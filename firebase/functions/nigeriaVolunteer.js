'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { z } = require('zod');
const admin = require('firebase-admin');
const {
  isSuperUserEmail,
  normalizeEmail,
  canViewAllNigeriaUnitReports,
  NIGERIA_REPORT_OVERVIEW_EMAILS,
} = require('./lib/adminAuth');
const { generateStructured } = require('./genkit/generateWithRetry');

const { sendMailViaAppsScript } = require('./lib/mailTransport');
const { loadOpenActionsForUser } = require('./nigeriaActionReminders');

const googleGenaiApiKey = defineSecret('GOOGLE_GENAI_API_KEY');
const appsScriptSelfServeMailUrl = defineSecret('APPS_SCRIPT_SELF_SERVE_MAIL_URL');
const selfServeMailSecret = defineSecret('SELF_SERVE_MAIL_SECRET');

const notesSummarySchema = z.object({
  executiveSummary: z.string(),
  keyTopics: z.array(z.string()).max(8),
  actionItems: z.array(z.string()).max(12),
  prayerAndFollowUps: z.array(z.string()).max(8),
});

const VISION_STATUSES = new Set(['todo', 'doing', 'done']);

function normalizeVisionStatus(status) {
  const s = String(status || 'todo').trim().toLowerCase();
  return VISION_STATUSES.has(s) ? s : 'todo';
}

/** Keep milestone progress when a leader rewrites/shares an updated plan. */
function mergeMilestoneProgress(oldPlan, newPlan) {
  if (!newPlan || typeof newPlan !== 'object') return newPlan;
  const oldList = (oldPlan && Array.isArray(oldPlan.milestones) ? oldPlan.milestones : []) || [];
  const byTitle = new Map();
  oldList.forEach((m, i) => {
    const title = String(m && m.title || '').trim().toLowerCase();
    if (title) byTitle.set(title, normalizeVisionStatus(m.status));
    byTitle.set('__idx_' + i, normalizeVisionStatus(m && m.status));
  });
  const milestones = Array.isArray(newPlan.milestones)
    ? newPlan.milestones.map((m, i) => {
        const title = String(m && m.title || '').trim().toLowerCase();
        const status =
          (title && byTitle.get(title)) ||
          byTitle.get('__idx_' + i) ||
          normalizeVisionStatus(m && m.status);
        return Object.assign({}, m, { status });
      })
    : [];
  return Object.assign({}, newPlan, { milestones });
}

function visionProgressSummary(plan) {
  const milestones = (plan && Array.isArray(plan.milestones) ? plan.milestones : []) || [];
  let done = 0;
  let doing = 0;
  milestones.forEach((m) => {
    const s = normalizeVisionStatus(m && m.status);
    if (s === 'done') done += 1;
    else if (s === 'doing') doing += 1;
  });
  const total = milestones.length;
  const pct = total ? Math.round(((done + doing * 0.5) / total) * 100) : 0;
  return { total, done, doing, todo: Math.max(0, total - done - doing), percent: pct };
}

/** Sanitize photo URLs saved on vision boards and monthly reports. */
function normalizeImageUrls(list, max = 12) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (out.length >= max) break;
    let url = '';
    let caption = '';
    if (typeof item === 'string') {
      url = item.trim();
    } else if (item && typeof item === 'object') {
      url = String(item.url || item.src || '').trim();
      caption = String(item.caption || '').trim().slice(0, 120);
    }
    if (!/^https:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(caption ? { url, caption } : { url });
  }
  return out;
}

const unitVisionPlanSchema = z.object({
  milestones: z
    .array(
      z.object({
        title: z.string(),
        targetMonth: z.string(),
        description: z.string(),
        status: z.enum(['todo', 'doing', 'done']).optional(),
      })
    )
    .max(12),
  roadmap: z
    .array(
      z.object({
        phase: z.string(),
        focus: z.string(),
        steps: z.array(z.string()).max(8),
      })
    )
    .max(6),
  howToGetThere: z.array(z.string()).max(12),
  toolsAndResources: z
    .array(
      z.object({
        name: z.string(),
        purpose: z.string(),
      })
    )
    .max(12),
});

const TZ = 'Africa/Lagos';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const NIGERIA_UNITS = [
  { id: 'moderators-presenters', label: 'Moderators & Presenters', day: 1, start: '21:30', end: '22:30' },
  { id: 'bible-study', label: 'Bible Study Team', day: 2, start: '20:30', end: '21:30' },
  { id: 'prayer', label: 'Prayer Team', day: 2, start: '23:15', end: '00:30', endNextDay: true },
  { id: 'welcome-hospitality', label: 'Welcome & Hospitality', day: 3, start: '22:00', end: '22:30' },
  { id: 'creative', label: 'Creative Unit', day: 4, start: '20:00', end: '21:00' },
  { id: 'choir', label: 'Choir', day: 0, start: '20:30', end: '21:30' },
  { id: 'growth-retention', label: 'Growth & Retention', day: 6, start: '20:00', end: '21:00' },
  { id: 'communications-social', label: 'Communications & Social Media', day: 1, start: '20:00', end: '20:30' },
  { id: 'media', label: 'Media Team', day: 6, start: '19:00', end: '20:00' },
  { id: 'group1', label: 'Group 1', day: 1, start: '21:00', end: '21:15' },
  { id: 'group2', label: 'Group 2', day: 0, start: '17:00', end: '17:15' },
  { id: 'group3', label: 'Group 3', day: 3, start: '21:00', end: '21:15' },
  { id: 'group4', label: 'Group 4', day: 4, start: '20:30', end: '20:45' },
  { id: 'group5', label: 'Group 5', day: 1, start: '21:00', end: '21:15' },
  { id: 'group6', label: 'Group 6', day: 1, start: '21:00', end: '21:15' },
  { id: 'workers-coordinator', label: 'Workers Coordinator', day: 3, start: '21:00', end: '21:30' },
  { id: 'internal-leaders', label: 'Internal Leaders Meeting', day: 0, start: '21:30', end: '22:30' },
];

const WORKERS_COORDINATOR_UNIT_ID = 'workers-coordinator';
const INTERNAL_LEADERS_UNIT_ID = 'internal-leaders';
const WORKFORCE_ACTIVE_STATUSES = ['pending_training', 'in_training'];
const WORKFORCE_ENLIST_EXCLUDE = new Set([WORKERS_COORDINATOR_UNIT_ID, INTERNAL_LEADERS_UNIT_ID]);
const SIGNUP_VIEWER_UNIT_IDS = ['welcome-hospitality', 'growth-retention', 'workers-coordinator'];

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isWorkersCoordinatorLeader(profile, isSuperUser) {
  if (isSuperUser) return true;
  return isLeaderOfUnit(profile, WORKERS_COORDINATOR_UNIT_ID, false);
}

/** Kingdom Workforce tab: Workers Coordinator leaders (and superusers) only. */
function workforceAccessForProfile(profile, isSuperUser) {
  if (isSuperUser) {
    return { canView: true, canApprove: true, leaderUnitIds: null };
  }
  if (isWorkersCoordinatorLeader(profile, false)) {
    return { canView: true, canApprove: true, leaderUnitIds: null };
  }
  return { canView: false, canApprove: false, leaderUnitIds: [] };
}

async function loadUnitLeaders(db, unitId) {
  const seen = new Map();
  const snaps = await Promise.all([
    db.collection('nigeria_volunteers').where('unitIds', 'array-contains', unitId).get(),
    db.collection('nigeria_volunteers').where('unitId', '==', unitId).get(),
  ]);
  for (const snap of snaps) {
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const email = normalizeEmail(d.email);
      if (!email || !email.includes('@')) return;
      const units = normalizeProfileUnits(d);
      const isLeader = units.some((u) => u.unitId === unitId && u.role === 'leader');
      if (!isLeader) return;
      seen.set(doc.id, {
        uid: doc.id,
        email,
        name: String(d.name || '').trim() || email.split('@')[0],
      });
    });
  }
  return [...seen.values()];
}

async function assertNoActiveWorkforceBlock(db, email) {
  const norm = normalizeEmail(email);
  if (!norm) return;
  const snap = await db
    .collection('nigeria_workforce_signups')
    .where('email', '==', norm)
    .limit(20)
    .get();
  const active = snap.docs.find((doc) => WORKFORCE_ACTIVE_STATUSES.includes(doc.data().status));
  if (active) {
    throw new HttpsError(
      'permission-denied',
      'Your Kingdom Workforce enlistment is in progress. Complete Workers Training Class — your Workers Coordinator will enable hub sign-in when you are cleared.'
    );
  }
}

function buildWorkforceWelcomeMail({ name, units }) {
  const first = String(name || 'Friend').trim().split(/\s+/)[0] || 'Friend';
  const unitLine = units.map((u) => u.unitLabel).join(', ');
  const subject = 'Welcome to the Kingdom Workforce — Dear Daughter Nigeria';
  const plainBody =
    `Hi ${first},\n\n` +
    `Thank you for enlisting in the Kingdom Workforce — the army of God serving through Dear Daughter Nigeria.\n\n` +
    `Unit(s) you chose: ${unitLine}\n\n` +
    `Next step: Workers Training Class\n` +
    `You will be onboarded through our Workers Training Class before active unit service. ` +
    `Your unit leader(s) and Workers Coordinator have been notified.\n\n` +
    `Important: You will not have hub sign-in access until you complete training and your Workers Coordinator greenlights you in the system.\n\n` +
    `We are glad you said yes to serve.\n\n` +
    `Dear Daughter Bible Study Group Nigeria\n` +
    `https://prayercityhtx.com/ng`;
  const htmlBody =
    `<div style="font-family:system-ui,sans-serif;color:#1e293b;max-width:520px;line-height:1.55">` +
    `<p>Hi <strong>${escapeHtml(first)}</strong>,</p>` +
    `<p>Thank you for enlisting in the <strong>Kingdom Workforce</strong> — the army of God serving through Dear Daughter Nigeria.</p>` +
    `<p><strong>Unit(s):</strong> ${escapeHtml(unitLine)}</p>` +
    `<p><strong>Next step — Workers Training Class</strong><br/>` +
    `You will be onboarded through Workers Training Class before active unit service. ` +
    `Your unit leader(s) and Workers Coordinator have been notified.</p>` +
    `<p><strong>Hub access:</strong> You will not be able to sign in to the volunteer hub until training is complete and your Workers Coordinator clears you.</p>` +
    `<p>We are glad you said yes to serve.<br/>Dear Daughter Nigeria</p></div>`;
  return { subject, plainBody, htmlBody };
}

function buildWorkforceLeaderNotifyMail({ leaderName, applicant, units }) {
  const unitLine = units.map((u) => u.unitLabel).join(', ');
  const subject = `Kingdom Workforce enlistment — ${applicant.name}`;
  const plainBody =
    `Hi ${leaderName},\n\n` +
    `A new Kingdom Workforce enlistment was submitted for your unit(s): ${unitLine}\n\n` +
    `Name: ${applicant.name}\n` +
    `Email: ${applicant.email}\n` +
    `Phone: ${applicant.phone}\n` +
    (applicant.city ? `City: ${applicant.city}\n` : '') +
    (applicant.notes ? `Notes: ${applicant.notes}\n` : '') +
    `\nStatus: Pending Workers Training Class\n` +
    `They cannot sign in to the hub until the Workers Coordinator greenlights them after training.\n\n` +
    `Review in the DDBS Nigeria dashboard → Kingdom Workforce tab.\n\n` +
    `Dear Daughter Nigeria`;
  const htmlBody =
    `<div style="font-family:system-ui,sans-serif;color:#1e293b;max-width:520px;line-height:1.55">` +
    `<p>Hi <strong>${escapeHtml(leaderName)}</strong>,</p>` +
    `<p>New <strong>Kingdom Workforce</strong> enlistment for: <strong>${escapeHtml(unitLine)}</strong></p>` +
    `<ul>` +
    `<li><strong>Name:</strong> ${escapeHtml(applicant.name)}</li>` +
    `<li><strong>Email:</strong> ${escapeHtml(applicant.email)}</li>` +
    `<li><strong>Phone:</strong> ${escapeHtml(applicant.phone)}</li>` +
    (applicant.city ? `<li><strong>City:</strong> ${escapeHtml(applicant.city)}</li>` : '') +
    `</ul>` +
    `<p>Status: <strong>Pending Workers Training Class</strong>. Hub access is blocked until the Workers Coordinator clears them.</p>` +
    `<p>Review in the dashboard → <strong>Kingdom Workforce</strong> tab.</p></div>`;
  return { subject, plainBody, htmlBody };
}

function buildWorkforceApprovedMail({ name }) {
  const first = String(name || 'Friend').trim().split(/\s+/)[0] || 'Friend';
  const subject = 'Cleared for hub access — Dear Daughter Nigeria';
  const plainBody =
    `Hi ${first},\n\n` +
    `Your Workers Coordinator has greenlit your Kingdom Workforce training — welcome to active service!\n\n` +
    `You may now complete volunteer registration (if you have not already) and sign in to the DDBS Nigeria hub with the same email, using your Nigeria (+234) phone on file.\n\n` +
    `Hub: https://prayercityhtx.com/ng\n\n` +
    `Dear Daughter Nigeria`;
  const htmlBody =
    `<p>Hi <strong>${escapeHtml(first)}</strong>,</p>` +
    `<p>Your <strong>Workers Coordinator</strong> has cleared you after Workers Training Class. You may now register (if needed) and <strong>sign in to the DDBS Nigeria hub</strong> with your email and Nigeria (+234) phone.</p>` +
    `<p><a href="https://prayercityhtx.com/ng">Open DDBS Nigeria hub</a></p>`;
  return { subject, plainBody, htmlBody };
}

function getUnit(id) {
  return NIGERIA_UNITS.find((u) => u.id === id);
}

function normalizeProfileUnits(profile) {
  if (!profile) return [];
  if (Array.isArray(profile.units) && profile.units.length) {
    return profile.units
      .filter((u) => u && u.unitId && (u.role === 'leader' || u.role === 'member'))
      .map((u) => {
        const unit = getUnit(u.unitId);
        return {
          unitId: u.unitId,
          unitLabel: u.unitLabel || (unit ? unit.label : u.unitId),
          role: u.role,
        };
      });
  }
  if (profile.unitId) {
    const unit = getUnit(profile.unitId);
    return [
      {
        unitId: profile.unitId,
        unitLabel: profile.unitLabel || (unit ? unit.label : profile.unitId),
        role: profile.role === 'leader' ? 'leader' : 'member',
      },
    ];
  }
  return [];
}

function isLeaderOfUnit(profile, unitId, isSuperUser) {
  if (isSuperUser) return true;
  return normalizeProfileUnits(profile).some((u) => u.unitId === unitId && u.role === 'leader');
}

function canViewMemberSignups(profile, isSuperUser) {
  if (isSuperUser) return true;
  return normalizeProfileUnits(profile).some(
    (u) => u.role === 'leader' && SIGNUP_VIEWER_UNIT_IDS.includes(u.unitId)
  );
}

function buildWelcomeSignupMail({ name }) {
  const first = String(name || 'Friend').trim().split(/\s+/)[0] || 'Friend';
  const subject = 'Welcome to Dear Daughter Bible Study Group Nigeria';
  const plainBody =
    `Hi ${first},\n\n` +
    `Thank you for signing up to join Dear Daughter Bible Study Group Nigeria!\n\n` +
    `We teach the undiluted Word of God to all nations of the world — and we are glad you said yes.\n\n` +
    `Our Welcome & Hospitality and Growth teams will reach out soon with next steps, Telegram links, and how to plug into mid-week Bible Study and programs.\n\n` +
    `Follow us: https://www.instagram.com/deardaughter_bs\n` +
    `Hub: https://prayercityhtx.com/ng\n\n` +
    `With love,\nDear Daughter Nigeria`;
  const htmlBody =
    `<p>Hi <strong>${first}</strong>,</p>` +
    `<p>Thank you for signing up to join <strong>Dear Daughter Bible Study Group Nigeria</strong>!</p>` +
    `<p>We teach the undiluted Word of God to all nations of the world — and we are glad you said yes.</p>` +
    `<p>Our Welcome &amp; Hospitality and Growth teams will reach out soon with next steps, Telegram links, and how to plug into mid-week Bible Study and programs.</p>` +
    `<p><a href="https://www.instagram.com/deardaughter_bs">@deardaughter_bs</a> · ` +
    `<a href="https://prayercityhtx.com/ng">DDBS Nigeria hub</a></p>` +
    `<p>With love,<br/>Dear Daughter Nigeria</p>`;
  return { subject, plainBody, htmlBody };
}

function parseHm(hm) {
  const p = String(hm).split(':');
  return { h: parseInt(p[0], 10), m: parseInt(p[1], 10) };
}

function ymdInLagos(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function lagosWeekday(d) {
  const w = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[w];
}

function lagosLocalToDate(dateYmd, hm) {
  const t = parseHm(hm);
  const iso =
    dateYmd +
    'T' +
    String(t.h).padStart(2, '0') +
    ':' +
    String(t.m).padStart(2, '0') +
    ':00';
  return new Date(iso + '+01:00');
}

function meetingKey(unitId, dateYmd) {
  return unitId + '_' + dateYmd;
}

function getNextMeeting(unit, fromDate = new Date()) {
  for (let i = 0; i < 14; i++) {
    const d = new Date(fromDate.getTime() + i * 86400000);
    if (lagosWeekday(d) !== unit.day) continue;
    const dateYmd = ymdInLagos(d);
    const start = lagosLocalToDate(dateYmd, unit.start);
    let endYmd = dateYmd;
    if (unit.endNextDay) {
      endYmd = ymdInLagos(new Date(d.getTime() + 86400000));
    }
    let end = lagosLocalToDate(endYmd, unit.end);
    if (end <= start) end = new Date(end.getTime() + 86400000);
    if (i === 0 && fromDate > end) continue;
    return { unitId: unit.id, dateYmd, key: meetingKey(unit.id, dateYmd), start, end };
  }
  return null;
}

const CHECK_IN_OPEN_MIN_BEFORE = 15;
const CHECK_IN_CLOSE_MIN_AFTER = 10;

const ABSENCE_WINDOW_MS = 8 * 7 * 24 * 60 * 60 * 1000;
const ABSENCE_MAX_PER_WINDOW = 2;
const EMERGENCY_WINDOW_MS = 12 * 7 * 24 * 60 * 60 * 1000;
const EMERGENCY_MAX_PER_WINDOW = 1;
const PLANNED_ABSENCE_MIN_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Attendance restart (Lagos YMD). Check-in dates begin here.
 * Misses / “absent” only count from the next day so this reset does not
 * mark the house absent for earlier meetings.
 */
const HUB_POLICY_START_YMD = '2026-09-14';
const ATTENDANCE_TRACKING_START_YMD = HUB_POLICY_START_YMD;
const ATTENDANCE_MISS_START_YMD = '2026-09-15';
/** Units that start attendance later than the hub-wide policy date. */
const UNIT_ATTENDANCE_START_YMD = {
  'internal-leaders': '2026-09-14',
};

function policyEpochStartDate() {
  return lagosLocalToDate(HUB_POLICY_START_YMD, '00:00');
}

function trackingStartYmd(unitId) {
  return UNIT_ATTENDANCE_START_YMD[unitId] || HUB_POLICY_START_YMD;
}

function meetingUnitId(m) {
  if (!m) return '';
  if (m.unitId) return m.unitId;
  const key = String(m.key || '');
  const cut = key.lastIndexOf('_');
  return cut > 0 ? key.slice(0, cut) : '';
}

function meetingInTrackingPeriod(m) {
  if (!m || !m.dateYmd) return false;
  return String(m.dateYmd) >= trackingStartYmd(meetingUnitId(m));
}

function meetingCountsAsAbsence(m) {
  return !!(m && meetingInTrackingPeriod(m) && String(m.dateYmd) >= ATTENDANCE_MISS_START_YMD);
}

/** Fixed consecutive windows from HUB_POLICY_START_YMD (not a lookback into the past). */
function currentPolicyWindow(now, windowMs) {
  const epoch = policyEpochStartDate().getTime();
  const t = (now || new Date()).getTime();
  if (t < epoch) {
    return { start: new Date(epoch), end: new Date(epoch + windowMs), index: 0 };
  }
  const index = Math.floor((t - epoch) / windowMs);
  const startMs = epoch + index * windowMs;
  return {
    start: new Date(startMs),
    end: new Date(startMs + windowMs),
    index,
  };
}

function isWithinCheckInWindow(meeting, now = new Date()) {
  const open = new Date(meeting.start.getTime() - CHECK_IN_OPEN_MIN_BEFORE * 60000);
  const close = new Date(meeting.end.getTime() + CHECK_IN_CLOSE_MIN_AFTER * 60000);
  return now >= open && now <= close;
}

function meetingsInMonth(unit, year, month) {
  const out = [];
  const d = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  while (d <= end) {
    if (lagosWeekday(d) === unit.day) {
      const dateYmd = ymdInLagos(d);
      const start = lagosLocalToDate(dateYmd, unit.start);
      let endYmd = dateYmd;
      if (unit.endNextDay) {
        endYmd = ymdInLagos(new Date(d.getTime() + 86400000));
      }
      let endDt = lagosLocalToDate(endYmd, unit.end);
      if (endDt <= start) endDt = new Date(endDt.getTime() + 86400000);
      out.push({
        unitId: unit.id,
        key: meetingKey(unit.id, dateYmd),
        dateYmd,
        start,
        end: endDt,
      });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function normalizeNigeriaPhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('234')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length < 9 || digits.length > 11) return null;
  return '+234' + digits;
}

function isNigeriaPhoneRegistered(phone) {
  const raw = String(phone || '').replace(/\s/g, '');
  if (/^\+234\d{9,11}$/.test(raw)) return true;
  if (/^234\d{9,11}$/.test(raw)) return true;
  if (/^0[789]\d{9}$/.test(raw)) return true;
  return false;
}

function phoneFromRegistration(phone) {
  const normalized = normalizeNigeriaPhone(phone);
  if (normalized) return normalized;
  const raw = String(phone || '').replace(/\s/g, '');
  if (/^234\d{9,11}$/.test(raw)) return '+' + raw;
  return null;
}

/**
 * Bridge an approved Nigeria applicant into a login-capable volunteers/{uid}
 * record on their first sign-in. The approval step writes an email-keyed
 * volunteer_onboarding doc; here we materialize it under the actual uid.
 * Returns the created volunteer data, or null when there is nothing to bridge.
 */
async function provisionNigeriaVolunteerFromOnboarding(db, uid, email) {
  if (!email) return null;
  const onboardSnap = await db.collection('volunteer_onboarding').doc(email).get();
  if (!onboardSnap.exists) return null;
  const onboard = onboardSnap.data() || {};
  const phone = phoneFromRegistration(onboard.phone) || onboard.phone || '';
  if (!isNigeriaPhoneRegistered(phone)) return null;
  const provisioned = {
    email,
    name: onboard.name || '',
    phone,
    notes: onboard.notes || '',
    region: 'nigeria',
    source: onboard.source || 'nigeria_workforce',
    createdFromOnboardingAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('volunteers').doc(uid).set(provisioned, { merge: true });
  return provisioned;
}

async function assertNigeriaVolunteerAccess(db, uid, authToken) {
  const email = normalizeEmail(authToken?.token?.email || authToken?.email);
  if (email && isSuperUserEmail(email)) {
    const vSnap = await db.collection('volunteers').doc(uid).get();
    const volunteer = vSnap.exists ? { ...vSnap.data() } : { email, name: 'Coordinator' };
    const phone = phoneFromRegistration(volunteer.phone) || '+2348000000000';
    return {
      volunteer,
      phone,
      email: email || volunteer.email || '',
      isSuperUser: true,
    };
  }

  const vSnap = await db.collection('volunteers').doc(uid).get();
  let volunteer;
  if (vSnap.exists) {
    volunteer = vSnap.data();
  } else {
    volunteer = await provisionNigeriaVolunteerFromOnboarding(db, uid, email);
    if (!volunteer) {
      throw new HttpsError(
        'failed-precondition',
        'Complete volunteer sign-up first, then sign in here with the same email.'
      );
    }
  }
  const phone = volunteer.phone || '';
  // Any already-registered volunteer may join the Nigeria hub — including people
  // who signed up on the US hub before the Nigeria hub existed. After signing in
  // they pick their unit(s) and role (member/leader). A Nigeria (+234) phone is
  // preferred (it powers WhatsApp follow-up in the leader roster) but is no
  // longer required for access.
  await assertNoActiveWorkforceBlock(db, volunteer.email || email);
  return {
    volunteer,
    phone: phoneFromRegistration(phone) || phone || '',
    email: volunteer.email || email || '',
    isSuperUser: false,
  };
}

function attendanceInsight(rate) {
  if (rate >= 85) return { level: 'excellent', message: 'Outstanding consistency — keep shining!' };
  if (rate >= 70) return { level: 'good', message: 'You are doing well — stay steady!' };
  if (rate >= 50) return { level: 'fair', message: 'Room to grow — try to join the next meeting.' };
  return { level: 'low', message: 'We miss you — your unit needs you this week.' };
}

function computeConsecutiveMisses(pastMeetings, attendedKeys, excusedKeys = new Set()) {
  let count = 0;
  for (let i = pastMeetings.length - 1; i >= 0; i--) {
    const key = pastMeetings[i].key;
    if (attendedKeys.has(key) || excusedKeys.has(key)) break;
    count++;
  }
  return count;
}

const STRIKE_WINDOW_WEEKS = 8;
const STRIKE_WINDOW_MS = STRIKE_WINDOW_WEEKS * 7 * 86400000;
/** A check-in only counts as "late" once this many minutes past the start have passed. */
const LATE_GRACE_MS = 5 * 60 * 1000;

/**
 * Counts, within the last 8 weeks, how many meetings a member missed and how
 * many they joined late (checked in after the meeting had already started).
 * Excused absences never count. Each miss or late arrival is one "strike".
 * The window never starts before HUB_POLICY_START_YMD, and misses are not
 * counted before ATTENDANCE_MISS_START_YMD.
 */
function computeStrikeWindowStats(allPast, attendedKeys, excusedKeys, checkedInAtByKey, now) {
  const epochMs = policyEpochStartDate().getTime();
  const windowStart = Math.max(now.getTime() - STRIKE_WINDOW_MS, epochMs);
  let missed = 0;
  let late = 0;
  (allPast || []).forEach((m) => {
    if (!meetingInTrackingPeriod(m)) return;
    if (m.start.getTime() < windowStart) return;
    if (excusedKeys.has(m.key)) return;
    if (attendedKeys.has(m.key)) {
      const at = checkedInAtByKey[m.key];
      if (at && at > m.start.getTime() + LATE_GRACE_MS) late += 1;
    } else if (meetingCountsAsAbsence(m)) {
      missed += 1;
    }
  });
  return { missed, late, strikes: missed + late, windowWeeks: STRIKE_WINDOW_WEEKS };
}

function describeStrikes(missed, late) {
  const parts = [];
  if (missed > 0) parts.push('missed ' + missed + ' meeting' + (missed === 1 ? '' : 's'));
  if (late > 0) parts.push('come late ' + late + ' time' + (late === 1 ? '' : 's'));
  if (!parts.length) return 'had some attendance issues';
  return parts.join(' and ');
}

/**
 * Warning tiers based on strikes (missed OR late meetings) in the last 8 weeks
 * for a single unit. Multi-unit members are scored separately per unit — missing
 * Unit A never triggers withdrawal messaging for Unit B.
 */
function attendanceMissWarning(strikeStats, unitLabel) {
  const stats = strikeStats || { missed: 0, late: 0, strikes: 0, windowWeeks: STRIKE_WINDOW_WEEKS };
  const strikes = stats.strikes || 0;
  const detail = describeStrikes(stats.missed || 0, stats.late || 0);
  const unitName = String(unitLabel || 'this unit').trim() || 'this unit';
  const base = {
    consecutiveMisses: strikes,
    strikes,
    missed: stats.missed || 0,
    late: stats.late || 0,
    windowWeeks: STRIKE_WINDOW_WEEKS,
    unitLabel: unitName,
  };
  if (strikes >= 4) {
    return Object.assign({}, base, {
      tier: 'withdrawal',
      level: 'critical',
      title: 'Unit withdrawal notice — ' + unitName,
      message:
        'In the last 8 weeks for ' +
        unitName +
        ' you have ' +
        detail +
        '. Withdrawal from this unit may be initiated soon unless you attend the next ' +
        unitName +
        ' meetings on time. This does not affect your other units. Please contact your unit leader immediately.',
    });
  }
  if (strikes >= 3) {
    return Object.assign({}, base, {
      tier: 'final',
      level: 'critical',
      title: 'Final attendance warning — ' + unitName,
      message:
        'In the last 8 weeks for ' +
        unitName +
        ' you have ' +
        detail +
        '. This is your final warning for this unit — one more missed or late ' +
        unitName +
        ' meeting and withdrawal from this unit may be initiated. Your other units are unaffected.',
    });
  }
  if (strikes >= 2) {
    return Object.assign({}, base, {
      tier: 'warning',
      level: 'warn',
      title: 'Attendance warning — ' + unitName,
      message:
        'In the last 8 weeks for ' +
        unitName +
        ' you have ' +
        detail +
        '. Please attend your next ' +
        unitName +
        ' meetings on time. This warning applies only to this unit.',
    });
  }
  return null;
}

async function loadExcusedMeetingKeys(db, uid, unitId) {
  const snap = await db
    .collection('nigeria_absence_requests')
    .where('uid', '==', uid)
    .where('unitId', '==', unitId)
    .where('status', '==', 'approved')
    .get();
  const keys = new Set();
  snap.docs.forEach((doc) => {
    const mk = doc.data().meetingKey;
    if (mk) keys.add(mk);
  });
  return keys;
}

async function getAbsenceQuotas(db, uid, unitId, now = new Date()) {
  const win8 = currentPolicyWindow(now, ABSENCE_WINDOW_MS);
  const win12 = currentPolicyWindow(now, EMERGENCY_WINDOW_MS);
  const snap = await db
    .collection('nigeria_absence_requests')
    .where('uid', '==', uid)
    .where('unitId', '==', unitId)
    .get();

  let usedInWindow = 0;
  let emergencyUsedInWindow = 0;

  snap.docs.forEach((doc) => {
    const d = doc.data();
    const created = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : null;
    // Prefer meeting date when present so June / pre-hub requests never burn the new period.
    const meetingYmd = d.meetingDateYmd ? String(d.meetingDateYmd) : '';
    if (meetingYmd && meetingYmd < HUB_POLICY_START_YMD) return;
    if (!created && !meetingYmd) return;

    const in8 =
      created
        ? created >= win8.start && created < win8.end
        : meetingYmd >= ymdInLagos(win8.start) && meetingYmd < ymdInLagos(win8.end);
    if (in8) usedInWindow++;

    if (d.type === 'emergency') {
      const in12 =
        created
          ? created >= win12.start && created < win12.end
          : meetingYmd >= ymdInLagos(win12.start) && meetingYmd < ymdInLagos(win12.end);
      if (in12) emergencyUsedInWindow++;
    }
  });

  const emergencyAvailable = emergencyUsedInWindow < EMERGENCY_MAX_PER_WINDOW;
  return {
    windowWeeks: 8,
    maxRequests: ABSENCE_MAX_PER_WINDOW,
    usedInWindow,
    remaining: Math.max(0, ABSENCE_MAX_PER_WINDOW - usedInWindow),
    windowStartsAt: win8.start.toISOString(),
    windowEndsAt: win8.end.toISOString(),
    windowStartYmd: ymdInLagos(win8.start),
    windowEndYmd: ymdInLagos(new Date(win8.end.getTime() - 86400000)),
    emergencyWindowWeeks: 12,
    emergencyMax: EMERGENCY_MAX_PER_WINDOW,
    emergencyUsedInWindow,
    emergencyAvailable,
    emergencyWindowStartsAt: win12.start.toISOString(),
    emergencyWindowEndsAt: win12.end.toISOString(),
    emergencyResetsAt: win12.end.toISOString(),
  };
}

async function pastMeetingsForUnit(db, unitId, monthsBack = 6) {
  const unit = getUnit(unitId);
  if (!unit) return [];
  const now = new Date();
  const lagosYmd = ymdInLagos(now);
  const year = parseInt(lagosYmd.slice(0, 4), 10);
  const month = parseInt(lagosYmd.slice(5, 7), 10);
  const all = [];
  for (let i = 0; i < monthsBack; i++) {
    let y = year;
    let m = month - i;
    while (m <= 0) {
      m += 12;
      y--;
    }
    all.push(...meetingsInMonth(unit, y, m));
  }
  return all
    .filter((m) => m.end <= now && meetingInTrackingPeriod(m))
    .sort((a, b) => a.start - b.start);
}

async function computeUserAttendanceStats(db, uid, unitId, year, month) {
  const unit = getUnit(unitId);
  if (!unit) return null;
  const scheduled = meetingsInMonth(unit, year, month);
  const now = new Date();
  // Only meetings on/after tracking start count for misses, rate, and streaks.
  const pastScheduled = scheduled.filter((m) => m.end <= now && meetingInTrackingPeriod(m));

  const snap = await db
    .collection('nigeria_attendance')
    .where('uid', '==', uid)
    .where('unitId', '==', unitId)
    .get();

  const attendedKeys = new Set();
  const checkedInAtByKey = {};
  snap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.meetingKey) {
      attendedKeys.add(d.meetingKey);
      const at = d.checkedInAt && d.checkedInAt.toDate ? d.checkedInAt.toDate().getTime() : null;
      if (at) checkedInAtByKey[d.meetingKey] = at;
    }
  });

  const excusedKeys = await loadExcusedMeetingKeys(db, uid, unitId);

  const attendedPast = pastScheduled.filter((m) => meetingPresentOrExcused(m.key, attendedKeys, excusedKeys));
  const missedPast = pastScheduled.filter(
    (m) => meetingCountsAsAbsence(m) && !meetingPresentOrExcused(m.key, attendedKeys, excusedKeys)
  );
  const rate = pastScheduled.length
    ? Math.round((attendedPast.length / pastScheduled.length) * 100)
    : null;

  const allPast = await pastMeetingsForUnit(db, unitId, 6);
  const consecutiveMisses = computeConsecutiveMisses(allPast, attendedKeys, excusedKeys);
  const strikeStats = computeStrikeWindowStats(allPast, attendedKeys, excusedKeys, checkedInAtByKey, now);
  const missWarning = attendanceMissWarning(strikeStats, unit.label);

  return {
    year,
    month,
    scheduledCount: scheduled.length,
    pastScheduledCount: pastScheduled.length,
    attendedCount: attendedPast.length,
    missedCount: missedPast.length,
    consecutiveMisses,
    missed8Weeks: strikeStats.missed,
    late8Weeks: strikeStats.late,
    strikes8Weeks: strikeStats.strikes,
    missWarning,
    attendanceRate: rate,
    insight: rate != null ? attendanceInsight(rate) : null,
    attendedDates: attendedPast.map((m) => m.dateYmd),
    missedDates: missedPast.map((m) => m.dateYmd),
    bestStreak: computeStreak(pastScheduled, attendedKeys, excusedKeys, true),
    currentStreak: computeStreak(pastScheduled, attendedKeys, excusedKeys, false),
  };
}

function meetingPresentOrExcused(key, attendedKeys, excusedKeys) {
  return attendedKeys.has(key) || excusedKeys.has(key);
}

function computeStreak(pastMeetings, attendedKeys, excusedKeys, longest) {
  let streak = 0;
  let best = 0;
  for (const m of pastMeetings) {
    if (meetingPresentOrExcused(m.key, attendedKeys, excusedKeys)) {
      streak++;
      best = Math.max(best, streak);
    } else {
      if (!longest) return streak;
      streak = 0;
    }
  }
  return longest ? best : streak;
}

async function loadUnitMembers(db, unitId) {
  const seen = new Map();
  const snaps = await Promise.all([
    db.collection('nigeria_volunteers').where('unitIds', 'array-contains', unitId).get(),
    db.collection('nigeria_volunteers').where('unitId', '==', unitId).get(),
  ]);
  for (const snap of snaps) {
    snap.forEach((doc) => {
      if (seen.has(doc.id)) return;
      const d = doc.data() || {};
      const units = normalizeProfileUnits(d);
      const mine = units.find((u) => u.unitId === unitId);
      if (!mine) return;
      seen.set(doc.id, {
        uid: doc.id,
        name: String(d.name || '').trim() || (d.email ? String(d.email).split('@')[0] : 'Member'),
        phone: String(d.phone || '').trim(),
        email: normalizeEmail(d.email),
        role: mine.role,
      });
    });
  }
  return [...seen.values()];
}

/**
 * People who enlisted for this unit via Kingdom Workforce but are not yet on
 * the nigeria_volunteers roster (still in training / approved, awaiting hub profile).
 */
async function loadPendingWorkforceForUnit(db, unitId, existingEmails = new Set()) {
  try {
    const snap = await db
      .collection('nigeria_workforce_signups')
      .where('unitIds', 'array-contains', unitId)
      .limit(80)
      .get();
    const pending = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const status = String(d.status || '');
      if (!['pending_training', 'in_training', 'approved'].includes(status)) return;
      const email = normalizeEmail(d.email);
      if (email && existingEmails.has(email)) return;
      pending.push({
        uid: 'wf_' + doc.id,
        signupId: doc.id,
        name: String(d.name || '').trim() || (email ? email.split('@')[0] : 'Applicant'),
        phone: String(d.phone || '').trim(),
        email,
        role: 'member',
        pendingWorkforce: true,
        workforceStatus: status,
        missed: 0,
        late: 0,
        strikes: 0,
        tier: 'pending',
        level: 'pending',
      });
    });
    pending.sort((a, b) => a.name.localeCompare(b.name));
    return pending;
  } catch (err) {
    console.warn('[loadPendingWorkforceForUnit]', unitId, err && err.message);
    return [];
  }
}

/**
 * Leader-only roster of every member in a unit, each with their 8-week strike
 * status (missed / late / withdrawal risk). Lets a leader see at a glance who
 * needs a nudge and who has hit the withdrawal notice (so they can remove them
 * from the WhatsApp group).
 */
async function computeUnitRoster(db, unitId, now = new Date()) {
  const unit = getUnit(unitId);
  if (!unit) return { roster: [], recentMeetings: [] };
  try {
    const members = await loadUnitMembers(db, unitId);
    const existingEmails = new Set(
      members.map((m) => normalizeEmail(m.email)).filter(Boolean)
    );

    const allPast = await pastMeetingsForUnit(db, unitId, 6);
    const recentMeetingsList = allPast.slice(-8);

    const attSnap = await db.collection('nigeria_attendance').where('unitId', '==', unitId).get();
    const attByUid = {};
    const attByMeeting = {};
    attSnap.forEach((doc) => {
      const d = doc.data() || {};
      if (!d.uid || !d.meetingKey) return;
      const rec = attByUid[d.uid] || (attByUid[d.uid] = { keys: new Set(), at: {} });
      rec.keys.add(d.meetingKey);
      const atMs = d.checkedInAt && d.checkedInAt.toDate ? d.checkedInAt.toDate().getTime() : null;
      if (atMs) rec.at[d.meetingKey] = atMs;
      const list = attByMeeting[d.meetingKey] || (attByMeeting[d.meetingKey] = []);
      list.push({
        uid: d.uid,
        name: String(d.name || '').trim() || 'Member',
        checkedInAtMs: atMs,
        checkedInAtIso: atMs ? new Date(atMs).toISOString() : null,
      });
    });

    const absSnap = await db
      .collection('nigeria_absence_requests')
      .where('unitId', '==', unitId)
      .where('status', '==', 'approved')
      .get();
    const excusedByUid = {};
    const excusedByMeeting = {};
    absSnap.forEach((doc) => {
      const d = doc.data() || {};
      if (!d.uid || !d.meetingKey) return;
      (excusedByUid[d.uid] || (excusedByUid[d.uid] = new Set())).add(d.meetingKey);
      const list = excusedByMeeting[d.meetingKey] || (excusedByMeeting[d.meetingKey] = []);
      list.push({
        uid: d.uid,
        name: String(d.name || '').trim() || 'Member',
        type: d.type || 'planned',
      });
    });

    const roster = members.map((m) => {
      const att = attByUid[m.uid] || { keys: new Set(), at: {} };
      const excused = excusedByUid[m.uid] || new Set();
      const strikeStats = computeStrikeWindowStats(allPast, att.keys, excused, att.at, now);
      const warning = attendanceMissWarning(strikeStats, unit.label);
      const checkIns = recentMeetingsList.map((mtg) => {
        const present = att.keys.has(mtg.key);
        const isExcused = excused.has(mtg.key);
        const atMs = att.at[mtg.key] || null;
        const late = !!(present && atMs && atMs > mtg.start.getTime() + LATE_GRACE_MS);
        return {
          meetingKey: mtg.key,
          dateYmd: mtg.dateYmd,
          dayName: mtg.dayName || DAY_NAMES[unit.day],
          status: present
            ? 'present'
            : isExcused
              ? 'excused'
              : meetingCountsAsAbsence(mtg)
                ? 'missed'
                : 'pending',
          checkedInAtIso: atMs ? new Date(atMs).toISOString() : null,
          late,
        };
      });
      return {
        uid: m.uid,
        name: m.name,
        phone: m.phone,
        email: m.email,
        role: m.role,
        missed: strikeStats.missed,
        late: strikeStats.late,
        strikes: strikeStats.strikes,
        tier: warning ? warning.tier : 'ok',
        level: warning ? warning.level : 'ok',
        checkIns,
      };
    });

    const tierRank = { withdrawal: 0, final: 1, warning: 2, pending: 3, ok: 4 };
    roster.sort((a, b) => {
      const ra = tierRank[a.tier] != null ? tierRank[a.tier] : 4;
      const rb = tierRank[b.tier] != null ? tierRank[b.tier] : 4;
      if (ra !== rb) return ra - rb;
      if (b.strikes !== a.strikes) return b.strikes - a.strikes;
      return a.name.localeCompare(b.name);
    });

    const memberByUid = new Map(members.map((m) => [m.uid, m]));
    const recentMeetings = recentMeetingsList
      .slice()
      .reverse()
      .map((mtg) => {
        const present = (attByMeeting[mtg.key] || [])
          .map((p) => {
            const mem = memberByUid.get(p.uid);
            return {
              uid: p.uid,
              name: (mem && mem.name) || p.name,
              checkedInAtIso: p.checkedInAtIso,
              late: !!(p.checkedInAtMs && p.checkedInAtMs > mtg.start.getTime() + LATE_GRACE_MS),
            };
          })
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const excused = (excusedByMeeting[mtg.key] || [])
          .map((e) => {
            const mem = memberByUid.get(e.uid);
            return {
              uid: e.uid,
              name: (mem && mem.name) || e.name,
              type: e.type,
            };
          })
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const presentIds = new Set(present.map((p) => p.uid));
        const excusedIds = new Set(excused.map((e) => e.uid));
        const absent = meetingCountsAsAbsence(mtg)
          ? members
              .filter((m) => !presentIds.has(m.uid) && !excusedIds.has(m.uid))
              .map((m) => ({ uid: m.uid, name: m.name }))
              .sort((a, b) => String(a.name).localeCompare(String(b.name)))
          : [];
        return {
          meetingKey: mtg.key,
          dateYmd: mtg.dateYmd,
          dayName: mtg.dayName || DAY_NAMES[unit.day],
          startIso: mtg.start.toISOString(),
          presentCount: present.length,
          memberCount: members.length,
          present,
          excused,
          absent,
        };
      });

    const pending = await loadPendingWorkforceForUnit(db, unitId, existingEmails);
    return { roster: roster.concat(pending), recentMeetings };
  } catch (err) {
    console.warn('[computeUnitRoster]', unitId, err && err.message);
    return { roster: [], recentMeetings: [] };
  }
}

async function computeUnitAttendanceForReport(db, unitId, year, month) {
  const empty = {
    memberCount: 0,
    meetingsHeld: 0,
    totalCheckIns: 0,
    averageAttendancePerMeeting: 0,
    averageAttendanceRate: null,
    highestAttendance: null,
    lowestAttendance: null,
    meetingBreakdown: [],
  };
  const unit = getUnit(String(unitId || '').trim());
  if (!unit) return empty;

  const scheduled = meetingsInMonth(unit, year, month);
  const now = new Date();
  const pastScheduled = scheduled.filter((m) => m.end <= now);

  const membersSnap = await db.collection('nigeria_volunteers').where('unitId', '==', unitId).get();
  const memberCount = membersSnap.size;

  const attSnap = await db
    .collection('nigeria_attendance')
    .where('unitId', '==', unitId)
    .get();

  const byMeeting = {};
  pastScheduled.forEach((m) => {
    byMeeting[m.key] = { dateYmd: m.dateYmd, count: 0, attendees: [] };
  });

  attSnap.docs.forEach((doc) => {
    const d = doc.data();
    const mk = d.meetingKey;
    if (!byMeeting[mk]) return;
    const dateYmd = d.meetingDateYmd || '';
    if (!dateYmd.startsWith(String(year) + '-')) return;
    const mMonth = parseInt(dateYmd.slice(5, 7), 10);
    if (mMonth !== month) return;
    byMeeting[mk].count++;
    byMeeting[mk].attendees.push({ name: d.name || '', uid: d.uid });
  });

  const meetings = Object.values(byMeeting);
  let highest = null;
  let lowest = null;
  meetings.forEach((m) => {
    if (!highest || m.count > highest.count) highest = m;
    if (!lowest || m.count < lowest.count) lowest = m;
  });

  const totalCheckIns = meetings.reduce((s, m) => s + m.count, 0);
  const avgPerMeeting = meetings.length ? Math.round((totalCheckIns / meetings.length) * 10) / 10 : 0;
  const avgPerMember =
    memberCount && meetings.length
      ? Math.round((totalCheckIns / (memberCount * meetings.length)) * 100)
      : null;

  return {
    memberCount,
    meetingsHeld: pastScheduled.length,
    totalCheckIns,
    averageAttendancePerMeeting: avgPerMeeting,
    averageAttendanceRate: avgPerMember,
    highestAttendance: highest
      ? { date: highest.dateYmd, count: highest.count }
      : null,
    lowestAttendance: lowest ? { date: lowest.dateYmd, count: lowest.count } : null,
    meetingBreakdown: meetings,
  };
}

function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  return request.auth.uid;
}

const saveNigeriaProfile = onCall(async (request) => {
  const uid = requireAuth(request);
  const { name, units, unitId, role, photoURL } = request.data || {};
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);

  let normalizedUnits = [];
  if (Array.isArray(units) && units.length) {
    for (const entry of units) {
      const unit = getUnit(entry.unitId);
      if (!unit) throw new HttpsError('invalid-argument', 'Invalid unit: ' + entry.unitId);
      if (entry.role !== 'leader' && entry.role !== 'member') {
        throw new HttpsError('invalid-argument', 'Role must be leader or member.');
      }
      normalizedUnits.push({
        unitId: entry.unitId,
        unitLabel: unit.label,
        role: entry.role,
      });
    }
  } else if (unitId) {
    const unit = getUnit(unitId);
    if (!unit) throw new HttpsError('invalid-argument', 'Invalid unit.');
    if (role !== 'leader' && role !== 'member') {
      throw new HttpsError('invalid-argument', 'Role must be leader or member.');
    }
    normalizedUnits.push({ unitId, unitLabel: unit.label, role });
  }

  if (!normalizedUnits.length) {
    throw new HttpsError('invalid-argument', 'Select at least one unit.');
  }

  const displayName = String(name || access.volunteer.name || '').trim();
  if (!displayName) {
    throw new HttpsError('invalid-argument', 'Name required.');
  }

  const primary = normalizedUnits[0];
  const patch = {
    uid,
    email: access.email,
    name: displayName,
    phone: access.phone,
    units: normalizedUnits,
    unitIds: normalizedUnits.map((u) => u.unitId),
    unitId: primary.unitId,
    unitLabel: primary.unitLabel,
    role: primary.role,
    region: 'nigeria',
    isSuperUser: access.isSuperUser === true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (photoURL) patch.photoURL = String(photoURL).trim();

  await db.collection('nigeria_volunteers').doc(uid).set(patch, { merge: true });

  // Flag the site-wide volunteer record so the US hub routes this person to the
  // Nigeria hub on future sign-ins, even if their phone is not a +234 number
  // (e.g. a Nigerian leader living abroad with a foreign phone).
  try {
    await db.collection('volunteers').doc(uid).set({ nigeriaHub: true }, { merge: true });
  } catch (ignore) {}

  return { ok: true, units: normalizedUnits };
});

/**
 * Coordinator/leader control to correct a member's role in a unit (since anyone
 * who signs in picks their own role). Supports promoting to leader (assistant),
 * demoting to member, and removing from the unit.
 *   role: 'leader' | 'member' | 'remove'
 * Superusers may manage anyone; a unit leader may manage members of their unit
 * but may not change or remove another leader (only a coordinator can).
 */
const setNigeriaMemberRole = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);

  const data = request.data || {};
  const unitId = String(data.unitId || '').trim();
  const targetUid = String(data.targetUid || '').trim();
  const action = String(data.role || '').trim();
  if (!unitId || !getUnit(unitId)) throw new HttpsError('invalid-argument', 'Invalid unit.');
  if (!targetUid) throw new HttpsError('invalid-argument', 'Target member required.');
  if (!['leader', 'member', 'remove'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Action must be leader, member, or remove.');
  }

  const callerSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  const callerProfile = callerSnap.exists ? callerSnap.data() : null;
  const isSuper =
    access.isSuperUser === true || (callerProfile && callerProfile.isSuperUser === true);
  const callerIsLeader = isLeaderOfUnit(callerProfile, unitId, isSuper);
  if (!isSuper && !callerIsLeader) {
    throw new HttpsError('permission-denied', 'Only unit leaders or coordinators can manage members.');
  }

  const targetSnap = await db.collection('nigeria_volunteers').doc(targetUid).get();
  if (!targetSnap.exists) {
    throw new HttpsError('failed-precondition', 'That member has no Nigeria profile yet.');
  }
  const targetProfile = targetSnap.data();
  let units = normalizeProfileUnits(targetProfile);
  const existing = units.find((u) => u.unitId === unitId);
  if (!existing) {
    throw new HttpsError('failed-precondition', 'That person is not in this unit.');
  }
  if (!isSuper && existing.role === 'leader') {
    throw new HttpsError(
      'permission-denied',
      'Only a coordinator can change or remove another leader.'
    );
  }

  if (action === 'remove') {
    units = units.filter((u) => u.unitId !== unitId);
  } else {
    existing.role = action;
  }

  const patch = {
    units,
    unitIds: units.map((u) => u.unitId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (units.length) {
    patch.unitId = units[0].unitId;
    patch.unitLabel = units[0].unitLabel;
    patch.role = units[0].role;
  } else {
    patch.unitId = admin.firestore.FieldValue.delete();
    patch.unitLabel = admin.firestore.FieldValue.delete();
    patch.role = admin.firestore.FieldValue.delete();
  }
  await db.collection('nigeria_volunteers').doc(targetUid).set(patch, { merge: true });

  try {
    await db
      .collection('volunteers')
      .doc(targetUid)
      .set({ nigeriaHub: units.length > 0 }, { merge: true });
  } catch (ignore) {}

  const result = await computeUnitRoster(db, unitId, new Date());
  return { ok: true, roster: result.roster || [] };
});

const recordNigeriaAttendance = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileRef = db.collection('nigeria_volunteers').doc(uid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }
  const profile = profileSnap.data();
  const profileUnits = normalizeProfileUnits(profile);
  if (!profileUnits.length) {
    throw new HttpsError('failed-precondition', 'Add at least one unit to your profile.');
  }

  const reqUnitId = String(request.data?.unitId || profile.unitId || profileUnits[0].unitId || '');
  const membership = profileUnits.find((u) => u.unitId === reqUnitId) || profileUnits[0];
  const unit = getUnit(membership.unitId);
  if (!unit) throw new HttpsError('failed-precondition', 'Invalid unit on profile.');

  const next = getNextMeeting(unit);
  if (!next) throw new HttpsError('failed-precondition', 'No upcoming meeting found.');

  const now = new Date();
  const inWindow = isWithinCheckInWindow(next, now);
  const meeting = next;

  if (!inWindow) {
    const prev = getNextMeeting(unit, new Date(meeting.start.getTime() - 86400000));
    if (prev && isWithinCheckInWindow(prev, now)) {
      Object.assign(meeting, prev);
    } else {
      throw new HttpsError(
        'failed-precondition',
        `Check-in opens ${CHECK_IN_OPEN_MIN_BEFORE} minutes before meeting and closes ${CHECK_IN_CLOSE_MIN_AFTER} minutes after.`
      );
    }
  }

  const docId = uid + '_' + meeting.key;
  const existing = await db.collection('nigeria_attendance').doc(docId).get();
  if (existing.exists) {
    return {
      ok: true,
      alreadyCheckedIn: true,
      checkedInAt: existing.data().checkedInAt,
      meetingKey: meeting.key,
      unitId: membership.unitId,
    };
  }

  const record = {
    uid,
    unitId: membership.unitId,
    unitLabel: membership.unitLabel,
    name: profile.name,
    phone: profile.phone,
    role: membership.role,
    meetingKey: meeting.key,
    meetingDateYmd: meeting.dateYmd,
    checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('nigeria_attendance').doc(docId).set(record);

  const year = parseInt(ymdInLagos(now).slice(0, 4), 10);
  const month = parseInt(ymdInLagos(now).slice(5, 7), 10);
  const stats = await computeUserAttendanceStats(db, uid, membership.unitId, year, month);
  await profileRef.set({ lastAttendanceAt: record.checkedInAt, attendanceStats: stats }, { merge: true });

  return {
    ok: true,
    alreadyCheckedIn: false,
    meetingKey: meeting.key,
    stats,
    unitId: membership.unitId,
  };
});

function canSubmitEmergencyAbsence(meeting, now = new Date()) {
  const open = new Date(meeting.start.getTime() - CHECK_IN_OPEN_MIN_BEFORE * 60000);
  return now >= open && now <= meeting.end;
}

function canSubmitPlannedAbsence(meeting, now = new Date()) {
  return meeting.start.getTime() - now.getTime() >= PLANNED_ABSENCE_MIN_MS;
}

function meetingFromKey(unitId, meetingKeyStr) {
  const unit = getUnit(unitId);
  if (!unit) return null;
  const prefix = unitId + '_';
  if (!String(meetingKeyStr).startsWith(prefix)) return null;
  const dateYmd = String(meetingKeyStr).slice(prefix.length);
  const start = lagosLocalToDate(dateYmd, unit.start);
  let endYmd = dateYmd;
  if (unit.endNextDay) {
    endYmd = ymdInLagos(new Date(lagosLocalToDate(dateYmd, '12:00').getTime() + 86400000));
  }
  let end = lagosLocalToDate(endYmd, unit.end);
  if (end <= start) end = new Date(end.getTime() + 86400000);
  return { unitId, dateYmd, key: meetingKeyStr, start, end };
}

const submitNigeriaAbsenceRequest = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }
  const profile = profileSnap.data();
  const profileUnits = normalizeProfileUnits(profile);
  const unitId = String(request.data?.unitId || '').trim();
  const meetingKeyStr = String(request.data?.meetingKey || '').trim();
  const type = String(request.data?.type || '').trim();
  const reason = String(request.data?.reason || '').trim().slice(0, 500);

  if (!unitId || !meetingKeyStr || !reason || reason.length < 8) {
    throw new HttpsError('invalid-argument', 'Unit, meeting, and a brief reason are required.');
  }
  if (type !== 'planned' && type !== 'emergency') {
    throw new HttpsError('invalid-argument', 'Request type must be planned or emergency.');
  }

  const membership = profileUnits.find((u) => u.unitId === unitId);
  if (!membership) throw new HttpsError('permission-denied', 'Not a member of that unit.');

  const meeting = meetingFromKey(unitId, meetingKeyStr);
  if (!meeting) throw new HttpsError('invalid-argument', 'Invalid meeting.');
  if (!meetingInTrackingPeriod(meeting)) {
    throw new HttpsError(
      'failed-precondition',
      'Absence requests only apply to meetings on or after 14 September 2026.'
    );
  }

  const now = new Date();
  if (now > meeting.end) {
    throw new HttpsError('failed-precondition', 'That meeting has already ended.');
  }

  const attDoc = await db.collection('nigeria_attendance').doc(uid + '_' + meetingKeyStr).get();
  if (attDoc.exists) {
    throw new HttpsError('failed-precondition', 'You already checked in for this meeting.');
  }

  const docId = uid + '_' + meetingKeyStr;
  const existing = await db.collection('nigeria_absence_requests').doc(docId).get();
  if (existing.exists) {
    return { ok: true, alreadySubmitted: true, request: existing.data() };
  }

  if (type === 'planned') {
    if (!canSubmitPlannedAbsence(meeting, now)) {
      throw new HttpsError(
        'failed-precondition',
        'Planned absence requests must be submitted at least 2 days before the meeting.'
      );
    }
  } else if (!canSubmitEmergencyAbsence(meeting, now)) {
    throw new HttpsError(
      'failed-precondition',
      'Emergency requests are only available from 15 minutes before the meeting until it ends.'
    );
  }

  const quotas = await getAbsenceQuotas(db, uid, unitId, now);
  if (quotas.remaining <= 0) {
    throw new HttpsError(
      'resource-exhausted',
      'You have used both absence requests allowed in this 8-week period for this unit.'
    );
  }
  if (type === 'emergency' && !quotas.emergencyAvailable) {
    throw new HttpsError(
      'resource-exhausted',
      'Your emergency absence slot for this 12-week period is already used. It resets at the start of the next period.'
    );
  }

  const unit = getUnit(unitId);
  const record = {
    uid,
    unitId,
    unitLabel: membership.unitLabel,
    name: profile.name || '',
    meetingKey: meetingKeyStr,
    meetingDateYmd: meeting.dateYmd,
    meetingStartAt: meeting.start,
    type,
    reason,
    status: 'approved',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('nigeria_absence_requests').doc(docId).set(record);

  const year = parseInt(ymdInLagos(now).slice(0, 4), 10);
  const month = parseInt(ymdInLagos(now).slice(5, 7), 10);
  const stats = await computeUserAttendanceStats(db, uid, unitId, year, month);

  return { ok: true, request: record, absenceQuotas: await getAbsenceQuotas(db, uid, unitId, now), stats };
});

const getNigeriaDashboard = onCall(
  { timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();

  let access;
  try {
    access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
  } catch (e) {
    if (e.code === 'permission-denied' || e.code === 'failed-precondition') {
      return {
        hasProfile: false,
        eligible: false,
        message: e.message,
      };
    }
    throw e;
  }

  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) {
    let suggestedUnits = [];
    try {
      const email = normalizeEmail(access.email);
      if (email) {
        const onboardSnap = await db.collection('volunteer_onboarding').doc(email).get();
        if (onboardSnap.exists) {
          const raw = onboardSnap.data().nigeriaUnits;
          if (Array.isArray(raw)) {
            suggestedUnits = raw
              .map((u) => {
                const unit = getUnit(u && u.unitId);
                if (!unit) return null;
                return {
                  unitId: unit.id,
                  unitLabel: unit.label,
                  role: u.role === 'leader' ? 'leader' : 'member',
                };
              })
              .filter(Boolean);
          }
        }
      }
    } catch (ignore) {}
    return {
      hasProfile: false,
      eligible: true,
      isSuperUser: access.isSuperUser === true,
      suggestedUnits,
      volunteer: {
        name: access.volunteer.name || '',
        email: access.email,
        phone: access.phone,
      },
    };
  }

  const profile = profileSnap.data();
  const profileUnits = normalizeProfileUnits(profile);
  if (!profileUnits.length) {
    throw new HttpsError('failed-precondition', 'Profile units missing.');
  }

  // Ensure the US hub routes this Nigeria volunteer to the Nigeria hub on future
  // visits (covers leaders abroad whose phone is not a +234 number).
  try {
    await db.collection('volunteers').doc(uid).set({ nigeriaHub: true }, { merge: true });
  } catch (ignore) {}

  const now = new Date();
  const year = parseInt(ymdInLagos(now).slice(0, 4), 10);
  const month = parseInt(ymdInLagos(now).slice(5, 7), 10);
  const isSuperUser = access.isSuperUser === true || profile.isSuperUser === true;

  const unitContexts = [];
  for (const membership of profileUnits) {
    const unit = getUnit(membership.unitId);
    if (!unit) continue;

    const nextMeeting = getNextMeeting(unit, now);
    const stats = await computeUserAttendanceStats(db, uid, membership.unitId, year, month);

    const reportId =
      membership.unitId + '_' + year + '_' + String(month).padStart(2, '0');
    const reportSnap = await db.collection('nigeria_unit_reports').doc(reportId).get();
    const latestReport = reportSnap.exists ? reportSnap.data() : null;

    let unitVision = null;
    try {
      const visionSnap = await db.collection('nigeria_unit_vision').doc(membership.unitId).get();
      unitVision = visionSnap.exists ? visionSnap.data() : null;
    } catch (visionErr) {
      console.warn('[getNigeriaDashboard] vision', membership.unitId, visionErr && visionErr.message);
    }

    // Digests + full rosters are deferred — they made reloads time out for multi-unit /
    // super users after check-in. Rosters load via getNigeriaMyMembersRosters.
    const lastMeetingDigest = null;

    let checkInOpen = false;
    let absenceTarget = nextMeeting;
    if (nextMeeting) {
      checkInOpen = isWithinCheckInWindow(nextMeeting, now);
      if (!checkInOpen) {
        const prev = getNextMeeting(unit, new Date(nextMeeting.start.getTime() - 86400000));
        if (prev && isWithinCheckInWindow(prev, now)) {
          checkInOpen = true;
          absenceTarget = prev;
        }
      }
    }
    // Never offer absence for meetings before the attendance restart (14 Sep 2026).
    if (absenceTarget && !meetingInTrackingPeriod(absenceTarget)) {
      absenceTarget = getNextMeeting(unit, policyEpochStartDate()) || null;
      checkInOpen = !!(absenceTarget && isWithinCheckInWindow(absenceTarget, now));
    }

    let alreadyCheckedIn = false;
    if (checkInOpen && absenceTarget) {
      try {
        const attSnap = await db
          .collection('nigeria_attendance')
          .doc(uid + '_' + absenceTarget.key)
          .get();
        alreadyCheckedIn = attSnap.exists;
      } catch (attErr) {
        console.warn('[getNigeriaDashboard] checkedIn', membership.unitId, attErr && attErr.message);
      }
    }

    const absenceQuotas = await getAbsenceQuotas(db, uid, membership.unitId, now);
    let absenceRequest = null;
    if (absenceTarget) {
      const absSnap = await db.collection('nigeria_absence_requests').doc(uid + '_' + absenceTarget.key).get();
      if (absSnap.exists) absenceRequest = absSnap.data();
    }

    const canRequestPlanned = absenceTarget
      ? absenceTarget.start.getTime() - now.getTime() >= PLANNED_ABSENCE_MIN_MS
      : false;
    const canRequestEmergency = absenceTarget ? canSubmitEmergencyAbsence(absenceTarget, now) : false;

    const isUnitLeader = membership.role === 'leader' || isSuperUser;

    let teamRoster = null;
    let rosterDeferred = false;
    let meetingAttendance = null;
    if (isUnitLeader && isSuperUser) {
      // Super users load rosters lazily — bundling every Group made dashboard
      // check-in time out. Regular unit leaders get their one roster inline.
      rosterDeferred = true;
    } else if (isUnitLeader) {
      try {
        const result = await computeUnitRoster(db, membership.unitId, now);
        teamRoster = Array.isArray(result) ? result : (result && result.roster) || [];
        meetingAttendance =
          result && !Array.isArray(result) ? result.recentMeetings || [] : [];
      } catch (rosterErr) {
        console.warn('[getNigeriaDashboard] roster', membership.unitId, rosterErr && rosterErr.message);
        teamRoster = [];
      }
    }

    unitContexts.push({
      unitId: membership.unitId,
      unitLabel: membership.unitLabel,
      role: membership.role,
      unit: {
        id: unit.id,
        label: unit.label,
        day: DAY_NAMES[unit.day],
        start: unit.start,
        end: unit.end,
      },
      nextMeeting: nextMeeting
        ? {
            key: nextMeeting.key,
            dateYmd: nextMeeting.dateYmd,
            startIso: nextMeeting.start.toISOString(),
            endIso: nextMeeting.end.toISOString(),
          }
        : null,
      checkInOpen,
      alreadyCheckedIn,
      attendanceStats: stats,
      latestReport,
      unitVision,
      lastMeetingDigest,
      absenceQuotas,
      absenceRequest,
      absenceTargetMeeting: absenceTarget
        ? {
            key: absenceTarget.key,
            dateYmd: absenceTarget.dateYmd,
            startIso: absenceTarget.start.toISOString(),
            endIso: absenceTarget.end.toISOString(),
          }
        : null,
      canRequestPlanned,
      canRequestEmergency,
      canSubmitReport: isUnitLeader,
      canEditVision: isUnitLeader,
      isLeaderView: isUnitLeader,
      teamRoster,
      rosterDeferred,
      meetingAttendance,
    });
  }

  // Super users who are not enrolled on a Group still need to see that Group's
  // roster (e.g. after greenlighting a Group 2 worker). Only Groups 1–6 — not
  // every ministry unit. Rosters load lazily via getNigeriaMyMembersRosters.
  if (isSuperUser) {
    const seen = new Set(unitContexts.map((c) => c.unitId));
    const groupUnits = NIGERIA_UNITS.filter((u) => /^group[1-6]$/.test(u.id) && !seen.has(u.id));
    for (const unit of groupUnits) {
      const nextMeeting = getNextMeeting(unit, now);
      unitContexts.push({
        unitId: unit.id,
        unitLabel: unit.label,
        role: 'leader',
        unit: {
          id: unit.id,
          label: unit.label,
          day: DAY_NAMES[unit.day],
          start: unit.start,
          end: unit.end,
        },
        nextMeeting: nextMeeting
          ? {
              key: nextMeeting.key,
              dateYmd: nextMeeting.dateYmd,
              startIso: nextMeeting.start.toISOString(),
              endIso: nextMeeting.end.toISOString(),
            }
          : null,
        checkInOpen: false,
        alreadyCheckedIn: false,
        attendanceStats: null,
        latestReport: null,
        unitVision: null,
        lastMeetingDigest: null,
        absenceQuotas: null,
        absenceRequest: null,
        absenceTargetMeeting: null,
        canRequestPlanned: false,
        canRequestEmergency: false,
        canSubmitReport: true,
        canEditVision: true,
        isLeaderView: true,
        teamRoster: null,
        rosterDeferred: true,
        browseOnly: true,
      });
    }
  }

  const primary = unitContexts.find((c) => !c.browseOnly) || unitContexts[0];
  let recentAttendance = [];
  try {
    const recentAttSnap = await db
      .collection('nigeria_attendance')
      .where('uid', '==', uid)
      .orderBy('checkedInAt', 'desc')
      .limit(8)
      .get();
    recentAttendance = recentAttSnap.docs.map((d) => {
      const v = d.data();
      return {
        meetingKey: v.meetingKey,
        meetingDateYmd: v.meetingDateYmd,
        unitId: v.unitId,
        unitLabel: v.unitLabel,
        checkedInAt: v.checkedInAt,
      };
    });
  } catch (recentErr) {
    console.warn('[getNigeriaDashboard] recentAttendance', recentErr && recentErr.message);
  }

  let myOpenActions = [];
  try {
    const actionUnitIds = unitContexts.map((c) => c.unitId);
    const boards = await loadOpenActionsForUser(db, uid, actionUnitIds);
    myOpenActions = boards.myOpenActions || [];
    unitContexts.forEach((c) => {
      c.teamOpenActions = (boards.teamByUnit && boards.teamByUnit[c.unitId]) || [];
    });
  } catch (actionErr) {
    console.warn('[getNigeriaDashboard] openActions', actionErr && actionErr.message);
  }

  return {
    hasProfile: true,
    eligible: true,
    isSuperUser,
    canViewAllUnitReports: canViewAllNigeriaUnitReports(access.email || profile.email),
    canViewMemberSignups: canViewMemberSignups(profile, isSuperUser),
    workforceAccess: workforceAccessForProfile(profile, isSuperUser),
    profile: {
      ...profile,
      units: profileUnits,
    },
    unitContexts,
    unit: primary ? primary.unit : null,
    nextMeeting: primary ? primary.nextMeeting : null,
    checkInOpen: primary ? primary.checkInOpen : false,
    alreadyCheckedIn: primary ? primary.alreadyCheckedIn : false,
    attendanceStats: primary ? primary.attendanceStats : null,
    latestReport: primary ? primary.latestReport : null,
    recentAttendance,
    myOpenActions,
  };
  }
);

const getNigeriaMyMembersRosters = onCall(
  { timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const uid = requireAuth(request);
    const db = admin.firestore();
    const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
    const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
    if (!profileSnap.exists) {
      throw new HttpsError('failed-precondition', 'Profile required.');
    }
    const profile = profileSnap.data();
    const profileUnits = normalizeProfileUnits(profile);
    const isSuperUser = access.isSuperUser === true || profile.isSuperUser === true;
    const now = new Date();

    const unitIds = new Set();
    profileUnits.forEach((m) => {
      if (m.role === 'leader' || isSuperUser) unitIds.add(m.unitId);
    });
    if (isSuperUser) {
      NIGERIA_UNITS.filter((u) => /^group[1-6]$/.test(u.id)).forEach((u) => unitIds.add(u.id));
    }

    const requested = Array.isArray(request.data?.unitIds)
      ? request.data.unitIds.map(String).filter((id) => unitIds.has(id))
      : Array.from(unitIds);

    const rosters = {};
    const meetingAttendance = {};
    await Promise.all(
      requested.map(async (unitId) => {
        try {
          const result = await computeUnitRoster(db, unitId, now);
          rosters[unitId] = result.roster || [];
          meetingAttendance[unitId] = result.recentMeetings || [];
        } catch (err) {
          console.warn('[getNigeriaMyMembersRosters]', unitId, err && err.message);
          rosters[unitId] = [];
          meetingAttendance[unitId] = [];
        }
      })
    );

    return { ok: true, rosters, meetingAttendance };
  }
);

/** Lightweight name list for meeting-notes Responsibility picker (any unit member). */
const getNigeriaUnitMemberOptions = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const unitId = String(request.data?.unitId || '').trim();
  if (!unitId || !getUnit(unitId)) {
    throw new HttpsError('invalid-argument', 'Valid unitId required.');
  }
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) {
    throw new HttpsError('failed-precondition', 'Profile required.');
  }
  const profile = profileSnap.data();
  const isSuperUser = access.isSuperUser === true || profile.isSuperUser === true;
  const profileUnits = normalizeProfileUnits(profile);
  if (!isSuperUser && !profileUnits.some((u) => u.unitId === unitId)) {
    throw new HttpsError('permission-denied', 'Not a member of that unit.');
  }
  const members = await loadUnitMembers(db, unitId);
  members.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return {
    ok: true,
    members: members.map((m) => ({
      uid: m.uid,
      name: m.name,
      role: m.role,
    })),
  };
});

const submitNigeriaUnitReport = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
    secrets: [appsScriptSelfServeMailUrl, selfServeMailSecret],
  },
  async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
  const profile = profileSnap.data();
  const data = request.data || {};
  const reqUnitId = String(data.unitId || profile.unitId || '').trim();
  const profileUnits = normalizeProfileUnits(profile);
  const leaderUnit = profileUnits.find((u) => u.unitId === reqUnitId) || profileUnits[0];
  if (!leaderUnit) throw new HttpsError('failed-precondition', 'Profile units missing.');
  if (leaderUnit.role !== 'leader' && !access.isSuperUser) {
    throw new HttpsError('permission-denied', 'Only unit leaders can submit reports for that unit.');
  }

  const year = parseInt(data.reportYear, 10);
  const month = parseInt(data.reportMonth, 10);
  if (!year || !month) throw new HttpsError('invalid-argument', 'Report year and month required.');

  const draftId = reportDraftId(leaderUnit.unitId, year, month);
  const draftSnap = await db.collection('nigeria_unit_report_drafts').doc(draftId).get();
  if (!access.isSuperUser) {
    if (!draftSnap.exists || draftSnap.data().status !== 'approved') {
      throw new HttpsError(
        'failed-precondition',
        'Leader must approve the shared report before submitting.'
      );
    }
  }

  const attendanceAnalytics =
    (await computeUnitAttendanceForReport(db, leaderUnit.unitId, year, month)) || {
      memberCount: 0,
      meetingsHeld: 0,
      totalCheckIns: 0,
      averageAttendancePerMeeting: 0,
      averageAttendanceRate: null,
      highestAttendance: null,
      lowestAttendance: null,
      meetingBreakdown: [],
    };

  const formMeetingsHeld = String(data.meetingsHeld || '').trim();
  const formAttendance = String(data.attendance || '').trim();

  const reportId = leaderUnit.unitId + '_' + year + '_' + String(month).padStart(2, '0');
  const report = {
    unitId: leaderUnit.unitId,
    unitLabel: leaderUnit.unitLabel,
    reportYear: year,
    reportMonth: month,
    leaderUid: uid,
    leaderName: profile.name,
    leaderPhone: profile.phone,
    activities: String(data.activities || '').trim(),
    highlights: String(data.highlights || '').trim(),
    testimonies: String(data.testimonies || '').trim(),
    challenges: String(data.challenges || '').trim(),
    prayerRequests: String(data.prayerRequests || '').trim(),
    nextMonth: String(data.nextMonth || '').trim(),
    meetingNotesSummary: String(data.meetingNotesSummary || '').trim(),
    photos: normalizeImageUrls(data.photos, 12),
    // Prefer the leader's typed report fields; fall back to computed attendance stats.
    meetingsHeld: formMeetingsHeld || attendanceAnalytics.meetingsHeld || 0,
    attendanceSummary: attendanceAnalytics,
    attendanceNarrative: formAttendance || buildAttendanceNarrative(attendanceAnalytics),
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('nigeria_unit_reports').doc(reportId).set(report, { merge: true });
  await db.collection('nigeria_unit_report_drafts').doc(reportId).set(
    {
      status: 'submitted',
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      submittedByUid: uid,
      submittedByName: profile.name || '',
      form: mergeReportForms(draftSnap.exists ? draftSnap.data().form || {} : {}, {
        meetingsHeld: formMeetingsHeld,
        attendance: formAttendance,
        activities: String(data.activities || '').trim(),
        highlights: String(data.highlights || '').trim(),
        testimonies: String(data.testimonies || '').trim(),
        challenges: String(data.challenges || '').trim(),
        prayerRequests: String(data.prayerRequests || '').trim(),
        nextMonth: String(data.nextMonth || '').trim(),
        meetingNotesSummary: String(data.meetingNotesSummary || '').trim(),
      }),
    },
    { merge: true }
  );

  const submittedForm = mergeReportForms(draftSnap.exists ? draftSnap.data().form || {} : {}, {
    meetingsHeld: formMeetingsHeld,
    attendance: formAttendance,
    activities: report.activities,
    highlights: report.highlights,
    testimonies: report.testimonies,
    challenges: report.challenges,
    prayerRequests: report.prayerRequests,
    nextMonth: report.nextMonth,
    meetingNotesSummary: report.meetingNotesSummary,
  });
  const leaders = await loadUnitLeaders(db, leaderUnit.unitId);
  const recipients = [];
  leaders.forEach((leader) => recipients.push(leader));
  NIGERIA_REPORT_OVERVIEW_EMAILS.forEach((email) => {
    recipients.push({ email, name: email.split('@')[0] });
  });
  const mailStats = await sendUnitReportNoticeMails({
    recipients,
    kind: 'submitted',
    unitLabel: leaderUnit.unitLabel,
    period: reportPeriodLabel(year, month),
    actorName: profile.name || 'A unit leader',
    form: submittedForm,
  });

  return {
    ok: true,
    reportId,
    attendanceAnalytics,
    emailedTo: mailStats.emailed,
    emailFailed: mailStats.failed,
  };
  }
);

function reportDraftId(unitId, year, month) {
  return `${unitId}_${year}_${String(month).padStart(2, '0')}`;
}

function memberHasUnit(profile, unitId) {
  return normalizeProfileUnits(profile).some((u) => u.unitId === unitId) || profile.unitId === unitId;
}

function isUnitLeader(profile, unitId, isSuperUser) {
  if (isSuperUser) return true;
  return normalizeProfileUnits(profile).some((u) => u.unitId === unitId && u.role === 'leader');
}

function mergeReportForms(existing, incoming) {
  const prev = existing && typeof existing === 'object' ? existing : {};
  const next = incoming && typeof incoming === 'object' ? incoming : {};
  const out = { ...prev };
  Object.keys(next).forEach((key) => {
    const val = next[key];
    if (val == null) return;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // Never let a blank field wipe a previously saved answer.
      if (!trimmed && String(prev[key] || '').trim()) return;
      out[key] = val;
      return;
    }
    if (Array.isArray(val)) {
      if (!val.length && Array.isArray(prev[key]) && prev[key].length) return;
      out[key] = val;
      return;
    }
    out[key] = val;
  });
  return out;
}

function reportFormHasContent(form) {
  if (!form || typeof form !== 'object') return false;
  return [
    'activities',
    'highlights',
    'testimonies',
    'challenges',
    'prayerRequests',
    'nextMonth',
    'meetingNotesSummary',
    'meetingsHeld',
    'attendance',
  ].some((k) => String(form[k] || '').trim());
}

const REPORT_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function reportPeriodLabel(year, month) {
  return (REPORT_MONTH_NAMES[month - 1] || String(month)) + ' ' + year;
}

function buildUnitReportNoticeMail({
  recipientName,
  kind,
  unitLabel,
  period,
  actorName,
  form,
}) {
  const first = String(recipientName || 'Leader').trim().split(/\s+/)[0] || 'Leader';
  const shared = kind === 'shared';
  const subject = shared
    ? `Shared unit report — ${unitLabel} (${period})`
    : `Submitted unit report — ${unitLabel} (${period})`;
  const headline = shared
    ? `${actorName} shared the ${unitLabel} report for ${period} with unit leaders. Open Reports on the hub to add details or approve it.`
    : `${actorName} submitted the ${unitLabel} report for ${period}. A copy is below.`;
  const formBits = form && typeof form === 'object' ? form : {};
  function block(title, body) {
    const text = String(body || '').trim();
    if (!text) return '';
    return `\n--- ${title} ---\n${text}\n`;
  }
  const plainBody =
    `Hi ${first},\n\n` +
    headline +
    `\n\nUnit: ${unitLabel}\nPeriod: ${period}\n` +
    block('Activities', formBits.activities) +
    block('Highlights', formBits.highlights) +
    block('Challenges', formBits.challenges) +
    `\nOpen Reports: https://prayercityhtx.com/ng#reports\n\nDear Daughter Bible Study Group Nigeria`;
  function htmlBlock(title, body) {
    const text = String(body || '').trim();
    if (!text) return '';
    return (
      `<h3 style="margin:16px 0 6px;font-size:14px;color:#0f3d5c">${escapeHtml(title)}</h3>` +
      `<p style="white-space:pre-wrap;margin:0;line-height:1.5">${escapeHtml(text)}</p>`
    );
  }
  const htmlBody =
    `<div style="font-family:system-ui,sans-serif;color:#1e293b;max-width:640px;line-height:1.55">` +
    `<p>Hi <strong>${escapeHtml(first)}</strong>,</p>` +
    `<p>${escapeHtml(headline)}</p>` +
    `<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px">` +
    `<strong>${escapeHtml(unitLabel)}</strong><br>Period: ${escapeHtml(period)}<br>` +
    `${shared ? 'Shared' : 'Submitted'} by: ${escapeHtml(actorName)}</p>` +
    htmlBlock('Activities', formBits.activities) +
    htmlBlock('Highlights', formBits.highlights) +
    htmlBlock('Challenges', formBits.challenges) +
    `<p style="margin-top:20px"><a href="https://prayercityhtx.com/ng#reports" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Open Reports</a></p>` +
    `<p style="font-size:12px;color:#64748b">Dear Daughter Bible Study Group Nigeria</p></div>`;
  return { subject, plainBody, htmlBody };
}

async function sendUnitReportNoticeMails({ recipients, kind, unitLabel, period, actorName, form }) {
  const scriptUrl = appsScriptSelfServeMailUrl.value();
  const secret = selfServeMailSecret.value();
  const emailed = [];
  const failed = [];
  const seen = new Set();
  for (const rec of recipients || []) {
    const email = normalizeEmail(rec.email);
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    const name = rec.name || email.split('@')[0];
    const mail = buildUnitReportNoticeMail({
      recipientName: name,
      kind,
      unitLabel,
      period,
      actorName,
      form,
    });
    try {
      const mailRes = await sendMailViaAppsScript({
        scriptUrl,
        secret,
        email,
        subject: mail.subject,
        plainBody: mail.plainBody,
        htmlBody: mail.htmlBody,
      });
      if (mailRes.ok) emailed.push({ email, name });
      else failed.push({ email, error: mailRes.error || 'mail_failed' });
    } catch (err) {
      failed.push({ email, error: String(err && err.message ? err.message : err) });
    }
  }
  return { emailed, failed };
}

const shareNigeriaUnitReportDraft = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
    secrets: [appsScriptSelfServeMailUrl, selfServeMailSecret],
  },
  async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
  const profile = profileSnap.data();
  const data = request.data || {};
  const unitId = String(data.unitId || '').trim();
  const year = parseInt(data.reportYear, 10);
  const month = parseInt(data.reportMonth, 10);
  const form = data.form || {};
  if (!unitId || !year || !month) throw new HttpsError('invalid-argument', 'unitId, year, and month required.');
  if (!memberHasUnit(profile, unitId)) {
    throw new HttpsError('permission-denied', 'You are not a member of that unit.');
  }

  const draftId = reportDraftId(unitId, year, month);
  const unit = getUnit(unitId);
  const existingSnap = await db.collection('nigeria_unit_report_drafts').doc(draftId).get();
  const existingForm = existingSnap.exists ? existingSnap.data().form || {} : {};
  const mergedForm = mergeReportForms(existingForm, form);

  // Protect against blank overwrites when the client sends an empty form.
  if (reportFormHasContent(existingForm) && !reportFormHasContent(mergedForm)) {
    throw new HttpsError(
      'failed-precondition',
      'Share blocked — your form looks empty, but a filled draft already exists. Reload shared report details, then share again.'
    );
  }

  const contribution = {
    uid,
    name: profile.name || 'Member',
    message: 'Shared the report with the unit for review.',
    at: new Date().toISOString(),
  };

  await db.collection('nigeria_unit_report_drafts').doc(draftId).set(
    {
      unitId,
      reportYear: year,
      reportMonth: month,
      unitLabel: unit ? unit.label : unitId,
      status: 'shared',
      form: mergedForm,
      formHistory: admin.firestore.FieldValue.arrayUnion({
        at: new Date().toISOString(),
        byUid: uid,
        byName: profile.name || '',
        action: 'share',
        activitiesLen: String(mergedForm.activities || '').length,
        notesLen: String(mergedForm.meetingNotesSummary || '').length,
      }),
      sharedAt: admin.firestore.FieldValue.serverTimestamp(),
      sharedByUid: uid,
      sharedByName: profile.name || '',
      approvedAt: null,
      approvedByUid: null,
      approvedByName: null,
      contributions: admin.firestore.FieldValue.arrayUnion(contribution),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedByUid: uid,
      lastUpdatedByName: profile.name || '',
    },
    { merge: true }
  );

  const leaders = await loadUnitLeaders(db, unitId);
  const mailStats = await sendUnitReportNoticeMails({
    recipients: leaders,
    kind: 'shared',
    unitLabel: unit ? unit.label : unitId,
    period: reportPeriodLabel(year, month),
    actorName: profile.name || 'A unit leader',
    form: mergedForm,
  });

  return {
    ok: true,
    draftId,
    status: 'shared',
    emailedTo: mailStats.emailed,
    emailFailed: mailStats.failed,
  };
});

const contributeNigeriaUnitReportDraft = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
  const profile = profileSnap.data();
  const data = request.data || {};
  const unitId = String(data.unitId || '').trim();
  const year = parseInt(data.reportYear, 10);
  const month = parseInt(data.reportMonth, 10);
  const form = data.form || {};
  const note = String(data.note || '').trim();
  if (!unitId || !year || !month) throw new HttpsError('invalid-argument', 'unitId, year, and month required.');
  if (!memberHasUnit(profile, unitId)) {
    throw new HttpsError('permission-denied', 'You are not a member of that unit.');
  }

  const draftId = reportDraftId(unitId, year, month);
  const draftSnap = await db.collection('nigeria_unit_report_drafts').doc(draftId).get();
  if (!draftSnap.exists || draftSnap.data().status !== 'shared') {
    throw new HttpsError('failed-precondition', 'Report is not open for teammate edits.');
  }

  const mergedForm = mergeReportForms(draftSnap.data().form || {}, form);
  const contribution = {
    uid,
    name: profile.name || 'Member',
    message: note || 'Updated the shared report.',
    at: new Date().toISOString(),
  };

  await db.collection('nigeria_unit_report_drafts').doc(draftId).set(
    {
      form: mergedForm,
      contributions: admin.firestore.FieldValue.arrayUnion(contribution),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedByUid: uid,
      lastUpdatedByName: profile.name || '',
    },
    { merge: true }
  );
  return { ok: true, draftId };
});

const approveNigeriaUnitReportDraft = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
  const profile = profileSnap.data();
  const data = request.data || {};
  const unitId = String(data.unitId || '').trim();
  const year = parseInt(data.reportYear, 10);
  const month = parseInt(data.reportMonth, 10);
  const form = data.form || null;
  if (!unitId || !year || !month) throw new HttpsError('invalid-argument', 'unitId, year, and month required.');
  if (!isUnitLeader(profile, unitId, access.isSuperUser)) {
    throw new HttpsError('permission-denied', 'Only the unit leader can approve the report.');
  }

  const draftId = reportDraftId(unitId, year, month);
  const draftSnap = await db.collection('nigeria_unit_report_drafts').doc(draftId).get();
  if (!draftSnap.exists || draftSnap.data().status !== 'shared') {
    throw new HttpsError('failed-precondition', 'Nothing to approve — share the report with teammates first.');
  }

  const approvedForm = mergeReportForms(draftSnap.data().form || {}, form || {});
  await db.collection('nigeria_unit_report_drafts').doc(draftId).set(
    {
      status: 'approved',
      form: approvedForm,
      approvedForm,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedByUid: uid,
      approvedByName: profile.name || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { ok: true, draftId, status: 'approved' };
});

function buildAttendanceNarrative(a) {
  if (!a || !a.meetingsHeld) return 'No completed meetings this month yet.';
  const lines = [
    'Meetings held: ' + a.meetingsHeld,
    'Total check-ins: ' + a.totalCheckIns,
    'Average per meeting: ' + a.averageAttendancePerMeeting,
  ];
  if (a.averageAttendanceRate != null) {
    lines.push('Average member attendance rate: ' + a.averageAttendanceRate + '%');
  }
  if (a.highestAttendance) {
    lines.push(
      'Highest attendance: ' + a.highestAttendance.date + ' (' + a.highestAttendance.count + ' present)'
    );
  }
  if (a.lowestAttendance) {
    lines.push(
      'Lowest attendance: ' + a.lowestAttendance.date + ' (' + a.lowestAttendance.count + ' present)'
    );
  }
  return lines.join('\n');
}

const getNigeriaAttendanceForReport = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
  const profile = profileSnap.data();
  const profileUnits = normalizeProfileUnits(profile);
  const reqUnitId = String(request.data?.unitId || profile.unitId || '').trim();
  const membership = profileUnits.find((u) => u.unitId === reqUnitId) || profileUnits[0];
  if (!membership) throw new HttpsError('failed-precondition', 'Profile units missing.');

  const year = parseInt(request.data?.reportYear, 10);
  const month = parseInt(request.data?.reportMonth, 10);
  if (!year || !month) throw new HttpsError('invalid-argument', 'Year and month required.');

  if (membership.role === 'leader' || access.isSuperUser) {
    const unitStats = await computeUnitAttendanceForReport(db, membership.unitId, year, month);
    return { role: 'leader', unitStats, personalStats: null, unitId: membership.unitId };
  }

  const personalStats = await computeUserAttendanceStats(db, uid, membership.unitId, year, month);
  return { role: 'member', unitStats: null, personalStats, unitId: membership.unitId };
});

function formatNotesSummaryOutput(output) {
  if (!output) return '';
  const lines = [];
  if (output.executiveSummary) lines.push(output.executiveSummary);
  if (output.keyTopics?.length) {
    lines.push('', 'Key topics:', ...output.keyTopics.map((t) => `• ${t}`));
  }
  if (output.actionItems?.length) {
    lines.push('', 'Action items:', ...output.actionItems.map((t) => `☐ ${t}`));
  }
  if (output.prayerAndFollowUps?.length) {
    lines.push('', 'Prayer & follow-ups:', ...output.prayerAndFollowUps.map((t) => `• ${t}`));
  }
  return lines.join('\n').trim();
}

function notesPayloadToText(data) {
  if (!data) return '';
  if (Array.isArray(data.actions) && data.actions.length) {
    return data.actions
      .map((a) => {
        const parts = [`[${a.status || 'Open'}]`, a.actionDescription || '(no description)'];
        if (a.responsibilityName) parts.push('Resp: ' + a.responsibilityName);
        if (a.dateDue) parts.push('Due: ' + a.dateDue);
        if (a.category) parts.push('Cat: ' + a.category);
        if (a.comments) parts.push('Notes: ' + a.comments);
        if (a.dateCompleted) parts.push('Done: ' + a.dateCompleted);
        return parts.join(' · ');
      })
      .join('\n');
  }
  return String(data.content || '').trim();
}

function buildSimpleNotesSummary(notes, unitLabel, period) {
  if (!notes.length) return `No shared meeting notes for ${unitLabel} in ${period}.`;
  const bullets = [];
  notes.forEach((n) => {
    if (Array.isArray(n.actions) && n.actions.length) {
      n.actions.forEach((a) => {
        const t = String(a.actionDescription || '').trim();
        if (!t) return;
        const bit =
          t +
          (a.responsibilityName ? ` (${a.responsibilityName})` : '') +
          (a.status ? ` [${a.status}]` : '');
        bullets.push(bit);
      });
      return;
    }
    String(n.content || '')
      .split('\n')
      .forEach((line) => {
        const t = line.trim();
        if (t && t !== '---') bullets.push(t.replace(/^[-•☐]\s*/, ''));
      });
  });
  return [
    `Summary from ${notes.length} meeting note(s) — ${unitLabel} (${period})`,
    '',
    ...bullets.slice(0, 10).map((b) => `• ${b}`),
  ].join('\n');
}

const summarizeNigeriaMeetingNotesForReport = onCall(
  { cors: true, timeoutSeconds: 120, secrets: [googleGenaiApiKey] },
  async (request) => {
    const uid = requireAuth(request);
    const db = admin.firestore();
    await assertNigeriaVolunteerAccess(db, uid, request.auth);
    const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
    if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
    const profile = profileSnap.data();
    const unitId = String(request.data?.unitId || '').trim();
    const year = parseInt(request.data?.reportYear, 10);
    const month = parseInt(request.data?.reportMonth, 10);
    const notes = Array.isArray(request.data?.notes) ? request.data.notes : [];
    if (!unitId || !year || !month) {
      throw new HttpsError('invalid-argument', 'unitId, year, and month required.');
    }
    const profileUnits = normalizeProfileUnits(profile);
    const isMember =
      profileUnits.some((u) => u.unitId === unitId) || profile.unitId === unitId;
    if (!isMember) throw new HttpsError('permission-denied', 'Not a member of that unit.');

    const unit = getUnit(unitId);
    const unitLabel = unit ? unit.label : unitId;
    const period = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    if (!notes.length) {
      return { summaryText: `No shared meeting notes for ${unitLabel} in ${period}.`, aiUsed: false };
    }

    const notesBlock = notes
      .map(
        (n) =>
          `Meeting ${n.meetingDateYmd || n.meetingKey} (by ${n.updatedByName || 'member'}):\n${notesPayloadToText(n).slice(0, 4000)}`
      )
      .join('\n\n');

    try {
      process.env.GOOGLE_GENAI_API_KEY = googleGenaiApiKey.value();
      const { output } = await generateStructured({
        prompt: `You are summarizing DDBS Nigeria unit meeting notes into a concise monthly report section for church leadership.
Unit: ${unitLabel}
Period: ${period}

Be factual, warm, and organized. Merge duplicate points. Extract clear action items and prayer/follow-up points when present.

Meeting notes:
${notesBlock}`,
        schema: notesSummarySchema,
      });
      return {
        summary: output,
        summaryText: formatNotesSummaryOutput(output),
        aiUsed: true,
      };
    } catch (e) {
      console.warn('[summarizeNigeriaMeetingNotesForReport]', e);
      return {
        summaryText: buildSimpleNotesSummary(notes, unitLabel, period),
        aiUsed: false,
      };
    }
  }
);

function assertUnitLeader(profile, unitId, isSuperUser) {
  if (isSuperUser) return;
  const membership = normalizeProfileUnits(profile).find((u) => u.unitId === unitId);
  if (!membership || membership.role !== 'leader') {
    throw new HttpsError('permission-denied', 'Only unit leaders can edit the quarterly vision.');
  }
}

function formatVisionPlanText(plan) {
  if (!plan) return '';
  const lines = [];
  if (plan.milestones?.length) {
    lines.push('Milestones:');
    plan.milestones.forEach((m) => {
      lines.push(`• ${m.targetMonth || ''} — ${m.title}: ${m.description || ''}`);
    });
  }
  if (plan.roadmap?.length) {
    lines.push('', 'Roadmap:');
    plan.roadmap.forEach((r) => {
      lines.push(`${r.phase} — ${r.focus}`);
      (r.steps || []).forEach((s) => lines.push(`  - ${s}`));
    });
  }
  if (plan.howToGetThere?.length) {
    lines.push('', 'How to get there:');
    plan.howToGetThere.forEach((h) => lines.push(`• ${h}`));
  }
  if (plan.toolsAndResources?.length) {
    lines.push('', 'Tools & resources:');
    plan.toolsAndResources.forEach((t) => lines.push(`• ${t.name}: ${t.purpose}`));
  }
  return lines.join('\n').trim();
}

/**
 * Builds a warm, plain-language starter plan (no AI, no jargon) directly from
 * the leader's vision. Always available, so the vision board works even when
 * the AI service is unavailable. The leader can edit everything before saving.
 */
function buildStarterVisionPlan(visionText, unitLabel, startDate) {
  const monthName = (offset) => {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + offset, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  const m1 = monthName(0);
  const m2 = monthName(1);
  const m3 = monthName(2);
  const cleanVision = String(visionText || '').replace(/\s+/g, ' ').trim();
  const visionLine = cleanVision
    ? 'Our vision in our own words: "' + cleanVision + '"'
    : 'Share the vision together as a team.';

  return {
    milestones: [
      {
        title: 'Everyone knows the vision',
        targetMonth: m1,
        status: 'todo',
        description:
          visionLine +
          ' In the first month, share it with the whole team, pray over it together, and agree on what a good result looks like.',
      },
      {
        title: 'A simple weekly rhythm has started',
        targetMonth: m1,
        status: 'todo',
        description:
          'Pick one or two simple things the team will do every week to move the vision forward, and make sure each person knows their part.',
      },
      {
        title: 'More people are taking part',
        targetMonth: m2,
        status: 'todo',
        description:
          'Invite more members to join in, celebrate the early wins, and gently adjust anything that is not working well.',
      },
      {
        title: 'The vision is reaching more people',
        targetMonth: m3,
        status: 'todo',
        description:
          'Open the work up to bless more people beyond the team, and keep encouraging one another along the way.',
      },
      {
        title: 'We finish strong and give thanks',
        targetMonth: m3,
        status: 'todo',
        description:
          'Look back at how far the team has come, thank everyone for their part, and decide which good habits to keep going.',
      },
    ],
    roadmap: [
      {
        phase: m1 + ' — Lay the foundation',
        focus: 'Prayer, clear vision, and small first steps',
        steps: [
          'Meet as a team and pray over the vision together.',
          'Explain the vision in simple words so everyone understands it.',
          'Agree on one or two easy goals for this month.',
          'Give each person a clear, small role.',
        ],
      },
      {
        phase: m2 + ' — Build momentum',
        focus: 'Staying steady and growing the team',
        steps: [
          'Keep a steady weekly rhythm of meetings and activities.',
          'Invite more members to join in and help.',
          'Celebrate small wins to keep everyone encouraged.',
          'Notice what is working and gently fix what is not.',
        ],
      },
      {
        phase: m3 + ' — Reach further and last',
        focus: 'Blessing more people and keeping good habits',
        steps: [
          'Reach out to more people beyond the team.',
          'Review the progress together and give thanks.',
          'Decide which good habits to keep after the three months.',
        ],
      },
    ],
    howToGetThere: [
      'Begin every step with prayer and keep God at the centre.',
      'Keep the goals small and simple so no one feels overwhelmed.',
      'Meet regularly and keep talking to one another.',
      'Share updates often so the whole team feels part of the journey.',
      'Encourage each other and celebrate every small win.',
      'Ask members what they enjoy, and let them serve in those areas.',
    ],
    toolsAndResources: [
      {
        name: 'WhatsApp group',
        purpose: 'Stay in touch, share reminders, and encourage one another during the week.',
      },
      {
        name: 'Shared prayer list',
        purpose: 'Pray together for the vision and for one another.',
      },
      {
        name: 'A simple weekly checklist',
        purpose: 'Keep track of the few things the team wants to do each week.',
      },
      {
        name: 'The Bible and a daily devotional',
        purpose: 'Keep the team grounded in God’s word while you serve.',
      },
      {
        name: 'A short monthly catch-up',
        purpose: 'Look back at the progress, give thanks, and plan the next step.',
      },
    ],
  };
}

const generateNigeriaUnitVision = onCall(
  { cors: true, timeoutSeconds: 60, memory: '512MiB', secrets: [googleGenaiApiKey] },
  async (request) => {
    const uid = requireAuth(request);
    const db = admin.firestore();
    const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
    const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
    if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
    const profile = profileSnap.data();
    const unitId = String(request.data?.unitId || '').trim();
    const visionText = String(request.data?.visionText || '').trim().slice(0, 4000);
    if (!unitId || visionText.length < 20) {
      throw new HttpsError('invalid-argument', 'Unit and a vision (at least 20 characters) are required.');
    }
    const isSuperUser = access.isSuperUser === true || profile.isSuperUser === true;
    assertUnitLeader(profile, unitId, isSuperUser);

    const unit = getUnit(unitId);
    const unitLabel = unit ? unit.label : unitId;
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + 92 * 86400000);
    const periodLabel =
      periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) +
      ' – ' +
      periodEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const starter = buildStarterVisionPlan(visionText, unitLabel, periodStart);

    // Keep AI attempts short — client often times out around 60s and leaders need a
    // reliable plan even when Gemini is slow.
    const aiPromise = (async () => {
      process.env.GOOGLE_GENAI_API_KEY = googleGenaiApiKey.value();
      const { output } = await generateStructured({
        prompt: `You are helping a church volunteer team leader plan the next three months for the "${unitLabel}" team. The planning period is ${periodLabel}.

The leader's vision (in their own words):
${visionText}

Write a simple, faith-filled plan with:
- clear milestones for each month,
- a step-by-step plan for each month,
- simple things the team can do to get there,
- and helpful everyday tools the team can use (like a WhatsApp group, a prayer list, a simple checklist, the Bible, a devotional).

VERY IMPORTANT rules for the wording:
- Use very simple, everyday English that any volunteer can understand.
- Do NOT use technical words, business jargon, buzzwords, or abbreviations (avoid words like "KPI", "leverage", "framework", "strategy deck", "onboarding", "stakeholder", "workflow", "optimize", "synergy", "deliverables", "metrics").
- Write warmly and kindly, as if speaking to a friend at church.
- Keep sentences short and encouraging.`,
        schema: unitVisionPlanSchema,
        models: ['gemini-2.0-flash'],
        maxAttemptsPerModel: 1,
      });
      return output;
    })();

    let timedOut = false;
    const raced = await Promise.race([
      aiPromise.then((output) => ({ ok: true, output })).catch((e) => ({ ok: false, error: e })),
      new Promise((resolve) =>
        setTimeout(() => {
          timedOut = true;
          resolve({ ok: false, error: new Error('vision_ai_timeout') });
        }, 12000)
      ),
    ]);

    if (raced && raced.ok && raced.output && Array.isArray(raced.output.milestones) && raced.output.milestones.length) {
      const plan = Object.assign({}, raced.output, {
        milestones: raced.output.milestones.map((m) => Object.assign({}, m, { status: 'todo' })),
      });
      return { plan, aiUsed: true, periodLabel };
    }

    if (!timedOut && raced && raced.error) {
      console.warn(
        '[generateNigeriaUnitVision] falling back to starter plan:',
        String((raced.error && raced.error.message) || raced.error).slice(0, 200)
      );
    }
    return { plan: starter, aiUsed: false, periodLabel };
  }
);

const saveNigeriaUnitVision = onCall(
  { cors: true, timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
  const profile = profileSnap.data();
  const unitId = String(request.data?.unitId || '').trim();
  const visionText = String(request.data?.visionText || '').trim().slice(0, 4000);
  let plan = request.data?.plan;
  if (!unitId || visionText.length < 20) {
    throw new HttpsError('invalid-argument', 'Unit and vision text are required.');
  }
  const isSuperUser = access.isSuperUser === true || profile.isSuperUser === true;
  assertUnitLeader(profile, unitId, isSuperUser);

  const unit = getUnit(unitId);
  const unitLabel = unit ? unit.label : unitId;
  const existingSnap = await db.collection('nigeria_unit_vision').doc(unitId).get();
  const existing = existingSnap.exists ? existingSnap.data() : null;

  // If the leader only wrote a vision, auto-build a starter plan so share/update always works.
  const hasPlan =
    plan &&
    typeof plan === 'object' &&
    ((Array.isArray(plan.milestones) && plan.milestones.length) ||
      (Array.isArray(plan.roadmap) && plan.roadmap.length));
  if (!hasPlan) {
    plan = existing && existing.plan
      ? existing.plan
      : buildStarterVisionPlan(visionText, unitLabel, new Date());
  }

  plan = mergeMilestoneProgress(existing && existing.plan, plan);
  if (Array.isArray(plan.milestones)) {
    plan.milestones = plan.milestones.map((m) =>
      Object.assign({}, m, { status: normalizeVisionStatus(m && m.status) })
    );
  }

  const imageUrls =
    request.data?.imageUrls != null || request.data?.photos != null
      ? normalizeImageUrls(request.data?.imageUrls || request.data?.photos, 12)
      : normalizeImageUrls(existing && existing.imageUrls, 12);
  const record = {
    unitId,
    unitLabel,
    visionText,
    plan,
    planText: formatVisionPlanText(plan),
    progress: visionProgressSummary(plan),
    imageUrls,
    updatedByUid: uid,
    updatedByName: profile.name || '',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('nigeria_unit_vision').doc(unitId).set(record, { merge: true });
  return { ok: true, progress: record.progress, imageUrls, plan };
  }
);

/**
 * Leaders mark milestone progress on the vision board (todo / doing / done)
 * without rewriting the whole plan. The whole team sees the progress bench.
 */
const updateNigeriaVisionProgress = onCall(
  { cors: true, timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
  const profile = profileSnap.data();
  const unitId = String(request.data?.unitId || '').trim();
  const milestoneIndex = Number(request.data?.milestoneIndex);
  const status = normalizeVisionStatus(request.data?.status);
  if (!unitId || !Number.isInteger(milestoneIndex) || milestoneIndex < 0) {
    throw new HttpsError('invalid-argument', 'Unit and milestone are required.');
  }
  const isSuperUser = access.isSuperUser === true || profile.isSuperUser === true;
  assertUnitLeader(profile, unitId, isSuperUser);

  const ref = db.collection('nigeria_unit_vision').doc(unitId);
  const snap = await ref.get();
  if (!snap.exists || !snap.data().plan) {
    throw new HttpsError('failed-precondition', 'Share a vision plan with the team first.');
  }
  const data = snap.data();
  const plan = Object.assign({}, data.plan);
  const milestones = Array.isArray(plan.milestones) ? plan.milestones.slice() : [];
  if (milestoneIndex >= milestones.length) {
    throw new HttpsError('invalid-argument', 'That milestone was not found.');
  }
  milestones[milestoneIndex] = Object.assign({}, milestones[milestoneIndex], {
    status,
    statusUpdatedAt: new Date().toISOString(),
    statusUpdatedByUid: uid,
    statusUpdatedByName: profile.name || '',
  });
  plan.milestones = milestones;
  const progress = visionProgressSummary(plan);
  await ref.set(
    {
      plan,
      planText: formatVisionPlanText(plan),
      progress,
      updatedByUid: uid,
      updatedByName: profile.name || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { ok: true, progress, plan };
});

const getPrayerCityAccess = onCall(async (request) => {
  const email = normalizeEmail(request.auth?.token?.email);
  if (!request.auth?.uid || !email) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  return {
    email,
    isSuperUser: isSuperUserEmail(email),
    isDigestAdmin: isSuperUserEmail(email),
  };
});

const submitNigeriaMemberSignup = onCall(
  {
    cors: true,
    secrets: [appsScriptSelfServeMailUrl, selfServeMailSecret],
  },
  async (request) => {
    const name = String(request.data?.name || '').trim();
    const email = normalizeEmail(request.data?.email);
    const phoneRaw = String(request.data?.phone || '').trim();
    const city = String(request.data?.city || '').trim().slice(0, 120);
    const birthday = String(request.data?.birthday || '').trim().slice(0, 20);
    const maritalStatus = String(request.data?.maritalStatus || '').trim().slice(0, 40);
    const interest = String(request.data?.interest || '').trim().slice(0, 80);
    const notes = String(request.data?.notes || '').trim().slice(0, 500);

    if (!name || name.length < 2) {
      throw new HttpsError('invalid-argument', 'Please enter your full name.');
    }
    if (!email || !email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Please enter a valid email.');
    }
    const phone = normalizeNigeriaPhone(phoneRaw) || phoneFromRegistration(phoneRaw);
    if (!phone && !isNigeriaPhoneRegistered(phoneRaw)) {
      throw new HttpsError('invalid-argument', 'Please enter a valid Nigeria phone number.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      throw new HttpsError('invalid-argument', 'Please enter your birthday.');
    }
    const allowedMarital = new Set([
      'single',
      'married',
      'engaged',
      'widowed',
      'divorced',
      'prefer-not-to-say',
    ]);
    if (!allowedMarital.has(maritalStatus)) {
      throw new HttpsError('invalid-argument', 'Please select your marital status.');
    }

    const db = admin.firestore();
    const docRef = db.collection('nigeria_member_signups').doc();
    const record = {
      name,
      email,
      phone: phone || phoneRaw,
      city,
      birthday,
      maritalStatus,
      interest,
      notes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      welcomeEmailSent: false,
    };
    await docRef.set(record);

    const mail = buildWelcomeSignupMail({ name });
    let welcomeEmailSent = false;
    let welcomeEmailError = '';
    try {
      const mailRes = await sendMailViaAppsScript({
        scriptUrl: appsScriptSelfServeMailUrl.value(),
        secret: selfServeMailSecret.value(),
        email,
        subject: mail.subject,
        plainBody: mail.plainBody,
        htmlBody: mail.htmlBody,
      });
      welcomeEmailSent = mailRes.ok === true;
      if (!mailRes.ok) welcomeEmailError = mailRes.error || 'mail_failed';
    } catch (e) {
      welcomeEmailError = String(e.message || e);
    }

    await docRef.set(
      {
        welcomeEmailSent,
        welcomeEmailError: welcomeEmailError || admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    return {
      ok: true,
      id: docRef.id,
      welcomeEmailSent,
      message: welcomeEmailSent
        ? 'Thank you! Check your inbox for a welcome email — our team will reach out soon.'
        : 'Thank you! Our team will reach out soon.',
    };
  }
);

const ALIVE_HANGOUT_EDITION = '2027-06';
const ALIVE_STREAMS = new Set(['brother', 'sister', 'married', 'single']);
const ALIVE_HEARD_FROM = new Set(['instagram', 'bible-study', 'friend', 'jesus-march', 'other', '']);

function normalizeHangoutPhone(phoneRaw) {
  const ng = normalizeNigeriaPhone(phoneRaw) || phoneFromRegistration(phoneRaw);
  if (ng) return ng;
  const digits = String(phoneRaw || '').replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) {
    if (digits.startsWith('00')) return '+' + digits.slice(2);
    if (digits.startsWith('234')) return '+' + digits;
    return '+' + digits;
  }
  return null;
}

function aliveHangoutRsvpId(edition, email) {
  return (
    String(edition || ALIVE_HANGOUT_EDITION) +
    '_' +
    Buffer.from(String(email || ''))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
      .slice(0, 80)
  );
}

function buildAliveHangoutMail({ name, returning }) {
  const first = String(name || 'friend').trim().split(/\s+/)[0] || 'friend';
  const subject = returning
    ? 'Your Alive Hangout 2027 details were updated'
    : 'You are registered — Alive Hangout, Saturday 12 June 2027';
  const plainBody =
    'Hi ' +
    first +
    ',\n\n' +
    'Registration is compulsory. You are registered for Alive Hangout — Dear Daughter Nigeria, Saturday 12 June 2027.\n\n' +
    'This is the outdoor getaway for men, women, married couples, and singles: games, food, dance, guest ministers, special presentations, and teaching on righteousness, sexual purity, and being alive in Christ (dead to sin).\n\n' +
    'We will email and WhatsApp the outdoor venue to everyone on this list. Keep Saturday 12 June 2027 open.\n\n' +
    'Share the page: https://prayercityhtx.com/alive\n' +
    'Nigeria hub: https://prayercityhtx.com/ng\n\n' +
    'Romans 6:11 — Reckon yourselves dead indeed unto sin, but alive unto God through Jesus Christ our Lord.\n\n' +
    'Dear Daughter Bible Study Group Nigeria\n';
  const htmlBody =
    '<div style="font-family:Georgia,serif;color:#12352a;max-width:640px;line-height:1.6;background:#f6f1e4;padding:28px">' +
    '<p style="letter-spacing:0.18em;text-transform:uppercase;font-size:11px;color:#9a7420;font-weight:700;margin:0 0 8px">Alive Hangout · Saturday 12 June 2027</p>' +
    '<h1 style="font-size:28px;margin:0 0 16px;color:#07140f">You are registered.</h1>' +
    '<p>Hi <strong>' +
    escapeHtml(first) +
    '</strong>,</p>' +
    '<p>Your registration is complete. Welcome to <strong>Alive Hangout</strong> — our outdoor Christian getaway for men, women, married couples, and singles.</p>' +
    '<p style="background:#fff;border:1px solid #e7dcc4;border-radius:12px;padding:14px 16px">' +
    '<strong>Saturday, 12 June 2027</strong><br>' +
    'Games. Food. Dance. Guest ministers. Special presentations.<br>' +
    'We teach righteousness, sexual purity, and a life that is <em>alive in Christ and dead to sin</em>.</p>' +
    '<p>The outdoor venue will come to this email and your WhatsApp. Keep Saturday 12 June 2027 open.</p>' +
    '<p style="margin:24px 0"><a href="https://prayercityhtx.com/alive" style="display:inline-block;background:#d4af37;color:#07140f;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">Open the hangout page</a></p>' +
    '<p style="font-size:14px;color:#4b5d54">Romans 6:11 · Dear Daughter Bible Study Group Nigeria</p></div>';
  return { subject, plainBody, htmlBody };
}

const submitAliveHangoutRsvp = onCall(
  {
    cors: true,
    invoker: 'public',
    secrets: [appsScriptSelfServeMailUrl, selfServeMailSecret],
  },
  async (request) => {
    if (String(request.data?.website || '').trim()) {
      return { ok: true, message: 'Thank you.' };
    }

    const edition = String(request.data?.edition || ALIVE_HANGOUT_EDITION)
      .trim()
      .slice(0, 12);
    const useEdition = edition === ALIVE_HANGOUT_EDITION ? edition : ALIVE_HANGOUT_EDITION;
    const name = String(request.data?.name || '').trim().slice(0, 120);
    const email = normalizeEmail(request.data?.email);
    const phoneRaw = String(request.data?.phone || '').trim();
    const city = String(request.data?.city || '').trim().slice(0, 120);
    const stream = String(request.data?.stream || '').trim().toLowerCase();
    const church = String(request.data?.church || '').trim().slice(0, 120);
    const heardFromRaw = String(request.data?.heardFrom || '').trim().toLowerCase();
    const heardFrom = ALIVE_HEARD_FROM.has(heardFromRaw) ? heardFromRaw : '';
    const notes = String(request.data?.notes || '').trim().slice(0, 500);
    const wantToServe = request.data?.wantToServe === true;
    let partySize = Number(request.data?.partySize || 1);
    if (!Number.isFinite(partySize)) partySize = 1;
    partySize = Math.min(8, Math.max(1, Math.round(partySize)));

    if (!name || name.length < 2) {
      throw new HttpsError('invalid-argument', 'Please enter your full name.');
    }
    if (!email || !email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Please enter a valid email.');
    }
    const phone = normalizeHangoutPhone(phoneRaw);
    if (!phone) {
      throw new HttpsError('invalid-argument', 'Please enter a valid phone / WhatsApp number.');
    }
    if (!ALIVE_STREAMS.has(stream)) {
      throw new HttpsError('invalid-argument', 'Please choose who you are coming as.');
    }

    const db = admin.firestore();
    const docRef = db.collection('alive_hangout_rsvps').doc(aliveHangoutRsvpId(useEdition, email));
    const existing = await docRef.get();
    const returning = existing.exists;
    const record = {
      edition: useEdition,
      name,
      email,
      phone,
      city,
      stream,
      partySize,
      church,
      heardFrom,
      notes,
      wantToServe,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!returning) {
      record.createdAt = admin.firestore.FieldValue.serverTimestamp();
      record.confirmEmailSent = false;
    }
    await docRef.set(record, { merge: true });

    const mail = buildAliveHangoutMail({ name, returning });
    let confirmEmailSent = false;
    let confirmEmailError = '';
    try {
      const mailRes = await sendMailViaAppsScript({
        scriptUrl: appsScriptSelfServeMailUrl.value(),
        secret: selfServeMailSecret.value(),
        email,
        subject: mail.subject,
        plainBody: mail.plainBody,
        htmlBody: mail.htmlBody,
      });
      confirmEmailSent = mailRes.ok === true;
      if (!mailRes.ok) confirmEmailError = mailRes.error || 'mail_failed';
    } catch (e) {
      confirmEmailError = String(e.message || e);
    }

    await docRef.set(
      {
        confirmEmailSent,
        confirmEmailError: confirmEmailError || admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    return {
      ok: true,
      id: docRef.id,
      returning,
      confirmEmailSent,
      message: returning
        ? confirmEmailSent
          ? 'You were already on the list — we updated your details and emailed you.'
          : 'You were already on the list — we updated your details.'
        : confirmEmailSent
          ? 'You are registered. Check your email — we will send the outdoor venue.'
          : 'You are registered. Watch this number — we will send the outdoor venue.',
    };
  }
);

const getAliveHangoutRsvps = onCall(async (request) => {
  requireAuth(request);
  const email = normalizeEmail(request.auth?.token?.email);
  if (!canViewAllNigeriaUnitReports(email)) {
    throw new HttpsError('permission-denied', 'Nigeria coordinators only.');
  }

  const edition = String(request.data?.edition || ALIVE_HANGOUT_EDITION).trim() || ALIVE_HANGOUT_EDITION;
  const snap = await admin
    .firestore()
    .collection('alive_hangout_rsvps')
    .where('edition', '==', edition)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const rsvps = snap.docs.map((doc) => {
    const d = doc.data();
    const createdAt = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : null;
    return {
      id: doc.id,
      name: d.name || '',
      email: d.email || '',
      phone: d.phone || '',
      city: d.city || '',
      stream: d.stream || '',
      partySize: d.partySize || 1,
      church: d.church || '',
      heardFrom: d.heardFrom || '',
      notes: d.notes || '',
      wantToServe: d.wantToServe === true,
      createdAt,
      confirmEmailSent: d.confirmEmailSent === true,
    };
  });

  return { edition, rsvps, count: rsvps.length };
});

const getNigeriaMemberSignups = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const email = normalizeEmail(request.auth?.token?.email);
  const isSuperUser = isSuperUserEmail(email);

  if (!isSuperUser) {
    const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
    if (!profileSnap.exists) {
      throw new HttpsError('failed-precondition', 'Complete your profile first.');
    }
    const profile = profileSnap.data();
    if (!canViewMemberSignups(profile, false)) {
      throw new HttpsError(
        'permission-denied',
        'Welcome & Hospitality or Growth & Retention leaders only.'
      );
    }
  }

  const snap = await db
    .collection('nigeria_member_signups')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const signups = snap.docs.map((doc) => {
    const d = doc.data();
    const createdAt = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : null;
    return {
      id: doc.id,
      name: d.name || '',
      email: d.email || '',
      phone: d.phone || '',
      city: d.city || '',
      birthday: d.birthday || '',
      maritalStatus: d.maritalStatus || '',
      interest: d.interest || '',
      notes: d.notes || '',
      createdAt,
      welcomeEmailSent: d.welcomeEmailSent === true,
    };
  });

  return { signups };
});

const submitNigeriaWorkforceSignup = onCall(
  {
    cors: true,
    secrets: [appsScriptSelfServeMailUrl, selfServeMailSecret],
  },
  async (request) => {
    const name = String(request.data?.name || '').trim();
    const email = normalizeEmail(request.data?.email);
    const phoneRaw = String(request.data?.phone || '').trim();
    const city = String(request.data?.city || '').trim().slice(0, 120);
    const notes = String(request.data?.notes || '').trim().slice(0, 500);
    const unitIdsRaw = Array.isArray(request.data?.unitIds) ? request.data.unitIds : [];

    if (!name || name.length < 2) {
      throw new HttpsError('invalid-argument', 'Please enter your full name.');
    }
    if (!email || !email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Please enter a valid email.');
    }
    const phone = normalizeNigeriaPhone(phoneRaw) || phoneFromRegistration(phoneRaw);
    if (!phone && !isNigeriaPhoneRegistered(phoneRaw)) {
      throw new HttpsError('invalid-argument', 'Please enter a valid Nigeria phone number.');
    }

    const unitIds = [...new Set(unitIdsRaw.map((id) => String(id || '').trim()).filter(Boolean))];
    if (!unitIds.length) {
      throw new HttpsError('invalid-argument', 'Choose at least one unit to serve.');
    }

    const units = [];
    for (const id of unitIds) {
      if (WORKFORCE_ENLIST_EXCLUDE.has(id)) continue;
      const unit = getUnit(id);
      if (!unit) throw new HttpsError('invalid-argument', 'Invalid unit: ' + id);
      units.push({ unitId: unit.id, unitLabel: unit.label });
    }
    if (!units.length) {
      throw new HttpsError('invalid-argument', 'Choose at least one unit to serve.');
    }

    const db = admin.firestore();
    const existing = await db
      .collection('nigeria_workforce_signups')
      .where('email', '==', email)
      .limit(10)
      .get();
    const hasActive = existing.docs.some((doc) =>
      WORKFORCE_ACTIVE_STATUSES.includes(doc.data().status)
    );
    if (hasActive) {
      throw new HttpsError(
        'already-exists',
        'You already have a Kingdom Workforce application in progress. Check your email for Workers Training Class details.'
      );
    }

    const docRef = db.collection('nigeria_workforce_signups').doc();
    const applicant = { name, email, phone: phone || phoneRaw, city, notes };
    const record = {
      ...applicant,
      units,
      unitIds: units.map((u) => u.unitId),
      status: 'pending_training',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      welcomeEmailSent: false,
      leaderEmailsNotified: [],
    };
    await docRef.set(record);

    const scriptUrl = appsScriptSelfServeMailUrl.value();
    const secret = selfServeMailSecret.value();
    let welcomeEmailSent = false;
    let welcomeEmailError = '';

    try {
      const welcome = buildWorkforceWelcomeMail({ name, units });
      const mailRes = await sendMailViaAppsScript({
        scriptUrl,
        secret,
        email,
        subject: welcome.subject,
        plainBody: welcome.plainBody,
        htmlBody: welcome.htmlBody,
      });
      welcomeEmailSent = mailRes.ok === true;
      if (!mailRes.ok) welcomeEmailError = mailRes.error || 'mail_failed';
    } catch (e) {
      welcomeEmailError = String(e.message || e);
    }

    const notified = new Set();
    const notifyTargets = new Map();

    for (const u of units) {
      const leaders = await loadUnitLeaders(db, u.unitId);
      for (const leader of leaders) {
        if (!notifyTargets.has(leader.email)) {
          notifyTargets.set(leader.email, leader);
        }
      }
    }
    const coordLeaders = await loadUnitLeaders(db, WORKERS_COORDINATOR_UNIT_ID);
    for (const leader of coordLeaders) {
      notifyTargets.set(leader.email, leader);
    }

    for (const leader of notifyTargets.values()) {
      if (notified.has(leader.email)) continue;
      notified.add(leader.email);
      try {
        const mail = buildWorkforceLeaderNotifyMail({ leaderName: leader.name, applicant, units });
        await sendMailViaAppsScript({
          scriptUrl,
          secret,
          email: leader.email,
          subject: mail.subject,
          plainBody: mail.plainBody,
          htmlBody: mail.htmlBody,
        });
      } catch (e) {
        console.warn('[workforceNotify]', leader.email, e);
      }
    }

    await docRef.set(
      {
        welcomeEmailSent,
        welcomeEmailError: welcomeEmailError || admin.firestore.FieldValue.delete(),
        leaderEmailsNotified: [...notified],
      },
      { merge: true }
    );

    return {
      ok: true,
      id: docRef.id,
      welcomeEmailSent,
      message: welcomeEmailSent
        ? 'Enlisted! Check your email about Workers Training Class. Hub sign-in opens after your Workers Coordinator clears you.'
        : 'Enlisted! Our Workers Coordinator and unit leaders will reach out about Workers Training Class.',
    };
  }
);

const getNigeriaWorkforceSignups = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const email = normalizeEmail(request.auth?.token?.email);
  const isSuperUser = isSuperUserEmail(email);

  let access = { canView: true, canApprove: true, leaderUnitIds: null };
  if (!isSuperUser) {
    const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
    if (!profileSnap.exists) {
      throw new HttpsError('failed-precondition', 'Complete your profile first.');
    }
    access = workforceAccessForProfile(profileSnap.data(), false);
    if (!access.canView) {
      throw new HttpsError('permission-denied', 'Workers Coordinator leaders only.');
    }
  }

  const snap = await db
    .collection('nigeria_workforce_signups')
    .orderBy('createdAt', 'desc')
    .limit(80)
    .get();

  const signups = snap.docs
    .map((doc) => {
      const d = doc.data();
      const createdAt =
        d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : null;
      const approvedAt =
        d.approvedAt && d.approvedAt.toDate ? d.approvedAt.toDate().toISOString() : null;
      return {
        id: doc.id,
        name: d.name || '',
        email: d.email || '',
        phone: d.phone || '',
        city: d.city || '',
        notes: d.notes || '',
        units: d.units || [],
        unitIds: d.unitIds || [],
        status: d.status || 'pending_training',
        createdAt,
        approvedAt,
        welcomeEmailSent: d.welcomeEmailSent === true,
      };
    })
    .filter((s) => {
      if (access.leaderUnitIds === null) return true;
      return s.unitIds.some((id) => access.leaderUnitIds.includes(id));
    });

  return { signups, canApprove: access.canApprove };
});

const approveNigeriaWorkforceSignup = onCall(
  {
    cors: true,
    secrets: [appsScriptSelfServeMailUrl, selfServeMailSecret],
  },
  async (request) => {
    const uid = requireAuth(request);
    const signupId = String(request.data?.signupId || '').trim();
    if (!signupId) throw new HttpsError('invalid-argument', 'signupId required.');

    const db = admin.firestore();
    const email = normalizeEmail(request.auth?.token?.email);
    const isSuperUser = isSuperUserEmail(email);

    if (!isSuperUser) {
      const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
      if (!profileSnap.exists || !isWorkersCoordinatorLeader(profileSnap.data(), false)) {
        throw new HttpsError('permission-denied', 'Workers Coordinator leader only.');
      }
    }

    const ref = db.collection('nigeria_workforce_signups').doc(signupId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Signup not found.');
    const data = snap.data();
    if (data.status === 'approved') {
      return { ok: true, alreadyApproved: true };
    }

    await ref.set(
      {
        status: 'approved',
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedByUid: uid,
        approvedByEmail: email,
      },
      { merge: true }
    );

    // Bridge the approved applicant into the onboarding registry so they become
    // eligible to sign in to the Nigeria dashboard with this same email.
    const applicantEmail = normalizeEmail(data.email);
    if (applicantEmail) {
      const nigeriaUnits = (Array.isArray(data.units) ? data.units : [])
        .map((u) => {
          const unit = getUnit(u && u.unitId);
          if (!unit) return null;
          return { unitId: unit.id, unitLabel: unit.label, role: 'member' };
        })
        .filter(Boolean);

      await db
        .collection('volunteer_onboarding')
        .doc(applicantEmail)
        .set(
          {
            email: applicantEmail,
            name: data.name || '',
            phone: phoneFromRegistration(data.phone) || data.phone || '',
            notes: data.notes || '',
            region: 'nigeria',
            source: 'nigeria_workforce',
            nigeriaUnits,
            onboardingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      // If they already have a hub profile, merge the enlisted units onto it
      // so leaders see them in My members immediately.
      try {
        const existingVol = await db
          .collection('nigeria_volunteers')
          .where('email', '==', applicantEmail)
          .limit(1)
          .get();
        if (!existingVol.empty) {
          const volDoc = existingVol.docs[0];
          const current = normalizeProfileUnits(volDoc.data());
          const byId = new Map(current.map((u) => [u.unitId, u]));
          nigeriaUnits.forEach((u) => {
            if (!byId.has(u.unitId)) byId.set(u.unitId, u);
          });
          const merged = [...byId.values()];
          if (merged.length) {
            const primary = merged[0];
            await volDoc.ref.set(
              {
                units: merged,
                unitIds: merged.map((u) => u.unitId),
                unitId: primary.unitId,
                unitLabel: primary.unitLabel,
                role: primary.role,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
        }
      } catch (mergeErr) {
        console.warn('[approveWorkforce] merge units', mergeErr);
      }
    }

    let clearedEmailSent = false;
    try {
      const mail = buildWorkforceApprovedMail({ name: data.name });
      const mailRes = await sendMailViaAppsScript({
        scriptUrl: appsScriptSelfServeMailUrl.value(),
        secret: selfServeMailSecret.value(),
        email: normalizeEmail(data.email),
        subject: mail.subject,
        plainBody: mail.plainBody,
        htmlBody: mail.htmlBody,
      });
      clearedEmailSent = mailRes.ok === true;
    } catch (e) {
      console.warn('[approveWorkforce]', e);
    }

    await ref.set({ clearedEmailSent }, { merge: true });

    return { ok: true, clearedEmailSent };
  }
);

const markNigeriaWorkforceInTraining = onCall(async (request) => {
  const uid = requireAuth(request);
  const signupId = String(request.data?.signupId || '').trim();
  if (!signupId) throw new HttpsError('invalid-argument', 'signupId required.');

  const db = admin.firestore();
  const email = normalizeEmail(request.auth?.token?.email);
  const isSuperUser = isSuperUserEmail(email);

  if (!isSuperUser) {
    const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
    if (!profileSnap.exists || !isWorkersCoordinatorLeader(profileSnap.data(), false)) {
      throw new HttpsError('permission-denied', 'Workers Coordinator leader only.');
    }
  }

  const ref = db.collection('nigeria_workforce_signups').doc(signupId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Signup not found.');

  await ref.set(
    {
      status: 'in_training',
      inTrainingAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
});

/**
 * Email a filled monthly unit report copy to the reporter (and optional CC).
 * Replaces broken FormSubmit "send to my email" on the Nigeria hub.
 */
const emailNigeriaUnitReportCopy = onCall(
  {
    cors: true,
    timeoutSeconds: 60,
    secrets: [appsScriptSelfServeMailUrl, selfServeMailSecret],
  },
  async (request) => {
    const uid = requireAuth(request);
    const db = admin.firestore();
    await assertNigeriaVolunteerAccess(db, uid, request.auth);
    const data = request.data || {};

    const reporterName = String(data.reporterName || '').trim().slice(0, 120);
    const reporterEmail = normalizeEmail(data.reporterEmail || request.auth.token.email);
    const unitDisplay = String(data.unitDisplay || data.unitId || 'Unit').trim().slice(0, 120);
    const year = parseInt(data.reportYear, 10);
    const month = parseInt(data.reportMonth, 10);
    const activities = String(data.activities || '').trim();

    if (!reporterName) throw new HttpsError('invalid-argument', 'Name is required.');
    if (!reporterEmail || !reporterEmail.includes('@')) {
      throw new HttpsError('invalid-argument', 'A valid email is required.');
    }
    if (!year || !month) throw new HttpsError('invalid-argument', 'Reporting month is required.');
    if (!activities) throw new HttpsError('invalid-argument', 'Please describe what your unit did this month.');

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const period = (monthNames[month - 1] || String(month)) + ' ' + year;

    function block(title, body) {
      const text = String(body || '').trim();
      if (!text) return '';
      return '\n--- ' + title + ' ---\n' + text + '\n';
    }

    const plainBody =
      'Hi ' +
      reporterName.split(/\s+/)[0] +
      ',\n\n' +
      'Here is your Dear Daughter Nigeria unit report copy.\n\n' +
      'Unit: ' +
      unitDisplay +
      '\nPeriod: ' +
      period +
      '\nSubmitted by: ' +
      reporterName +
      '\nEmail: ' +
      reporterEmail +
      (data.reporterPhone ? '\nPhone: ' + String(data.reporterPhone).trim() : '') +
      '\nMeetings / gatherings: ' +
      (String(data.meetingsHeld || '').trim() || '—') +
      '\nAttendance: ' +
      (String(data.attendance || '').trim() || '—') +
      block('Meeting notes summary', data.meetingNotesSummary) +
      block('Activities', activities) +
      block('Highlights', data.highlights) +
      block('Testimonies', data.testimonies) +
      block('Challenges', data.challenges) +
      block('Prayer requests', data.prayerRequests) +
      block('Plans for next month', data.nextMonth) +
      '\nOpen the hub anytime: https://prayercityhtx.com/ng\n\n' +
      'Dear Daughter Bible Study Group Nigeria\n';

    function htmlBlock(title, body) {
      const text = String(body || '').trim();
      if (!text) return '';
      return (
        '<h3 style="margin:18px 0 6px;font-size:14px;color:#0f3d5c">' +
        escapeHtml(title) +
        '</h3><p style="white-space:pre-wrap;margin:0;line-height:1.5">' +
        escapeHtml(text) +
        '</p>'
      );
    }

    const htmlBody =
      '<div style="font-family:system-ui,sans-serif;color:#1e293b;max-width:640px;line-height:1.5">' +
      '<p>Hi <strong>' +
      escapeHtml(reporterName.split(/\s+/)[0]) +
      '</strong>,</p>' +
      '<p>Here is your <strong>Dear Daughter Nigeria</strong> unit report copy.</p>' +
      '<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px">' +
      '<strong>' +
      escapeHtml(unitDisplay) +
      '</strong><br>Period: ' +
      escapeHtml(period) +
      '<br>Submitted by: ' +
      escapeHtml(reporterName) +
      '</p>' +
      htmlBlock('Meetings / gatherings', data.meetingsHeld || '—') +
      htmlBlock('Attendance', data.attendance || '—') +
      htmlBlock('Meeting notes summary', data.meetingNotesSummary) +
      htmlBlock('Activities', activities) +
      htmlBlock('Highlights', data.highlights) +
      htmlBlock('Testimonies', data.testimonies) +
      htmlBlock('Challenges', data.challenges) +
      htmlBlock('Prayer requests', data.prayerRequests) +
      htmlBlock('Plans for next month', data.nextMonth) +
      '<p style="margin-top:20px"><a href="https://prayercityhtx.com/ng" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Open Nigeria hub</a></p>' +
      '<p style="font-size:12px;color:#64748b">Dear Daughter Bible Study Group Nigeria</p></div>';

    const subject = 'Your unit report — ' + unitDisplay + ' (' + period + ')';
    const mailRes = await sendMailViaAppsScript({
      scriptUrl: appsScriptSelfServeMailUrl.value(),
      secret: selfServeMailSecret.value(),
      email: reporterEmail,
      subject,
      plainBody,
      htmlBody,
    });

    if (!mailRes || !mailRes.ok) {
      throw new HttpsError(
        'internal',
        (mailRes && mailRes.error) || 'Could not send the report email. Try Download PDF instead.'
      );
    }

    return { ok: true, emailedTo: reporterEmail };
  }
);

/**
 * Overview: list submitted monthly reports across all Nigeria units.
 * Restricted to super users + designated overview emails.
 */
/**
 * Read-only: list recent shared/approved/submitted drafts across the caller's units.
 * Used so multi-unit members can find a teammate's shared report without guessing unit/month.
 * Never writes. Never returns drafts for units the caller cannot access.
 */
const listMyNigeriaUnitReportDrafts = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
  const profile = profileSnap.data();
  const memberships = normalizeProfileUnits(profile);
  const unitIds = memberships.map((u) => u.unitId).filter(Boolean);
  if (!unitIds.length && profile.unitId) unitIds.push(String(profile.unitId));
  // Super-users with an empty profile still need a path — keep it narrow (no full catalog scan).
  if (access.isSuperUser && !unitIds.length && profile.unitId) {
    unitIds.push(String(profile.unitId));
  }

  const uniqueUnitIds = [...new Set(unitIds)];
  if (!uniqueUnitIds.length) {
    return { ok: true, drafts: [], count: 0 };
  }
  const now = new Date();
  const monthsBack = 6;
  const reads = [];
  uniqueUnitIds.forEach((unitId) => {
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const draftId = reportDraftId(unitId, year, month);
      reads.push(
        db
          .collection('nigeria_unit_report_drafts')
          .doc(draftId)
          .get()
          .then((snap) => ({ draftId, unitId, year, month, snap }))
          .catch(() => null)
      );
    }
  });

  const rows = await Promise.all(reads);
  const drafts = [];
  rows.forEach((row) => {
    if (!row || !row.snap || !row.snap.exists) return;
    const d = row.snap.data() || {};
    const status = String(d.status || '');
    if (!['shared', 'approved', 'submitted'].includes(status)) return;
    if (!reportFormHasContent(d.form)) return;
    if (!access.isSuperUser && !memberHasUnit(profile, d.unitId || row.unitId)) return;
    const unit = getUnit(d.unitId || row.unitId);
    drafts.push({
      draftId: row.draftId,
      unitId: d.unitId || row.unitId,
      unitLabel: d.unitLabel || (unit && unit.label) || row.unitId,
      reportYear: d.reportYear || row.year,
      reportMonth: d.reportMonth || row.month,
      status,
      sharedByName: d.sharedByName || '',
      approvedByName: d.approvedByName || '',
      lastUpdatedByName: d.lastUpdatedByName || '',
      form: d.form || {},
      contributions: Array.isArray(d.contributions) ? d.contributions.slice(-12) : [],
    });
  });

  drafts.sort((a, b) => {
    if (b.reportYear !== a.reportYear) return b.reportYear - a.reportYear;
    if (b.reportMonth !== a.reportMonth) return b.reportMonth - a.reportMonth;
    return String(a.unitLabel).localeCompare(String(b.unitLabel));
  });

  return { ok: true, drafts, count: drafts.length };
});

const listNigeriaUnitReports = onCall(async (request) => {
  const uid = requireAuth(request);
  const email = normalizeEmail(request.auth?.token?.email);
  if (!canViewAllNigeriaUnitReports(email)) {
    throw new HttpsError('permission-denied', 'You do not have access to all-unit reports.');
  }

  const db = admin.firestore();
  await assertNigeriaVolunteerAccess(db, uid, request.auth);

  const yearFilter = parseInt(request.data?.reportYear, 10) || 0;
  const monthFilter = parseInt(request.data?.reportMonth, 10) || 0;

  const snap = await db.collection('nigeria_unit_reports').limit(250).get();
  const reports = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const year = parseInt(d.reportYear, 10) || 0;
    const month = parseInt(d.reportMonth, 10) || 0;
    if (yearFilter && year !== yearFilter) return;
    if (monthFilter && month !== monthFilter) return;
    reports.push({
      id: doc.id,
      unitId: d.unitId || '',
      unitLabel: d.unitLabel || d.unitId || 'Unit',
      reportYear: year,
      reportMonth: month,
      leaderName: d.leaderName || '',
      leaderPhone: d.leaderPhone || '',
      activities: d.activities || '',
      highlights: d.highlights || '',
      testimonies: d.testimonies || '',
      challenges: d.challenges || '',
      prayerRequests: d.prayerRequests || '',
      nextMonth: d.nextMonth || '',
      meetingNotesSummary: d.meetingNotesSummary || '',
      meetingsHeld: d.meetingsHeld != null ? d.meetingsHeld : '',
      attendanceNarrative: d.attendanceNarrative || '',
      photos: Array.isArray(d.photos) ? d.photos.slice(0, 12) : [],
      submittedAt: d.submittedAt || null,
    });
  });

  reports.sort((a, b) => {
    if (b.reportYear !== a.reportYear) return b.reportYear - a.reportYear;
    if (b.reportMonth !== a.reportMonth) return b.reportMonth - a.reportMonth;
    return String(a.unitLabel).localeCompare(String(b.unitLabel));
  });

  return {
    ok: true,
    reports,
    count: reports.length,
  };
});

module.exports = {
  saveNigeriaProfile,
  setNigeriaMemberRole,
  recordNigeriaAttendance,
  submitNigeriaAbsenceRequest,
  getNigeriaDashboard,
  getNigeriaMyMembersRosters,
  getNigeriaUnitMemberOptions,
  submitNigeriaUnitReport,
  shareNigeriaUnitReportDraft,
  contributeNigeriaUnitReportDraft,
  approveNigeriaUnitReportDraft,
  getNigeriaAttendanceForReport,
  summarizeNigeriaMeetingNotesForReport,
  generateNigeriaUnitVision,
  saveNigeriaUnitVision,
  updateNigeriaVisionProgress,
  getPrayerCityAccess,
  submitNigeriaMemberSignup,
  submitAliveHangoutRsvp,
  getAliveHangoutRsvps,
  getNigeriaMemberSignups,
  submitNigeriaWorkforceSignup,
  getNigeriaWorkforceSignups,
  approveNigeriaWorkforceSignup,
  markNigeriaWorkforceInTraining,
  emailNigeriaUnitReportCopy,
  listNigeriaUnitReports,
  listMyNigeriaUnitReportDrafts,
  computeUnitAttendanceForReport,
  computeUserAttendanceStats,
  computeUnitRoster,
  loadUnitLeaders,
  NIGERIA_UNITS,
  INTERNAL_LEADERS_UNIT_ID,
};
