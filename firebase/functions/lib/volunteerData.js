'use strict';

const volunteerDailyDigest = require('../volunteerDailyDigest');
const { buildScheduleGrid, DATE_ORDER } = require('../volunteerScheduleReport');
const { loadUndeliverableEmailSet } = require('../emailUndeliverable');
const { isEmailBlocked } = require('../emailBlocklist');
const { normalizeEmail } = require('./adminAuth');

/**
 * @param {import('firebase-admin')} admin
 */
async function loadMergedVolunteers(admin) {
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
      timeslot: String(onboard.timeslot || '').trim(),
      dailyDigestOptOut: onboard.dailyDigestOptOut === true,
      emailUndeliverable: onboard.emailUndeliverable === true,
      intelligenceNotes: String(onboard.intelligenceNotes || '').trim(),
      coordinatorFlags: onboard.coordinatorFlags || {},
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
      if (String(v.timeslot || '').trim()) merged.timeslot = v.timeslot;
      if (v.dailyDigestOptOut === true) merged.dailyDigestOptOut = true;
    }

    volunteers.push(merged);
  }

  return volunteers;
}

function serveDateLabelFromYmd(ymd) {
  for (const label of DATE_ORDER) {
    const d = new Date(label);
    if (isNaN(d.getTime())) continue;
    const chicagoYmd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    if (chicagoYmd === ymd) return label;
  }
  return '';
}

/**
 * Build the operational snapshot the intelligence agent reasons over.
 * @param {import('firebase-admin')} admin
 * @param {{ ymd?: string, siteBase?: string }} [opts]
 */
async function buildDailyDigestSnapshot(admin, opts = {}) {
  const ymd = opts.ymd || volunteerDailyDigest.todayYmdChicago();
  const siteBase = String(opts.siteBase || volunteerDailyDigest.SITE_DEFAULT).replace(/\/?$/, '');
  const volunteers = await loadMergedVolunteers(admin);
  const undeliverableSet = await loadUndeliverableEmailSet(admin);
  const grid = buildScheduleGrid(volunteers);

  const digestRows = [];
  for (const vol of volunteers) {
    const blocked =
      isEmailBlocked(vol.email) ||
      vol.dailyDigestOptOut ||
      vol.emailUndeliverable ||
      undeliverableSet.has(vol.email);

    let digest = null;
    if (!blocked) {
      digest = await volunteerDailyDigest.buildDailyVolunteerDigest({
        ...vol,
        siteBase,
        previewDate: ymd,
      });
    }

    digestRows.push({
      email: vol.email,
      name: vol.name,
      phone: vol.phone,
      tent: vol.tent || '—',
      shifts: vol.shifts,
      position: vol.position,
      blocked,
      hasDigestToday: !!digest,
      digestSubject: digest?.subject || '',
      roleIds: digest?.roleIds || [],
      plainExcerpt: digest ? digest.plainBody.slice(0, 600) : '',
      intelligenceNotes: vol.intelligenceNotes,
      coordinatorFlags: vol.coordinatorFlags,
    });
  }

  const serveDateLabel = serveDateLabelFromYmd(ymd);
  const scheduledToday = serveDateLabel
    ? (grid.byDate.get(serveDateLabel) || new Map())
    : new Map();

  const scheduledTodaySummary = [];
  for (const [timeSlot, people] of scheduledToday.entries()) {
    scheduledTodaySummary.push({
      time: timeSlot,
      count: people.length,
      volunteers: people.map((p) => ({
        name: p.name,
        role: p.role,
        tent: p.tent,
      })),
    });
  }

  return {
    ymd,
    serveDateLabel,
    siteBase,
    generatedAt: new Date().toISOString(),
    totals: {
      volunteers: volunteers.length,
      digestEligible: digestRows.filter((r) => r.hasDigestToday).length,
      blocked: digestRows.filter((r) => r.blocked).length,
      unscheduled: grid.unscheduled.length,
      scheduledTodaySlots: scheduledTodaySummary.length,
    },
    unscheduled: grid.unscheduled.map((v) => ({
      email: v.email,
      name: v.name,
      phone: v.phone,
    })),
    scheduledToday: scheduledTodaySummary,
    digestRows,
  };
}

module.exports = {
  loadMergedVolunteers,
  buildDailyDigestSnapshot,
  serveDateLabelFromYmd,
};
