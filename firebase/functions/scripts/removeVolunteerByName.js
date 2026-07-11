'use strict';

/**
 * Remove volunteer(s) from Firestore by first + last name (case-insensitive).
 * Usage: node scripts/removeVolunteerByName.js Ellen Wright
 */
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

async function removeVolunteerByEmail(email) {
  const e = norm(email);
  if (!e || !e.includes('@')) return null;

  let onboardingDeleted = false;
  const onboardRef = db.collection('volunteer_onboarding').doc(e);
  if ((await onboardRef.get()).exists) {
    await onboardRef.delete();
    onboardingDeleted = true;
  }

  const volSnap = await db.collection('volunteers').where('email', '==', e).get();
  let directoryDeleted = 0;
  for (const doc of volSnap.docs) {
    const dirRef = db.collection('volunteer_directory').doc(doc.id);
    if ((await dirRef.get()).exists) {
      await dirRef.delete();
      directoryDeleted++;
    }
    await doc.ref.delete();
  }

  const digestRef = db.collection('volunteer_daily_digest_sent').doc(e);
  if ((await digestRef.get()).exists) {
    await digestRef.delete();
  }

  return { email: e, onboardingDeleted, volunteersRemoved: volSnap.size, directoryDeleted };
}

async function main() {
  const first = norm(process.argv[2]);
  const last = norm(process.argv[3]);
  if (!first || !last) {
    console.error('Usage: node scripts/removeVolunteerByName.js <First> <Last>');
    process.exit(1);
  }

  const matches = [];
  const volSnap = await db.collection('volunteers').get();
  volSnap.docs.forEach((doc) => {
    const d = doc.data() || {};
    const name = norm(d.name);
    const parts = name.split(/\s+/).filter(Boolean);
    const f = parts[0] || '';
    const l = parts.slice(1).join(' ') || '';
    if (f === first && l === last) {
      matches.push({ uid: doc.id, email: norm(d.email), name: d.name });
    }
  });

  const onboardSnap = await db.collection('volunteer_onboarding').get();
  onboardSnap.docs.forEach((doc) => {
    const d = doc.data() || {};
    const name = norm(d.name);
    const parts = name.split(/\s+/).filter(Boolean);
    const f = parts[0] || '';
    const l = parts.slice(1).join(' ') || '';
    const email = norm(doc.id);
    if (f === first && l === last && !matches.some((m) => m.email === email)) {
      matches.push({ uid: null, email, name: d.name || doc.id });
    }
  });

  const dirSnap = await db.collection('volunteer_directory').get();
  dirSnap.docs.forEach((doc) => {
    const d = doc.data() || {};
    const name = norm(d.name);
    const parts = name.split(/\s+/).filter(Boolean);
    const f = parts[0] || '';
    const l = parts.slice(1).join(' ') || '';
    if (f === first && l === last && !matches.some((m) => m.uid === doc.id)) {
      matches.push({ uid: doc.id, email: norm(d.email), name: d.name });
    }
  });

  if (!matches.length) {
    console.log('No matches for', first, last);
    process.exit(0);
  }

  const emails = [...new Set(matches.map((m) => m.email).filter(Boolean))];
  for (const email of emails) {
    const r = await removeVolunteerByEmail(email);
    console.log('Removed:', r);
  }

  for (const m of matches) {
    if (m.uid) {
      const dirRef = db.collection('volunteer_directory').doc(m.uid);
      if ((await dirRef.get()).exists) {
        await dirRef.delete();
        console.log('Deleted directory doc', m.uid);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
