'use strict';

const { genkit } = require('genkit');
const { googleAI } = require('@genkit-ai/google-genai');
const { enableFirebaseTelemetry } = require('@genkit-ai/firebase');

let telemetryEnabled = false;

function ensureTelemetry() {
  if (!telemetryEnabled) {
    enableFirebaseTelemetry();
    telemetryEnabled = true;
  }
}

function resolveGenaiApiKey() {
  return (
    String(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '').trim() ||
    null
  );
}

/** @param {{ model?: string }} [opts] */
function createAI(opts = {}) {
  const apiKey = resolveGenaiApiKey();
  if (!apiKey) {
    throw new Error(
      'GOOGLE_GENAI_API_KEY not configured. Run: firebase functions:secrets:set GOOGLE_GENAI_API_KEY'
    );
  }
  process.env.GOOGLE_GENAI_API_KEY = apiKey;
  ensureTelemetry();
  const modelName = opts.model || 'gemini-2.0-flash';
  return genkit({
    plugins: [googleAI({ apiKey })],
    model: googleAI.model(modelName),
  });
}

module.exports = { createAI, ensureTelemetry, resolveGenaiApiKey };
