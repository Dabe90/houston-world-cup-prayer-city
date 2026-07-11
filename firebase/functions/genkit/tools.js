'use strict';

const { z } = require('zod');
const { createAI } = require('./ai');
const { generateStructured } = require('./generateWithRetry');
const { buildDailyDigestSnapshot } = require('../lib/volunteerData');
const { sendMailViaAppsScript } = require('../lib/mailTransport');
const { loadUndeliverableEmailSet, markEmailUndeliverable } = require('../emailUndeliverable');
const { isEmailBlocked } = require('../emailBlocklist');
const { normalizeEmail } = require('../lib/adminAuth');

const ActionSchema = z.object({
  type: z.enum([
    'notify_volunteer',
    'notify_organizer',
    'flag_mismatch',
    'assign_tent_reminder',
    'schedule_gap',
    'no_action',
  ]),
  email: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
  suggestedSubject: z.string().optional(),
  suggestedPlainBody: z.string().optional(),
  autoSendSafe: z.boolean(),
  firestorePatch: z
    .object({
      intelligenceNotes: z.string().optional(),
      coordinatorFlag: z.string().optional(),
    })
    .optional(),
});

const AnalysisSchema = z.object({
  summary: z.string(),
  opportunities: z.array(z.string()),
  mismatches: z.array(z.string()),
  risks: z.array(z.string()),
  recommendedFocus: z.array(z.string()),
});

/**
 * @param {import('firebase-admin')} admin
 * @param {{ mail?: { scriptUrl: string, secret: string }, model?: string }} ctx
 */
function createDigestIntelligenceTools(admin, ctx = {}) {
  const mailCfg = ctx.mail || { scriptUrl: '', secret: '' };

  async function readDailyDigest(input) {
    const ymd = input?.ymd;
    const settingsSnap = await admin.firestore().doc('settings/volunteer_daily_digest').get();
    const digestSettings = settingsSnap.data() || {};
    const snapshot = await buildDailyDigestSnapshot(admin, {
      ymd,
      siteBase: digestSettings.siteBase,
    });
    return {
      ok: true,
      ymd: snapshot.ymd,
      serveDateLabel: snapshot.serveDateLabel,
      totals: snapshot.totals,
      unscheduled: snapshot.unscheduled.slice(0, 40),
      scheduledToday: snapshot.scheduledToday,
      digestRows: snapshot.digestRows.map((r) => ({
        email: r.email,
        name: r.name,
        tent: r.tent,
        hasDigestToday: r.hasDigestToday,
        digestSubject: r.digestSubject,
        roleIds: r.roleIds,
        blocked: r.blocked,
        shiftsPreview: String(r.shifts || '').slice(0, 240),
      })),
    };
  }

  async function analyzeDigestWithAI(input) {
    const snapshot = input?.snapshot || (await readDailyDigest({ ymd: input?.ymd }));
    const prompt = [
      'You are the Prayer City volunteer operations analyst.',
      'Review the daily digest snapshot JSON and identify:',
      '- opportunities (gaps we can fill, roles needing reinforcement)',
      '- mismatches (tent/shift/role inconsistencies)',
      '- risks (unscheduled volunteers near serve day, blocked emails, empty tents)',
      'Be concrete and actionable. Do not invent volunteers not in the data.',
      '',
      'SNAPSHOT JSON:',
      JSON.stringify(snapshot).slice(0, 120000),
    ].join('\n');

    const result = await generateStructured({
      prompt,
      schema: AnalysisSchema,
      model: ctx.model,
    });

    return {
      ok: true,
      ymd: snapshot.ymd,
      analysis: result.output,
      modelUsed: result.modelUsed,
    };
  }

  async function suggestVolunteerActions(input) {
    const snapshot = input?.snapshot;
    const analysis = input?.analysis;
    if (!snapshot || !analysis) {
      throw new Error('snapshot and analysis required');
    }

    const prompt = [
      'Based on the Prayer City digest snapshot and analysis, suggest up to 8 actions.',
      'Rules:',
      '- notify_volunteer: only for specific volunteers in snapshot; include subject + plain body under 120 words.',
      '- autoSendSafe=true ONLY for polite reminders (tent, shift time, hub link). Never true for sensitive corrections.',
      '- flag_mismatch / schedule_gap: set firestorePatch.coordinatorFlag when ops should review.',
      '- Do not suggest email to blocked volunteers.',
      '',
      'SNAPSHOT:',
      JSON.stringify(snapshot).slice(0, 80000),
      '',
      'ANALYSIS:',
      JSON.stringify(analysis),
    ].join('\n');

    const result = await generateStructured({
      prompt,
      schema: z.object({
        actions: z.array(ActionSchema).max(8),
      }),
      model: ctx.model,
    });

    const undeliverableSet = await loadUndeliverableEmailSet(admin);
    const actions = (result.output?.actions || []).filter((a) => {
      if (!a.email) return true;
      const e = normalizeEmail(a.email);
      if (!e) return false;
      if (isEmailBlocked(e) || undeliverableSet.has(e)) return false;
      return true;
    });

    return { ok: true, actions, modelUsed: result.modelUsed };
  }

  async function sendSmartNotifications(input) {
    const dryRun = input?.dryRun !== false;
    const actions = input?.actions || [];
    const maxSend = Math.min(Number(input?.maxSend) || 5, 10);
    const sent = [];
    const skipped = [];

    for (const action of actions) {
      if (action.type !== 'notify_volunteer' || !action.email) {
        skipped.push({ action, reason: 'not_a_volunteer_notify' });
        continue;
      }
      if (!action.autoSendSafe) {
        skipped.push({ action, reason: 'not_auto_send_safe' });
        continue;
      }
      if (!action.suggestedSubject || !action.suggestedPlainBody) {
        skipped.push({ action, reason: 'missing_copy' });
        continue;
      }
      if (sent.length >= maxSend) {
        skipped.push({ action, reason: 'max_send_reached' });
        continue;
      }

      if (dryRun) {
        sent.push({ email: action.email, dryRun: true, subject: action.suggestedSubject });
        continue;
      }

      const mailRes = await sendMailViaAppsScript({
        scriptUrl: mailCfg.scriptUrl,
        secret: mailCfg.secret,
        email: action.email,
        subject: action.suggestedSubject,
        plainBody: action.suggestedPlainBody,
        htmlBody: `<p>${String(action.suggestedPlainBody).replace(/\n/g, '<br>')}</p>`,
      });

      if (!mailRes.ok) {
        if (mailRes.permanent) {
          await markEmailUndeliverable(admin, action.email, mailRes.error, 'digest_intelligence');
        }
        skipped.push({ action, reason: mailRes.error || 'send_failed' });
        continue;
      }

      sent.push({ email: action.email, dryRun: false, subject: action.suggestedSubject });
    }

    return { ok: true, dryRun, sent, skipped };
  }

  async function updateVolunteerFirestore(input) {
    const actions = input?.actions || [];
    const runId = String(input?.runId || '').trim();
    const updated = [];
    const errors = [];

    for (const action of actions) {
      const patch = action.firestorePatch;
      const email = normalizeEmail(action.email);
      if (!patch || !email) continue;

      const docPatch = {
        intelligenceUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (patch.intelligenceNotes) {
        docPatch.intelligenceNotes = String(patch.intelligenceNotes).slice(0, 2000);
      }
      if (patch.coordinatorFlag) {
        docPatch[`coordinatorFlags.${patch.coordinatorFlag}`] = {
          at: new Date().toISOString(),
          runId,
          reason: String(action.reason || '').slice(0, 500),
        };
      }
      if (runId) docPatch.lastIntelligenceRunId = runId;

      try {
        await admin.firestore().collection('volunteer_onboarding').doc(email).set(docPatch, { merge: true });
        const vq = await admin.firestore().collection('volunteers').where('email', '==', email).limit(3).get();
        await Promise.all(vq.docs.map((d) => d.ref.set(docPatch, { merge: true })));
        updated.push({ email, fields: Object.keys(docPatch) });
      } catch (e) {
        errors.push({ email, error: String(e.message || e) });
      }
    }

    return { ok: errors.length === 0, updated, errors };
  }

  const ai = createAI({ model: ctx.model });

  const readDailyDigestTool = ai.defineTool(
    {
      name: 'readDailyDigest',
      description: 'Load today volunteer digest + schedule snapshot from Firestore (Prayer City ops data).',
      inputSchema: z.object({ ymd: z.string().optional() }),
      outputSchema: z.object({ ok: z.boolean(), ymd: z.string() }).passthrough(),
    },
    readDailyDigest
  );

  const analyzeDigestWithAITool = ai.defineTool(
    {
      name: 'analyzeDigestWithAI',
      description: 'Analyze digest snapshot for opportunities, mismatches, and risks.',
      inputSchema: z.object({
        ymd: z.string().optional(),
        snapshot: z.any().optional(),
      }),
      outputSchema: z.object({ ok: z.boolean() }).passthrough(),
    },
    analyzeDigestWithAI
  );

  const suggestVolunteerActionsTool = ai.defineTool(
    {
      name: 'suggestVolunteerActions',
      description: 'Suggest concrete volunteer coordinator actions from analysis.',
      inputSchema: z.object({
        snapshot: z.any(),
        analysis: z.any(),
      }),
      outputSchema: z.object({ ok: z.boolean(), actions: z.array(ActionSchema) }),
    },
    suggestVolunteerActions
  );

  const sendSmartNotificationsTool = ai.defineTool(
    {
      name: 'sendSmartNotifications',
      description: 'Send safe auto-approved volunteer emails via Gmail Apps Script bridge.',
      inputSchema: z.object({
        actions: z.array(ActionSchema),
        dryRun: z.boolean().optional(),
        maxSend: z.number().optional(),
      }),
      outputSchema: z.object({ ok: z.boolean() }).passthrough(),
    },
    sendSmartNotifications
  );

  const updateVolunteerFirestoreTool = ai.defineTool(
    {
      name: 'updateVolunteerFirestore',
      description: 'Persist intelligence notes and coordinator flags on volunteer records.',
      inputSchema: z.object({
        actions: z.array(ActionSchema),
        runId: z.string().optional(),
      }),
      outputSchema: z.object({ ok: z.boolean() }).passthrough(),
    },
    updateVolunteerFirestore
  );

  return {
    ai,
    implementations: {
      readDailyDigest,
      analyzeDigestWithAI,
      suggestVolunteerActions,
      sendSmartNotifications,
      updateVolunteerFirestore,
    },
    tools: {
      readDailyDigestTool,
      analyzeDigestWithAITool,
      suggestVolunteerActionsTool,
      sendSmartNotificationsTool,
      updateVolunteerFirestoreTool,
    },
    ActionSchema,
    AnalysisSchema,
  };
}

module.exports = { createDigestIntelligenceTools };
