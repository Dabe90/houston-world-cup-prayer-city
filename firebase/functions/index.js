'use strict';

const express = require('express');
const { onRequest } = require('firebase-functions/v2/https');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const inviteSecret = defineSecret('INVITE_SECRET');
const selfServeMailSecret = defineSecret('SELF_SERVE_MAIL_SECRET');
const appsScriptSelfServeMailUrl = defineSecret('APPS_SCRIPT_SELF_SERVE_MAIL_URL');

/** Must match where users land after clicking the email link (your live dashboard URL). */
const SIGNIN_CONTINUE_URL =
  'https://houston-world-cup-prayer-city.vercel.app/dashboard.html';

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

  const onboardSnap = await admin
    .firestore()
    .collection('volunteer_onboarding')
    .doc(email)
    .get();

  if (!onboardSnap.exists) {
    res.status(404).json({
      error: 'not_registered',
      message:
        'No volunteer record for this email yet. Ask an organizer to send your invite from the sheet, or use the link from your original signup email.',
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

  const actionCodeSettings = {
    url: SIGNIN_CONTINUE_URL,
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
    console.error('Apps Script mail failed', mailRes.status, text);
    res.status(502).json({
      error: 'mail_failed',
      detail:
        parsed && parsed.error
          ? String(parsed.error).slice(0, 300)
          : text.slice(0, 200),
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
