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
  await volRef.set(
    {
      email,
      name: data.name || '',
      phone: data.phone || '',
      notes: data.notes || '',
      shifts: data.shifts || '',
      sheetRowId: data.sheetRowId || '',
      tent: data.tent || '',
      timeslot: data.timeslot || '',
      position: data.position || '',
      mergedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

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
    const res = await fetch(
      'https://feeds.bbci.co.uk/sport/football/rss.xml',
      { headers: { 'User-Agent': 'PrayerCityDashboard/1.0' } }
    );
    if (!res.ok) return fallback;
    const xml = await res.text();
    const titles = [];
    const re = /<item[\s\S]*?<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/gi;
    let m;
    while ((m = re.exec(xml)) !== null && titles.length < 12) {
      const t = m[1].replace(/\s+/g, ' ').trim();
      if (t) titles.push(t);
    }
    if (titles.length === 0) {
      const parts = xml.split('<item').slice(1);
      for (const part of parts) {
        const tm = part.match(
          /<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/title>/
        );
        if (tm) {
          const t = (tm[1] || tm[2] || '').replace(/\s+/g, ' ').trim();
          if (t) titles.push(t);
        }
        if (titles.length >= 12) break;
      }
    }
    if (titles.length === 0) return fallback;
    const day = Math.floor(Date.now() / 86400000);
    const headline = titles[day % titles.length];
    return {
      ok: true,
      headline,
      source: 'BBC Sport (RSS)',
      tip: buildTipFromHeadline(headline),
      usedFallback: false,
    };
  } catch (e) {
    console.error('getLogisticsNewsTip', e);
    return fallback;
  }
});
