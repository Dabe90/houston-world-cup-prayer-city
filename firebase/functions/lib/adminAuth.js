'use strict';

const { HttpsError } = require('firebase-functions/v2/https');

const DIGEST_ADMIN_EMAILS = new Set([
  'ddbs.htx@gmail.com',
  'abuxberkeley@gmail.com',
]);

/** Coordinators — full access to ops tools and preview all regional dashboards. */
const SUPER_USER_EMAILS = DIGEST_ADMIN_EMAILS;

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function isDigestAdminEmail(email) {
  return DIGEST_ADMIN_EMAILS.has(normalizeEmail(email));
}

function isSuperUserEmail(email) {
  return SUPER_USER_EMAILS.has(normalizeEmail(email));
}

/** @param {import('firebase-functions/v2/https').CallableRequest} request */
function assertDigestAdmin(request) {
  const email = normalizeEmail(request.auth?.token?.email);
  if (!request.auth?.uid || !email) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  if (!isDigestAdminEmail(email)) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }
  return email;
}

/** @param {import('firebase-functions/v2/https').CallableRequest} request */
function assertSuperUser(request) {
  const email = normalizeEmail(request.auth?.token?.email);
  if (!request.auth?.uid || !email) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  if (!isSuperUserEmail(email)) {
    throw new HttpsError('permission-denied', 'Super-user access required.');
  }
  return email;
}

module.exports = {
  DIGEST_ADMIN_EMAILS,
  SUPER_USER_EMAILS,
  normalizeEmail,
  isDigestAdminEmail,
  isSuperUserEmail,
  assertDigestAdmin,
  assertSuperUser,
};
