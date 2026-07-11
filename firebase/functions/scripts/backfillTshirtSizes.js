'use strict';

/**
 * One-time: push saved shirtSize from Firestore to Google Sheet column K.
 *
 * Prerequisites:
 * 1. PrayerCityFormPipeline.gs deployed as web app (volunteer_tshirt_size handler live).
 * 2. GOOGLE_APPLICATION_CREDENTIALS or `firebase login` for admin SDK.
 * 3. Env: APPS_SCRIPT_SELF_SERVE_MAIL_URL, SELF_SERVE_MAIL_SECRET
 *
 * Usage (from firebase/functions):
 *   node scripts/backfillTshirtSizes.js
 */

const admin = require('firebase-admin');

const TSHIRT_SIZES = new Set(['S', 'M', 'L', 'X']);

function normalizeShirtSize(raw) {
  let s = String(raw || '')
    .trim()
    .toUpperCase();
  if (s === 'XL') s = 'X';
  return s;
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

async function postTshirtSize(scriptUrl, secret, { email, name, shirtSize }) {
  async function post(body) {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch (_) {}
    return { res, text, parsed };
  }

  let result = await post({
    type: 'volunteer_tshirt_size',
    secret,
    email,
    name,
    shirtSize,
  });
  if (result.parsed.error === 'bad_type') {
    result = await post({
      type: 'volunteer_sheet_update',
      secret,
      email,
      name,
      shirtSize,
    });
  }
  return result;
}

async function main() {
  const scriptUrl = process.env.APPS_SCRIPT_SELF_SERVE_MAIL_URL || '';
  const secret = process.env.SELF_SERVE_MAIL_SECRET || '';
  if (!scriptUrl.trim() || !secret.trim()) {
    console.error(
      'Set APPS_SCRIPT_SELF_SERVE_MAIL_URL and SELF_SERVE_MAIL_SECRET env vars.'
    );
    console.error(
      '  firebase functions:secrets:access APPS_SCRIPT_SELF_SERVE_MAIL_URL'
    );
    console.error('  firebase functions:secrets:access SELF_SERVE_MAIL_SECRET');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const snap = await admin.firestore().collection('volunteers').get();
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const vol = doc.data() || {};
    const shirtSize = normalizeShirtSize(vol.shirtSize);
    if (!TSHIRT_SIZES.has(shirtSize)) {
      skipped++;
      continue;
    }
    const email = normalizeEmail(vol.email || '');
    if (!email) {
      skipped++;
      continue;
    }

    const name = String(vol.name || '').trim();
    const { res, text, parsed } = await postTshirtSize(scriptUrl, secret, {
      email,
      name,
      shirtSize,
    });

    if (!res.ok || !parsed.ok) {
      console.error('FAIL', email, shirtSize, parsed.error || text);
      failed++;
      if (parsed.error === 'bad_type' || parsed.error === 'nothing_to_update') {
        console.error(
          'Apps Script missing T-shirt support — update handleVolunteerSheetUpdate_ in Apps Script, save, Deploy → New version on deployment AKfycbxGlb1bztkLFoJg...'
        );
        process.exit(2);
      }
      continue;
    }

    await doc.ref.set(
      {
        shirtSizeNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        shirtSizeNotifiedValue: shirtSize,
      },
      { merge: true }
    );
    console.log('OK', email, shirtSize, 'row', parsed.sheetRow || 0);
    synced++;
  }

  console.log({ synced, skipped, failed, total: snap.size });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
