/**
 * Houston Prayer City — send Firebase email sign-in links from your Sheet.
 *
 * SETUP:
 * 1. Deploy Cloud Function invVolunteer (see FIREBASE_SETUP.md in repo).
 * 2. Fill CONFIG below.
 * 3. Sheet: row 1 headers must include at least: Email, Name (adjust COLUMN_* constants).
 * 4. Add a column "InviteSent" (recommended) to track sends — set INVITE_FLAG_COLUMN.
 * 5. Run authorizeInviteSender() once from the script editor to grant Gmail send permission.
 */

var CONFIG = {
  /** Full URL of invVolunteer, e.g. https://us-central1-PROJECT.cloudfunctions.net/invVolunteer */
  INVITE_FUNCTION_URL: 'https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/invVolunteer',
  /** Same secret you stored: firebase functions:secrets:set INVITE_SECRET */
  INVITE_SECRET: 'paste-a-long-random-secret-here',
  /** Spreadsheet ID from the sheet URL */
  SPREADSHEET_ID: 'your-google-sheet-id',
  /** 1-based column indexes — change to match YOUR header row (example: A=name B=email C=phone D=notes E=shifts) */
  COL_NAME: 1,
  COL_EMAIL: 2,
  COL_PHONE: 3,
  COL_NOTES: 4,
  COL_SHIFTS: 5,
  /** "InviteSent" column — 0 to skip tracking */
  INVITE_FLAG_COLUMN: 6,
  SHEET_NAME: 'Sheet1',
};

function authorizeInviteSender() {
  // Triggers OAuth consent for Gmail (send email).
  GmailApp.getInboxThreads(0, 1);
  SpreadsheetApp.getUi().alert('Gmail authorization OK. You can close this.');
}

/**
 * Menu: Extensions → Prayer City → Send invites for new rows
 * Sends for rows where InviteSent is blank (if INVITE_FLAG_COLUMN set).
 */
function sendPendingInvitesFromSheet() {
  var sh = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var sent = 0;
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var email = String(row[CONFIG.COL_EMAIL - 1] || '')
      .trim()
      .toLowerCase();
    if (!email || email.indexOf('@') < 0) continue;

    if (CONFIG.INVITE_FLAG_COLUMN > 0) {
      var flag = row[CONFIG.INVITE_FLAG_COLUMN - 1];
      if (flag === true || String(flag).toLowerCase() === 'yes' || String(flag).toLowerCase() === 'sent')
        continue;
    }

    var name = String(row[CONFIG.COL_NAME - 1] || '');
    var phone = String(row[CONFIG.COL_PHONE - 1] || '');
    var notes = String(row[CONFIG.COL_NOTES - 1] || '');
    var shifts = String(row[CONFIG.COL_SHIFTS - 1] || '');
    var sheetRowId = String(r + 1);

    var payload = {
      email: email,
      name: name,
      phone: phone,
      notes: notes,
      shifts: shifts,
      sheetRowId: sheetRowId,
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Invite-Secret': CONFIG.INVITE_SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    var resp = UrlFetchApp.fetch(CONFIG.INVITE_FUNCTION_URL, options);
    var code = resp.getResponseCode();
    var text = resp.getContentText();
    if (code !== 200) {
      throw new Error('Row ' + (r + 1) + ' failed: HTTP ' + code + ' ' + text);
    }
    var json = JSON.parse(text);
    if (!json.signInLink) throw new Error('No signInLink for row ' + (r + 1));

    var subject = 'Your Houston Prayer City volunteer dashboard link';
    var body =
      'Hi ' +
      (name || 'friend') +
      ',\n\n' +
      'Thank you for signing up to serve! Use this secure one-time link to open your volunteer dashboard and (optional) set a password for later:\n\n' +
      json.signInLink +
      '\n\n' +
      'If the button above does not work, copy the entire line into your browser.\n\n' +
      'Blessings,\n' +
      'Houston World Cup Prayer City Movement';

    GmailApp.sendEmail(email, subject, body);
    if (CONFIG.INVITE_FLAG_COLUMN > 0) {
      sh.getRange(r + 1, CONFIG.INVITE_FLAG_COLUMN).setValue('Sent');
    }
    sent++;
  }
  SpreadsheetApp.getUi().alert('Sent ' + sent + ' invite(s).');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Prayer City')
    .addItem('Send pending dashboard invites', 'sendPendingInvitesFromSheet')
    .addToUi();
}
