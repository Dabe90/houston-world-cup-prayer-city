/**
 * Houston Prayer City — outreach to past contacts (not yet signed up).
 *
 * PastLeads columns:
 *   A Email | B First Name | C Last Name | D Greeting | E OutreachSent | F LastOutreach | G FailStreak
 *
 * 1. Import outreach/past-contacts-to-email.csv into tab "PastLeads".
 * 2. Menu: Send past-contact outreach (first invite).
 * 3. Menu: Turn ON daily first outreach (auto, ~7am) — sends to blank rows until done; emails you when complete.
 * 4. Menu: Turn ON daily follow-up (reminds non-signups once per day until they register).
 */

var OUTREACH_CONFIG = {
  SPREADSHEET_ID: '1x0OQfAs5z3Ryy7VBdV_fmmRr-yWCT5bEpCNSfEsonXk',
  PAST_LEADS_TAB: 'PastLeads',
  VOLUNTEER_TAB: '',
  VOLUNTEER_EMAIL_COLUMN: 3,
  COL_EMAIL: 1,
  COL_FIRST_NAME: 2,
  COL_LAST_NAME: 3,
  COL_GREETING: 4,
  COL_OUTREACH_SENT: 5,
  COL_LAST_OUTREACH: 6,
  /** Consecutive send failures (cleared on success). At MAX_CONSECUTIVE_SEND_FAILURES → Skip — undeliverable. */
  COL_FAIL_STREAK: 7,
  MAX_CONSECUTIVE_SEND_FAILURES: 3,
  VIDEO_URL: 'https://youtu.be/3Sn8ysMi1Lk',
  SIGNUP_URL: 'https://prayercityhtx.com/volunteer/',
  MAX_SEND_PER_RUN: 80,
  MAX_FOLLOWUP_PER_DAY: 80,
  /** Pause between sends to reduce Gmail rate-limit errors (ms). */
  SEND_DELAY_MS: 200,
  /** Daily first-outreach trigger hour (0–23). Runs before follow-up. */
  FIRST_BATCH_TRIGGER_HOUR: 7,
  /** Email when first-outreach queue is empty (blank = script owner). */
  NOTIFY_EMAIL: '',
  /** Daily follow-up trigger hour (0–23) in script project timezone — set project TZ to America/Chicago. */
  FOLLOWUP_TRIGGER_HOUR: 9,
  /** Virtual volunteer info session (replaces in-person training in emails). */
  VIRTUAL_SESSION_DATE_LABEL: 'Thursday, June 11, 2026',
  /** Last day (Chicago) to include Zoom / virtual session in outreach emails. */
  VIRTUAL_SESSION_LAST_YMD: '2026-06-11',
  VIRTUAL_SESSION_TIME: '6:00 PM',
  VIRTUAL_SESSION_TIMEZONE: 'Central Time (Houston)',
  ZOOM_URL:
    'https://us06web.zoom.us/j/88179064654?pwd=fGNWdDayQeRuixN5pH3AfwxdiL45Xk.1',
  DONATION_URL:
    'https://www.zeffy.com/en-US/donation-form/houston-world-cup-prayer-city-movement',
  /** Host on prayercityhtx.com (deploy images/prayer-city-tshirt.png). */
  TSHIRT_IMAGE_URL: 'https://prayercityhtx.com/images/prayer-city-tshirt.png',
  /** First serve Sunday (countdown target). */
  FIRST_SERVE_SUNDAY_DATE: '2026-06-14',
  EMAIL_SUBJECT: 'Thu Jun 11 virtual session (6pm). All You Need to Know about Sunday.',
  EMAIL_SUBJECT_AFTER_VIRTUAL: 'Prayer City serve day — sign up & what you need',
  /** Never send outreach / follow-up to these addresses (lowercase). */
  EMAIL_BLOCKLIST: ['marykaarto@gmail.com', 'emcocke@gmail.com'],
};

/** Virtual session block only through Thu Jun 11; omitted from Fri Jun 12 onward. */
function shouldShowVirtualSessionInEmail_() {
  var today = Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
  return today <= OUTREACH_CONFIG.VIRTUAL_SESSION_LAST_YMD;
}

var PAST_OUTREACH_FIRST_BATCH_DAILY_FN = 'sendPastContactsOutreachDaily';
var PAST_OUTREACH_DAILY_FN = 'sendPastContactsFollowUpDaily';
var PAST_OUTREACH_FIRST_BATCH_DONE_PROP = 'PAST_OUTREACH_FIRST_BATCH_DONE_NOTIFIED';
/** When set, daily + manual past-contact outreach skips sending (campaign ended). */
var PAST_OUTREACH_PAUSED_PROP = 'PAST_OUTREACH_CAMPAIGN_PAUSED';

function isPastOutreachPaused_() {
  return PropertiesService.getScriptProperties().getProperty(PAST_OUTREACH_PAUSED_PROP) === '1';
}

function setPastOutreachPaused_(paused) {
  var props = PropertiesService.getScriptProperties();
  if (paused) {
    props.setProperty(PAST_OUTREACH_PAUSED_PROP, '1');
  } else {
    props.deleteProperty(PAST_OUTREACH_PAUSED_PROP);
  }
}

/** Menu: stop all past-contact email (removes daily triggers + sets pause flag). */
function pausePastOutreachCampaignEnded() {
  setPastOutreachPaused_(true);
  removePastOutreachFirstBatchDailyTrigger_();
  removePastOutreachDailyTrigger_();
  alertOrLog_(
    'Past-contact outreach is PAUSED (campaign ended).\n\n' +
      'Daily triggers are OFF and send functions will no-op until you choose Resume.'
  );
}

/** Menu: allow past-contact outreach again (does not re-enable daily triggers). */
function resumePastOutreachCampaign() {
  setPastOutreachPaused_(false);
  alertOrLog_(
    'Past-contact outreach pause is OFF.\n\n' +
      'Daily triggers are still OFF until you turn them back on from the menu.'
  );
}

function authorizePastOutreachSender() {
  GmailApp.getInboxThreads(0, 1);
  Logger.log('Gmail authorization OK for past-contact outreach.');
}

function todayYmdChicago_() {
  return Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
}

function alertOrLog_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

/**
 * Seed the shared do-not-send registry from PastLeads rows that already bounced
 * or are undeliverable. Deliberately excludes "registered" / "do not email"
 * rows so this never blocks a registered volunteer's other mail. Returns count.
 */
function seedUndeliverableRegistryFromPastLeads_() {
  if (typeof addUndeliverableEmails_ !== 'function') return 0;
  var sh = getPastLeadsSheet_();
  var data = sh.getDataRange().getValues();
  var emails = [];
  for (var r = 1; r < data.length; r++) {
    var status = String(data[r][OUTREACH_CONFIG.COL_OUTREACH_SENT - 1] || '').trim();
    var email = normalizeEmail_(data[r][OUTREACH_CONFIG.COL_EMAIL - 1]);
    if (!email || email.indexOf('@') < 1) continue;
    // Only truly undeliverable/bad/failed addresses — NOT "registered"/"do not email".
    if (!/undeliver|bad address/i.test(status) && !/^failed/i.test(status)) continue;
    if (/retry/i.test(status)) continue;
    emails.push(email);
  }
  var added = addUndeliverableEmails_(emails);
  if (emails.length && typeof syncUndeliverableToFirestore_ === 'function') {
    syncUndeliverableToFirestore_(emails, 'seed from past leads', 'registry_seed');
  }
  return added;
}

function getPastLeadsSheet_() {
  var ss = SpreadsheetApp.openById(OUTREACH_CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(OUTREACH_CONFIG.PAST_LEADS_TAB);
  if (!sh) {
    throw new Error(
      'Tab "' +
        OUTREACH_CONFIG.PAST_LEADS_TAB +
        '" not found. Import outreach/past-contacts-to-email.csv into PastLeads.'
    );
  }
  ensurePastLeadsHeaders_(sh);
  return sh;
}

function ensurePastLeadsHeaders_(sh) {
  var headers = sh.getRange(1, 1, 1, OUTREACH_CONFIG.COL_LAST_OUTREACH).getValues()[0];
  var expected = ['Email', 'First Name', 'Last Name', 'Greeting', 'OutreachSent', 'LastOutreach'];
  for (var i = 0; i < expected.length; i++) {
    if (String(headers[i] || '').trim() !== expected[i]) {
      sh.getRange(1, i + 1).setValue(expected[i]);
    }
  }
}

function getVolunteerSignupSheet_() {
  var ss = SpreadsheetApp.openById(OUTREACH_CONFIG.SPREADSHEET_ID);
  if (OUTREACH_CONFIG.VOLUNTEER_TAB) {
    return ss.getSheetByName(OUTREACH_CONFIG.VOLUNTEER_TAB);
  }
  return ss.getSheets()[0];
}

function normalizeEmail_(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function isEmailBlocked_(email) {
  var e = normalizeEmail_(email);
  if (!e) return false;
  var list = OUTREACH_CONFIG.EMAIL_BLOCKLIST || [];
  for (var i = 0; i < list.length; i++) {
    if (normalizeEmail_(list[i]) === e) return true;
  }
  return false;
}

function markSkipDoNotEmail_(sh, rowIndex) {
  sh.getRange(rowIndex, OUTREACH_CONFIG.COL_OUTREACH_SENT).setValue('Skip — do not email');
}

function loadRegisteredEmails_() {
  var sh = getVolunteerSignupSheet_();
  var data = sh.getDataRange().getValues();
  var col = OUTREACH_CONFIG.VOLUNTEER_EMAIL_COLUMN - 1;
  var set = {};
  for (var r = 1; r < data.length; r++) {
    var e = normalizeEmail_(data[r][col]);
    if (e && e.indexOf('@') > 0) set[e] = true;
  }
  return set;
}

function firstNameFromRow_(row) {
  var fn = String(row[OUTREACH_CONFIG.COL_FIRST_NAME - 1] || '').trim();
  if (fn) return fn.split(/\s+/)[0];
  return '';
}

function greetingForRow_(row) {
  var g = String(row[OUTREACH_CONFIG.COL_GREETING - 1] || '').trim();
  if (g) return g;
  var fn = firstNameFromRow_(row);
  return fn ? 'Dear ' + fn + ',' : 'Dear Beloved,';
}

function outreachStatus_(row) {
  return String(row[OUTREACH_CONFIG.COL_OUTREACH_SENT - 1] || '').trim();
}

function lastOutreachYmd_(row) {
  var v = row[OUTREACH_CONFIG.COL_LAST_OUTREACH - 1];
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'America/Chicago', 'yyyy-MM-dd');
  }
  return String(v || '').trim().slice(0, 10);
}

function followUpCountFromStatus_(status) {
  if (isForeverSkipStatus_(status)) return -1;
  var m = /^Follow-up\s+(\d+)$/i.exec(status);
  if (m) return parseInt(m[1], 10);
  if (/^sent$/i.test(status)) return 0;
  return -1;
}

/** Never email again: registered, bad format, undeliverable, etc. */
function isForeverSkipStatus_(status) {
  if (!status) return false;
  return /^skip(\s|$)/i.test(status);
}

function isInitialAlreadySent_(status) {
  if (!status) return false;
  if (isForeverSkipStatus_(status)) return true;
  if (/^failed\s*[—\-]\s*retry/i.test(status)) return false;
  if (/^failed/i.test(status)) return true;
  return /^sent$/i.test(status) || /^follow-up\s+\d+$/i.test(status);
}

/**
 * Pre-send validation (catches empty, typos like .con, malformed addresses).
 * @returns {{ ok: boolean, email?: string, reason?: string }}
 */
function validateEmailForOutreach_(email) {
  var e = normalizeEmail_(email);
  if (!e) return { ok: false, reason: 'empty' };
  if (/\s|,|;|>|</.test(e)) return { ok: false, reason: 'format' };
  if (e.indexOf('@') < 1 || e.split('@').length !== 2) return { ok: false, reason: 'format' };
  if (e.indexOf('..') >= 0) return { ok: false, reason: 'format' };
  var dom = e.split('@')[1];
  if (!/^[a-z0-9.-]+\.[a-z]{2,24}$/i.test(dom)) return { ok: false, reason: 'format' };
  if (/\.(con|cmo|ocm|comm|coom|nett)$/i.test(dom)) return { ok: false, reason: 'typo_tld' };
  return { ok: true, email: e };
}

/**
 * Gmail send errors from Apps Script are usually quota/rate limits — NOT "bad address".
 * Invalid recipients often send successfully here; bounces arrive later in Gmail.
 * Default to temporary so we do not blacklist valid emails by mistake.
 * @returns {'permanent'|'temporary'}
 */
function classifySendError_(err) {
  var msg = String((err && err.message) || err || '').toLowerCase();
  if (
    /quota|rate limit|too many|user-rate|service invoked too many|limit exceeded|daily sending|temporarily unavailable|try again later|timeout|timed out|internal error|backend error|urlfetch|blocked|suspended|minute|per day|mail service|gmail service|email send|limit:|exceeded/.test(
      msg
    )
  ) {
    return 'temporary';
  }
  // Only mark permanent when the error clearly names the recipient (rare in Apps Script).
  if (
    /invalid\s+(email|address|recipient)|bad\s+recipient|no\s+such\s+(user|mailbox|recipient)|user\s+unknown|mailbox\s+not\s+found|recipient.*rejected|5\.1\.1|550\s*5\.1\.1|address\s+not\s+found/.test(
      msg
    )
  ) {
    return 'permanent';
  }
  return 'temporary';
}

function markSkipBadAddress_(sh, rowIndex, reason) {
  sh.getRange(rowIndex, OUTREACH_CONFIG.COL_OUTREACH_SENT).setValue(
    'Skip — bad address' + (reason ? ' (' + reason + ')' : '')
  );
}

function markSkipUndeliverable_(sh, rowIndex, detail) {
  var note = detail ? String(detail).replace(/\s+/g, ' ').slice(0, 48) : '';
  sh.getRange(rowIndex, OUTREACH_CONFIG.COL_OUTREACH_SENT).setValue(
    'Skip — undeliverable' + (note ? ' (' + note + ')' : '')
  );
  try {
    var email = normalizeEmail_(sh.getRange(rowIndex, OUTREACH_CONFIG.COL_EMAIL).getValue());
    if (email && typeof syncUndeliverableToFirestore_ === 'function') {
      syncUndeliverableToFirestore_([email], note || 'undeliverable', 'past_outreach');
    }
  } catch (e) {
    Logger.log('markSkipUndeliverable_ firestore sync: ' + e);
  }
}

function getFailStreak_(row) {
  var n = parseInt(row[OUTREACH_CONFIG.COL_FAIL_STREAK - 1], 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

function clearFailStreak_(sh, rowIndex) {
  sh.getRange(rowIndex, OUTREACH_CONFIG.COL_FAIL_STREAK).setValue(0);
}

/**
 * Increment fail streak; after MAX_CONSECUTIVE_SEND_FAILURES mark undeliverable (no more mail).
 * @returns {number} new streak
 */
function recordSendFailure_(sh, rowIndex, detail) {
  var row = sh.getRange(rowIndex, 1, 1, OUTREACH_CONFIG.COL_FAIL_STREAK).getValues()[0];
  var streak = getFailStreak_(row) + 1;
  sh.getRange(rowIndex, OUTREACH_CONFIG.COL_FAIL_STREAK).setValue(streak);
  if (streak >= OUTREACH_CONFIG.MAX_CONSECUTIVE_SEND_FAILURES) {
    markSkipUndeliverable_(
      sh,
      rowIndex,
      detail || streak + ' failed sends'
    );
    return streak;
  }
  sh.getRange(rowIndex, OUTREACH_CONFIG.COL_OUTREACH_SENT).setValue(
    'Failed — retry (' + streak + '/' + OUTREACH_CONFIG.MAX_CONSECUTIVE_SEND_FAILURES + ')'
  );
  return streak;
}

function markFailedRetry_(sh, rowIndex) {
  recordSendFailure_(sh, rowIndex, '');
}

function sleepBetweenSends_() {
  if (OUTREACH_CONFIG.SEND_DELAY_MS > 0) {
    Utilities.sleep(OUTREACH_CONFIG.SEND_DELAY_MS);
  }
}

function buildOutreachSubject_(row) {
  var fn = firstNameFromRow_(row);
  var base = shouldShowVirtualSessionInEmail_()
    ? OUTREACH_CONFIG.EMAIL_SUBJECT
    : OUTREACH_CONFIG.EMAIL_SUBJECT_AFTER_VIRTUAL;
  if (fn) {
    return fn + ' — ' + base;
  }
  return base;
}

function buildFollowUpSubject_(row, followNum) {
  return buildOutreachSubject_(row);
}

function buildVirtualSessionPlain_() {
  return (
    'VIRTUAL INFORMATION SESSION (PLEASE ATTEND)\n' +
    OUTREACH_CONFIG.VIRTUAL_SESSION_DATE_LABEL +
    ' · ' +
    OUTREACH_CONFIG.VIRTUAL_SESSION_TIME +
    ' ' +
    OUTREACH_CONFIG.VIRTUAL_SESSION_TIMEZONE +
    '\n\n' +
    'This session is important — we will share prayer tent locations, free street parking near 1325 La Concha Lane, team assignments, and other key details before our first serve day this Sunday.\n\n' +
    'Join on Zoom:\n' +
    OUTREACH_CONFIG.ZOOM_URL
  );
}

function buildTshirtPlain_() {
  return (
    'PRAYER CITY T-SHIRTS\n' +
    'We are printing Houston Prayer City volunteer T-shirts. Please reply to this email with your shirt size (S, M, L, or X).\n\n' +
    'If you are able to make a donation toward your shirt, that would be wonderful — and deeply appreciated. 100% goes to the movement via Zeffy:\n' +
    OUTREACH_CONFIG.DONATION_URL
  );
}

function buildOutreachBodies_(greeting) {
  var video = OUTREACH_CONFIG.VIDEO_URL;
  var signup = OUTREACH_CONFIG.SIGNUP_URL;

  var plain =
    greeting +
    '\n\n' +
    'Something beautiful is unfolding in Houston — and you were part of our story before. We would love for you to walk with us again during World Cup season.\n\n' +
    'The Houston World Cup Prayer City Movement is prayer, worship, and Gospel welcome as the nations come to our city for FIFA World Cup 2026.\n\n' +
    (shouldShowVirtualSessionInEmail_() ? buildVirtualSessionPlain_() + '\n\n' : '') +
    buildTshirtPlain_() +
    '\n\n' +
    'Sign up to volunteer (choose your shifts):\n' +
    signup +
    '\n\n' +
    'Watch "All About Prayer City":\n' +
    video +
    '\n\n' +
    'With love and gratitude,\n\n' +
    'Damilola\nPrayer City HTX\nDear Daughter Bible Study Group';

  return { plain: plain, html: buildFirstOutreachHtml_(greeting) };
}

function buildFollowUpBodies_(greeting, followNum) {
  var signup = OUTREACH_CONFIG.SIGNUP_URL;
  var video = OUTREACH_CONFIG.VIDEO_URL;

  var plain =
    greeting +
    '\n\n' +
    'Thank you to everyone who joined us for Prayer City training — your presence and prayers meant so much. We are grateful for you.\n\n' +
    (shouldShowVirtualSessionInEmail_()
      ? 'If you were not able to attend in person, we warmly invite you to our virtual information session this week. It is important that you join us so you will know prayer tent locations, free street parking near the tents, and other key arrangements before serve days begin.\n\n' +
        buildVirtualSessionPlain_() +
        '\n\n'
      : 'Serve days are approaching — sign up below for prayer tent locations, parking near 1325 La Concha Lane, and everything you need before your shift.\n\n') +
    buildTshirtPlain_() +
    '\n\n' +
    'If you have not completed volunteer registration yet, you can sign up here:\n' +
    signup +
    '\n\n' +
    'Vision video: ' +
    video +
    '\n\n' +
    'We love you and we are honored to serve Houston together.\n\n' +
    'With love,\nDamilola\nPrayer City HTX\nDear Daughter Bible Study Group';

  return { plain: plain, html: buildFollowUpHtml_(greeting) };
}

function buildVirtualSessionHtml_() {
  var zoom = OUTREACH_CONFIG.ZOOM_URL;
  return (
    '<div style="margin:22px 0;padding:18px;border-radius:14px;background:linear-gradient(135deg,#eff6ff,#f8fafc);border:1px solid #93c5fd;">' +
    '<p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.14em;color:#1d4ed8;text-transform:uppercase;">Please attend — virtual information session</p>' +
    '<p style="margin:0 0 10px;font-size:17px;font-weight:900;color:#0f172a;">' +
    OUTREACH_CONFIG.VIRTUAL_SESSION_DATE_LABEL +
    ' · ' +
    OUTREACH_CONFIG.VIRTUAL_SESSION_TIME +
    ' <span style="font-weight:600;color:#475569;">' +
    OUTREACH_CONFIG.VIRTUAL_SESSION_TIMEZONE +
    '</span></p>' +
    '<p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.65;">' +
    'We will share <strong>prayer tent locations</strong>, <strong>parking and shuttle arrangements</strong> to NRG Stadium, team details, and everything you need before our first serve day this <strong>Sunday</strong>.' +
    '</p>' +
    '<a href="' +
    zoom +
    '" style="display:inline-block;padding:12px 22px;border-radius:9999px;background:#2563eb;color:#fff;font-weight:800;font-size:14px;text-decoration:none;">Join Zoom meeting →</a>' +
    '<p style="margin:12px 0 0;font-size:12px;color:#64748b;word-break:break-all;">' +
    zoom +
    '</p></div>'
  );
}

function buildTshirtHtml_() {
  var img = OUTREACH_CONFIG.TSHIRT_IMAGE_URL;
  var donate = OUTREACH_CONFIG.DONATION_URL;
  return (
    '<div style="margin:22px 0;padding:18px;border-radius:14px;background:#ffffff;border:1px solid #e2e8f0;">' +
    '<p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.14em;color:#0d9488;text-transform:uppercase;">Prayer City volunteer T-shirts</p>' +
    '<img src="' +
    img +
    '" alt="Houston Prayer City volunteer T-shirt" width="600" style="width:100%;max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;display:block;margin:0 0 14px;" />' +
    '<p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.65;">' +
    'We are printing <strong>Houston Prayer City</strong> shirts for our volunteer family. Please <strong>reply to this email</strong> with your size: <strong>S, M, L, or X</strong>.' +
    '</p>' +
    '<p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.65;">' +
    'If you are able to make a donation toward your shirt, that would be wonderful — much appreciated. Gifts are processed through Zeffy (100% to the movement).' +
    '</p>' +
    '<a href="' +
    donate +
    '" style="display:inline-block;padding:12px 22px;border-radius:9999px;background:linear-gradient(90deg,#0f3d5c,#0d9488);color:#fff;font-weight:800;font-size:14px;text-decoration:none;">Give via Zeffy →</a></div>'
  );
}

function buildFirstOutreachHtml_(greeting) {
  var video = OUTREACH_CONFIG.VIDEO_URL;
  var signup = OUTREACH_CONFIG.SIGNUP_URL;
  var thumb = 'https://img.youtube.com/vi/3Sn8ysMi1Lk/maxresdefault.jpg';
  var safeGreeting = greeting.replace(/</g, '&lt;');

  return (
    '<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:640px;line-height:1.6;">' +
    '<p style="font-size:17px;font-weight:800;margin:0 0 16px;">' +
    safeGreeting +
    '</p>' +
    '<p style="font-size:15px;color:#334155;">You were part of our story before — and Houston is becoming a <strong style="color:#0f3d5c;">Prayer City</strong> as the world arrives for World Cup 2026. We would love for you to serve with us again.</p>' +
    (shouldShowVirtualSessionInEmail_() ? buildVirtualSessionHtml_() : '') +
    buildTshirtHtml_() +
    '<p style="text-align:center;margin:24px 0;"><a href="' +
    signup +
    '" style="display:inline-block;padding:14px 28px;border-radius:9999px;background:linear-gradient(90deg,#0f3d5c,#0d9488);color:#fff;font-weight:800;font-size:15px;text-decoration:none;">Sign up to volunteer</a></p>' +
    '<div style="margin:22px 0;padding:16px;border-radius:14px;background:linear-gradient(135deg,#e0f2fe,#f8fafc);border:1px solid #cbd5e1;">' +
    '<p style="margin:0 0 10px;font-size:12px;font-weight:900;letter-spacing:0.12em;color:#0d9488;text-transform:uppercase;">Watch the vision</p>' +
    '<a href="' +
    video +
    '" style="text-decoration:none;display:block;">' +
    '<img src="' +
    thumb +
    '" alt="All About Prayer City" width="600" style="width:100%;max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;display:block;" />' +
    '<p style="margin:10px 0 0;font-size:13px;font-weight:800;color:#0f3d5c;">Tap to watch on YouTube →</p></a></div>' +
    '<p style="margin-top:24px;font-size:15px;color:#334155;">With love,<br/><strong style="color:#0f3d5c;">Damilola</strong><br/>Prayer City HTX<br/>Dear Daughter Bible Study Group</p></div>'
  );
}

function buildFollowUpHtml_(greeting) {
  var signup = OUTREACH_CONFIG.SIGNUP_URL;
  var safeGreeting = greeting.replace(/</g, '&lt;');

  return (
    '<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:640px;line-height:1.6;">' +
    '<p style="font-size:17px;font-weight:800;margin:0 0 16px;">' +
    safeGreeting +
    '</p>' +
    '<p style="font-size:15px;color:#334155;line-height:1.65;">' +
    'Thank you to everyone who joined us for <strong>Prayer City training</strong> — your presence and prayers blessed our city. We are truly grateful for you.' +
    '</p>' +
    (shouldShowVirtualSessionInEmail_()
      ? '<p style="font-size:15px;color:#334155;line-height:1.65;">' +
        'If you were not able to attend in person, please join us virtually this week. <strong>Your attendance matters</strong> — we will cover prayer tent locations, parking and shuttle plans to NRG Stadium, and other essential details before serve days begin.' +
        '</p>' +
        buildVirtualSessionHtml_()
      : '<p style="font-size:15px;color:#334155;line-height:1.65;">' +
        'Serve days are approaching — complete sign-up for shuttle pick-up, prayer tents near NRG, and key details before your shift.' +
        '</p>') +
    buildTshirtHtml_() +
    '<p style="text-align:center;margin:24px 0;"><a href="' +
    signup +
    '" style="display:inline-block;padding:14px 28px;border-radius:9999px;background:linear-gradient(90deg,#0f3d5c,#0d9488);color:#fff;font-weight:800;font-size:15px;text-decoration:none;">Complete volunteer sign-up</a></p>' +
    '<p style="margin-top:24px;font-size:15px;color:#334155;">We love you and we are honored to serve Houston together.<br/><br/>With love,<br/><strong style="color:#0f3d5c;">Damilola</strong><br/>Prayer City HTX<br/>Dear Daughter Bible Study Group</p></div>'
  );
}

function markRegisteredSkip_(sh, rowIndex) {
  sh.getRange(rowIndex, OUTREACH_CONFIG.COL_OUTREACH_SENT).setValue('Skip — registered');
}

function sendOutreachEmail_(email, subject, bodies) {
  if (isEmailBlocked_(email)) {
    throw new Error('blocked: do not email ' + normalizeEmail_(email));
  }
  // Never email an address that previously bounced (shared do-not-send registry).
  if (typeof isInUndeliverableRegistry_ === 'function' && isInUndeliverableRegistry_(email)) {
    throw new Error('undeliverable: previously bounced ' + normalizeEmail_(email));
  }
  GmailApp.sendEmail(email, subject, bodies.plain, {
    htmlBody: bodies.html,
    name: 'Houston Prayer City',
  });
}

function recordOutreachSent_(sh, rowIndex, statusLabel, todayYmd) {
  sh.getRange(rowIndex, OUTREACH_CONFIG.COL_OUTREACH_SENT).setValue(statusLabel);
  sh.getRange(rowIndex, OUTREACH_CONFIG.COL_LAST_OUTREACH).setValue(todayYmd);
  clearFailStreak_(sh, rowIndex);
}

function getRemainingEmailQuota_() {
  try {
    return MailApp.getRemainingDailyQuota();
  } catch (e) {
    return -1;
  }
}

function getOutreachNotifyEmail_() {
  var configured = String(OUTREACH_CONFIG.NOTIFY_EMAIL || '').trim();
  if (configured) return configured;
  try {
    var active = Session.getActiveUser().getEmail();
    if (active) return active;
  } catch (e1) {}
  try {
    var effective = ScriptApp.getEffectiveUser().getEmail();
    if (effective) return effective;
  } catch (e2) {}
  return '';
}

/** Rows still waiting for a first invite (blank or Failed — retry). */
function countPendingFirstOutreach_() {
  var registered = loadRegisteredEmails_();
  var data = getPastLeadsSheet_().getDataRange().getValues();
  var pending = 0;
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var status = outreachStatus_(row);
    if (isForeverSkipStatus_(status)) continue;
    var v = validateEmailForOutreach_(row[OUTREACH_CONFIG.COL_EMAIL - 1]);
    if (!v.ok) continue;
    if (registered[v.email]) continue;
    if (isInitialAlreadySent_(status)) continue;
    pending++;
  }
  return pending;
}

/** @returns {{ total: number, sent: number, followUp: number, skip: number, failedRetry: number, pending: number }} */
function summarizePastLeadsFirstOutreach_() {
  var data = getPastLeadsSheet_().getDataRange().getValues();
  var summary = {
    total: Math.max(0, data.length - 1),
    sent: 0,
    followUp: 0,
    skip: 0,
    failedRetry: 0,
    pending: 0,
  };
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var status = outreachStatus_(row);
    if (/^failed\s*[—\-]\s*retry/i.test(status)) {
      summary.failedRetry++;
      summary.pending++;
      continue;
    }
    if (isForeverSkipStatus_(status)) {
      summary.skip++;
      continue;
    }
    if (/^follow-up\s+\d+$/i.test(status)) {
      summary.followUp++;
      continue;
    }
    if (/^sent$/i.test(status)) {
      summary.sent++;
      continue;
    }
    if (!status || /^failed/i.test(status)) {
      summary.pending++;
    }
  }
  return summary;
}

function maybeNotifyPastOutreachFirstBatchComplete_() {
  var props = PropertiesService.getScriptProperties();
  var pending = countPendingFirstOutreach_();
  if (pending > 0) {
    props.deleteProperty(PAST_OUTREACH_FIRST_BATCH_DONE_PROP);
    return;
  }
  if (props.getProperty(PAST_OUTREACH_FIRST_BATCH_DONE_PROP)) return;

  var to = getOutreachNotifyEmail_();
  if (!to) {
    Logger.log('[past outreach] First batch complete — set OUTREACH_CONFIG.NOTIFY_EMAIL.');
    return;
  }

  var s = summarizePastLeadsFirstOutreach_();
  var sheetUrl =
    'https://docs.google.com/spreadsheets/d/' + OUTREACH_CONFIG.SPREADSHEET_ID + '/edit';
  var subject = 'Prayer City: PastLeads first outreach is complete';
  var plain =
    'All past contacts on PastLeads have received their first outreach email (or were skipped as registered/bad/undeliverable).\n\n' +
    'Total rows: ' +
    s.total +
    '\nFirst invite sent: ' +
    s.sent +
    '\nIn follow-up sequence: ' +
    s.followUp +
    '\nSkipped: ' +
    s.skip +
    '\nStill waiting for first send: ' +
    s.pending +
    '\n\nSheet: ' +
    sheetUrl +
    '\n\nYou can turn OFF daily first outreach from the Past contacts menu if you only wanted first invites.';
  var html =
    '<div style="font-family:system-ui,sans-serif;max-width:520px;color:#0f172a;">' +
    '<p style="font-size:16px;"><strong>PastLeads first outreach is complete.</strong></p>' +
    '<p>Everyone on the list has had their first invite (or was skipped).</p>' +
    '<ul style="font-size:14px;line-height:1.6;color:#334155;">' +
    '<li>Total rows: <strong>' +
    s.total +
    '</strong></li>' +
    '<li>First invite sent: <strong>' +
    s.sent +
    '</strong></li>' +
    '<li>In follow-up sequence: <strong>' +
    s.followUp +
    '</strong></li>' +
    '<li>Skipped: <strong>' +
    s.skip +
    '</strong></li>' +
    '<li>Still waiting: <strong>' +
    s.pending +
    '</strong></li>' +
    '</ul>' +
    '<p><a href="' +
    sheetUrl +
    '">Open PastLeads sheet</a></p>' +
    '<p style="font-size:13px;color:#64748b;">Turn off daily first outreach from the spreadsheet menu if you only needed first invites.</p></div>';

  GmailApp.sendEmail(to, subject, plain, { htmlBody: html, name: 'Prayer City Outreach' });
  props.setProperty(PAST_OUTREACH_FIRST_BATCH_DONE_PROP, todayYmdChicago_());
  Logger.log('[past outreach] Completion email sent to ' + to);
}

/**
 * First-time outreach (manual menu or daily trigger).
 * Only rows with blank OutreachSent (or Failed — retry). Skips Sent / Follow-up / Skip.
 * @param {{ silent?: boolean }} opts silent=true for time-driven triggers (no UI alert)
 * @returns {Object} stats
 */
function sendPastContactsOutreachCore_(opts) {
  opts = opts || {};
  var silent = opts.silent === true;
  if (isPastOutreachPaused_()) {
    var pausedMsg = 'Past-contact outreach is paused (campaign ended). No emails sent.';
    Logger.log('[sendPastContactsOutreach] ' + pausedMsg);
    if (!silent) alertOrLog_(pausedMsg);
    return { sent: 0, paused: true };
  }
  var sh = getPastLeadsSheet_();
  var remainingStart = getRemainingEmailQuota_();
  if (remainingStart >= 0 && remainingStart === 0) {
    var zeroMsg =
      'Gmail daily send quota is 0. First outreach paused until tomorrow (not bad addresses).';
    Logger.log('[sendPastContactsOutreach] ' + zeroMsg);
    if (!silent) alertOrLog_(zeroMsg);
    return { sent: 0, quotaZero: true };
  }

  var registered = loadRegisteredEmails_();
  var data = sh.getDataRange().getValues();
  var todayYmd = todayYmdChicago_();
  var sent = 0;
  var skippedReg = 0;
  var skippedSent = 0;
  var skippedBad = 0;
  var skippedUndeliverable = 0;
  var failedTemp = 0;
  var max = OUTREACH_CONFIG.MAX_SEND_PER_RUN;
  if (remainingStart > 0) {
    max = Math.min(max, remainingStart);
  }

  for (var r = 1; r < data.length && sent < max; r++) {
    var row = data[r];
    var status = outreachStatus_(row);

    if (isForeverSkipStatus_(status)) {
      skippedSent++;
      continue;
    }

    if (getFailStreak_(row) >= OUTREACH_CONFIG.MAX_CONSECUTIVE_SEND_FAILURES) {
      markSkipUndeliverable_(sh, r + 1, 'max failures');
      skippedUndeliverable++;
      continue;
    }

    var v = validateEmailForOutreach_(row[OUTREACH_CONFIG.COL_EMAIL - 1]);
    if (!v.ok) {
      markSkipBadAddress_(sh, r + 1, v.reason);
      skippedBad++;
      continue;
    }
    var email = v.email;

    if (isEmailBlocked_(email)) {
      markSkipDoNotEmail_(sh, r + 1);
      skippedSent++;
      continue;
    }

    if (registered[email]) {
      markRegisteredSkip_(sh, r + 1);
      skippedReg++;
      continue;
    }

    if (isInitialAlreadySent_(status)) {
      skippedSent++;
      continue;
    }

    var greeting = greetingForRow_(row);
    try {
      sendOutreachEmail_(email, buildOutreachSubject_(row), buildOutreachBodies_(greeting));
      recordOutreachSent_(sh, r + 1, 'Sent', todayYmd);
      sent++;
      sleepBetweenSends_();
    } catch (e) {
      var kind = classifySendError_(e);
      Logger.log('Outreach failed row ' + (r + 1) + ' ' + email + ' [' + kind + ']: ' + e);
      if (kind === 'permanent') {
        markSkipUndeliverable_(sh, r + 1, e.message || e);
        skippedUndeliverable++;
      } else {
        var streak = recordSendFailure_(sh, r + 1, e.message || e);
        failedTemp++;
        if (streak >= OUTREACH_CONFIG.MAX_CONSECUTIVE_SEND_FAILURES) {
          skippedUndeliverable++;
        }
        break;
      }
    }
  }

  var stats = {
    sent: sent,
    skippedReg: skippedReg,
    skippedSent: skippedSent,
    skippedBad: skippedBad,
    skippedUndeliverable: skippedUndeliverable,
    failedTemp: failedTemp,
    remainingAfter: getRemainingEmailQuota_(),
    quotaZero: false,
  };

  var logMsg =
    '[sendPastContactsOutreach] sent=' +
    sent +
    ' skip_reg=' +
    skippedReg +
    ' skip_done=' +
    skippedSent +
    ' skip_bad=' +
    skippedBad +
    ' skip_undeliverable=' +
    skippedUndeliverable +
    ' temp_stop=' +
    failedTemp +
    ' quota_left=' +
    stats.remainingAfter;
  Logger.log(logMsg);

  if (!silent) {
    var msg =
      'Past-contact outreach complete.\n\nSent: ' +
      sent +
      '\nSkipped (registered): ' +
      skippedReg +
      '\nSkipped (already done / skip): ' +
      skippedSent +
      '\nSkipped (bad address): ' +
      skippedBad +
      '\nSkipped (undeliverable — will not retry): ' +
      skippedUndeliverable +
      '\nStopped (temporary Gmail limit — retry later): ' +
      failedTemp;
    if (stats.remainingAfter >= 0) {
      msg += '\n\nGmail recipients remaining today: ' + stats.remainingAfter;
    }
    if (sent >= max && max > 0) {
      msg += '\n\nReached today\'s batch limit (' + max + '). Daily auto-run will continue tomorrow if enabled.';
    }
    if (failedTemp > 0) {
      msg += '\n\nQuota hit — not bad addresses. Retry tomorrow or run Restore wrongly skipped.';
    }
    alertOrLog_(msg);
  }

  return stats;
}

/** Menu: first-time outreach batch (manual). */
function sendPastContactsOutreach() {
  sendPastContactsOutreachCore_({ silent: false });
}

/**
 * Daily trigger: first outreach to anyone still on PastLeads without a first send.
 * Stops when all rows are Sent/Skip or Gmail quota is 0. Re-runs safely each day.
 */
function sendPastContactsOutreachDaily() {
  sendPastContactsOutreachCore_({ silent: true });
  maybeNotifyPastOutreachFirstBatchComplete_();
}

/**
 * Daily trigger: follow-up to anyone previously emailed who still has not signed up.
 * Sends at most one email per person per calendar day (Chicago).
 */
function sendPastContactsFollowUpDaily() {
  if (isPastOutreachPaused_()) {
    Logger.log('[sendPastContactsFollowUpDaily] Paused (campaign ended). No emails sent.');
    return;
  }
  var sh = getPastLeadsSheet_();
  var registered = loadRegisteredEmails_();
  var data = sh.getDataRange().getValues();
  var todayYmd = todayYmdChicago_();
  var sent = 0;
  var skippedReg = 0;
  var skippedToday = 0;
  var skippedNever = 0;
  var skippedUndeliverable = 0;
  var failedTemp = 0;
  var max = OUTREACH_CONFIG.MAX_FOLLOWUP_PER_DAY;

  for (var r = 1; r < data.length && sent < max; r++) {
    var row = data[r];
    var status = outreachStatus_(row);

    if (isForeverSkipStatus_(status)) {
      skippedNever++;
      continue;
    }

    if (getFailStreak_(row) >= OUTREACH_CONFIG.MAX_CONSECUTIVE_SEND_FAILURES) {
      markSkipUndeliverable_(sh, r + 1, 'max failures');
      skippedUndeliverable++;
      continue;
    }

    var v = validateEmailForOutreach_(row[OUTREACH_CONFIG.COL_EMAIL - 1]);
    if (!v.ok) {
      markSkipBadAddress_(sh, r + 1, v.reason);
      continue;
    }
    var email = v.email;

    if (isEmailBlocked_(email)) {
      markSkipDoNotEmail_(sh, r + 1);
      skippedNever++;
      continue;
    }

    if (registered[email]) {
      if (!/^skip/i.test(status)) {
        markRegisteredSkip_(sh, r + 1);
      }
      skippedReg++;
      continue;
    }

    var prevCount = followUpCountFromStatus_(status);
    if (prevCount < 0) {
      skippedNever++;
      continue;
    }

    if (lastOutreachYmd_(row) === todayYmd) {
      skippedToday++;
      continue;
    }

    var nextCount = prevCount + 1;
    var greeting = greetingForRow_(row);
    try {
      sendOutreachEmail_(
        email,
        buildFollowUpSubject_(row, nextCount),
        buildFollowUpBodies_(greeting, nextCount)
      );
      recordOutreachSent_(sh, r + 1, 'Follow-up ' + nextCount, todayYmd);
      sent++;
      sleepBetweenSends_();
    } catch (e) {
      var kind = classifySendError_(e);
      Logger.log('Follow-up failed row ' + (r + 1) + ' ' + email + ' [' + kind + ']: ' + e);
      if (kind === 'permanent') {
        markSkipUndeliverable_(sh, r + 1, e.message || e);
        skippedUndeliverable++;
      } else {
        var streak = recordSendFailure_(sh, r + 1, e.message || e);
        failedTemp++;
        if (streak >= OUTREACH_CONFIG.MAX_CONSECUTIVE_SEND_FAILURES) {
          skippedUndeliverable++;
        }
        break;
      }
    }
  }

  Logger.log(
    '[sendPastContactsFollowUpDaily] ' +
      todayYmd +
      ' sent=' +
      sent +
      ' registered_skip=' +
      skippedReg +
      ' not_eligible=' +
      skippedNever +
      ' already_today=' +
      skippedToday +
      ' undeliverable=' +
      skippedUndeliverable +
      ' temp_stop=' +
      failedTemp
  );
}

/**
 * UNDO mistaken "Skip — undeliverable" from quota failures (e.g. after markUnrepairablePastLeads).
 * Clears OutreachSent for rows that were only marked undeliverable due to bulk send limits,
 * so you can send again in smaller batches.
 */
function restoreMisclassifiedUndeliverableLeads() {
  var sh = getPastLeadsSheet_();
  var data = sh.getDataRange().getValues();
  var restored = 0;
  var restoredRetry = 0;
  var kept = 0;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var status = outreachStatus_(row);
    var stLow = status.toLowerCase();

    if (!/^skip\s*[—\-]\s*undeliverable/i.test(status) && !/^failed/i.test(status)) {
      continue;
    }

    var v = validateEmailForOutreach_(row[OUTREACH_CONFIG.COL_EMAIL - 1]);
    if (!v.ok) {
      kept++;
      continue;
    }

    if (/^failed\s*[—\-]\s*retry/i.test(status)) {
      kept++;
      continue;
    }

    if (/^failed/i.test(status)) {
      sh.getRange(r + 1, OUTREACH_CONFIG.COL_OUTREACH_SENT).setValue('');
      restored++;
      continue;
    }

    // Skip — undeliverable (often from quota batch, not real bounces)
    sh.getRange(r + 1, OUTREACH_CONFIG.COL_OUTREACH_SENT).setValue('');
    restored++;
  }

  alertOrLog_(
    'Restored rows for retry.\n\n' +
      'Cleared status (ready to send again): ' +
      restored +
      '\nLeft unchanged (bad address or already retry): ' +
      kept +
      '\n\nNext: run Send first outreach in batches of ~50–80/day (Gmail limit).'
  );
}

/**
 * Only mark Failed rows as undeliverable if Apps Script log message looks like a real bad address.
 * Prefer restoreMisclassifiedUndeliverableLeads() if many valid emails were wrongly skipped.
 */
function markUnrepairablePastLeads() {
  var sh = getPastLeadsSheet_();
  var data = sh.getDataRange().getValues();
  var markedUndeliverable = 0;
  var markedBad = 0;
  var leftForRetry = 0;
  var alreadySkip = 0;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var status = outreachStatus_(row);

    if (isForeverSkipStatus_(status) && !/^failed/i.test(status)) {
      alreadySkip++;
      continue;
    }

    var v = validateEmailForOutreach_(row[OUTREACH_CONFIG.COL_EMAIL - 1]);
    if (!v.ok) {
      markSkipBadAddress_(sh, r + 1, v.reason);
      markedBad++;
      continue;
    }

    if (/^failed/i.test(status)) {
      markSkipUndeliverable_(sh, r + 1, 'manual review — check Executions log');
      markedUndeliverable++;
    }
  }

  alertOrLog_(
    'WARNING: Bulk-marking Failed as undeliverable is usually wrong after quota errors.\n\n' +
      'Prefer: Restore misclassified undeliverable (menu) then resend in small batches.\n\n' +
      'Marked undeliverable: ' +
      markedUndeliverable +
      '\nMarked bad address: ' +
      markedBad
  );
}

/** Turn on daily automatic first outreach (~7am project time). */
function installPastOutreachFirstBatchDailyTrigger() {
  installPastOutreachFirstBatchDailyTrigger_();
  alertOrLog_(
    'Daily FIRST outreach is ON.\n\n' +
      PAST_OUTREACH_FIRST_BATCH_DAILY_FN +
      ' runs around ' +
      OUTREACH_CONFIG.FIRST_BATCH_TRIGGER_HOUR +
      ':00 each day (not immediately).\n' +
      'Sends up to ' +
      OUTREACH_CONFIG.MAX_SEND_PER_RUN +
      ' new invites per day (blank OutreachSent only).\n' +
      'You will get one email when the first-outreach queue is empty.\n' +
      'Set Apps Script timezone to America/Chicago (Project Settings).'
  );
}

function removePastOutreachFirstBatchDailyTrigger() {
  removePastOutreachFirstBatchDailyTrigger_();
  alertOrLog_('Daily FIRST outreach is OFF.');
}

/** Turn on both daily first outreach (7am) and daily follow-up (9am). */
function installPastOutreachAllDailyTriggers() {
  installPastOutreachFirstBatchDailyTrigger_();
  installPastOutreachDailyTrigger_();
  alertOrLog_(
    'All daily outreach is ON.\n\n' +
      '• ' +
      OUTREACH_CONFIG.FIRST_BATCH_TRIGGER_HOUR +
      ':00 — first invites (up to ' +
      OUTREACH_CONFIG.MAX_SEND_PER_RUN +
      '/day)\n' +
      '• ' +
      OUTREACH_CONFIG.FOLLOWUP_TRIGGER_HOUR +
      ':00 — follow-ups for non-signups\n\n' +
      'Timezone: set Apps Script to America/Chicago.'
  );
}

function removePastOutreachAllDailyTriggers() {
  removePastOutreachFirstBatchDailyTrigger_();
  removePastOutreachDailyTrigger_();
  alertOrLog_('All daily outreach triggers are OFF.');
}

/** Same as removePastOutreachAllDailyTriggers but also sets the campaign pause flag. */
function stopAllPastOutreachEmail() {
  pausePastOutreachCampaignEnded();
}

function installPastOutreachFirstBatchDailyTrigger_() {
  var fn = PAST_OUTREACH_FIRST_BATCH_DAILY_FN;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(fn)
    .timeBased()
    .everyDays(1)
    .atHour(OUTREACH_CONFIG.FIRST_BATCH_TRIGGER_HOUR)
    .create();
}

function removePastOutreachFirstBatchDailyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === PAST_OUTREACH_FIRST_BATCH_DAILY_FN) ScriptApp.deleteTrigger(t);
  });
}

function installPastOutreachDailyTrigger_() {
  var fn = PAST_OUTREACH_DAILY_FN;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(fn)
    .timeBased()
    .everyDays(1)
    .atHour(OUTREACH_CONFIG.FOLLOWUP_TRIGGER_HOUR)
    .create();
}

function removePastOutreachDailyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === PAST_OUTREACH_DAILY_FN) ScriptApp.deleteTrigger(t);
  });
}

/** Menu: turn on daily follow-ups (9am project time — set TZ to Chicago). */
function installPastOutreachDailyTrigger() {
  installPastOutreachDailyTrigger_();
  alertOrLog_(
    'Daily past-contact follow-up is ON.\n\n' +
      PAST_OUTREACH_DAILY_FN +
      ' runs once per day around ' +
      OUTREACH_CONFIG.FOLLOWUP_TRIGGER_HOUR +
      ':00 (script project timezone).\n' +
      'Set Apps Script project timezone to America/Chicago (Project Settings).\n' +
      'Stops automatically when someone appears in volunteer sign-ups (column C).'
  );
}

function removePastOutreachDailyTrigger() {
  removePastOutreachDailyTrigger_();
  alertOrLog_('Daily past-contact follow-up is OFF.');
}

/**
 * Menu lives in PrayerCityFormPipeline.gs → buildPrayerCitySpreadsheetMenu_()
 * (Apps Script allows only one onOpen per project.)
 */
function refreshPastContactsMenu() {
  if (typeof buildPrayerCitySpreadsheetMenu_ === 'function') {
    buildPrayerCitySpreadsheetMenu_();
    alertOrLog_('Menu refreshed. Use 🙏 Prayer City → Past contacts items.');
    return;
  }
  alertOrLog_(
    'Paste the updated PrayerCityFormPipeline.gs (buildPrayerCitySpreadsheetMenu_) and reload the sheet.'
  );
}

/** Menu: mark blocklisted emails on PastLeads (e.g. Mary Kaarto). */
function applyEmailBlocklistToPastLeads() {
  var sh = getPastLeadsSheet_();
  var data = sh.getDataRange().getValues();
  var n = 0;
  for (var r = 1; r < data.length; r++) {
    if (isEmailBlocked_(data[r][OUTREACH_CONFIG.COL_EMAIL - 1])) {
      markSkipDoNotEmail_(sh, r + 1);
      n++;
    }
  }
  alertOrLog_(
    'Email blocklist applied to ' +
      n +
      ' row(s) on PastLeads (status → Skip — do not email).'
  );
}

/**
 * Menu: stop chronic delivery failures — blocklist + 3-strike undeliverable + old Failed — retry rows.
 */
function stopChronicDeliveryFailuresOnPastLeads() {
  var sh = getPastLeadsSheet_();
  var data = sh.getDataRange().getValues();
  var blocked = 0;
  var threeStrike = 0;
  var failedRetry = 0;
  var max = OUTREACH_CONFIG.MAX_CONSECUTIVE_SEND_FAILURES;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var email = row[OUTREACH_CONFIG.COL_EMAIL - 1];
    var status = outreachStatus_(row);
    var streak = getFailStreak_(row);

    if (isEmailBlocked_(email)) {
      if (!/^skip\s*[—\-]\s*do not email/i.test(status)) {
        markSkipDoNotEmail_(sh, r + 1);
        blocked++;
      }
      continue;
    }

    if (streak >= max && !isForeverSkipStatus_(status)) {
      markSkipUndeliverable_(sh, r + 1, streak + ' failed sends');
      threeStrike++;
      continue;
    }

    if (/^failed/i.test(status) && !isForeverSkipStatus_(status)) {
      sh.getRange(r + 1, OUTREACH_CONFIG.COL_FAIL_STREAK).setValue(max);
      markSkipUndeliverable_(sh, r + 1, 'repeat delivery failure');
      failedRetry++;
    }
  }

  alertOrLog_(
    'Stopped repeat outreach for chronic failures.\n\n' +
      'Blocklist (do not email): ' +
      blocked +
      '\n3+ fail streak → undeliverable: ' +
      threeStrike +
      '\nFailed — retry → undeliverable: ' +
      failedRetry +
      '\n\nMary Kaarto and blocklisted addresses will not be emailed again.'
  );
}
