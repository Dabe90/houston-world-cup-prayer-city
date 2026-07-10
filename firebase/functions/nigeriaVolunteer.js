'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { isSuperUserEmail, normalizeEmail } = require('./lib/adminAuth');

const TZ = 'Africa/Lagos';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const NIGERIA_UNITS = [
  { id: 'moderators-presenters', label: 'Moderators & Presenters', day: 1, start: '21:30', end: '22:30' },
  { id: 'bible-study', label: 'Bible Study Team', day: 2, start: '20:30', end: '21:30' },
  { id: 'prayer', label: 'Prayer Team', day: 2, start: '23:15', end: '00:30', endNextDay: true },
  { id: 'welcome-hospitality', label: 'Welcome & Hospitality', day: 3, start: '22:00', end: '22:30' },
  { id: 'creative', label: 'Creative Unit', day: 4, start: '20:00', end: '21:00' },
  { id: 'choir', label: 'Choir', day: 0, start: '20:30', end: '21:30' },
];

function getUnit(id) {
  return NIGERIA_UNITS.find((u) => u.id === id);
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

function isWithinCheckInWindow(meeting, now = new Date()) {
  const open = new Date(meeting.start.getTime() - 20 * 60000);
  const close = new Date(meeting.end.getTime() + 45 * 60000);
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
      out.push({ key: meetingKey(unit.id, dateYmd), dateYmd, start, end: endDt });
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

async function assertNigeriaVolunteerAccess(db, uid, authToken) {
  const email = normalizeEmail(authToken?.email);
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
  if (!vSnap.exists) {
    throw new HttpsError(
      'failed-precondition',
      'Complete volunteer sign-up first, then sign in here with the same email.'
    );
  }
  const volunteer = vSnap.data();
  const phone = volunteer.phone || '';
  if (!isNigeriaPhoneRegistered(phone)) {
    throw new HttpsError(
      'permission-denied',
      'This dashboard is for volunteers who registered with a Nigeria (+234) phone number.'
    );
  }
  return {
    volunteer,
    phone: phoneFromRegistration(phone),
    email: volunteer.email || '',
    isSuperUser: false,
  };
}

function attendanceInsight(rate) {
  if (rate >= 85) return { level: 'excellent', message: 'Outstanding consistency — keep shining!' };
  if (rate >= 70) return { level: 'good', message: 'You are doing well — stay steady!' };
  if (rate >= 50) return { level: 'fair', message: 'Room to grow — try to join the next meeting.' };
  return { level: 'low', message: 'We miss you — your unit needs you this week.' };
}

async function computeUserAttendanceStats(db, uid, unitId, year, month) {
  const unit = getUnit(unitId);
  if (!unit) return null;
  const scheduled = meetingsInMonth(unit, year, month);
  const now = new Date();
  const pastScheduled = scheduled.filter((m) => m.end <= now);

  const snap = await db
    .collection('nigeria_attendance')
    .where('uid', '==', uid)
    .where('unitId', '==', unitId)
    .get();

  const attendedKeys = new Set();
  snap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.meetingKey) attendedKeys.add(d.meetingKey);
  });

  const attendedPast = pastScheduled.filter((m) => attendedKeys.has(m.key));
  const missedPast = pastScheduled.filter((m) => !attendedKeys.has(m.key));
  const rate = pastScheduled.length
    ? Math.round((attendedPast.length / pastScheduled.length) * 100)
    : null;

  return {
    year,
    month,
    scheduledCount: scheduled.length,
    pastScheduledCount: pastScheduled.length,
    attendedCount: attendedPast.length,
    missedCount: missedPast.length,
    attendanceRate: rate,
    insight: rate != null ? attendanceInsight(rate) : null,
    attendedDates: attendedPast.map((m) => m.dateYmd),
    missedDates: missedPast.map((m) => m.dateYmd),
    bestStreak: computeStreak(pastScheduled, attendedKeys, true),
    currentStreak: computeStreak(pastScheduled, attendedKeys, false),
  };
}

function computeStreak(pastMeetings, attendedKeys, longest) {
  let streak = 0;
  let best = 0;
  for (const m of pastMeetings) {
    if (attendedKeys.has(m.key)) {
      streak++;
      best = Math.max(best, streak);
    } else {
      if (!longest) return streak;
      streak = 0;
    }
  }
  return longest ? best : streak;
}

async function computeUnitAttendanceForReport(db, unitId, year, month) {
  const unit = getUnit(unitId);
  if (!unit) return null;

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
  const { name, unitId, role } = request.data || {};
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);

  const unit = getUnit(unitId);
  if (!unit) throw new HttpsError('invalid-argument', 'Invalid unit.');
  if (role !== 'leader' && role !== 'member') {
    throw new HttpsError('invalid-argument', 'Role must be leader or member.');
  }
  const displayName = String(name || access.volunteer.name || '').trim();
  if (!displayName) {
    throw new HttpsError('invalid-argument', 'Name required.');
  }

  await db
    .collection('nigeria_volunteers')
    .doc(uid)
    .set(
      {
        uid,
        email: access.email,
        name: displayName,
        phone: access.phone,
        unitId,
        unitLabel: unit.label,
        role,
        region: 'nigeria',
        isSuperUser: access.isSuperUser === true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { ok: true, phone: access.phone, unitId, role };
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
  const unit = getUnit(profile.unitId);
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
        'Check-in opens 20 minutes before meeting and closes 45 minutes after.'
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
    };
  }

  const record = {
    uid,
    unitId: profile.unitId,
    unitLabel: profile.unitLabel,
    name: profile.name,
    phone: profile.phone,
    role: profile.role,
    meetingKey: meeting.key,
    meetingDateYmd: meeting.dateYmd,
    checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('nigeria_attendance').doc(docId).set(record);

  const year = parseInt(ymdInLagos(now).slice(0, 4), 10);
  const month = parseInt(ymdInLagos(now).slice(5, 7), 10);
  const stats = await computeUserAttendanceStats(db, uid, profile.unitId, year, month);
  await profileRef.set({ lastAttendanceAt: record.checkedInAt, attendanceStats: stats }, { merge: true });

  return { ok: true, alreadyCheckedIn: false, meetingKey: meeting.key, stats };
});

const getNigeriaDashboard = onCall(async (request) => {
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
    return {
      hasProfile: false,
      eligible: true,
      isSuperUser: access.isSuperUser === true,
      volunteer: {
        name: access.volunteer.name || '',
        email: access.email,
        phone: access.phone,
      },
    };
  }

  const profile = profileSnap.data();
  const unit = getUnit(profile.unitId);
  if (!unit) throw new HttpsError('failed-precondition', 'Unknown unit.');

  const now = new Date();
  const year = parseInt(ymdInLagos(now).slice(0, 4), 10);
  const month = parseInt(ymdInLagos(now).slice(5, 7), 10);

  const nextMeeting = getNextMeeting(unit, now);
  const stats = await computeUserAttendanceStats(db, uid, profile.unitId, year, month);

  const reportId = profile.unitId + '_' + year + '_' + String(month).padStart(2, '0');
  const reportSnap = await db.collection('nigeria_unit_reports').doc(reportId).get();
  const latestReport = reportSnap.exists ? reportSnap.data() : null;

  let unitRoster = null;
  if (profile.role === 'leader') {
    const rosterSnap = await db
      .collection('nigeria_volunteers')
      .where('unitId', '==', profile.unitId)
      .get();
    unitRoster = rosterSnap.docs.map((d) => {
      const v = d.data();
      return { uid: d.id, name: v.name, role: v.role, phone: v.phone };
    });
  }

  const recentAttSnap = await db
    .collection('nigeria_attendance')
    .where('uid', '==', uid)
    .orderBy('checkedInAt', 'desc')
    .limit(8)
    .get();

  const recentAttendance = recentAttSnap.docs.map((d) => {
    const v = d.data();
    return {
      meetingKey: v.meetingKey,
      meetingDateYmd: v.meetingDateYmd,
      checkedInAt: v.checkedInAt,
    };
  });

  let checkInOpen = false;
  if (nextMeeting) {
    checkInOpen = isWithinCheckInWindow(nextMeeting, now);
    if (!checkInOpen) {
      const prev = getNextMeeting(unit, new Date(nextMeeting.start.getTime() - 86400000));
      if (prev && isWithinCheckInWindow(prev, now)) checkInOpen = true;
    }
  }

  return {
    hasProfile: true,
    eligible: true,
    isSuperUser: access.isSuperUser === true || profile.isSuperUser === true,
    profile,
    unit: { id: unit.id, label: unit.label, day: DAY_NAMES[unit.day], start: unit.start, end: unit.end },
    nextMeeting: nextMeeting
      ? {
          key: nextMeeting.key,
          dateYmd: nextMeeting.dateYmd,
          startIso: nextMeeting.start.toISOString(),
          endIso: nextMeeting.end.toISOString(),
        }
      : null,
    checkInOpen,
    attendanceStats: stats,
    latestReport,
    recentAttendance,
    unitRoster,
  };
});

const submitNigeriaUnitReport = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  const access = await assertNigeriaVolunteerAccess(db, uid, request.auth);
  const profileSnap = await db.collection('nigeria_volunteers').doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError('failed-precondition', 'Profile required.');
  const profile = profileSnap.data();
  if (profile.role !== 'leader' && !access.isSuperUser) {
    throw new HttpsError('permission-denied', 'Only unit leaders can submit reports.');
  }

  const data = request.data || {};
  const year = parseInt(data.reportYear, 10);
  const month = parseInt(data.reportMonth, 10);
  if (!year || !month) throw new HttpsError('invalid-argument', 'Report year and month required.');

  const attendanceAnalytics = await computeUnitAttendanceForReport(db, profile.unitId, year, month);

  const reportId = profile.unitId + '_' + year + '_' + String(month).padStart(2, '0');
  const report = {
    unitId: profile.unitId,
    unitLabel: profile.unitLabel,
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
    meetingsHeld: attendanceAnalytics.meetingsHeld,
    attendanceSummary: attendanceAnalytics,
    attendanceNarrative: buildAttendanceNarrative(attendanceAnalytics),
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('nigeria_unit_reports').doc(reportId).set(report, { merge: true });
  return { ok: true, reportId, attendanceAnalytics };
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

  const year = parseInt(request.data?.reportYear, 10);
  const month = parseInt(request.data?.reportMonth, 10);
  if (!year || !month) throw new HttpsError('invalid-argument', 'Year and month required.');

  if (profile.role === 'leader' || access.isSuperUser) {
    const unitStats = await computeUnitAttendanceForReport(db, profile.unitId, year, month);
    return { role: 'leader', unitStats, personalStats: null };
  }

  const personalStats = await computeUserAttendanceStats(db, uid, profile.unitId, year, month);
  return { role: 'member', unitStats: null, personalStats };
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

module.exports = {
  saveNigeriaProfile,
  recordNigeriaAttendance,
  getNigeriaDashboard,
  submitNigeriaUnitReport,
  getNigeriaAttendanceForReport,
  getPrayerCityAccess,
  computeUnitAttendanceForReport,
  computeUserAttendanceStats,
};
