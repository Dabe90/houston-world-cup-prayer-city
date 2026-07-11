'use strict';

const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { assertDigestAdmin } = require('../lib/adminAuth');
const { runDigestIntelligencePipeline } = require('./digestIntelligenceFlow');

const googleGenaiApiKey = defineSecret('GOOGLE_GENAI_API_KEY');
const selfServeMailSecret = defineSecret('SELF_SERVE_MAIL_SECRET');
const appsScriptSelfServeMailUrl = defineSecret('APPS_SCRIPT_SELF_SERVE_MAIL_URL');

const digestIntelligenceSecrets = [
  googleGenaiApiKey,
  selfServeMailSecret,
  appsScriptSelfServeMailUrl,
];

/**
 * @param {import('firebase-admin')} admin
 */
function registerDigestIntelligenceExports(admin) {
  function mailCtx() {
    return {
      scriptUrl: appsScriptSelfServeMailUrl.value(),
      secret: selfServeMailSecret.value(),
    };
  }

  async function runPipeline(input, triggeredBy) {
    process.env.GOOGLE_GENAI_API_KEY = googleGenaiApiKey.value();
    return runDigestIntelligencePipeline(
      admin,
      { ...input, triggeredBy },
      { mail: mailCtx(), triggeredBy }
    );
  }

  const runDigestIntelligenceNow = onCall(
    {
      cors: true,
      timeoutSeconds: 540,
      memory: '1GiB',
      secrets: digestIntelligenceSecrets,
    },
    async (request) => {
      const adminEmail = assertDigestAdmin(request);
      const data = request.data || {};
      try {
        return await runPipeline(
          {
            ymd: data.ymd,
            dryRun: data.dryRun,
            autoSend: data.autoSend,
            triggeredBy: `callable:${adminEmail}`,
          },
          `callable:${adminEmail}`
        );
      } catch (e) {
        const { HttpsError } = require('firebase-functions/v2/https');
        throw new HttpsError('internal', String(e.message || e));
      }
    }
  );

  const scheduledDigestIntelligence = onSchedule(
    {
      schedule: '30 8 * * *',
      timeZone: 'America/Chicago',
      timeoutSeconds: 540,
      memory: '1GiB',
      secrets: digestIntelligenceSecrets,
    },
    async () => {
      try {
        await runPipeline({ triggeredBy: 'schedule' }, 'schedule');
      } catch (e) {
        console.error('[scheduledDigestIntelligence]', e);
      }
    }
  );

  const runDigestIntelligenceHttp = onRequest(
    {
      timeoutSeconds: 540,
      memory: '1GiB',
      secrets: digestIntelligenceSecrets,
    },
    async (req, res) => {
      const provided = String(req.query.secret || req.get('x-digest-secret') || '').trim();
      const secret = selfServeMailSecret.value();
      if (!provided || provided !== secret) {
        res.status(403).send('forbidden');
        return;
      }
      try {
        const result = await runPipeline(
          {
            ymd: String(req.query.ymd || '').trim() || undefined,
            dryRun: req.query.dryRun !== 'false',
            autoSend: req.query.autoSend === 'true',
            triggeredBy: 'http_secret',
          },
          'http_secret'
        );
        res.json(result);
      } catch (e) {
        console.error('[runDigestIntelligenceHttp]', e);
        res.status(500).json({ ok: false, error: String(e.message || e) });
      }
    }
  );

  return {
    runDigestIntelligenceNow,
    scheduledDigestIntelligence,
    runDigestIntelligenceHttp,
  };
}

module.exports = { registerDigestIntelligenceExports };
