'use strict';

const { z } = require('zod');
const { createDigestIntelligenceTools } = require('./tools');

const DEFAULT_MAX_AUTO_SEND = 5;

/**
 * @param {import('firebase-admin')} admin
 * @param {{
 *   mail?: { scriptUrl: string, secret: string },
 *   model?: string,
 *   runId?: string,
 *   triggeredBy?: string,
 * }} ctx
 */
async function runDigestIntelligencePipeline(admin, input = {}, ctx = {}) {
  const runId =
    ctx.runId ||
    `dir_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const triggeredBy = ctx.triggeredBy || input.triggeredBy || 'unknown';
  const settingsSnap = await admin.firestore().doc('settings/digest_intelligence').get();
  const intelSettings = settingsSnap.data() || {};
  const digestSettingsSnap = await admin
    .firestore()
    .doc('settings/volunteer_daily_digest')
    .get();
  const digestSettings = digestSettingsSnap.data() || {};

  if (intelSettings.enabled !== true) {
    return {
      ok: false,
      aborted: 'disabled',
      runId,
      message: 'Create Firestore settings/digest_intelligence with enabled: true',
    };
  }

  const dryRun =
    input.dryRun !== undefined
      ? input.dryRun === true
      : intelSettings.dryRun !== false;
  const autoSend =
    input.autoSend !== undefined
      ? input.autoSend === true
      : intelSettings.autoSend === true;

  const tools = createDigestIntelligenceTools(admin, ctx);
  const { implementations } = tools;
  const runRef = admin.firestore().collection('digest_intelligence_runs').doc(runId);
  const startedAt = admin.firestore.FieldValue.serverTimestamp();

  await runRef.set({
    runId,
    status: 'running',
    triggeredBy,
    dryRun,
    autoSend,
    startedAt,
    ymd: input.ymd || null,
  });

  let snapshot = null;
  let analysis = null;
  let actions = [];
  let sendResult = null;
  let firestoreResult = null;
  let errorMessage = '';

  try {
    snapshot = await implementations.readDailyDigest({
      ymd: input.ymd,
    });

    const analysisRes = await implementations.analyzeDigestWithAI({
      snapshot,
    });
    analysis = analysisRes.analysis;

    const actionsRes = await implementations.suggestVolunteerActions({
      snapshot,
      analysis,
    });
    actions = actionsRes.actions || [];

    firestoreResult = await implementations.updateVolunteerFirestore({
      actions,
      runId,
    });

    const shouldSend = autoSend && !dryRun;
    sendResult = await implementations.sendSmartNotifications({
      actions,
      dryRun: !shouldSend,
      maxSend: intelSettings.maxAutoSend || DEFAULT_MAX_AUTO_SEND,
    });

    const completed = {
      runId,
      status: 'completed',
      triggeredBy,
      ymd: snapshot.ymd,
      serveDateLabel: snapshot.serveDateLabel,
      dryRun,
      autoSend,
      totals: snapshot.totals,
      analysis,
      actions,
      sendResult,
      firestoreResult,
      digestSiteBase: digestSettings.siteBase || snapshot.siteBase,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await runRef.set(completed, { merge: true });

    return {
      ok: true,
      runId,
      ymd: snapshot.ymd,
      serveDateLabel: snapshot.serveDateLabel,
      summary: analysis?.summary || '',
      opportunities: analysis?.opportunities || [],
      mismatches: analysis?.mismatches || [],
      risks: analysis?.risks || [],
      actionsCount: actions.length,
      sentCount: (sendResult?.sent || []).length,
      dryRun: sendResult?.dryRun !== false,
      autoSend,
      sendResult,
      firestoreResult,
    };
  } catch (e) {
    errorMessage = String(e.message || e);
    console.error('[digestIntelligence]', runId, e);
    await runRef.set(
      {
        status: 'failed',
        error: errorMessage.slice(0, 2000),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        partial: {
          ymd: snapshot?.ymd,
          analysis,
          actionsCount: actions.length,
        },
      },
      { merge: true }
    );
    throw e;
  }
}

/**
 * @param {import('firebase-admin')} admin
 * @param {{ mail?: { scriptUrl: string, secret: string }, model?: string }} ctx
 */
function createDigestIntelligenceFlow(admin, ctx = {}) {
  const { ai } = createDigestIntelligenceTools(admin, ctx);

  const dailyDigestIntelligenceFlow = ai.defineFlow(
    {
      name: 'dailyDigestIntelligence',
      inputSchema: z.object({
        ymd: z.string().optional(),
        dryRun: z.boolean().optional(),
        autoSend: z.boolean().optional(),
        triggeredBy: z.string().optional(),
      }),
      outputSchema: z
        .object({
          ok: z.boolean(),
          runId: z.string(),
          ymd: z.string().optional(),
          summary: z.string().optional(),
          actionsCount: z.number().optional(),
          sentCount: z.number().optional(),
          dryRun: z.boolean().optional(),
        })
        .passthrough(),
    },
    async (input) => {
      const runId = `dir_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      return runDigestIntelligencePipeline(admin, input, {
        ...ctx,
        runId,
        triggeredBy: input.triggeredBy || 'callable_flow',
      });
    }
  );

  return dailyDigestIntelligenceFlow;
}

module.exports = {
  runDigestIntelligencePipeline,
  createDigestIntelligenceFlow,
  DEFAULT_MAX_AUTO_SEND,
};
