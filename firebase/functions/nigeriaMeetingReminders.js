'use strict';

const { sendMailViaAppsScript } = require('./lib/mailTransport');
const { isEmailBlocked } = require('./emailBlocklist');
const {
  loadUndeliverableEmailSet,
  markEmailUndeliverable,
  isPermanentDeliveryError,
} = require('./emailUndeliverable');
const { normalizeEmail } = require('./lib/adminAuth');

const TZ = 'Africa/Lagos';
const CRON_INTERVAL_MS = 5 * 60 * 1000;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const NIGERIA_UNITS = [
  { id: 'moderators-presenters', label: 'Moderators & Presenters', day: 1, start: '21:30', end: '22:30' },
  { id: 'bible-study', label: 'Bible Study Team', day: 2, start: '20:30', end: '21:30' },
  { id: 'prayer', label: 'Prayer Team', day: 2, start: '23:15', end: '00:30', endNextDay: true },
  { id: 'welcome-hospitality', label: 'Welcome & Hospitality', day: 3, start: '22:00', end: '22:30' },
  { id: 'creative', label: 'Creative Unit', day: 4, start: '20:00', end: '21:00' },
  { id: 'choir', label: 'Choir', day: 0, start: '20:30', end: '21:30' },
];

const REMINDER_BUCKETS = [
  { id: '2d', ms: 2 * 24 * 60 * 60 * 1000, label: 'in 2 days', subject: '2 days' },
  { id: '1d', ms: 24 * 60 * 60 * 1000, label: 'tomorrow', subject: '1 day' },
  { id: '2h', ms: 2 * 60 * 60 * 1000, label: 'in 2 hours', subject: '2 hours' },
  { id: '15m', ms: 15 * 60 * 1000, label: 'in 15 minutes', subject: '15 minutes' },
];

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

function formatTime12(hm) {
  const t = parseHm(hm);
  let h = t.h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return h + ':' + String(t.m).padStart(2, '0') + ' ' + ampm;
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
    return {
      unitId: unit.id,
      unitLabel: unit.label,
      dateYmd,
      dayName: DAY_NAMES[unit.day],
      key: meetingKey(unit.id, dateYmd),
      start,
      end,
      startLabel: formatTime12(unit.start),
      endLabel: formatTime12(unit.end),
    };
  }
  return null;
}

function reminderBucketFor(msUntil, intervalMs = CRON_INTERVAL_MS) {
  if (msUntil <= 0) return null;
  for (const bucket of REMINDER_BUCKETS) {
    const windowMs = bucket.id === '15m' ? 10 * 60 * 1000 : intervalMs;
    if (msUntil <= bucket.ms && msUntil > bucket.ms - windowMs) return bucket;
  }
  return null;
}

function sentDocId(uid, meetingKeyStr, reminderId) {
  return String(uid) + '__' + String(meetingKeyStr).replace(/[/.#]/g, '_') + '__' + reminderId;
}

async function loadVolunteersForUnit(db, unitId) {
  const seen = new Map();
  const [byIds, byLegacy] = await Promise.all([
    db.collection('nigeria_volunteers').where('unitIds', 'array-contains', unitId).get(),
    db.collection('nigeria_volunteers').where('unitId', '==', unitId).get(),
  ]);
  for (const snap of [byIds, byLegacy]) {
    snap.forEach((doc) => {
      const d = doc.data() || {};
      if (d.meetingReminderOptOut === true) return;
      const email = normalizeEmail(d.email);
      if (!email || !email.includes('@')) return;
      seen.set(doc.id, {
        uid: doc.id,
        email,
        name: String(d.name || '').trim() || email.split('@')[0],
      });
    });
  }
  return [...seen.values()];
}

function buildReminderMail(opts) {
  const {
    name,
    unitLabel,
    meeting,
    bucket,
    hubUrl,
  } = opts;
  const whenLine =
    meeting.dayName +
    ', ' +
    meeting.dateYmd +
    ' · ' +
    meeting.startLabel +
    ' – ' +
    meeting.endLabel +
    ' WAT';
  const subject =
    'DDBS Nigeria — ' + unitLabel + ' meeting ' + bucket.subject;
  const plainBody = [
    'Hi ' + name + ',',
    '',
    'Reminder: your ' + unitLabel + ' unit meeting is ' + bucket.label + '.',
    '',
    'When: ' + whenLine,
    '',
    'Open your unit hub to check in and view shared meeting notes:',
    hubUrl,
    '',
    'Dear Daughter Bible Study Group Nigeria',
  ].join('\n');

  const htmlBody =
    '<div style="font-family:system-ui,sans-serif;color:#1e293b;max-width:520px;line-height:1.5">' +
    '<p>Hi ' +
    escapeHtml(name) +
    ',</p>' +
    '<p><strong>Reminder:</strong> your <strong>' +
    escapeHtml(unitLabel) +
    '</strong> unit meeting is <strong>' +
    escapeHtml(bucket.label) +
    '</strong>.</p>' +
    '<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px">' +
    '<strong>When</strong><br>' +
    escapeHtml(whenLine) +
    '</p>' +
    '<p><a href="' +
    escapeHtml(hubUrl) +
    '" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Open unit hub</a></p>' +
    '<p style="font-size:12px;color:#64748b">Dear Daughter Bible Study Group Nigeria</p></div>';

  return { subject, plainBody, htmlBody };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {import('firebase-admin')} admin
 * @param {{ scriptUrl: string, secret: string }} mail
 * @param {{ force?: boolean, dryRun?: boolean, siteBase?: string }} [opts]
 */
async function runNigeriaMeetingRemindersJob(admin, mail, opts = {}) {
  const db = admin.firestore();
  const settingsSnap = await db.doc('settings/nigeria_meeting_reminders').get();
  const settings = settingsSnap.data() || {};
  if (settings.enabled !== true && !opts.force) {
    return { ok: false, aborted: 'disabled', message: 'Enable settings/nigeria_meeting_reminders { enabled: true }' };
  }

  const hubUrl =
    String(opts.siteBase || settings.siteBase || 'https://prayercityhtx.com').replace(/\/$/, '') +
    '/ddbs-nig.html#units';

  const undeliverable = await loadUndeliverableEmailSet(admin);
  const now = new Date();
  const stats = { sent: 0, skipped: 0, errors: 0, examined: 0 };

  for (const unit of NIGERIA_UNITS) {
    const meeting = getNextMeeting(unit, now);
    if (!meeting) continue;
    const msUntil = meeting.start.getTime() - now.getTime();
    const bucket = reminderBucketFor(msUntil);
    if (!bucket) continue;

    const volunteers = await loadVolunteersForUnit(db, unit.id);
    for (const vol of volunteers) {
      stats.examined++;
      if (isEmailBlocked(vol.email) || undeliverable.has(vol.email)) {
        stats.skipped++;
        continue;
      }

      const docId = sentDocId(vol.uid, meeting.key, bucket.id);
      const sentRef = db.collection('nigeria_meeting_reminder_sent').doc(docId);
      const sentSnap = await sentRef.get();
      if (sentSnap.exists && !opts.force) {
        stats.skipped++;
        continue;
      }

      const { subject, plainBody, htmlBody } = buildReminderMail({
        name: vol.name,
        unitLabel: unit.label,
        meeting,
        bucket,
        hubUrl,
      });

      if (opts.dryRun) {
        stats.sent++;
        continue;
      }

      const mailRes = await sendMailViaAppsScript({
        scriptUrl: mail.scriptUrl,
        secret: mail.secret,
        email: vol.email,
        subject,
        plainBody,
        htmlBody,
      });

      if (mailRes.ok) {
        await sentRef.set({
          uid: vol.uid,
          email: vol.email,
          unitId: unit.id,
          unitLabel: unit.label,
          meetingKey: meeting.key,
          meetingDateYmd: meeting.dateYmd,
          meetingStartIso: meeting.start.toISOString(),
          reminderType: bucket.id,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        stats.sent++;
      } else {
        if (isPermanentDeliveryError(mailRes.error)) {
          await markEmailUndeliverable(admin, vol.email, mailRes.error, 'nigeria_meeting_reminder');
        }
        stats.errors++;
      }
    }
  }

  return { ok: true, ...stats, ranAt: now.toISOString() };
}

module.exports = {
  runNigeriaMeetingRemindersJob,
  REMINDER_BUCKETS,
  reminderBucketFor,
  getNextMeeting,
  NIGERIA_UNITS,
};
