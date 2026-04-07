/**
 * Prayer City: Gmail → Sheet → Firebase sign-in link → Gmail to volunteer
 *
 * FIX vs older snippet: sendDashboardInvite MUST call GmailApp.sendEmail(signInLink).
 * Firebase only creates the link; it does not email the volunteer.
 *
 * SPREADSHEET_ID must be ONLY the id string from the URL:
 *   https://docs.google.com/spreadsheets/d/THIS_ID_ONLY/edit
 * (not /edit?gid=...)
 */

// =============================================
// CONFIGURATION
// =============================================
const CONFIG = {
  // ID only: between /d/ and /edit in the Sheet URL (no /edit?gid=...).
  SPREADSHEET_ID: "1x0OQfAs5z3Ryy7VBdV_fmmRr-yWCT5bEpCNSfEsonXk",
  INVITE_FUNCTION_URL: "https://us-central1-bible-study-dashboard-99f2d.cloudfunctions.net/invVolunteer",
  INVITE_SECRET: "PrayerCity2026!InviteSecret_VolunteerHC@K9mP7qR2vT8wZ4xY6nB3cD5eF9gH1jL",
  // Same value as Firebase secret SELF_SERVE_MAIL_SECRET (used by volunteerSelfServeSignInMail → doPost).
  SELF_SERVE_MAIL_SECRET: "Houstonworldcuprayercity2026Piccyf*k1990",

  DATE_COLUMN: 1,
  NAME_COLUMN: 2,
  EMAIL_COLUMN: 3,
  PHONE_COLUMN: 4,
  NOTES_COLUMN: 5,
  SHIFTS_COLUMN: 6,
  STATUS_COLUMN: 7,

  /** Gmail invites (sheet + dashboard self-serve). Firebase’s own “Email me a link” is separate — change that in Firebase Console → Auth → Templates / project name. */
  EMAIL_SUBJECT_DASHBOARD: "Your volunteer dashboard link — Daughter Team",
  EMAIL_OPENING: "Dear Daughter Team,\n\n",
  EMAIL_SIGNOFF:
    "— Daughter Team\nHouston World Cup Prayer City Movement",
};

// =============================================
// 0. Run once: authorize Gmail send + read
// Safe to run from the Apps Script editor (▶ Run). Do NOT use getUi() here —
// getUi() only works when the script runs from the spreadsheet (e.g. custom menu).
// =============================================
function authorizeInviteSender() {
  GmailApp.getInboxThreads(0, 1);
  Logger.log("Gmail access OK. Check Executions log. Save the project (Ctrl+S).");
}

// =============================================
// 1. EXTRACT EMAILS FROM GMAIL & LOG TO SHEET
// =============================================
function extractLeadEmailsToSheet() {
  const FROM_EMAIL = "submissions@formsubmit.co";
  const SUBJECT_CONTAINS = "New World Cup Volunteer Signup";
  const LABEL_NAME = "Processed-FormSubmissions";
  const MAX_THREADS = 50;

  const searchQuery = 'from:' + FROM_EMAIL + ' "' + SUBJECT_CONTAINS + '" -label:' + LABEL_NAME;
  Logger.log("Searching: " + searchQuery);

  const sheet = SpreadsheetApp.getActiveSheet();
  const threads = GmailApp.search(searchQuery, 0, MAX_THREADS);
  const messages = threads.flatMap(function (t) {
    return t.getMessages();
  });

  let lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    sheet.appendRow([
      "Date",
      "name",
      "email",
      "phone",
      "notes",
      "selected_shifts",
      "Status",
    ]);
  }

  let newRowsAdded = 0;
  let label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(LABEL_NAME);
  }

  messages.forEach(function (msg) {
    const body = msg.getPlainBody();
    const lines = body
      .split("\n")
      .map(function (l) {
        return l.trim();
      })
      .filter(function (l) {
        return l !== "";
      });

    let name = "";
    let email = "";
    let phone = "";
    let notes = "";
    let shifts = "";
    let currentField = null;
    let valueLines = [];

    function assignField(field, value) {
      if (field === "name") name = value;
      else if (field === "email") email = value;
      else if (field === "phone") phone = value;
      else if (field === "notes") notes = value;
      else if (field.indexOf("selected_shifts") !== -1 || field.indexOf("shifts") !== -1) {
        shifts = value.trim();
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      if (lower.match(/^\*[a-z_ ]+:\s*\*$/i)) {
        if (currentField && valueLines.length > 0) {
          assignField(currentField, valueLines.join("\n").trim());
        }
        currentField = null;
        valueLines = [];
        const match = line.match(/^\*([^*]+):\s*\*$/i);
        if (match) {
          currentField = match[1]
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
        }
        continue;
      }

      if (currentField && !line.startsWith("---") && !line.match(/^\*[a-z]/i)) {
        valueLines.push(line);
      }

      if (line.startsWith("---")) {
        if (currentField && valueLines.length > 0) {
          assignField(currentField, valueLines.join("\n").trim());
        }
        currentField = null;
        valueLines = [];
      }
    }

    if (currentField && valueLines.length > 0) {
      assignField(currentField, valueLines.join("\n").trim());
    }

    if (email && email !== "Not found") {
      sheet.appendRow([
        msg.getDate(),
        name || "Not found",
        email || "Not found",
        phone || "Not found",
        notes || "",
        shifts || "Not found",
        "Pending",
      ]);

      const rowNum = sheet.getLastRow();
      const send = sendDashboardInvite(name, email, phone, notes, shifts, String(rowNum));
      if (send.ok) {
        sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Invited");
        msg.getThread().addLabel(label);
        newRowsAdded++;
      } else {
        Logger.log("Row " + rowNum + " invite/email failed: " + send.reason);
        sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Invite failed — see log");
      }
    }
  });

  Logger.log("Finished. New rows processed: " + newRowsAdded);
}

// =============================================
// 2. FIREBASE LINK + actually email the volunteer
// =============================================
function sendDashboardInvite(name, email, phone, notes, shifts, sheetRowId) {
  if (!email || email === "Not found") {
    return { ok: false, reason: "invalid email" };
  }

  email = String(email).trim();

  const payload = {
    email: email,
    name: name || "",
    phone: phone || "",
    notes: notes || "Signed up via form",
    shifts: shifts || "",
    sheetRowId: sheetRowId || "",
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "X-Invite-Secret": CONFIG.INVITE_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  let response;
  try {
    response = UrlFetchApp.fetch(CONFIG.INVITE_FUNCTION_URL, options);
  } catch (e) {
    return { ok: false, reason: String(e) };
  }

  const code = response.getResponseCode();
  const text = response.getContentText();

  if (code !== 200) {
    return { ok: false, reason: "HTTP " + code + " " + text };
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: "Bad JSON: " + text };
  }

  if (!result.ok || !result.signInLink) {
    return { ok: false, reason: result.error || "no signInLink in response" };
  }

  const subject = CONFIG.EMAIL_SUBJECT_DASHBOARD;
  var body =
    CONFIG.EMAIL_OPENING +
    "Thank you for signing up! Open this link to sign in to your volunteer dashboard (you can set a password on that page for next time):\n\n" +
    result.signInLink +
    "\n\n" +
    "IMPORTANT: If the site asks you to confirm your email, type exactly this address (same one this message was sent to):\n" +
    email +
    "\n\n" +
    "If the link does not open, copy the whole URL above into your browser.\n\n" +
    CONFIG.EMAIL_SIGNOFF;

  try {
    GmailApp.sendEmail(email, subject, body);
  } catch (e) {
    return { ok: false, reason: "GmailApp.sendEmail failed: " + String(e) };
  }

  Logger.log("Email delivered to " + email);
  return { ok: true };
}

// =============================================
// 3. MENU — manual resend for Pending rows
// =============================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🙏 Prayer City")
    .addItem("Send pending dashboard invites", "sendPendingInvites")
    .addToUi();
}

function sendPendingInvites() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  let sentCount = 0;
  let errors = 0;

  for (let i = 1; i < data.length; i++) {
    const status = String(data[i][CONFIG.STATUS_COLUMN - 1] || "")
      .trim()
      .toLowerCase();
    const email = String(data[i][CONFIG.EMAIL_COLUMN - 1] || "").trim();

    if (!email || email === "Not found") continue;
    if (status !== "pending" && status !== "") continue;

    const name = String(data[i][CONFIG.NAME_COLUMN - 1] || "").trim();
    const phone = String(data[i][CONFIG.PHONE_COLUMN - 1] || "").trim();
    const notes = String(data[i][CONFIG.NOTES_COLUMN - 1] || "").trim();
    const shifts = String(data[i][CONFIG.SHIFTS_COLUMN - 1] || "").trim();

    const send = sendDashboardInvite(name, email, phone, notes, shifts, String(i + 1));
    if (send.ok) {
      sheet.getRange(i + 1, CONFIG.STATUS_COLUMN).setValue("Invited");
      sentCount++;
    } else {
      errors++;
      Logger.log("Row " + (i + 1) + ": " + send.reason);
    }
    Utilities.sleep(500);
  }

  var summary = "Done.\nSent: " + sentCount + "\nErrors: " + errors + "\n(See Executions log for details.)";
  try {
    SpreadsheetApp.getUi().alert(summary);
  } catch (e) {
    Logger.log(summary);
    Logger.log("(No popup: run this from the Sheet menu 🙏 Prayer City → Send pending…, not only from the script editor.)");
  }
}

// =============================================
// 4. WEB APP — dashboard “Email me a sign-in link” (POST from Cloud Function)
// Deploy: Deploy → New deployment → Select type: Web app
// Execute as: Me  |  Who has access: Anyone
// Copy the Web app URL into Firebase secret APPS_SCRIPT_SELF_SERVE_MAIL_URL
// =============================================
function doPost(e) {
  var data = {};
  try {
    data = JSON.parse((e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return jsonResponse({ ok: false, error: "invalid_json" });
  }

  if (data.type !== "self_serve_signin") {
    return jsonResponse({ ok: false, error: "bad_type" });
  }
  if (data.secret !== CONFIG.SELF_SERVE_MAIL_SECRET) {
    return jsonResponse({ ok: false, error: "unauthorized" });
  }

  var email = String(data.email || "")
    .trim()
    .toLowerCase();
  var signInLink = String(data.signInLink || "").trim();
  if (!email || !signInLink) {
    return jsonResponse({ ok: false, error: "missing_fields" });
  }

  var subject = CONFIG.EMAIL_SUBJECT_DASHBOARD;
  var plain =
    CONFIG.EMAIL_OPENING +
    "Thank you for signing up! Open this link to sign in to your volunteer dashboard (you can set a password on that page for next time):\n\n" +
    signInLink +
    "\n\nIf the site asks you to confirm your email, type exactly:\n" +
    email +
    "\n\nIf the link does not open, copy the whole URL into your browser.\n\n" +
    CONFIG.EMAIL_SIGNOFF;

  var safeHref = signInLink.replace(/"/g, "&quot;");
  var openLine =
    "<p>" + CONFIG.EMAIL_OPENING.split("\n").join(" ").trim() + "</p>";
  var htmlBody =
    openLine +
    "<p>Thank you for signing up! Open this link to sign in to your volunteer dashboard (you can set a password on that page for next time):</p>" +
    "<p><a href=\"" +
    safeHref +
    '">Sign in to dashboard</a></p><p>If asked for your email, use exactly: ' +
    email.replace(/</g, "") +
    "</p>" +
    "<p>If the link does not open, copy the whole URL into your browser.</p>" +
    "<p>" +
    CONFIG.EMAIL_SIGNOFF.replace(/\n/g, "<br>") +
    "</p>";

  try {
    GmailApp.sendEmail(email, subject, plain, { htmlBody: htmlBody });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }

  return jsonResponse({ ok: true });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
