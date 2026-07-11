'use strict';

/**
 * Seed Firestore settings for the Daily Digest Intelligence Agent.
 *
 * Usage (from firebase/functions):
 *   node scripts/enableDigestIntelligence.js
 *   node scripts/enableDigestIntelligence.js --auto-send
 */

const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'bible-study-dashboard-99f2d-firebase-adminsdk-fbsvc-acf38364bd.json'
);

async function main() {
  const autoSend = process.argv.includes('--auto-send');
  const dryRun = !process.argv.includes('--live');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath)),
      projectId: 'bible-study-dashboard-99f2d',
    });
  }

  const db = admin.firestore();
  await db.doc('settings/digest_intelligence').set(
    {
      enabled: true,
      dryRun,
      autoSend,
      maxAutoSend: 5,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      notes:
        'dryRun=true logs actions without mail. autoSend=true sends only autoSendSafe reminders via Apps Script.',
    },
    { merge: true }
  );

  console.log('Wrote settings/digest_intelligence:', { enabled: true, dryRun, autoSend });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
