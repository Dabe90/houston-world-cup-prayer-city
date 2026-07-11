'use strict';

/**
 * Email organizer a volunteer schedule grouped by date and time slot.
 *
 * Usage (from firebase/functions):
 *   node scripts/sendVolunteerSchedule.js
 *   node scripts/sendVolunteerSchedule.js --date "June 14, 2026"
 *   node scripts/sendVolunteerSchedule.js --to ddbs.htx@gmail.com
 *
 * Env: APPS_SCRIPT_SELF_SERVE_MAIL_URL, SELF_SERVE_MAIL_SECRET
 * Auth: GOOGLE_APPLICATION_CREDENTIALS or `firebase login` for Admin SDK
 */

const admin = require('firebase-admin');
const { buildScheduleGrid, buildScheduleEmail } = require('../volunteerScheduleReport');

const DEFAULT_TO = 'ddbs.htx@gmail.com';

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function parseArgs(argv) {
  const out = { to: DEFAULT_TO, date: '' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--to' && argv[i + 1]) {
      out.to = argv[++i];
    } else if (argv[i] === '--date' && argv[i + 1]) {
      out.date = argv[++i];
    }
  }
  return out;
}

async function loadVolunteers() {
  const onboardSnap = await admin.firestore().collection('volunteer_onboarding').get();
  const volunteers = [];

  for (const doc of onboardSnap.docs) {
    const email = normalizeEmail(doc.id);
    if (!email || !email.includes('@')) continue;

    const onboard = doc.data() || {};
    const merged = {
      email,
      name: String(onboard.name || '').trim(),
      phone: String(onboard.phone || '').trim(),
      shifts: String(onboard.shifts || '').trim(),
      tent: String(onboard.tent || '').trim(),
      position: String(onboard.position || '').trim(),
    };

    const volSnap = await admin
      .firestore()
      .collection('volunteers')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!volSnap.empty) {
      const v = volSnap.docs[0].data() || {};
      if (String(v.name || '').trim()) merged.name = v.name;
      if (String(v.phone || '').trim()) merged.phone = v.phone;
      if (String(v.shifts || '').trim()) merged.shifts = v.shifts;
      if (String(v.tent || '').trim()) merged.tent = v.tent;
      if (String(v.position || '').trim()) merged.position = v.position;
    }

    volunteers.push(merged);
  }

  return volunteers;
}

async function sendViaAppsScript(scriptUrl, secret, { to, subject, plainBody, htmlBody }) {
  const res = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'daily_volunteer_digest',
      secret,
      email: to,
      subject,
      plainBody,
      htmlBody,
    }),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { res, text, parsed };
}

async function main() {
  const args = parseArgs(process.argv);
  const scriptUrl = process.env.APPS_SCRIPT_SELF_SERVE_MAIL_URL || '';
  const secret = process.env.SELF_SERVE_MAIL_SECRET || '';

  if (!scriptUrl.trim() || !secret.trim()) {
    console.error('Set APPS_SCRIPT_SELF_SERVE_MAIL_URL and SELF_SERVE_MAIL_SECRET.');
    console.error('  firebase functions:secrets:access APPS_SCRIPT_SELF_SERVE_MAIL_URL');
    console.error('  firebase functions:secrets:access SELF_SERVE_MAIL_SECRET');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const volunteers = await loadVolunteers();
  const grid = buildScheduleGrid(volunteers);
  const email = buildScheduleEmail(grid, { filterDate: args.date });

  console.log('Volunteers loaded:', volunteers.length);
  console.log('Schedule stats:', email.stats);
  console.log('Sending to:', args.to);

  const { res, text, parsed } = await sendViaAppsScript(scriptUrl, secret, {
    to: normalizeEmail(args.to),
    subject: email.subject,
    plainBody: email.plainBody,
    htmlBody: email.htmlBody,
  });

  if (!res.ok || !parsed?.ok) {
    console.error('Mail failed:', res.status, text.slice(0, 500));
    process.exit(2);
  }

  console.log('Schedule email sent OK to', args.to);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
