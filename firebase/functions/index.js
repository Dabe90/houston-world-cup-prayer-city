'use strict';

const crypto = require('crypto');
const express = require('express');
const { onRequest } = require('firebase-functions/v2/https');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const volunteerDailyDigest = require('./volunteerDailyDigest');
const { runCampaignThankYouJob } = require('./campaignThankYouJob');
const { buildScheduleGrid, buildScheduleEmail } = require('./volunteerScheduleReport');
const { isEmailBlocked } = require('./emailBlocklist');
const {
  markEmailUndeliverable,
  isEmailUndeliverable,
  loadUndeliverableEmailSet,
  isPermanentDeliveryError,
} = require('./emailUndeliverable');
const nigeriaVolunteer = require('./nigeriaVolunteer');
const { runNigeriaMeetingRemindersJob } = require('./nigeriaMeetingReminders');
const { runNigeriaPostMeetingDigestJob } = require('./nigeriaPostMeetingDigest');

const inviteSecret = defineSecret('INVITE_SECRET');
const selfServeMailSecret = defineSecret('SELF_SERVE_MAIL_SECRET');
const appsScriptSelfServeMailUrl = defineSecret('APPS_SCRIPT_SELF_SERVE_MAIL_URL');

/** Must match where users land after clicking the email link (your live dashboard URL). */
const SIGNIN_CONTINUE_URL = 'https://prayercityhtx.com/';

function resolveSignInContinueUrl(raw) {
  const fallback = SIGNIN_CONTINUE_URL;
  const input = String(raw || '').trim();
  if (!input) return fallback;
  try {
    const u = new URL(input);
    const host = u.hostname.toLowerCase();
    if (host !== 'prayercityhtx.com' && host !== 'www.prayercityhtx.com') {
      return fallback;
    }
    // Normalize www → apex so Firebase authorized domains stay consistent.
    u.protocol = 'https:';
    u.hostname = 'prayercityhtx.com';
    u.hash = '';
    // Only allow known site paths (never arbitrary open redirect).
    const path = u.pathname || '/';
    if (
      path === '/' ||
      path === '/index.html' ||
      path === '/ddbs-nig.html' ||
      path === '/volunteer-hub.html' ||
      path.startsWith('/volunteer/')
    ) {
      return u.origin + (path === '/index.html' ? '/' : path);
    }
    return fallback;
  } catch (e) {
    return fallback;
  }
}

setGlobalOptions({ region: 'us-central1' });

admin.initializeApp();

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/**
 * POST from Google Apps Script:
 * Header: X-Invite-Secret: (value from firebase functions:secrets:set INVITE_SECRET)
 * Body JSON: { email, name?, phone?, notes?, shifts?, sheetRowId? }
 * Response: { ok: true, signInLink }
 */
const inviteApp = express();
inviteApp.use(express.json({ limit: '256kb' }));

inviteApp.post('/', async (req, res) => {
  const sent = req.get('x-invite-secret');
  if (!sent || sent !== inviteSecret.value()) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body || {};
  const email = normalizeEmail(body.email);
  if (!email) {
    res.status(400).json({ error: 'email required' });
    return;
  }
  if (isEmailBlocked(email)) {
    res.status(403).json({ error: 'blocked', message: 'This address is not eligible for mail.' });
    return;
  }
  if (await isEmailUndeliverable(admin, email)) {
    res.status(403).json({
      error: 'undeliverable',
      message: 'This address cannot receive mail (delivery failed).',
    });
    return;
  }

  const actionCodeSettings = {
    url: SIGNIN_CONTINUE_URL,
    handleCodeInApp: true,
  };

  try {
    await admin
      .firestore()
      .collection('volunteer_onboarding')
      .doc(email)
      .set(
        {
          email,
          name: body.name || '',
          phone: body.phone || '',
          notes: body.notes || '',
          shifts: body.shifts || '',
          sheetRowId: body.sheetRowId || '',
          tent: body.tent || '',
          timeslot: body.timeslot || '',
          position: body.position || '',
          invitedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    const signInLink = await admin
      .auth()
      .generateSignInWithEmailLink(email, actionCodeSettings);

    res.json({ ok: true, signInLink });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'invite failed' });
  }
});

exports.invVolunteer = onRequest(
  {
    cors: true,
    secrets: [inviteSecret],
    invoker: 'public',
  },
  inviteApp
);

/** POST from Apps Script when Gmail reports a bounce / bad address. */
const undeliverableApp = express();
undeliverableApp.use(express.json({ limit: '64kb' }));

undeliverableApp.post('/', async (req, res) => {
  const body = req.body || {};
  const secret = String(body.secret || req.get('x-mail-secret') || '');
  if (!secret || secret !== selfServeMailSecret.value()) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const emails = Array.isArray(body.emails) ? body.emails : [body.email];
  const reason = String(body.reason || 'gmail bounce').slice(0, 500);
  const source = String(body.source || 'apps_script').slice(0, 120);
  let marked = 0;

  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email || !email.includes('@')) continue;
    try {
      await markEmailUndeliverable(admin, email, reason, source);
      marked++;
    } catch (e) {
      console.error('[markEmailUndeliverable]', email, e);
    }
  }

  res.json({ ok: true, marked });
});

exports.markEmailUndeliverable = onRequest(
  {
    cors: true,
    secrets: [selfServeMailSecret],
    invoker: 'public',
  },
  undeliverableApp
);

/**
 * POST JSON { email } from dashboard (CORS). For *onboarded* volunteers only
 * (Firestore volunteer_onboarding/{email} must exist). Generates the same
 * sign-in link as invVolunteer, then POSTs to your Apps Script web app URL
 * (see APPS_SCRIPT_SELF_SERVE_MAIL_URL secret) so GmailApp can deliver mail —
 * bypasses Firebase client email delivery issues (SMTP / filtering).
 */
const selfServeApp = express();
selfServeApp.use(express.json({ limit: '32kb' }));

selfServeApp.post('/', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ error: 'email required' });
    return;
  }
  if (isEmailBlocked(email)) {
    res.status(403).json({
      error: 'blocked',
      message: 'This address is not eligible for mail.',
    });
    return;
  }
  if (await isEmailUndeliverable(admin, email)) {
    res.status(403).json({
      error: 'undeliverable',
      message: 'This address cannot receive mail (delivery failed).',
    });
    return;
  }

  const onboardSnap = await admin
    .firestore()
    .collection('volunteer_onboarding')
    .doc(email)
    .get();

  let registered = onboardSnap.exists;
  if (!registered) {
    const volSnap = await admin
      .firestore()
      .collection('volunteers')
      .where('email', '==', email)
      .limit(1)
      .get();
    registered = !volSnap.empty;
  }
  // Also allow Nigeria hub profiles (signed up via Nigeria path).
  if (!registered) {
    const ngSnap = await admin
      .firestore()
      .collection('nigeria_volunteers')
      .where('email', '==', email)
      .limit(1)
      .get();
    registered = !ngSnap.empty;
  }

  if (!registered) {
    res.status(404).json({
      error: 'not_registered',
      message:
        'No volunteer record for this email yet. Join the Kingdom Workforce or ask an organizer to clear you, then try again with the same email.',
    });
    return;
  }

  const rateRef = admin.firestore().collection('self_serve_signin_rate').doc(email);
  const rateSnap = await rateRef.get();
  if (rateSnap.exists && rateSnap.data().lastAt) {
    const ms = rateSnap.data().lastAt.toMillis();
    if (Date.now() - ms < 60000) {
      res.status(429).json({
        error: 'too_fast',
        message: 'Wait about a minute before requesting another link.',
      });
      return;
    }
  }

  const continueUrl = resolveSignInContinueUrl(req.body?.continueUrl);
  const actionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  let signInLink;
  try {
    signInLink = await admin
      .auth()
      .generateSignInWithEmailLink(email, actionCodeSettings);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'link_failed' });
    return;
  }

  const scriptUrl = appsScriptSelfServeMailUrl.value();
  const secret = selfServeMailSecret.value();
  if (!scriptUrl?.trim() || !secret?.trim()) {
    res.status(503).json({ error: 'mail_not_configured' });
    return;
  }

  let mailRes;
  try {
    mailRes = await fetch(scriptUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'self_serve_signin',
        secret,
        email,
        signInLink,
      }),
    });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'mail_upstream_failed' });
    return;
  }

  const text = await mailRes.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (_) {}

  if (!mailRes.ok || !parsed || !parsed.ok) {
    const errMsg =
      parsed && parsed.error ? String(parsed.error).slice(0, 300) : text.slice(0, 200);
    console.error('Apps Script mail failed', mailRes.status, errMsg);
    if (parsed && parsed.permanent === true) {
      await markEmailUndeliverable(admin, email, errMsg, 'self_serve_signin');
    }
    res.status(502).json({
      error: 'mail_failed',
      detail: errMsg,
    });
    return;
  }

  await rateRef.set({ lastAt: admin.firestore.FieldValue.serverTimestamp() });

  res.json({ ok: true });
});

exports.volunteerSelfServeSignInMail = onRequest(
  {
    cors: true,
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
    invoker: 'public',
  },
  selfServeApp
);

/**
 * POST JSON { email } from dashboard password modal. Generates a Firebase
 * password-reset link and delivers via Gmail (Apps Script) — same path as
 * self-serve sign-in, which lands in inbox more reliably than Firebase noreply.
 */
const selfServePasswordResetApp = express();
selfServePasswordResetApp.use(express.json({ limit: '32kb' }));

selfServePasswordResetApp.post('/', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ error: 'email required' });
    return;
  }
  if (isEmailBlocked(email)) {
    res.status(403).json({
      error: 'blocked',
      message: 'This address is not eligible for mail.',
    });
    return;
  }
  if (await isEmailUndeliverable(admin, email)) {
    res.status(403).json({
      error: 'undeliverable',
      message: 'This address cannot receive mail (delivery failed).',
    });
    return;
  }

  let authUser;
  try {
    authUser = await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e && e.code === 'auth/user-not-found') {
      res.status(404).json({
        error: 'not_found',
        message: 'No account for this email yet.',
      });
      return;
    }
    console.error(e);
    res.status(500).json({ error: e.message || 'lookup_failed' });
    return;
  }
  if (!authUser || authUser.disabled) {
    res.status(404).json({
      error: 'not_found',
      message: 'No account for this email yet.',
    });
    return;
  }

  const rateRef = admin
    .firestore()
    .collection('self_serve_password_reset_rate')
    .doc(email);
  const rateSnap = await rateRef.get();
  if (rateSnap.exists && rateSnap.data().lastAt) {
    const ms = rateSnap.data().lastAt.toMillis();
    if (Date.now() - ms < 60000) {
      res.status(429).json({
        error: 'too_fast',
        message: 'Wait about a minute before requesting another reset link.',
      });
      return;
    }
  }

  const actionCodeSettings = {
    url: SIGNIN_CONTINUE_URL,
    handleCodeInApp: false,
  };

  let resetLink;
  try {
    resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'link_failed' });
    return;
  }

  const scriptUrl = appsScriptSelfServeMailUrl.value();
  const secret = selfServeMailSecret.value();
  if (!scriptUrl?.trim() || !secret?.trim()) {
    res.status(503).json({ error: 'mail_not_configured' });
    return;
  }

  let mailRes;
  try {
    mailRes = await fetch(scriptUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'self_serve_password_reset',
        secret,
        email,
        resetLink,
      }),
    });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'mail_upstream_failed' });
    return;
  }

  const text = await mailRes.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (_) {}

  if (!mailRes.ok || !parsed || !parsed.ok) {
    const errMsg =
      parsed && parsed.error ? String(parsed.error).slice(0, 300) : text.slice(0, 200);
    console.error('Apps Script password reset mail failed', mailRes.status, errMsg);
    if (parsed && parsed.permanent === true) {
      await markEmailUndeliverable(admin, email, errMsg, 'self_serve_password_reset');
    }
    res.status(502).json({
      error: 'mail_failed',
      detail: errMsg,
    });
    return;
  }

  await rateRef.set({ lastAt: admin.firestore.FieldValue.serverTimestamp() });

  res.json({ ok: true });
});

exports.volunteerSelfServePasswordResetMail = onRequest(
  {
    cors: true,
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
    invoker: 'public',
  },
  selfServePasswordResetApp
);

function htmlEscapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

const digestUnsubApp = express();
async function digestUnsubHandler(req, res) {
  const email = normalizeEmail(req.query.email);
  const t = String(req.query.t || '');
  const bad = (code, msg) => {
    res
      .status(code)
      .set('Content-Type', 'text/html; charset=utf-8')
      .send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribe</title></head><body style="font-family:system-ui;padding:2rem;max-width:32rem"><h1>Could not unsubscribe</h1><p>${htmlEscapeAttr(msg)}</p><p><a href="https://prayercityhtx.com/">Prayer City</a></p></body></html>`
      );
  };
  if (!email || !t) {
    bad(400, 'This link is incomplete. Use the link at the bottom of your latest daily email.');
    return;
  }
  const secret = selfServeMailSecret.value();
  const expected = volunteerDailyDigest.digestUnsubscribeToken(email, secret);
  const expBuf = Buffer.from(expected, 'utf8');
  const gotBuf = Buffer.from(t, 'utf8');
  if (
    expected.length === 0 ||
    expBuf.length !== gotBuf.length ||
    !crypto.timingSafeEqual(expBuf, gotBuf)
  ) {
    bad(403, 'This unsubscribe link is invalid or was changed.');
    return;
  }
  try {
    await admin
      .firestore()
      .collection('volunteer_onboarding')
      .doc(email)
      .set(
        {
          dailyDigestOptOut: true,
          dailyDigestOptOutAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    const vq = await admin.firestore().collection('volunteers').where('email', '==', email).get();
    await Promise.all(
      vq.docs.map((d) =>
        d.ref.set({ dailyDigestOptOut: true }, { merge: true })
      )
    );
  } catch (e) {
    console.error('volunteerDigestUnsubscribe', e);
    bad(500, 'Something went wrong. Please try again later.');
    return;
  }
  const pid = admin.app().options.projectId || process.env.GCLOUD_PROJECT || '';
  const resubBase = pid
    ? `https://us-central1-${pid}.cloudfunctions.net/volunteerDigestResubscribe`
    : '';
  const resubTok = volunteerDailyDigest.digestResubscribeToken(email, selfServeMailSecret.value());
  const resubUrl = resubBase
    ? `${resubBase}?email=${encodeURIComponent(email)}&t=${encodeURIComponent(resubTok)}`
    : '';
  const resubBlock = resubUrl
    ? `<p style="margin-top:1.25rem;"><a href="${htmlEscapeAttr(resubUrl)}">Resubscribe to daily emails</a> (one click)</p>`
    : '<p style="margin-top:1.25rem;">To receive emails again, contact your Prayer City organizer.</p>';
  res
    .set('Content-Type', 'text/html; charset=utf-8')
    .send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head><body style="font-family:system-ui;padding:2rem;max-width:32rem"><h1>You’re unsubscribed</h1><p>You won’t receive more daily volunteer task emails from Houston Prayer City.</p><p>Changed your mind?</p>${resubBlock}<p><a href="https://prayercityhtx.com/">Return to Prayer City</a></p></body></html>`
    );
}
digestUnsubApp.get(['/', '/volunteerDigestUnsubscribe'], digestUnsubHandler);

const digestResubApp = express();
async function digestResubHandler(req, res) {
  const email = normalizeEmail(req.query.email);
  const t = String(req.query.t || '');
  const bad = (code, msg) => {
    res
      .status(code)
      .set('Content-Type', 'text/html; charset=utf-8')
      .send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resubscribe</title></head><body style="font-family:system-ui;padding:2rem;max-width:32rem"><h1>Could not update preferences</h1><p>${htmlEscapeAttr(msg)}</p><p><a href="https://prayercityhtx.com/">Prayer City</a></p></body></html>`
      );
  };
  if (!email || !t) {
    bad(400, 'This link is incomplete. Use the link from your email or the unsubscribe confirmation page.');
    return;
  }
  const secret = selfServeMailSecret.value();
  const expected = volunteerDailyDigest.digestResubscribeToken(email, secret);
  const expBuf = Buffer.from(expected, 'utf8');
  const gotBuf = Buffer.from(t, 'utf8');
  if (
    expected.length === 0 ||
    expBuf.length !== gotBuf.length ||
    !crypto.timingSafeEqual(expBuf, gotBuf)
  ) {
    bad(403, 'This link is invalid or was changed.');
    return;
  }
  try {
    await admin
      .firestore()
      .collection('volunteer_onboarding')
      .doc(email)
      .set(
        {
          dailyDigestOptOut: false,
          dailyDigestOptOutAt: admin.firestore.FieldValue.delete(),
        },
        { merge: true }
      );
    const vq = await admin.firestore().collection('volunteers').where('email', '==', email).get();
    await Promise.all(
      vq.docs.map((d) =>
        d.ref.set(
          {
            dailyDigestOptOut: false,
            dailyDigestOptOutAt: admin.firestore.FieldValue.delete(),
          },
          { merge: true }
        )
      )
    );
  } catch (e) {
    console.error('volunteerDigestResubscribe', e);
    bad(500, 'Something went wrong. Please try again later.');
    return;
  }
  res
    .set('Content-Type', 'text/html; charset=utf-8')
    .send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resubscribed</title></head><body style="font-family:system-ui;padding:2rem;max-width:32rem"><h1>You’re resubscribed</h1><p>You’ll receive daily volunteer task emails again from Houston Prayer City (when the next digest runs).</p><p><a href="https://prayercityhtx.com/">Return to Prayer City</a></p></body></html>`
    );
}
digestResubApp.get(['/', '/volunteerDigestResubscribe'], digestResubHandler);

/** One-click resubscribe to daily digest (signed link). */
exports.volunteerDigestResubscribe = onRequest(
  {
    cors: true,
    secrets: [selfServeMailSecret],
    invoker: 'public',
  },
  digestResubApp
);

/** One-click unsubscribe from daily digest (signed link in email). */
exports.volunteerDigestUnsubscribe = onRequest(
  {
    cors: true,
    secrets: [selfServeMailSecret],
    invoker: 'public',
  },
  digestUnsubApp
);

/** Callable: copy volunteer_onboarding → volunteers/{uid} after first sign-in */
exports.mergeVolunteerProfile = onCall(async (request) => {
  if (!request.auth || !request.auth.token.email) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const email = normalizeEmail(request.auth.token.email);
  const uid = request.auth.uid;

  const snap = await admin
    .firestore()
    .collection('volunteer_onboarding')
    .doc(email)
    .get();

  if (!snap.exists) {
    return { merged: false };
  }

  const data = snap.data();
  const volRef = admin.firestore().collection('volunteers').doc(uid);
  const existingSnap = await volRef.get();
  const existing = existingSnap.exists ? existingSnap.data() : {};
  const hasStr = (v) =>
    v !== undefined && v !== null && String(v).trim() !== '';

  /**
   * Do not copy signup sheet/onboarding role fields over a profile the volunteer
   * already filled or updated from the dashboard (Edit Shifts sets sheetRowUpdatedAt).
   */
  const lockRoleFieldsFromOnboarding =
    hasStr(existing.shifts) || existing.sheetRowUpdatedAt != null;

  const patch = {
    email,
    name: data.name || '',
    phone: data.phone || '',
    notes: data.notes || '',
    sheetRowId: data.sheetRowId || '',
    mergedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!lockRoleFieldsFromOnboarding) {
    patch.shifts = data.shifts || '';
    patch.tent = data.tent || '';
    patch.timeslot = data.timeslot || '';
    patch.position = data.position || '';
  }

  await volRef.set(patch, { merge: true });

  const volSnap = await volRef.get();
  const vol = volSnap.exists ? volSnap.data() : {};
    await admin
      .firestore()
      .collection('volunteer_directory')
      .doc(uid)
      .set(
      {
        uid,
        name: (vol.name || data.name || '').trim(),
        photoURL: vol.photoURL || '',
        shifts: vol.shifts !== undefined && vol.shifts !== '' ? vol.shifts : data.shifts || '',
        tent: vol.tent !== undefined && vol.tent !== '' ? vol.tent : data.tent || '',
        timeslot:
          vol.timeslot !== undefined && vol.timeslot !== ''
            ? vol.timeslot
            : data.timeslot || '',
        position:
          vol.position !== undefined && vol.position !== ''
            ? vol.position
            : data.position || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { merged: true };
});

/**
 * Callable: update volunteer row in Google Sheet (date, position, time, shifts text)
 * and sync Firestore. Uses same Apps Script URL + secret as self-serve mail.
 */
exports.updateVolunteerSheetPreferences = onCall(
  { cors: true, secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl] },
  async (request) => {
    if (!request.auth?.token?.email) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const email = normalizeEmail(request.auth.token.email);
    const uid = request.auth.uid;
    const d = request.data || {};
    const dateStr = String(d.dateStr || '').trim();
    const position = String(d.position || '').trim();
    const timeslot = String(d.timeslot || '').trim();
    const shifts = String(d.shifts || '').trim();

    if (!dateStr && !position && !timeslot && !shifts) {
      throw new HttpsError(
        'invalid-argument',
        'Fill at least one of date, position, or time.'
      );
    }

    const scriptUrl = appsScriptSelfServeMailUrl.value();
    const secret = selfServeMailSecret.value();
    if (!scriptUrl?.trim() || !secret?.trim()) {
      throw new HttpsError(
        'failed-precondition',
        'Sheet sync is not configured (Apps Script URL / secret).'
      );
    }

    let res;
    try {
      res = await fetch(scriptUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'volunteer_sheet_update',
          secret,
          email,
          dateStr,
          position,
          timeslot,
          shifts,
        }),
      });
    } catch (e) {
      console.error('updateVolunteerSheetPreferences fetch', e);
      throw new HttpsError('unavailable', 'Could not reach Google Apps Script.');
    }

    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch (_) {}

    if (!res.ok || !parsed?.ok) {
      const err = parsed?.error || 'sheet_update_failed';
      if (err === 'email_not_in_sheet') {
        throw new HttpsError(
          'not-found',
          'Your email was not found in the volunteer sheet. Ask an organizer to add your row, or use the same email you signed up with.'
        );
      }
      throw new HttpsError(
        'failed-precondition',
        typeof err === 'string' ? err : 'sheet_update_failed'
      );
    }

    const volRef = admin.firestore().collection('volunteers').doc(uid);
    const patch = {
      sheetRowUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (shifts) patch.shifts = shifts;
    if (position) patch.position = position;
    if (timeslot) patch.timeslot = timeslot;
    if (dateStr) patch.availabilityDate = dateStr;

    await volRef.set(patch, { merge: true });

    const volSnap = await volRef.get();
    const vol = volSnap.exists ? volSnap.data() : {};

    await admin
      .firestore()
      .collection('volunteer_directory')
      .doc(uid)
      .set(
        {
          uid,
          name: vol.name || '',
          photoURL: vol.photoURL || '',
          shifts: vol.shifts || '',
          tent: vol.tent || '',
          timeslot: vol.timeslot || '',
          position: vol.position || '',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return { ok: true, row: parsed.row };
  }
);

/** Google News RSS — scoped to Houston + FIFA World Cup 2026 (query + server-side filter). */
const LOGISTICS_RSS_FEED_URLS = [
  'https://news.google.com/rss/search?q=Houston+%22FIFA+World+Cup%22+2026+OR+Houston+NRG+World+Cup+2026+OR+%22NRG+Stadium%22+FIFA+2026&hl=en-US&gl=US&ceid=US:en',
];

function extractRssItemTitles(xml, maxItems) {
  const titles = [];
  const parts = String(xml || '').split('<item');
  for (let i = 1; i < parts.length && titles.length < maxItems; i++) {
    const tm = parts[i].match(
      /<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/title>/i
    );
    if (!tm) continue;
    let t = (tm[1] || tm[2] || '').replace(/\s+/g, ' ').trim();
    if (!t || /^google news$/i.test(t)) continue;
    if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
    titles.push(t);
  }
  return titles;
}

/** Keep logistics/welfare headlines on Houston + FIFA 2026 tournament context only. */
function isLogisticsRssRelevant(title) {
  const t = String(title || '').toLowerCase();
  const hasWC =
    /\bworld cup\b/.test(t) ||
    (/\bfifa\b/.test(t) && /\b2026\b/.test(t));
  if (!hasWC) return false;
  if (
    /\b(premier league|champions league|uefa champions|uefa europa|uefa conference|\bepl\b|la liga|bundesliga|serie a|ligue 1)\b/i.test(
      t
    )
  ) {
    return false;
  }
  return (
    t.includes('houston') ||
    t.includes('nrg') ||
    /host cities|host stadium|16\s*cities|all\s*16/i.test(t) ||
    (/\b2026\b/.test(t) &&
      /\b(stadium|venue|schedule|ticket|security|fifa)\b/.test(t) &&
      (t.includes('usa') ||
        t.includes('u.s.') ||
        t.includes('united states') ||
        t.includes('america')))
  );
}

/**
 * Callable: logistics volunteers — headline from public RSS + practical event tip.
 * Requires auth. Falls back to static tip if RSS fetch fails.
 */
exports.getLogisticsNewsTip = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const fallback = {
    ok: true,
    headline: null,
    source: null,
    tip: 'Large-event baseline: map exits and choke points before crowds arrive; rotate rest for outdoor teams; keep one clear radio or chat channel for leads.',
    usedFallback: true,
  };

  function buildTipFromHeadline(headline) {
    const h = String(headline || '').toLowerCase();
    let extra =
      'For mega-events: add buffer time to rotations, pre-position water, and brief volunteers on hand signals if radios fail.';
    if (h.includes('crowd') || h.includes('fan')) {
      extra =
        'Crowd flow: watch pinch points at gates and merch; stagger queues if wait times spike.';
    }
    if (h.includes('security') || h.includes('police') || h.includes('arrest')) {
      extra =
        'Security news: align with venue lead before redirecting crowds; pause non-essential movement during incidents.';
    }
    if (h.includes('weather') || h.includes('heat') || h.includes('rain')) {
      extra =
        'Weather impact: adjust shade, footing, and crowd comfort — increase water checks for staff and guests.';
    }
    if (h.includes('stadium') || h.includes('world cup') || h.includes('match')) {
      extra =
        'Match-day surges: plan ingress/egress waves; keep accessibility routes clear at all times.';
    }
    const short = String(headline || '').slice(0, 140);
    return `${extra} Context: “${short}${headline && headline.length > 140 ? '…' : ''}”`;
  }

  try {
    const fetchOpts = {
      headers: { 'User-Agent': 'PrayerCityDashboard/1.0 (logistics RSS)' },
    };
    const seen = new Set();
    const filtered = [];

    for (const url of LOGISTICS_RSS_FEED_URLS) {
      const res = await fetch(url, fetchOpts);
      if (!res.ok) continue;
      const xml = await res.text();
      const titles = extractRssItemTitles(xml, 40);
      for (const raw of titles) {
        if (!isLogisticsRssRelevant(raw)) continue;
        const key = raw.toLowerCase().slice(0, 120);
        if (seen.has(key)) continue;
        seen.add(key);
        filtered.push(raw);
        if (filtered.length >= 24) break;
      }
      if (filtered.length >= 24) break;
    }

    if (filtered.length === 0) return fallback;

    const day = Math.floor(Date.now() / 86400000);
    const headline = filtered[day % filtered.length];
    return {
      ok: true,
      headline,
      source: 'Google News — Houston · FIFA World Cup 2026',
      tip: buildTipFromHeadline(headline),
      usedFallback: false,
    };
  } catch (e) {
    console.error('getLogisticsNewsTip', e);
    return fallback;
  }
});

const DIGEST_MAX_CONSECUTIVE_FAILURES = 3;
const DIGEST_ADMIN_EMAILS = new Set([
  'ddbs.htx@gmail.com',
  'abuxberkeley@gmail.com',
]);

/**
 * @param {string} email
 * @param {string} ymd
 * @param {{ errorMessage?: string, permanent?: boolean }} [opts]
 */
async function recordDigestDeliveryFailure(email, ymd, opts = {}) {
  const errMsg = String(opts.errorMessage || '');
  const permanent =
    opts.permanent === true || (errMsg && isPermanentDeliveryError(errMsg));

  if (permanent) {
    await markEmailUndeliverable(
      admin,
      email,
      errMsg || 'permanent delivery failure',
      'digest_send'
    );
    return DIGEST_MAX_CONSECUTIVE_FAILURES;
  }

  const sentRef = admin.firestore().collection('volunteer_daily_digest_sent').doc(email);
  const sentSnap = await sentRef.get();
  const prev = sentSnap.exists ? sentSnap.data() : {};
  const lastFailYmd = String(prev.lastFailYmd || '');
  let failStreak = Number(prev.failStreak) || 0;
  if (lastFailYmd !== ymd) {
    failStreak += 1;
  }
  await sentRef.set(
    {
      lastFailYmd: ymd,
      failStreak,
      lastFailAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  if (failStreak >= DIGEST_MAX_CONSECUTIVE_FAILURES) {
    await markEmailUndeliverable(
      admin,
      email,
      errMsg || failStreak + ' consecutive digest send failures',
      'digest_send_repeated'
    );
  }
  return failStreak;
}

/** @param {{ forceResend?: boolean }} opts */
async function runDailyVolunteerRoleDigestsJob(opts = {}) {
  const forceResend = opts.forceResend === true;
    const settingsSnap = await admin.firestore().doc('settings/volunteer_daily_digest').get();
    const settings = settingsSnap.data() || {};
    if (!settings.enabled) {
      console.log(
        '[sendDailyVolunteerRoleDigests] skipped: create Firestore settings/volunteer_daily_digest with enabled: true'
      );
      return { sent: 0, skipped: 0, failed: 0, aborted: 'disabled' };
    }

    const scriptUrl = appsScriptSelfServeMailUrl.value();
    const secret = selfServeMailSecret.value();
    if (!String(scriptUrl || '').trim() || !String(secret || '').trim()) {
      console.error('[sendDailyVolunteerRoleDigests] mail not configured (secrets)');
      return { sent: 0, skipped: 0, failed: 0, aborted: 'mail_not_configured' };
    }

    const ymd = volunteerDailyDigest.todayYmdChicago();
    const siteBase = String(settings.siteBase || volunteerDailyDigest.SITE_DEFAULT).replace(/\/?$/, '');
    const dryRun = settings.dryRun === true;
    const projectId = admin.app().options.projectId || process.env.GCLOUD_PROJECT || '';
    const digestUnsubBase = projectId
      ? `https://us-central1-${projectId}.cloudfunctions.net/volunteerDigestUnsubscribe`
      : '';
    const digestResubBase = projectId
      ? `https://us-central1-${projectId}.cloudfunctions.net/volunteerDigestResubscribe`
      : '';
    const unsubSecret = selfServeMailSecret.value();
    if (!digestUnsubBase) {
      console.warn('[sendDailyVolunteerRoleDigests] GCLOUD_PROJECT missing; unsubscribe/resubscribe links omitted from emails.');
    }

    const onboardSnap = await admin.firestore().collection('volunteer_onboarding').get();
    const undeliverableSet = await loadUndeliverableEmailSet(admin);
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of onboardSnap.docs) {
      const email = doc.id;
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

      const sentRef = admin.firestore().collection('volunteer_daily_digest_sent').doc(email);
      const sentSnap = await sentRef.get();
      const sentMeta = sentSnap.exists ? sentSnap.data() : {};
      if (
        !dryRun &&
        Number(sentMeta.failStreak) >= DIGEST_MAX_CONSECUTIVE_FAILURES
      ) {
        skipped++;
        continue;
      }
      if (!dryRun && !forceResend && sentSnap.exists && sentMeta.lastYmd === ymd) {
        skipped++;
        continue;
      }

      let volSnap;
      try {
        volSnap = await admin.firestore().collection('volunteers').where('email', '==', email).limit(1).get();
      } catch (e) {
        console.error('[sendDailyVolunteerRoleDigests] volunteers query', email, e);
        failed++;
        continue;
      }

      const merged = { ...onboard, email, name: onboard.name || '' };
      if (!volSnap.empty) {
        const v = volSnap.docs[0].data();
        if (String(v.name || '').trim()) merged.name = v.name;
        if (String(v.shifts || '').trim()) merged.shifts = v.shifts;
        if (String(v.position || '').trim()) merged.position = v.position;
        if (String(v.timeslot || '').trim()) merged.timeslot = v.timeslot;
        if (String(v.tent || '').trim()) merged.tent = v.tent;
        if (v.dailyDigestOptOut === true) {
          skipped++;
          continue;
        }
      }

      merged.siteBase = siteBase;
      merged.digestUnsubscribeSecret = unsubSecret;
      merged.digestUnsubscribeBaseUrl = digestUnsubBase;
      merged.digestResubscribeBaseUrl = digestResubBase;

      let content;
      try {
        content = await volunteerDailyDigest.buildDailyVolunteerDigest(merged);
      } catch (e) {
        console.error('[sendDailyVolunteerRoleDigests] build digest', email, e);
        failed++;
        continue;
      }

      if (!content) {
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log('[sendDailyVolunteerRoleDigests] dryRun', email, content.subject, content.roleIds);
        continue;
      }

      let mailRes;
      try {
        mailRes = await fetch(scriptUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'daily_volunteer_digest',
            secret,
            email,
            subject: content.subject,
            plainBody: content.plainBody,
            htmlBody: content.htmlBody,
          }),
        });
      } catch (e) {
        console.error('[sendDailyVolunteerRoleDigests] fetch mail', email, e);
        await recordDigestDeliveryFailure(email, ymd, { errorMessage: String(e) });
        failed++;
        continue;
      }

      const text = await mailRes.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch (_) {}

      if (!mailRes.ok || !parsed || !parsed.ok) {
        const errMsg = (parsed && (parsed.error || parsed.message)) || text.slice(0, 400);
        console.error('[sendDailyVolunteerRoleDigests] mail failed', email, mailRes.status, errMsg);
        const streak = await recordDigestDeliveryFailure(email, ymd, {
          errorMessage: errMsg,
          permanent: parsed && parsed.permanent === true,
        });
        if (streak >= DIGEST_MAX_CONSECUTIVE_FAILURES) {
          console.warn('[sendDailyVolunteerRoleDigests] stopped — undeliverable', email);
        }
        failed++;
        continue;
      }

      await sentRef.set(
        {
        lastYmd: ymd,
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        roleIds: content.roleIds,
          failStreak: 0,
          lastFailYmd: admin.firestore.FieldValue.delete(),
        },
        { merge: true }
      );
      sent++;
      await new Promise((r) => setTimeout(r, 150));
    }

    console.log(
    `[sendDailyVolunteerRoleDigests] done ymd=${ymd} sent=${sent} skipped=${skipped} failed=${failed} dryRun=${dryRun} forceResend=${forceResend}`
  );
  return { ymd, sent, skipped, failed, dryRun, forceResend };
}

/**
 * Daily (America/Chicago 7:00): role-based task email for volunteers in
 * `volunteer_onboarding`, using shifts merged from `volunteers/{uid}` when present.
 *
 * Enable in Firestore: document `settings/volunteer_daily_digest` with `{ "enabled": true }`.
 * Optional: `dryRun` (bool) — log only, no mail. `siteBase` (string) — volunteer hub URL.
 * Opt-out per person: field `dailyDigestOptOut: true` on onboarding doc or merged volunteer doc.
 *
 * Mail delivery uses the same Apps Script webhook as self-serve sign-in
 * (APPS_SCRIPT_SELF_SERVE_MAIL_URL + SELF_SERVE_MAIL_SECRET); add handler
 * `daily_volunteer_digest` in PrayerCityFormPipeline.gs.
 */
exports.sendDailyVolunteerRoleDigests = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Chicago',
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
  },
  async () => {
    await runDailyVolunteerRoleDigestsJob();
  }
);

/**
 * Callable (admins only): send today's digest now (e.g. after a failed 7am run).
 */
exports.runVolunteerDigestNow = onCall(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
  },
  async (request) => {
    if (!request.auth?.token?.email) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const caller = normalizeEmail(request.auth.token.email);
    if (!DIGEST_ADMIN_EMAILS.has(caller)) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }
    const stats = await runDailyVolunteerRoleDigestsJob({ forceResend: true });
    return { ok: true, ...stats };
  }
);

/**
 * HTTP (secret query): send today's digest now — for ops when 7am job failed.
 * GET/POST ?secret=SELF_SERVE_MAIL_SECRET
 */
exports.runVolunteerDigestHttp = onRequest(
  {
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
  },
  async (req, res) => {
    const provided = String(req.query.secret || req.get('x-digest-secret') || '').trim();
    const secret = selfServeMailSecret.value();
    if (!provided || provided !== secret) {
      res.status(403).send('forbidden');
      return;
    }
    const stats = await runDailyVolunteerRoleDigestsJob({ forceResend: true });
    res.json({ ok: true, ...stats });
  }
);

async function loadVolunteersForSchedule() {
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

async function emailVolunteerSchedule({ to, filterDate }) {
  const scriptUrl = appsScriptSelfServeMailUrl.value();
  const secret = selfServeMailSecret.value();
  if (!String(scriptUrl || '').trim() || !String(secret || '').trim()) {
    throw new Error('mail_not_configured');
  }

  const volunteers = await loadVolunteersForSchedule();
  const grid = buildScheduleGrid(volunteers);
  const content = buildScheduleEmail(grid, { filterDate: filterDate || '' });

  const mailRes = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'daily_volunteer_digest',
      secret,
      email: normalizeEmail(to),
      subject: content.subject,
      plainBody: content.plainBody,
      htmlBody: content.htmlBody,
    }),
  });

  const text = await mailRes.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_) {}

  if (!mailRes.ok || !parsed?.ok) {
    throw new Error(String(parsed?.error || text.slice(0, 200) || 'mail_failed'));
  }

  return {
    to: normalizeEmail(to),
    volunteers: volunteers.length,
    ...content.stats,
  };
}

/**
 * Callable (admins): email volunteer schedule grouped by date and time.
 */
exports.emailVolunteerSchedule = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
  },
  async (request) => {
    if (!request.auth?.token?.email) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const caller = normalizeEmail(request.auth.token.email);
    if (!DIGEST_ADMIN_EMAILS.has(caller)) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }
    const to = normalizeEmail(request.data?.to || 'ddbs.htx@gmail.com');
    const filterDate = String(request.data?.date || '').trim();
    try {
      const stats = await emailVolunteerSchedule({ to, filterDate });
      return { ok: true, ...stats };
    } catch (e) {
      throw new HttpsError('internal', String(e.message || e));
    }
  }
);

/**
 * HTTP (secret query): email volunteer schedule to organizer.
 * GET ?secret=...&to=ddbs.htx@gmail.com&date=June%2014,%202026
 */
exports.emailVolunteerScheduleHttp = onRequest(
  {
    timeoutSeconds: 120,
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
  },
  async (req, res) => {
    const provided = String(req.query.secret || req.get('x-digest-secret') || '').trim();
    const secret = selfServeMailSecret.value();
    if (!provided || provided !== secret) {
      res.status(403).send('forbidden');
      return;
    }
    const to = normalizeEmail(req.query.to || 'ddbs.htx@gmail.com');
    const filterDate = String(req.query.date || '').trim();
    try {
      const stats = await emailVolunteerSchedule({ to, filterDate });
      res.json({ ok: true, ...stats });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }
);

async function removeVolunteerByEmail(email) {
  const e = normalizeEmail(email);
  if (!e || !e.includes('@')) {
    throw new Error('invalid_email');
  }

  let onboardingDeleted = false;
  const onboardRef = admin.firestore().collection('volunteer_onboarding').doc(e);
  const onboardSnap = await onboardRef.get();
  if (onboardSnap.exists) {
    await onboardRef.delete();
    onboardingDeleted = true;
  }

  const volSnap = await admin.firestore().collection('volunteers').where('email', '==', e).get();
  let directoryDeleted = 0;
  for (const doc of volSnap.docs) {
    const dirRef = admin.firestore().collection('volunteer_directory').doc(doc.id);
    const dirSnap = await dirRef.get();
    if (dirSnap.exists) {
      await dirRef.delete();
      directoryDeleted++;
    }
    await doc.ref.delete();
  }

  const digestRef = admin.firestore().collection('volunteer_daily_digest_sent').doc(e);
  const digestSnap = await digestRef.get();
  if (digestSnap.exists) {
    await digestRef.delete();
  }

  return {
    email: e,
    onboardingDeleted,
    volunteersRemoved: volSnap.size,
    directoryRemoved: directoryDeleted,
  };
}

/**
 * HTTP (secret): remove volunteer from Firestore roster by email.
 * GET ?secret=...&email=someone@example.com
 */
exports.removeVolunteerHttp = onRequest(
  { timeoutSeconds: 60, secrets: [selfServeMailSecret] },
  async (req, res) => {
    const provided = String(req.query.secret || req.get('x-digest-secret') || '').trim();
    const secret = selfServeMailSecret.value();
    if (!provided || provided !== secret) {
      res.status(403).send('forbidden');
      return;
    }
    const email = String(req.query.email || '').trim();
    if (!email) {
      res.status(400).json({ ok: false, error: 'missing_email' });
      return;
    }
    try {
      const stats = await removeVolunteerByEmail(email);
      res.json({ ok: true, ...stats });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }
);

const TSHIRT_SIZES = new Set(['S', 'M', 'L', 'X']);

function normalizeShirtSize(raw) {
  let s = String(raw || '')
    .trim()
    .toUpperCase();
  if (s === 'XL') s = 'X';
  return s;
}

async function postTshirtSizeToAppsScript(scriptUrl, secret, { email, name, shirtSize }) {
  async function post(body) {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
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

  if (result.parsed?.error === 'bad_type') {
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

/**
 * Callable: after volunteer saves shirtSize on dashboard — email team + sheet col K.
 */
exports.notifyVolunteerTshirtSize = onCall(
  { cors: true, secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl] },
  async (request) => {
    if (!request.auth?.token?.email) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const shirtSize = normalizeShirtSize(request.data?.shirtSize);
    if (!TSHIRT_SIZES.has(shirtSize)) {
      throw new HttpsError('invalid-argument', 'Choose a valid T-shirt size.');
    }

    const email = normalizeEmail(request.auth.token.email);
    const uid = request.auth.uid;
    const volSnap = await admin.firestore().collection('volunteers').doc(uid).get();
    const vol = volSnap.exists ? volSnap.data() : {};
    const name = String(vol.name || '').trim();

    const scriptUrl = appsScriptSelfServeMailUrl.value();
    const secret = selfServeMailSecret.value();
    if (!String(scriptUrl || '').trim() || !String(secret || '').trim()) {
      throw new HttpsError(
        'failed-precondition',
        'Team email notification is not configured.'
      );
    }

    let res;
    let text;
    let parsed;
    try {
      ({ res, text, parsed } = await postTshirtSizeToAppsScript(scriptUrl, secret, {
        email,
        name,
        shirtSize,
      }));
    } catch (e) {
      console.error('notifyVolunteerTshirtSize fetch', e);
      throw new HttpsError('unavailable', 'Could not reach Google Apps Script.');
    }

    if (!res.ok || !parsed?.ok) {
      const err = String(parsed?.error || 'tshirt_notify_failed');
      console.error('notifyVolunteerTshirtSize apps script', res.status, text);
      if (err === 'bad_type' || err === 'nothing_to_update') {
        throw new HttpsError(
          'failed-precondition',
          'Google Apps Script needs redeploying — update handleVolunteerSheetUpdate_ (or full PrayerCityFormPipeline.gs) then Deploy → New version.'
        );
      }
      if (err === 'unauthorized') {
        throw new HttpsError(
          'failed-precondition',
          'Apps Script secret mismatch — update SELF_SERVE_MAIL_SECRET in Firebase and CONFIG.SELF_SERVE_MAIL_SECRET in the sheet script.'
        );
      }
      throw new HttpsError('internal', err);
    }

    await admin
      .firestore()
      .collection('volunteers')
      .doc(uid)
      .set(
        {
          shirtSizeNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          shirtSizeNotifiedValue: shirtSize,
        },
        { merge: true }
      );

    return { ok: true, emailed: parsed.emailed !== false, sheetRow: parsed.sheetRow || 0 };
  }
);

const TSHIRT_BACKFILL_ADMINS = new Set([
  'ddbs.htx@gmail.com',
  'abuxberkeley@gmail.com',
]);

/**
 * Callable (admins only): push every saved shirtSize from Firestore to sheet col K + team email.
 * Run after redeploying Apps Script with volunteer_tshirt_size handler.
 */
exports.backfillVolunteerTshirtSizes = onCall(
  { cors: true, secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl] },
  async (request) => {
    if (!request.auth?.token?.email) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const caller = normalizeEmail(request.auth.token.email);
    if (!TSHIRT_BACKFILL_ADMINS.has(caller)) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }

    const scriptUrl = appsScriptSelfServeMailUrl.value();
    const secret = selfServeMailSecret.value();
    if (!String(scriptUrl || '').trim() || !String(secret || '').trim()) {
      throw new HttpsError(
        'failed-precondition',
        'Apps Script URL / secret not configured.'
      );
    }

    const snap = await admin.firestore().collection('volunteers').get();
    const results = [];
    for (const doc of snap.docs) {
      const vol = doc.data() || {};
      const shirtSize = normalizeShirtSize(vol.shirtSize);
      if (!TSHIRT_SIZES.has(shirtSize)) continue;

      const email = normalizeEmail(vol.email || '');
      if (!email) continue;

      const name = String(vol.name || '').trim();
      let res;
      let text;
      let parsed;
      try {
        ({ res, text, parsed } = await postTshirtSizeToAppsScript(scriptUrl, secret, {
          email,
          name,
          shirtSize,
        }));
      } catch (e) {
        results.push({ email, shirtSize, ok: false, error: 'fetch_failed' });
        continue;
      }

      if (!res.ok || !parsed?.ok) {
        results.push({
          email,
          shirtSize,
          ok: false,
          error: parsed?.error || 'apps_script_failed',
        });
        if (parsed?.error === 'bad_type' || parsed?.error === 'nothing_to_update') {
          throw new HttpsError(
            'failed-precondition',
            'Apps Script still missing T-shirt support — update handleVolunteerSheetUpdate_ and redeploy.'
          );
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
      results.push({
        email,
        shirtSize,
        ok: true,
        sheetRow: parsed.sheetRow || 0,
        emailed: parsed.emailed !== false,
      });
    }

    const synced = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    return { ok: true, synced, failed, total: results.length, results };
  }
);

const { registerDigestIntelligenceExports } = require('./genkit/registerExports');
const digestIntel = registerDigestIntelligenceExports(admin);
exports.runDigestIntelligenceNow = digestIntel.runDigestIntelligenceNow;
exports.scheduledDigestIntelligence = digestIntel.scheduledDigestIntelligence;
exports.runDigestIntelligenceHttp = digestIntel.runDigestIntelligenceHttp;

/**
 * One-time thank-you after World Cup Prayer City campaign (July 6, 2026 9:00 AM CT).
 * Enable: Firestore settings/campaign_thank_you_2026 → { enabled: true }
 */
exports.scheduledCampaignThankYou = onSchedule(
  {
    schedule: '0 9 6 7 *',
    timeZone: 'America/Chicago',
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
  },
  async () => {
    try {
      await runCampaignThankYouJob(admin, {
        scriptUrl: appsScriptSelfServeMailUrl.value(),
        secret: selfServeMailSecret.value(),
      });
    } catch (e) {
      console.error('[scheduledCampaignThankYou]', e);
    }
  }
);

exports.runCampaignThankYouHttp = onRequest(
  {
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
  },
  async (req, res) => {
    const provided = String(req.query.secret || req.get('x-digest-secret') || '').trim();
    const secret = selfServeMailSecret.value();
    if (!provided || provided !== secret) {
      res.status(403).send('forbidden');
      return;
    }
    try {
      const stats = await runCampaignThankYouJob(admin, {
        scriptUrl: appsScriptSelfServeMailUrl.value(),
        secret: selfServeMailSecret.value(),
        dryRun: req.query.dryRun !== 'false',
        force: req.query.force === 'true',
      });
      res.json({ ok: true, ...stats });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }
);

exports.saveNigeriaProfile = nigeriaVolunteer.saveNigeriaProfile;
exports.setNigeriaMemberRole = nigeriaVolunteer.setNigeriaMemberRole;
exports.recordNigeriaAttendance = nigeriaVolunteer.recordNigeriaAttendance;
exports.submitNigeriaAbsenceRequest = nigeriaVolunteer.submitNigeriaAbsenceRequest;
exports.getNigeriaDashboard = nigeriaVolunteer.getNigeriaDashboard;
exports.submitNigeriaUnitReport = nigeriaVolunteer.submitNigeriaUnitReport;
exports.shareNigeriaUnitReportDraft = nigeriaVolunteer.shareNigeriaUnitReportDraft;
exports.contributeNigeriaUnitReportDraft = nigeriaVolunteer.contributeNigeriaUnitReportDraft;
exports.approveNigeriaUnitReportDraft = nigeriaVolunteer.approveNigeriaUnitReportDraft;
exports.getNigeriaAttendanceForReport = nigeriaVolunteer.getNigeriaAttendanceForReport;
exports.summarizeNigeriaMeetingNotesForReport = nigeriaVolunteer.summarizeNigeriaMeetingNotesForReport;
exports.generateNigeriaUnitVision = nigeriaVolunteer.generateNigeriaUnitVision;
exports.saveNigeriaUnitVision = nigeriaVolunteer.saveNigeriaUnitVision;
exports.updateNigeriaVisionProgress = nigeriaVolunteer.updateNigeriaVisionProgress;
exports.getPrayerCityAccess = nigeriaVolunteer.getPrayerCityAccess;
exports.submitNigeriaMemberSignup = nigeriaVolunteer.submitNigeriaMemberSignup;
exports.getNigeriaMemberSignups = nigeriaVolunteer.getNigeriaMemberSignups;
exports.submitNigeriaWorkforceSignup = nigeriaVolunteer.submitNigeriaWorkforceSignup;
exports.getNigeriaWorkforceSignups = nigeriaVolunteer.getNigeriaWorkforceSignups;
exports.approveNigeriaWorkforceSignup = nigeriaVolunteer.approveNigeriaWorkforceSignup;
exports.markNigeriaWorkforceInTraining = nigeriaVolunteer.markNigeriaWorkforceInTraining;

/**
 * Every 5 minutes (Africa/Lagos): email Nigeria unit members meeting reminders
 * at 2 days, 1 day, 2 hours, and 15 minutes before their next unit meeting.
 *
 * Enable: Firestore `settings/nigeria_meeting_reminders` → `{ "enabled": true }`.
 * Post-meeting digest emails: same doc → `{ "postMeetingDigestEnabled": true }`.
 * Opt-out per volunteer: `meetingReminderOptOut: true` on `nigeria_volunteers/{uid}`.
 */
exports.scheduledNigeriaMeetingReminders = onSchedule(
  {
    schedule: '*/5 * * * *',
    timeZone: 'Africa/Lagos',
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
  },
  async () => {
    await runNigeriaMeetingRemindersJob(admin, {
      scriptUrl: appsScriptSelfServeMailUrl.value(),
      secret: selfServeMailSecret.value(),
    });
    await runNigeriaPostMeetingDigestJob(admin, {
      scriptUrl: appsScriptSelfServeMailUrl.value(),
      secret: selfServeMailSecret.value(),
    });
  }
);

/**
 * Callable (digest admins): run Nigeria meeting reminders now (optional dryRun).
 */
exports.runNigeriaMeetingRemindersNow = onCall(
  {
    cors: true,
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [selfServeMailSecret, appsScriptSelfServeMailUrl],
  },
  async (request) => {
    if (!request.auth?.token?.email) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const caller = normalizeEmail(request.auth.token.email);
    if (!DIGEST_ADMIN_EMAILS.has(caller)) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }
    const data = request.data || {};
    const stats = await runNigeriaMeetingRemindersJob(
      admin,
      {
        scriptUrl: appsScriptSelfServeMailUrl.value(),
        secret: selfServeMailSecret.value(),
      },
      {
        force: data.force === true,
        dryRun: data.dryRun === true,
        siteBase: data.siteBase,
      }
    );
    const digestStats = await runNigeriaPostMeetingDigestJob(
      admin,
      {
        scriptUrl: appsScriptSelfServeMailUrl.value(),
        secret: selfServeMailSecret.value(),
      },
      {
        force: data.force === true,
        dryRun: data.dryRun === true,
        siteBase: data.siteBase,
      }
    );
    return { reminders: stats, postMeetingDigest: digestStats };
  }
);
