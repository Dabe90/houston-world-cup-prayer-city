'use strict';

const { isEmailBlocked, classifyDeliveryError } = require('./emailBlocklist');

const COLLECTION = 'email_undeliverable';

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/**
 * Gmail / Apps Script errors that mean the address should never be mailed again.
 * @returns {'permanent'|'temporary'}
 */
function classifyDeliveryErrorMsg(errMsg) {
  return classifyDeliveryError(errMsg);
}

function isPermanentDeliveryError(errMsg) {
  return classifyDeliveryError(errMsg) === 'permanent';
}

/**
 * Mark an address as undeliverable in Firestore and opt out of daily digest.
 * @param {import('firebase-admin')} admin
 */
async function markEmailUndeliverable(admin, email, reason, source) {
  const e = normalizeEmail(email);
  if (!e || !e.includes('@')) return false;

  const db = admin.firestore();
  const patch = {
    email: e,
    reason: String(reason || 'undeliverable').slice(0, 500),
    source: String(source || 'system').slice(0, 120),
    markedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection(COLLECTION).doc(e).set(patch, { merge: true });

  const optOut = {
    emailUndeliverable: true,
    dailyDigestOptOut: true,
    dailyDigestOptOutReason: 'undeliverable',
    dailyDigestOptOutAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('volunteer_onboarding').doc(e).set(optOut, { merge: true });

  const vq = await db.collection('volunteers').where('email', '==', e).get();
  await Promise.all(vq.docs.map((d) => d.ref.set(optOut, { merge: true })));

  return true;
}

async function isEmailUndeliverable(admin, email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (isEmailBlocked(e)) return true;

  const snap = await admin.firestore().collection(COLLECTION).doc(e).get();
  return snap.exists;
}

/** @returns {Promise<Set<string>>} */
async function loadUndeliverableEmailSet(admin) {
  const set = new Set();
  const snap = await admin.firestore().collection(COLLECTION).get();
  snap.docs.forEach((d) => {
    const id = normalizeEmail(d.id);
    if (id) set.add(id);
  });
  return set;
}

module.exports = {
  COLLECTION,
  normalizeEmail,
  classifyDeliveryErrorMsg,
  isPermanentDeliveryError,
  markEmailUndeliverable,
  isEmailUndeliverable,
  loadUndeliverableEmailSet,
};
