#!/usr/bin/env node
'use strict';

/**
 * Dry-run or send Nigeria unit meeting reminders.
 * Usage: node scripts/sendNigeriaMeetingReminders.js [--send] [--force]
 */
const admin = require('firebase-admin');

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  require('path').join(__dirname, '..', '..', '..', 'bible-study-dashboard-99f2d-firebase-adminsdk-fbsvc-acf38364bd.json');

if (!admin.apps.length) {
  try {
    admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
  } catch (e) {
    admin.initializeApp();
  }
}

const { runNigeriaMeetingRemindersJob } = require('../nigeriaMeetingReminders');

const args = process.argv.slice(2);
const dryRun = !args.includes('--send');
const force = args.includes('--force');

const scriptUrl = process.env.APPS_SCRIPT_SELF_SERVE_MAIL_URL || '';
const secret = process.env.SELF_SERVE_MAIL_SECRET || '';

runNigeriaMeetingRemindersJob(
  admin,
  { scriptUrl, secret },
  { dryRun, force: force || dryRun }
)
  .then((stats) => {
    console.log(JSON.stringify(stats, null, 2));
    process.exit(stats.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
