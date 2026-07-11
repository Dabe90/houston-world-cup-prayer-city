'use strict';

const { createAI } = require('./ai');

/** "-latest" alias tracks the current available flash model; keep dated ones as fallback. */
const DEFAULT_MODEL_CHAIN = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

const MAX_ATTEMPTS_PER_MODEL = 3;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function errorText(err) {
  return String(err?.message || err?.statusMessage || err || '');
}

/** @param {unknown} err */
function isRetryableGeminiError(err) {
  const msg = errorText(err).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('resource_exhausted') ||
    msg.includes('overloaded') ||
    msg.includes('deadline exceeded') ||
    msg.includes('internal error') ||
    msg.includes('[500')
  );
}

/**
 * @param {{ prompt: string, schema: import('zod').ZodTypeAny, model?: string, models?: string[] }} opts
 */
async function generateStructured(opts) {
  const preferred = String(opts.model || '').trim();
  const chain = opts.models?.length
    ? opts.models.slice()
    : preferred
      ? [preferred, ...DEFAULT_MODEL_CHAIN.filter((m) => m !== preferred)]
      : DEFAULT_MODEL_CHAIN.slice();

  let lastErr = null;

  for (const modelName of chain) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const ai = createAI({ model: modelName });
        const result = await ai.generate({
          prompt: opts.prompt,
          output: { schema: opts.schema },
        });
        return {
          output: result.output,
          modelUsed: modelName,
          attempts: attempt + 1,
        };
      } catch (err) {
        lastErr = err;
        const retryable = isRetryableGeminiError(err);
        console.warn(
          `[generateStructured] ${modelName} attempt ${attempt + 1}/${MAX_ATTEMPTS_PER_MODEL} failed:`,
          errorText(err).slice(0, 200)
        );
        if (!retryable) break;
        if (attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
          await sleep(Math.min(12000, 1500 * Math.pow(2, attempt)));
        }
      }
    }
  }

  throw lastErr || new Error('Gemini generate failed after retries and model fallbacks.');
}

module.exports = {
  generateStructured,
  DEFAULT_MODEL_CHAIN,
  isRetryableGeminiError,
};
