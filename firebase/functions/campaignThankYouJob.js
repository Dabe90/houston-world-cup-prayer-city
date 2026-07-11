'use strict';

const { buildCampaignThankYouEmail } = require('./campaignThankYouEmail');
const { sendMailViaAppsScript } = require('./lib/mailTransport');
const { isEmailBlocked } = require('./emailBlocklist');
const { loadUndeliverableEmailSet, markEmailUndeliverable } = require('./emailUndeliverable');

const CAMPAIGN_ID = 'world_cup_prayer_city_2026';
const SETTINGS_DOC = 'settings/campaign_thank_you_2026';
const SENT_COLLECTION = 'campaign_thank_you_sent';

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/**
 * @param {import('firebase-admin')} admin
 * @param {{ scriptUrl: string, secret: string, dryRun?: boolean, force?: boolean }} opts
 */
async function runCampaignThankYouJob(admin, opts) {
  const scriptUrl = String(opts.scriptUrl || '').trim();
  const secret = String(opts.secret || '').trim();
  if (!scriptUrl || !secret) {
    return { sent: 0, skipped: 0, failed: 0, aborted: 'mail_not_configured' };
  }

  const settingsRef = admin.firestore().doc(SETTINGS_DOC);
  const settingsSnap = await settingsRef.get();
  const settings = settingsSnap.data() || {};

  if (settings.enabled !== true && opts.force !== true) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      aborted: 'disabled',
      message: `Enable Firestore ${SETTINGS_DOC} with enabled: true`,
    };
  }

  if (settings.completedAt && opts.force !== true) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      aborted: 'already_completed',
      completedAt: settings.completedAt,
    };
  }

  const dryRun = opts.dryRun === true || settings.dryRun === true;
  const undeliverableSet = await loadUndeliverableEmailSet(admin);
  const onboardSnap = await admin.firestore().collection('volunteer_onboarding').get();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of onboardSnap.docs) {
    const email = normalizeEmail(doc.id);
    if (!email || !email.includes('@')) {
      skipped++;
      continue;
    }

    const onboard = doc.data() || {};
    if (onboard.dailyDigestOptOut === true || onboard.emailUndeliverable === true) {
      skipped++;
      continue;
    }
    if (isEmailBlocked(email) || undeliverableSet.has(email)) {
      skipped++;
      continue;
    }

    const sentRef = admin.firestore().collection(SENT_COLLECTION).doc(email);
    const sentSnap = await sentRef.get();
    if (!dryRun && !opts.force && sentSnap.exists && sentSnap.data()?.campaignId === CAMPAIGN_ID) {
      skipped++;
      continue;
    }

    let name = String(onboard.name || '').trim();
    const volSnap = await admin.firestore().collection('volunteers').where('email', '==', email).limit(1).get();
    if (!volSnap.empty) {
      const v = volSnap.docs[0].data() || {};
      if (String(v.name || '').trim()) name = v.name;
      if (v.dailyDigestOptOut === true) {
        skipped++;
        continue;
      }
    }

    const content = buildCampaignThankYouEmail({ name });

    if (dryRun) {
      console.log('[campaignThankYou] dryRun', email, content.subject);
      continue;
    }

    const mailRes = await sendMailViaAppsScript({
      scriptUrl,
      secret,
      email,
      subject: content.subject,
      plainBody: content.plainBody,
      htmlBody: content.htmlBody,
    });

    if (!mailRes.ok) {
      if (mailRes.permanent) {
        await markEmailUndeliverable(admin, email, mailRes.error, 'campaign_thank_you');
      }
      failed++;
      console.error('[campaignThankYou] failed', email, mailRes.error);
      continue;
    }

    await sentRef.set(
      {
        campaignId: CAMPAIGN_ID,
        email,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    sent++;
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!dryRun && sent > 0) {
    await settingsRef.set(
      {
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRun: { sent, skipped, failed },
      },
      { merge: true }
    );
  }

  console.log(`[campaignThankYou] done sent=${sent} skipped=${skipped} failed=${failed} dryRun=${dryRun}`);
  return { campaignId: CAMPAIGN_ID, sent, skipped, failed, dryRun };
}

module.exports = { runCampaignThankYouJob, CAMPAIGN_ID, SETTINGS_DOC };
