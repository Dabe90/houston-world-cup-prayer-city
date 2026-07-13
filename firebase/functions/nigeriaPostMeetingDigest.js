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
const CHECK_IN_CLOSE_MIN_AFTER = 10;

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

function buildMeetingForDate(unit, dateYmd) {
  const start = lagosLocalToDate(dateYmd, unit.start);
  let endYmd = dateYmd;
  if (unit.endNextDay) {
    const d = lagosLocalToDate(dateYmd, '12:00');
    endYmd = ymdInLagos(new Date(d.getTime() + 86400000));
  }
  let end = lagosLocalToDate(endYmd, unit.end);
  if (end <= start) end = new Date(end.getTime() + 86400000);
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

function meetingInDigestWindow(unit, now = new Date()) {
  for (let i = 0; i <= 2; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    if (lagosWeekday(d) !== unit.day) continue;
    const dateYmd = ymdInLagos(d);
    const meeting = buildMeetingForDate(unit, dateYmd);
    const digestStart = meeting.end.getTime() + CHECK_IN_CLOSE_MIN_AFTER * 60000;
    const digestEnd = digestStart + CRON_INTERVAL_MS;
    if (now.getTime() >= digestStart && now.getTime() < digestEnd) {
      return meeting;
    }
  }
  return null;
}

function noteDocId(unitId, meetingKeyStr) {
  return String(unitId) + '__' + String(meetingKeyStr).replace(/[/.#]/g, '_');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCheckedInAt(ts) {
  if (!ts || !ts.toDate) return '';
  return ts.toDate().toLocaleString('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
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
      if (d.meetingDigestOptOut === true) return;
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

function buildDigestMail(opts) {
  const { name, unitLabel, meeting, notesContent, attendanceLine, hubUrl } = opts;
  const whenLine =
    meeting.dayName +
    ', ' +
    meeting.dateYmd +
    ' · ' +
    meeting.startLabel +
    ' – ' +
    meeting.endLabel +
    ' WAT';
  const subject = 'DDBS Nigeria — ' + unitLabel + ' meeting notes (' + meeting.dateYmd + ')';
  const notesBlock = notesContent
    ? notesContent.slice(0, 6000)
    : '(No shared notes were saved for this meeting.)';

  const plainBody = [
    'Hi ' + name + ',',
    '',
    'Here is a recap from your ' + unitLabel + ' unit meeting.',
    '',
    'When: ' + whenLine,
    '',
    'Your attendance: ' + attendanceLine,
    '',
    'Meeting notes:',
    notesBlock,
    '',
    'Open your unit hub:',
    hubUrl,
    '',
    'Dear Daughter Bible Study Group Nigeria',
  ].join('\n');

  const htmlBody =
    '<div style="font-family:system-ui,sans-serif;color:#1e293b;max-width:520px;line-height:1.5">' +
    '<p>Hi ' +
    escapeHtml(name) +
    ',</p>' +
    '<p>Here is a recap from your <strong>' +
    escapeHtml(unitLabel) +
    '</strong> unit meeting.</p>' +
    '<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px">' +
    '<strong>When</strong><br>' +
    escapeHtml(whenLine) +
    '<br><br><strong>Your attendance</strong><br>' +
    escapeHtml(attendanceLine) +
    '</p>' +
    '<p><strong>Meeting notes</strong></p>' +
    '<pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;font-size:13px">' +
    escapeHtml(notesBlock) +
    '</pre>' +
    '<p><a href="' +
    escapeHtml(hubUrl) +
    '" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Open unit hub</a></p>' +
    '<p style="font-size:12px;color:#64748b">Dear Daughter Bible Study Group Nigeria</p></div>';

  return { subject, plainBody, htmlBody };
}

/**
 * @param {import('firebase-admin')} admin
 * @param {{ scriptUrl: string, secret: string }} mail
 * @param {{ force?: boolean, dryRun?: boolean, siteBase?: string }} [opts]
 */
async function runNigeriaPostMeetingDigestJob(admin, mail, opts = {}) {
  const db = admin.firestore();
  const settingsSnap = await db.doc('settings/nigeria_meeting_reminders').get();
  const settings = settingsSnap.data() || {};
  if (settings.postMeetingDigestEnabled !== true && !opts.force) {
    return {
      ok: false,
      aborted: 'disabled',
      message: 'Enable settings/nigeria_meeting_reminders { postMeetingDigestEnabled: true }',
    };
  }

  const hubUrl =
    String(opts.siteBase || settings.siteBase || 'https://prayercityhtx.com').replace(/\/$/, '') +
    '/ddbs-nig.html#units';

  const undeliverable = await loadUndeliverableEmailSet(admin);
  const now = new Date();
  const stats = { sent: 0, skipped: 0, errors: 0, digests: 0 };

  for (const unit of NIGERIA_UNITS) {
    const meeting = meetingInDigestWindow(unit, now);
    if (!meeting) continue;

    const digestDocId = meeting.key;
    const sentRef = db.collection('nigeria_post_meeting_sent').doc(digestDocId);
    const sentSnap = await sentRef.get();
    if (sentSnap.exists && !opts.force) continue;

    const noteSnap = await db.collection('nigeria_unit_meeting_notes').doc(noteDocId(unit.id, meeting.key)).get();
    const notesContent = noteSnap.exists ? String(noteSnap.data().content || '').trim() : '';

    const attSnap = await db.collection('nigeria_attendance').where('meetingKey', '==', meeting.key).get();
    const attendanceByUid = {};
    attSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (d.uid) attendanceByUid[d.uid] = d;
    });

    const absSnap = await db
      .collection('nigeria_absence_requests')
      .where('meetingKey', '==', meeting.key)
      .where('status', '==', 'approved')
      .get();
    const excusedByUid = {};
    absSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (d.uid) excusedByUid[d.uid] = d;
    });

    const volunteers = await loadVolunteersForUnit(db, unit.id);
    const roster = volunteers.map((vol) => {
      const att = attendanceByUid[vol.uid];
      const exc = excusedByUid[vol.uid];
      return {
        uid: vol.uid,
        name: vol.name,
        present: !!att,
        excused: !!exc,
        absenceType: exc ? exc.type : null,
        checkedInAt: att ? att.checkedInAt : null,
      };
    });

    if (!opts.dryRun) {
      await db
        .collection('nigeria_meeting_digests')
        .doc(digestDocId)
        .set({
          unitId: unit.id,
          unitLabel: unit.label,
          meetingKey: meeting.key,
          meetingDateYmd: meeting.dateYmd,
          meetingEndAt: meeting.end,
          notesContent,
          roster,
          emailedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    for (const vol of volunteers) {
      const att = attendanceByUid[vol.uid];
      const exc = excusedByUid[vol.uid];
      let attendanceLine;
      if (att) {
        attendanceLine = 'Present — checked in at ' + formatCheckedInAt(att.checkedInAt) + ' WAT';
      } else if (exc) {
        attendanceLine =
          'Excused absence (' +
          (exc.type === 'emergency' ? 'emergency' : 'planned') +
          ' request approved).';
      } else {
        attendanceLine = 'Absent — you did not check in for this meeting.';
      }

      if (isEmailBlocked(vol.email) || undeliverable.has(vol.email)) {
        stats.skipped++;
        continue;
      }

      const mailContent = buildDigestMail({
        name: vol.name,
        unitLabel: unit.label,
        meeting,
        notesContent,
        attendanceLine,
        hubUrl,
      });

      if (opts.dryRun) {
        stats.sent++;
        continue;
      }

      try {
        const mailRes = await sendMailViaAppsScript({
          scriptUrl: mail.scriptUrl,
          secret: mail.secret,
          email: vol.email,
          subject: mailContent.subject,
          plainBody: mailContent.plainBody,
          htmlBody: mailContent.htmlBody,
        });
        if (mailRes.ok) {
          stats.sent++;
        } else {
          stats.errors++;
          if (isPermanentDeliveryError(mailRes.error)) {
            await markEmailUndeliverable(admin, vol.email, mailRes.error);
          }
        }
      } catch (e) {
        stats.errors++;
        console.error('[nigeriaPostMeetingDigest]', vol.email, e);
      }
    }

    if (!opts.dryRun) {
      await sentRef.set({
        unitId: unit.id,
        meetingKey: meeting.key,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        recipientCount: volunteers.length,
      });
    }
    stats.digests++;
  }

  return { ok: true, ...stats };
}

module.exports = {
  runNigeriaPostMeetingDigestJob,
  meetingInDigestWindow,
};
