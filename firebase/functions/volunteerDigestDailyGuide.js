'use strict';

const {
  PARKING_NOTE,
  TENT_MAP_URL,
  TENT_LOCATION_ADDRESS,
  COORDINATOR_NAME,
  COORDINATOR_PHONE,
} = require('./serveDayFlowContent');

const VIRTUAL_INFO_SESSION_LABEL = 'Thursday, June 11, 2026';
const VIRTUAL_INFO_SESSION_TIME = '6:00 PM';
const VIRTUAL_INFO_SESSION_TIMEZONE = 'Central Time (Houston)';
/** Last calendar day (Chicago) to include virtual session in daily emails — hide from Friday onward. */
const VIRTUAL_INFO_SESSION_DATE = '2026-06-11';
const PRAYERCITY_ZOOM_URL =
  'https://us06web.zoom.us/j/88179064654?pwd=fGNWdDayQeRuixN5pH3AfwxdiL45Xk.1';
const PRAYERCITY_DONATION_URL =
  'https://www.zeffy.com/en-US/donation-form/houston-world-cup-prayer-city-movement';
const PRAYERCITY_TSHIRT_IMAGE_URL = 'https://prayercityhtx.com/images/prayer-city-tshirt.png';
const FAQ_URL = 'https://prayercityhtx.com/faq.html';
const HUB_URL = 'https://prayercityhtx.com/volunteer-hub.html';
const TRAINING_BASE = 'https://prayercityhtx.com/training/';

const DAILY_SUBJECT_LEADS = [
  'Your Prayer City serve-day guide',
  'Houston Prayer City — what you need before your shift',
  'Counting down with you — Prayer City details inside',
  'NRG prayer tents · parking · Zoom — your daily briefing',
  'World Cup Houston — your volunteer essentials today',
  'Prayer City heartbeat — serve-day info for you',
  'Before your shift: parking, tent, training & more',
  'We’re glad you’re on the team — today’s Prayer City guide',
  'Your daily Prayer City volunteer briefing',
  'Serve day is coming — here’s your refresher',
  'Prayer tents · Gospel welcome · your guide today',
  'Houston welcomes the world — your Prayer City checklist',
  'Stay ready: virtual session, parking & dashboard',
  'One city, one mission — your Prayer City update',
];

const DAILY_OPENERS = [
  'We are so honored you said yes to Houston Prayer City. Nations are coming to our city — and your role matters.',
  'Thank you for standing with us in prayer and welcome. Every day we’re getting closer to an extraordinary season in Houston.',
  'Your yes to serve still moves us. Houston Prayer City is about Jesus at the center — in tents, in prayer, in gentle gospel conversations.',
  'Good morning, volunteer family. We’re counting down to World Cup Houston with joy — and we’re glad you’re in the story.',
  'We’re grateful for you. Prayer City is not just an event — it’s welcoming guests near NRG with warmth, prayer, and the hope of Christ.',
  'Another day closer to serving together. Thank you for preparing your heart and your practical details with us.',
  'You are part of something historic for Houston. Well over half a million guests — and we want many to encounter Jesus.',
  'We love serving alongside you. Here’s a fresh look at what you need before your shift — same truth, packaged for today.',
  'The harvest is here and the workers are gathering. Thank you for being one of them.',
  'Houston is becoming a prayer city in a visible way. We’re glad you’re helping welcome the world.',
  'Your partnership means everything. Take five minutes with today’s guide — then carry hope into your day.',
  'From prayer tents to morning worship at the tent — you’re not alone. The team is with you.',
  'We’re cheering you on. Use this note as your daily refresher until serve day.',
  'Grace and peace today. Here’s your Prayer City essentials — tuned for {displayDate}.',
];

const DAILY_VISION_LINES = [
  'Prayer tents in the NRG Stadium area will welcome guests with prayer partners and counselors who point people to Jesus.',
  'We’re raising prayer volunteers and gospel welcome teams as Houston hosts the World Cup — less than 5 minutes from NRG Stadium.',
  'Nations are traveling to us. We want visitors to meet Christ and carry the gospel home to their countries.',
  'This is a unique moment: guests from around the world on our doorstep — and the Church ready to pray and proclaim.',
  'Prayer City is warm welcome, listening prayer, and Christ-centered conversations — not performance, but presence.',
  'We expect huge crowds near NRG. Your calm, loving presence in the tent can open a door to eternity for someone.',
  'Morning worship and prayer happen at the tent each day — a beautiful way to start before your shift.',
  'Every volunteer tag, every prayer, every welcome is part of welcoming Houston as a city that exalts Jesus.',
  'We’re building anticipation with faith — prayer in the tent, service in your role, hope on social media.',
  'The same heart that fuels Jesus March Houston flows here: prayer, unity, and winning souls to Christ with love.',
];

const DAILY_BEFORE_SERVE_FRAMES = [
  'Before your shift — quick checklist:',
  'Serve-day prep (review anytime):',
  'Practical steps before you arrive:',
  'Your pre-serve-day rhythm:',
  'Get ready with us:',
  'Don’t miss these before serve day:',
  'Today’s readiness reminders:',
];

const DAILY_CLOSINGS = [
  'We love you and we’re honored to serve Houston together.',
  'Thank you for walking this road with us — see you at the tent.',
  'We’re praying for you today. See you soon near NRG.',
  'Grateful for you. Let’s make Houston a city that encounters Jesus.',
  'With love from the Prayer City family.',
  'Carry peace today — God goes before us into the crowds.',
  'Bless you. We can’t wait to worship and serve alongside you.',
];

const DAILY_TSHIRT_CTAS = [
  'Open your dashboard and save your size (S–X) so we can print your Houston Prayer City shirt.',
  'Tap your dashboard to pick S, M, L, or X — shirts are handed out at check-in with Tricia Hill.',
  'Please confirm your T-shirt size on the dashboard when you can (S through X).',
  'Your volunteer shirt is waiting — save your size on the dashboard today if you haven’t yet.',
  'We’re printing team shirts — dashboard → T-shirt section → choose your size.',
];

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(arr, rng) {
  if (!arr.length) return '';
  return arr[Math.floor(rng() * arr.length)];
}

function daysUntilYmd(fromYmd, toYmd) {
  const p1 = String(fromYmd || '').split('-');
  const p2 = String(toYmd || '').split('-');
  if (p1.length !== 3 || p2.length !== 3) return null;
  const a = Date.UTC(+p1[0], +p1[1] - 1, +p1[2]);
  const b = Date.UTC(+p2[0], +p2[1] - 1, +p2[2]);
  return Math.round((b - a) / 86400000);
}

/** True on Thu Jun 11 and earlier; false from Fri Jun 12 onward. */
function shouldShowVirtualSession(dateStr) {
  const d = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d <= VIRTUAL_INFO_SESSION_DATE;
}

function trainingUrlForRole(roleId) {
  const map = {
    'prayer-partners': 'prayer-partners.html',
    counselors: 'counselors.html',
    'logistics-welfare': 'logistics-welfare.html',
    'photography-video': 'photography-video.html',
    'social-media': 'social-media.html',
  };
  return TRAINING_BASE + (map[roleId] || 'index.html');
}

/**
 * Rotating subject — same info, fresh headline each day.
 */
function buildRotatingDigestSubject(dateStr, daysToSunday) {
  const rng = mulberry32(hashStr(`subj-${dateStr}`));
  let subjectPool = DAILY_SUBJECT_LEADS;
  if (!shouldShowVirtualSession(dateStr)) {
    subjectPool = DAILY_SUBJECT_LEADS.filter(
      (s) => !/zoom|virtual session/i.test(s)
    );
    if (!subjectPool.length) subjectPool = DAILY_SUBJECT_LEADS;
  }
  const lead = pickOne(subjectPool, rng);
  if (typeof daysToSunday === 'number' && daysToSunday >= 0) {
    const n = Math.max(0, daysToSunday);
    const word = n === 1 ? 'day' : 'days';
    return `${n} ${word} to Sunday · ${lead}`;
  }
  return lead;
}

/**
 * Welcome-style daily guide — core facts stable, wording rotates by date.
 * @param {string} dateStr YYYY-MM-DD Chicago
 * @param {{ dearName?: string, dashboardUrl?: string, roleLabels?: string, roleIds?: string[], displayDate?: string, tent?: string }} opts
 */
function buildDailyServeGuideBlock(dateStr, opts) {
  opts = opts || {};
  const rng = mulberry32(hashStr(`guide-${dateStr}`));
  const dearName = opts.dearName || 'Dear volunteer,';
  const dashboardUrl = opts.dashboardUrl || 'https://prayercityhtx.com/';
  const roleLabels = opts.roleLabels || 'Volunteer';
  const roleIds = opts.roleIds || [];
  const displayDate = opts.displayDate || dateStr;
  const tent = String(opts.tent || '').trim();
  const showVirtual = shouldShowVirtualSession(dateStr);

  let opener = pickOne(DAILY_OPENERS, rng);
  opener = opener.replace('{displayDate}', displayDate);
  const vision = pickOne(DAILY_VISION_LINES, rng);
  const beforeFrame = pickOne(DAILY_BEFORE_SERVE_FRAMES, rng);
  const closing = pickOne(DAILY_CLOSINGS, rng);
  const tshirtCta = pickOne(DAILY_TSHIRT_CTAS, rng);

  const primaryRole = roleIds[0] || 'prayer-partners';
  const trainingUrl = trainingUrlForRole(primaryRole);

  const checklistPlain = [
    showVirtual
      ? `Join the virtual info session — ${VIRTUAL_INFO_SESSION_LABEL} at ${VIRTUAL_INFO_SESSION_TIME} ${VIRTUAL_INFO_SESSION_TIMEZONE}. Zoom: ${PRAYERCITY_ZOOM_URL}`
      : null,
    `Save your T-shirt size on your dashboard (S–X).`,
    `Read your role training: ${trainingUrl} (${roleLabels}).`,
    `Park near the prayer tents — ${TENT_LOCATION_ADDRESS}. ${PARKING_NOTE}`,
    `Call ${COORDINATOR_NAME} at ${COORDINATOR_PHONE} if you need help finding the tent.`,
    `Arrive ~15–30 minutes before your shift for check-in and briefing with ${COORDINATOR_NAME}.`,
    tent
      ? `All tents at ${TENT_LOCATION_ADDRESS}. Your assigned tent: ${tent} — confirm at check-in.`
      : `All tents at ${TENT_LOCATION_ADDRESS}. Your tent number is on your dashboard — confirm with ${COORDINATOR_NAME} at check-in.`,
    `Day-of emergency: ${COORDINATOR_NAME} ${COORDINATOR_PHONE}`,
  ].filter(Boolean);

  const plain =
    `${dearName}\n\n` +
    `${opener}\n\n` +
    `WHAT IS PRAYER CITY?\n${vision}\n\n` +
    `YOUR DASHBOARD\n${dashboardUrl}\n` +
    `Training, serve-day parking & tent photos, T-shirt size, daily toolkit, and your shifts.\n\n` +
    `${beforeFrame}\n` +
    checklistPlain.map((line, i) => `${i + 1}. ${line}`).join('\n') +
    `\n\nFAQ: ${FAQ_URL}\nVolunteer hub: ${HUB_URL}\n\n` +
    `${closing}`;

  const checklistHtml = checklistPlain
    .map(
      (line) =>
        `<li style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6;">${escapeHtml(line)}</li>`
    )
    .join('');

  const virtualHtml = showVirtual
    ? `<div style="margin:0 0 16px;padding:14px 16px;border-radius:12px;background:#eff6ff;border:1px solid #93c5fd;">` +
      `<p style="margin:0 0 6px;font-size:11px;font-weight:900;letter-spacing:0.1em;color:#1d4ed8;text-transform:uppercase;">Virtual session · please attend</p>` +
      `<p style="margin:0;font-size:14px;color:#334155;line-height:1.55;"><strong>${escapeHtml(VIRTUAL_INFO_SESSION_LABEL)}</strong> · ${escapeHtml(VIRTUAL_INFO_SESSION_TIME)} ${escapeHtml(VIRTUAL_INFO_SESSION_TIMEZONE)}</p>` +
      `<p style="margin:10px 0 0;"><a href="${escapeHtml(PRAYERCITY_ZOOM_URL)}" style="display:inline-block;padding:10px 16px;border-radius:9999px;background:#2563eb;color:#fff;font-weight:800;font-size:13px;text-decoration:none;">Join Zoom →</a></p>` +
      `</div>`
    : '';

  const html =
    `<div style="margin:0 0 24px;border-radius:16px;border:1px solid #cbd5e1;background:#ffffff;overflow:hidden;box-shadow:0 10px 36px rgba(15,61,92,0.1);">` +
    `<div style="padding:20px 22px 22px;">` +
    `<p style="margin:0;font-size:18px;color:#0f172a;font-weight:800;">${escapeHtml(dearName)}</p>` +
    `<p style="margin:14px 0 0;font-size:15px;color:#334155;line-height:1.65;">${escapeHtml(opener)}</p>` +
    `<p style="margin:16px 0 0;font-size:15px;color:#334155;line-height:1.65;"><strong style="color:#0f3d5c;">What is Prayer City?</strong> ${escapeHtml(vision)}</p>` +
    `<div style="margin:20px 0;padding:16px 18px;border-radius:12px;background:#e8f4fc;border:1px solid #bae6fd;">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.1em;color:#0f3d5c;text-transform:uppercase;">Your volunteer dashboard</p>` +
    `<p style="margin:0 0 12px;font-size:14px;color:#334155;">Training, serve-day flow, T-shirt size, toolkit — role: <strong>${escapeHtml(roleLabels)}</strong></p>` +
    `<a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 20px;border-radius:9999px;background:#0f3d5c;color:#fff;font-weight:800;font-size:14px;text-decoration:none;">Open dashboard →</a>` +
    `</div>` +
    virtualHtml +
    `<p style="margin:16px 0 10px;font-size:12px;font-weight:900;letter-spacing:0.1em;color:#0d9488;text-transform:uppercase;">${escapeHtml(beforeFrame)}</p>` +
    `<ol style="margin:0;padding-left:1.2rem;">${checklistHtml}</ol>` +
    `<p style="margin:16px 0 0;font-size:13px;color:#334155;"><a href="${escapeHtml(FAQ_URL)}" style="color:#0f3d5c;font-weight:700;">FAQ</a> · <a href="${escapeHtml(HUB_URL)}" style="color:#0f3d5c;font-weight:700;">Volunteer hub</a> · <a href="${escapeHtml(TENT_MAP_URL)}" style="color:#0f3d5c;font-weight:700;">Tent &amp; parking map</a></p>` +
    `<p style="margin:18px 0 0;font-size:15px;color:#334155;line-height:1.65;">${escapeHtml(closing)}</p>` +
    `</div></div>`;

  return { plain, html, tshirtCta, closing };
}

function buildRotatingTshirtBlock(dateStr, dashboardUrl, tshirtCta) {
  const cta =
    tshirtCta ||
    pickOne(DAILY_TSHIRT_CTAS, mulberry32(hashStr(`tshirt-${dateStr}`)));

  const plain =
    `PRAYER CITY T-SHIRTS\n${cta}\n\nSizes available: S, M, L, X.\n\nOptional donation toward shirt costs: ${PRAYERCITY_DONATION_URL}`;

  const html =
    `<div style="margin:0 0 24px;border-radius:16px;border:1px solid #e2e8f0;background:#ffffff;overflow:hidden;box-shadow:0 4px 18px rgba(15,61,92,0.08);">` +
    `<div style="padding:18px 20px 20px;">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.14em;color:#0d9488;text-transform:uppercase;">Volunteer T-shirts</p>` +
    `<img src="${escapeHtml(PRAYERCITY_TSHIRT_IMAGE_URL)}" alt="Houston Prayer City volunteer T-shirt" width="600" style="width:100%;max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;display:block;margin:0 0 14px;" />` +
    `<p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.65;">${escapeHtml(cta)}</p>` +
    `<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.65;">Sizes available: <strong>S, M, L, X</strong>.</p>` +
    `<a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;margin-right:10px;padding:12px 18px;border-radius:9999px;background:#0f3d5c;color:#ffffff;font-weight:900;font-size:13px;text-decoration:none;">Save size on dashboard →</a>` +
    `<a href="${escapeHtml(PRAYERCITY_DONATION_URL)}" style="display:inline-block;padding:12px 18px;border-radius:9999px;border:2px solid #0d9488;color:#0f766e;font-weight:800;font-size:13px;text-decoration:none;">Optional gift via Zeffy</a>` +
    `</div></div>`;

  return { plain, html };
}

module.exports = {
  buildRotatingDigestSubject,
  buildDailyServeGuideBlock,
  buildRotatingTshirtBlock,
  shouldShowVirtualSession,
  VIRTUAL_INFO_SESSION_DATE,
};
