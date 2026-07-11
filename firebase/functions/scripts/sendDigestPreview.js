'use strict';

/**
 * Send one digest preview email (does not mark volunteers as sent).
 *
 * Usage (from firebase/functions):
 *   set APPS_SCRIPT_SELF_SERVE_MAIL_URL=...
 *   set SELF_SERVE_MAIL_SECRET=...
 *   node scripts/sendDigestPreview.js
 *   node scripts/sendDigestPreview.js ddbs.htx@gmail.com
 */

const volunteerDailyDigest = require('../volunteerDailyDigest');

async function main() {
  const to = String(process.argv[2] || process.env.PREVIEW_EMAIL || 'ddbs.htx@gmail.com')
    .trim()
    .toLowerCase();
  const scriptUrl = String(process.env.APPS_SCRIPT_SELF_SERVE_MAIL_URL || '').trim();
  const secret = String(process.env.SELF_SERVE_MAIL_SECRET || '').trim();

  if (!scriptUrl || !secret) {
    console.error('Set APPS_SCRIPT_SELF_SERVE_MAIL_URL and SELF_SERVE_MAIL_SECRET.');
    process.exit(1);
  }

  const content = await volunteerDailyDigest.buildDailyVolunteerDigest({
    name: 'Damilola',
    email: to,
    previewDate: process.env.PREVIEW_DATE || undefined,
    shifts:
      'prayer partners counselor logistics and welfare photography and video social media',
    tent: 'Tent 1',
    siteBase: 'https://prayercityhtx.com/volunteer/',
    digestUnsubscribeSecret: secret,
    digestUnsubscribeBaseUrl:
      'https://us-central1-bible-study-dashboard-99f2d.cloudfunctions.net/volunteerDigestUnsubscribe',
    digestResubscribeBaseUrl:
      'https://us-central1-bible-study-dashboard-99f2d.cloudfunctions.net/volunteerDigestResubscribe',
  });

  if (!content) {
    console.error('Digest builder returned empty content.');
    process.exit(1);
  }

  const subject = `[PREVIEW] ${content.subject}`;
  const res = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'daily_volunteer_digest',
      secret,
      email: to,
      subject,
      plainBody: content.plainBody,
      htmlBody: content.htmlBody,
    }),
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_) {}

  if (!res.ok || !parsed?.ok) {
    console.error('Send failed', res.status, text);
    process.exit(1);
  }

  console.log('Preview sent to', to);
  console.log('Subject:', subject);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
