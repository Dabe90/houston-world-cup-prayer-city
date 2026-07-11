'use strict';

/**
 * Send campaign thank-you email to eligible volunteers.
 *
 * Usage (from firebase/functions):
 *   node scripts/sendCampaignThankYou.js --preview ddbs.htx@gmail.com
 *   node scripts/sendCampaignThankYou.js --dry-run
 *   node scripts/sendCampaignThankYou.js --live
 *   node scripts/sendCampaignThankYou.js --live --force
 *
 * Env: APPS_SCRIPT_SELF_SERVE_MAIL_URL, SELF_SERVE_MAIL_SECRET
 * Auth: service account JSON or firebase login
 */

const path = require('path');
const admin = require('firebase-admin');
const { buildCampaignThankYouEmail } = require('../campaignThankYouEmail');
const { runCampaignThankYouJob } = require('../campaignThankYouJob');
const { sendMailViaAppsScript } = require('../lib/mailTransport');

const serviceAccountPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'bible-study-dashboard-99f2d-firebase-adminsdk-fbsvc-acf38364bd.json'
);

function parseArgs(argv) {
  return {
    preview: argv.includes('--preview') ? String(argv[argv.indexOf('--preview') + 1] || 'ddbs.htx@gmail.com') : '',
    dryRun: argv.includes('--dry-run'),
    live: argv.includes('--live'),
    force: argv.includes('--force'),
    enable: argv.includes('--enable'),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const scriptUrl = process.env.APPS_SCRIPT_SELF_SERVE_MAIL_URL || '';
  const secret = process.env.SELF_SERVE_MAIL_SECRET || '';

  if (!scriptUrl.trim() || !secret.trim()) {
    console.error('Set APPS_SCRIPT_SELF_SERVE_MAIL_URL and SELF_SERVE_MAIL_SECRET.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath)),
      projectId: 'bible-study-dashboard-99f2d',
    });
  }

  if (args.enable) {
    await admin.firestore().doc('settings/campaign_thank_you_2026').set(
      {
        enabled: true,
        dryRun: false,
        scheduledFor: '2026-07-06T09:00:00 America/Chicago',
        note: 'Thank-you after World Cup Prayer City campaign',
      },
      { merge: true }
    );
    console.log('Enabled settings/campaign_thank_you_2026');
  }

  if (args.preview) {
    const content = buildCampaignThankYouEmail({ name: 'Damilola' });
    const mailRes = await sendMailViaAppsScript({
      scriptUrl,
      secret,
      email: args.preview.trim().toLowerCase(),
      subject: content.subject,
      plainBody: content.plainBody,
      htmlBody: content.htmlBody,
    });
    if (!mailRes.ok) {
      console.error('Preview failed:', mailRes.error);
      process.exit(2);
    }
    console.log('Preview sent to', args.preview);
    return;
  }

  if (!args.dryRun && !args.live) {
    console.error('Use --preview EMAIL, --dry-run, or --live');
    process.exit(1);
  }

  const stats = await runCampaignThankYouJob(admin, {
    scriptUrl,
    secret,
    dryRun: args.dryRun,
    force: args.force,
  });
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
