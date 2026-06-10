/**
 * Houston Prayer City — Twilio SMS for past contacts & registered members.
 *
 * Setup (once):
 *   Apps Script → Project Settings → Script properties:
 *     TWILIO_ACCOUNT_SID
 *     TWILIO_AUTH_TOKEN
 *     TWILIO_FROM_NUMBER   (your Twilio number, E.164 e.g. +18325551234)
 *
 * Sheets (same spreadsheet as PastLeads):
 *   SmsInvite  — import outreach/sms-invite-not-registered.csv
 *   SmsMembers — import outreach/sms-registered-update.csv
 *
 * Columns: Email | First Name | Phone | Segment | SmsSent | LastSms
 */

var SMS_CONFIG = {
  SPREADSHEET_ID: '1x0OQfAs5z3Ryy7VBdV_fmmRr-yWCT5bEpCNSfEsonXk',
  INVITE_TAB: 'SmsInvite',
  MEMBERS_TAB: 'SmsMembers',
  COL_EMAIL: 1,
  COL_FIRST_NAME: 2,
  COL_PHONE: 3,
  COL_SEGMENT: 4,
  COL_SMS_SENT: 5,
  COL_LAST_SMS: 6,
  SIGNUP_URL: 'https://prayercityhtx.com/volunteer/',
  ZOOM_URL:
    'https://us06web.zoom.us/j/88179064654?pwd=fGNWdDayQeRuixN5pH3AfwxdiL45Xk.1',
  DONATION_URL:
    'https://www.zeffy.com/en-US/donation-form/houston-world-cup-prayer-city-movement',
  VIRTUAL_SESSION_SHORT: 'Thu Jun 11, 6pm CT',
  MAX_SMS_PER_RUN: 50,
  SMS_DELAY_MS: 350,
  MEMBERS_DAILY_HOUR: 10,
  INVITE_DAILY_HOUR: 11,
};

var SMS_MEMBERS_DAILY_FN = 'sendSmsMembersDaily';
var SMS_INVITE_DAILY_FN = 'sendSmsInviteDaily';

function smsAlertOrLog_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

function todayYmdSmsChicago_() {
  return Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
}

function getTwilioCredentials_() {
  var p = PropertiesService.getScriptProperties();
  var sid = String(p.getProperty('TWILIO_ACCOUNT_SID') || '').trim();
  var token = String(p.getProperty('TWILIO_AUTH_TOKEN') || '').trim();
  var from = String(p.getProperty('TWILIO_FROM_NUMBER') || '').trim();
  if (!sid || !token || !from) {
    throw new Error(
      'Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in Apps Script → Project Settings → Script properties.'
    );
  }
  return { accountSid: sid, authToken: token, fromNumber: from };
}

/** Menu: shows where to paste Twilio keys (never put secrets in source code). */
function showTwilioSetupInstructions() {
  smsAlertOrLog_(
    'Twilio setup (one time)\n\n' +
      '1. Twilio Console → Account SID + Auth Token\n' +
      '2. Buy/use a US phone number (Messaging enabled)\n' +
      '3. Apps Script → Project Settings → Script properties → Add:\n' +
      '   TWILIO_ACCOUNT_SID\n' +
      '   TWILIO_AUTH_TOKEN\n' +
      '   TWILIO_FROM_NUMBER  (e.g. +18325551234)\n' +
      '4. Import CSVs into tabs SmsInvite & SmsMembers\n' +
      '5. Run "SMS — send test to my phone" (set TEST_SMS_PHONE property first)\n\n' +
      'Recipients can reply STOP to opt out (Twilio handles this).'
  );
}

function normalizePhoneE164_(phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (digits.indexOf('1') === 0 && digits.length === 11) {
    digits = digits.substring(1);
  }
  if (digits.length === 10) {
    return '+1' + digits;
  }
  if (String(phone || '').trim().indexOf('+') === 0 && digits.length >= 10) {
    return '+' + digits;
  }
  return '';
}

function smsStatus_(row) {
  return String(row[SMS_CONFIG.COL_SMS_SENT - 1] || '').trim();
}

function lastSmsYmd_(row) {
  var v = row[SMS_CONFIG.COL_LAST_SMS - 1];
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'America/Chicago', 'yyyy-MM-dd');
  }
  return String(v || '').trim().slice(0, 10);
}

function isSmsForeverSkip_(status) {
  if (!status) return false;
  return /^skip(\s|$)/i.test(status);
}

function firstNameFromSmsRow_(row) {
  var fn = String(row[SMS_CONFIG.COL_FIRST_NAME - 1] || '').trim();
  if (fn) return fn.split(/\s+/)[0];
  return '';
}

function smsGreetingName_(row) {
  var fn = firstNameFromSmsRow_(row);
  return fn || 'friend';
}

function followUpCountFromSmsStatus_(status) {
  if (isSmsForeverSkip_(status)) return -1;
  var m = /^Follow-up\s+(\d+)$/i.exec(status);
  if (m) return parseInt(m[1], 10);
  if (/^sent$/i.test(status)) return 0;
  return -1;
}

function markSmsSent_(sh, rowIndex, label, todayYmd) {
  sh.getRange(rowIndex, SMS_CONFIG.COL_SMS_SENT).setValue(label);
  sh.getRange(rowIndex, SMS_CONFIG.COL_LAST_SMS).setValue(todayYmd);
}

function markSmsSkip_(sh, rowIndex, reason) {
  sh.getRange(rowIndex, SMS_CONFIG.COL_SMS_SENT).setValue('Skip — ' + reason);
}

function sleepBetweenSms_() {
  if (SMS_CONFIG.SMS_DELAY_MS > 0) {
    Utilities.sleep(SMS_CONFIG.SMS_DELAY_MS);
  }
}

function sendTwilioSms_(toE164, body) {
  var cred = getTwilioCredentials_();
  var url =
    'https://api.twilio.com/2010-04-01/Accounts/' +
    cred.accountSid +
    '/Messages.json';
  var payload = {
    To: toE164,
    From: cred.fromNumber,
    Body: body,
  };
  var options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    headers: {
      Authorization:
        'Basic ' +
        Utilities.base64Encode(cred.accountSid + ':' + cred.authToken),
    },
    muteHttpExceptions: true,
  };
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code >= 200 && code < 300) {
    return { ok: true, response: text };
  }
  var err = text;
  try {
    var j = JSON.parse(text);
    err = (j.message || j.error_message || text) + ' (code ' + (j.code || code) + ')';
  } catch (e2) {}
  return { ok: false, error: err, httpCode: code };
}

function classifyTwilioError_(errMsg) {
  var msg = String(errMsg || '').toLowerCase();
  if (/unsubscribed|21610|blacklist|opted out|opt-out/.test(msg)) {
    return 'opt_out';
  }
  if (/invalid|21211|21614|not a valid|cannot route/.test(msg)) {
    return 'invalid';
  }
  if (/rate|limit|429|too many|throttl/.test(msg)) {
    return 'rate';
  }
  return 'other';
}

function buildMemberSmsBody_(name) {
  return (
    'Prayer City HTX — Hi ' +
    name +
    '! Thanks for serving. IMPORTANT virtual info session ' +
    SMS_CONFIG.VIRTUAL_SESSION_SHORT +
    ': prayer tent locations, parking & shuttle to NRG Stadium. Zoom: ' +
    SMS_CONFIG.ZOOM_URL +
    ' Reply with your T-shirt size (S, M, L, XL, 2XL, 3XL). Optional shirt donation: ' +
    SMS_CONFIG.DONATION_URL +
    ' Reply STOP to opt out.'
  );
}

function buildInviteSmsBody_(name) {
  return (
    'Prayer City HTX — Hi ' +
    name +
    '! Thank you for being part of our story. Virtual volunteer info ' +
    SMS_CONFIG.VIRTUAL_SESSION_SHORT +
    ' (tent locations, parking, NRG shuttle). Zoom: ' +
    SMS_CONFIG.ZOOM_URL +
    ' Sign up: ' +
    SMS_CONFIG.SIGNUP_URL +
    ' Reply STOP to opt out.'
  );
}

function ensureSmsSheet_(tabName) {
  var ss = SpreadsheetApp.openById(SMS_CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(tabName);
  if (!sh) {
    throw new Error(
      'Tab "' +
        tabName +
        '" not found. Import outreach/sms-*.csv into SmsInvite and SmsMembers.'
    );
  }
  var expected = ['Email', 'First Name', 'Phone', 'Segment', 'SmsSent', 'LastSms'];
  for (var i = 0; i < expected.length; i++) {
    if (String(sh.getRange(1, i + 1).getValue() || '').trim() !== expected[i]) {
      sh.getRange(1, i + 1).setValue(expected[i]);
    }
  }
  return sh;
}

function getSmsMembersSheet_() {
  return ensureSmsSheet_(SMS_CONFIG.MEMBERS_TAB);
}

function getSmsInviteSheet_() {
  return ensureSmsSheet_(SMS_CONFIG.INVITE_TAB);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh
 * @param {function(Array): string} buildBody
 * @param {{ silent?: boolean }} opts
 */
function sendSmsSheetCore_(sh, buildBody, opts) {
  opts = opts || {};
  var silent = opts.silent === true;
  getTwilioCredentials_();

  var data = sh.getDataRange().getValues();
  var todayYmd = todayYmdSmsChicago_();
  var sent = 0;
  var skippedToday = 0;
  var skippedForever = 0;
  var skippedBadPhone = 0;
  var skippedInvalid = 0;
  var failedRate = 0;
  var max = SMS_CONFIG.MAX_SMS_PER_RUN;

  for (var r = 1; r < data.length && sent < max; r++) {
    var row = data[r];
    var status = smsStatus_(row);

    if (isSmsForeverSkip_(status)) {
      skippedForever++;
      continue;
    }

    var phone = normalizePhoneE164_(row[SMS_CONFIG.COL_PHONE - 1]);
    if (!phone) {
      markSmsSkip_(sh, r + 1, 'bad phone');
      skippedBadPhone++;
      continue;
    }

    var prev = followUpCountFromSmsStatus_(status);
    if (prev < 0 && status) {
      skippedForever++;
      continue;
    }

    if (lastSmsYmd_(row) === todayYmd) {
      skippedToday++;
      continue;
    }

    var nextLabel = prev < 0 ? 'Sent' : 'Follow-up ' + (prev + 1);
    var body = buildBody(smsGreetingName_(row));
    var result = sendTwilioSms_(phone, body);

    if (result.ok) {
      markSmsSent_(sh, r + 1, nextLabel, todayYmd);
      sent++;
      sleepBetweenSms_();
      continue;
    }

    Logger.log('SMS failed row ' + (r + 1) + ' ' + phone + ': ' + result.error);
    var kind = classifyTwilioError_(result.error);
    if (kind === 'opt_out' || kind === 'invalid') {
      markSmsSkip_(sh, r + 1, kind === 'opt_out' ? 'opt out' : 'invalid phone');
      skippedInvalid++;
    } else if (kind === 'rate') {
      failedRate++;
      break;
    } else {
      failedRate++;
      break;
    }
  }

  var summary =
    'SMS batch done.\n\nSent: ' +
    sent +
    '\nSkipped (already sent today): ' +
    skippedToday +
    '\nSkipped (opt out / invalid / bad phone): ' +
    (skippedForever + skippedBadPhone + skippedInvalid) +
    '\nStopped (Twilio rate/error): ' +
    failedRate;
  Logger.log('[sendSmsSheet] ' + summary.replace(/\n/g, ' | '));
  if (!silent) smsAlertOrLog_(summary);
  return { sent: sent };
}

/** Menu: registered members / signups with phone (SmsMembers tab). */
function sendSmsMembersNow() {
  sendSmsSheetCore_(getSmsMembersSheet_(), buildMemberSmsBody_, { silent: false });
}

/** Menu: past contacts not registered by phone (SmsInvite tab). */
function sendSmsInviteNow() {
  sendSmsSheetCore_(getSmsInviteSheet_(), buildInviteSmsBody_, { silent: false });
}

function sendSmsMembersDaily() {
  sendSmsSheetCore_(getSmsMembersSheet_(), buildMemberSmsBody_, { silent: true });
}

function sendSmsInviteDaily() {
  sendSmsSheetCore_(getSmsInviteSheet_(), buildInviteSmsBody_, { silent: true });
}

/** Send one test SMS — set Script property TEST_SMS_PHONE=+1XXXXXXXXXX first. */
function sendSmsTestToMyPhone() {
  var testPhone = String(
    PropertiesService.getScriptProperties().getProperty('TEST_SMS_PHONE') || ''
  ).trim();
  if (!testPhone) {
    smsAlertOrLog_(
      'Add Script property TEST_SMS_PHONE (E.164, e.g. +13466648066), then run again.'
    );
    return;
  }
  var phone = normalizePhoneE164_(testPhone);
  if (!phone) {
    smsAlertOrLog_('TEST_SMS_PHONE is not a valid US number.');
    return;
  }
  var body = buildMemberSmsBody_('there');
  var result = sendTwilioSms_(phone, body);
  if (result.ok) {
    smsAlertOrLog_('Test SMS sent to ' + phone);
  } else {
    smsAlertOrLog_('Test SMS failed:\n' + result.error);
  }
}

function installSmsMembersDailyTrigger_() {
  var fn = SMS_MEMBERS_DAILY_FN;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(fn)
    .timeBased()
    .everyDays(1)
    .atHour(SMS_CONFIG.MEMBERS_DAILY_HOUR)
    .create();
}

function removeSmsMembersDailyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === SMS_MEMBERS_DAILY_FN) ScriptApp.deleteTrigger(t);
  });
}

function installSmsInviteDailyTrigger_() {
  var fn = SMS_INVITE_DAILY_FN;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(fn)
    .timeBased()
    .everyDays(1)
    .atHour(SMS_CONFIG.INVITE_DAILY_HOUR)
    .create();
}

function removeSmsInviteDailyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === SMS_INVITE_DAILY_FN) ScriptApp.deleteTrigger(t);
  });
}

function installSmsMembersDailyTrigger() {
  installSmsMembersDailyTrigger_();
  smsAlertOrLog_(
    'Daily MEMBER SMS is ON (~' +
      SMS_CONFIG.MEMBERS_DAILY_HOUR +
      ':00). Sends to SmsMembers tab, max ' +
      SMS_CONFIG.MAX_SMS_PER_RUN +
      '/day. Timezone: America/Chicago.'
  );
}

function removeSmsMembersDailyTrigger() {
  removeSmsMembersDailyTrigger_();
  smsAlertOrLog_('Daily member SMS is OFF.');
}

function installSmsInviteDailyTrigger() {
  installSmsInviteDailyTrigger_();
  smsAlertOrLog_(
    'Daily INVITE SMS is ON (~' +
      SMS_CONFIG.INVITE_DAILY_HOUR +
      ':00). Sends to SmsInvite tab, max ' +
      SMS_CONFIG.MAX_SMS_PER_RUN +
      '/day.'
  );
}

function removeSmsInviteDailyTrigger() {
  removeSmsInviteDailyTrigger_();
  smsAlertOrLog_('Daily invite SMS is OFF.');
}

function installSmsAllDailyTriggers() {
  installSmsMembersDailyTrigger_();
  installSmsInviteDailyTrigger_();
  smsAlertOrLog_(
    'All daily SMS ON:\n• Members ~' +
      SMS_CONFIG.MEMBERS_DAILY_HOUR +
      ':00\n• Invite list ~' +
      SMS_CONFIG.INVITE_DAILY_HOUR +
      ':00'
  );
}

function removeSmsAllDailyTriggers() {
  removeSmsMembersDailyTrigger_();
  removeSmsInviteDailyTrigger_();
  smsAlertOrLog_('All daily SMS triggers OFF.');
}
