/**
 * Prayer City: Gmail → Sheet → Firebase sign-in link → Gmail to volunteer
 *
 * Column F (SHIFTS_COLUMN) = volunteer’s chosen timeslot + position (one field).
 * Column H = Tent 1–7 assigned automatically: balances headcount and spreads the
 * same shift text across tents so every tent gets a mix of shifts as signups grow.
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
  /** Column H: assigned automatically as Tent 1–7 (balanced across shifts in col F). */
  TENT_COLUMN: 8,
  /** Legacy / optional; timeslot + role live in column F (SHIFTS_COLUMN). Leave blank when inviting. */
  TIMESLOT_COLUMN: 9,
  POSITION_COLUMN: 10,

  /** Gmail invites (sheet + dashboard self-serve). Firebase’s own “Email me a link” is separate — change that in Firebase Console → Auth → Templates / project name. */
  EMAIL_SUBJECT_DASHBOARD: "Your volunteer dashboard link — Daughter Team",
  EMAIL_OPENING: "Dear Daughter Team,\n\n",
  EMAIL_SIGNOFF:
    "— Daughter Team\nHouston World Cup Prayer City Movement",

  /** Optional: exact tab name for volunteer rows. If "", uses the first tab in the workbook. */
  SHEET_TAB_NAME: "",
  /** How often the automatic Gmail sync runs (minutes). Must be 1, 5, 10, 15, or 30 for valid triggers. */
  GMAIL_SYNC_EVERY_MINUTES: 10,
};

function getVolunteerSheet_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (CONFIG.SHEET_TAB_NAME) {
    var byName = ss.getSheetByName(CONFIG.SHEET_TAB_NAME);
    if (byName) return byName;
  }
  return ss.getSheets()[0];
}

var TENT_COUNT_ = 7;

/** Normalize column F text so we can spread similar shifts across tents. */
function normalizeShiftKey_(shiftText) {
  var s = String(shiftText || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 200);
  if (!s || s === "not found") return "__default__";
  return s;
}

/** Parse "Tent 3", "tent 3", "3" → 1..7; else 0. */
function parseTentNumber_(cell) {
  var s = String(cell || "").trim().toLowerCase();
  var m = s.match(/tent\s*(\d+)/);
  if (m) {
    var n = parseInt(m[1], 10);
    if (n >= 1 && n <= TENT_COUNT_) return n;
  }
  m = s.match(/^(\d+)$/);
  if (m) {
    var n2 = parseInt(m[1], 10);
    if (n2 >= 1 && n2 <= TENT_COUNT_) return n2;
  }
  return 0;
}

/**
 * Pick Tent 1..7: minimize duplicate shift text in the same tent, then even headcount.
 * So tents share all shift types over time; more signups fill every tent.
 */
function computeBalancedTent_(sheet, excludeRowNum, shiftText) {
  var data = sheet.getDataRange().getValues();
  var sk = normalizeShiftKey_(shiftText);

  var tentTotals = [0, 0, 0, 0, 0, 0, 0];
  var tentShiftCounts = {};

  for (var r = 1; r < data.length; r++) {
    var rowNum = r + 1;
    if (excludeRowNum && rowNum === excludeRowNum) continue;

    var tentCell = String(data[r][CONFIG.TENT_COLUMN - 1] || "").trim();
    var t = parseTentNumber_(tentCell);
    if (t < 1 || t > TENT_COUNT_) continue;

    tentTotals[t - 1]++;

    var rowShift = normalizeShiftKey_(String(data[r][CONFIG.SHIFTS_COLUMN - 1] || ""));
    var key = t + "|" + rowShift;
    tentShiftCounts[key] = (tentShiftCounts[key] || 0) + 1;
  }

  var bestScore = Infinity;
  var candidates = [];
  for (var ti = 1; ti <= TENT_COUNT_; ti++) {
    var tot = tentTotals[ti - 1];
    var sameSk = tentShiftCounts[ti + "|" + sk] || 0;
    var score = sameSk * 100 + tot * 10;
    if (score < bestScore) {
      bestScore = score;
      candidates = [ti];
    } else if (score === bestScore) {
      candidates.push(ti);
    }
  }
  if (candidates.length === 0) return "Tent 1";
  var pick = candidates[Math.floor(Math.random() * candidates.length)];
  return "Tent " + pick;
}

/** If column H is empty, assign Tent 1–7 and write the sheet. */
function assignTentToRowIfEmpty_(sheet, rowNum, shiftText) {
  var current = String(sheet.getRange(rowNum, CONFIG.TENT_COLUMN).getValue() || "").trim();
  if (parseTentNumber_(current) >= 1) {
    return current;
  }
  var label = computeBalancedTent_(sheet, rowNum, shiftText);
  sheet.getRange(rowNum, CONFIG.TENT_COLUMN).setValue(label);
  return label;
}

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

  const sheet = getVolunteerSheet_();
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
      "Tent (auto 1–7)",
      "(optional)",
      "(optional)",
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
        "",
        "",
        "",
      ]);

      const rowNum = sheet.getLastRow();
      const tentAssigned = assignTentToRowIfEmpty_(sheet, rowNum, shifts);
      const send = sendDashboardInvite(
        name,
        email,
        phone,
        notes,
        shifts,
        String(rowNum),
        tentAssigned,
        "",
        ""
      );
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
/** timeslot/position are legacy; shifts (column F) is the source of truth. */
function sendDashboardInvite(name, email, phone, notes, shifts, sheetRowId, tent, timeslot, position) {
  if (!email || email === "Not found") {
    return { ok: false, reason: "invalid email" };
  }

  email = String(email).trim();
  tent = tent != null ? String(tent).trim() : "";
  timeslot = timeslot != null ? String(timeslot).trim() : "";
  position = position != null ? String(position).trim() : "";

  const payload = {
    email: email,
    name: name || "",
    phone: phone || "",
    notes: notes || "Signed up via form",
    shifts: shifts || "",
    sheetRowId: sheetRowId || "",
    tent: tent,
    timeslot: timeslot,
    position: position,
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
// 3. MENU + automatic Gmail sync (time-driven trigger)
// =============================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🙏 Prayer City")
    .addItem("Sync Gmail & send new invites", "extractLeadEmailsToSheet")
    .addItem("Send pending dashboard invites", "sendPendingInvites")
    .addSeparator()
    .addItem("Rebalance all tents (column H)", "rebalanceAllTents")
    .addSeparator()
    .addItem("Turn ON auto-sync (timer)", "installGmailPipelineTrigger")
    .addItem("Turn OFF auto-sync", "removeGmailPipelineTrigger")
    .addToUi();
}

/**
 * Run once from the sheet menu (or editor ▶) to enable automatic runs.
 * Uses CONFIG.GMAIL_SYNC_EVERY_MINUTES (1, 5, 10, 15, or 30).
 */
function installGmailPipelineTrigger() {
  var n = parseInt(CONFIG.GMAIL_SYNC_EVERY_MINUTES, 10) || 10;
  var allowed = [1, 5, 10, 15, 30];
  if (allowed.indexOf(n) === -1) {
    n = 10;
  }
  var fn = "extractLeadEmailsToSheet";
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger(fn).timeBased().everyMinutes(n).create();
  var msg =
    "Automatic sync is ON.\n\n" +
    fn +
    " will run every " +
    n +
    " minutes (while this account can run triggers).\nCheck Executions if something fails.";
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
  Logger.log("installGmailPipelineTrigger: every " + n + " min");
}

function removeGmailPipelineTrigger() {
  var fn = "extractLeadEmailsToSheet";
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) {
      ScriptApp.deleteTrigger(t);
    }
  });
  var msg = "Automatic sync is OFF (no more time triggers for " + fn + ").";
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

/**
 * One-time: clears column H for all data rows, then assigns Tent 1–7 in sheet order
 * using the same balance rules as new invites (column F = shift text).
 * Does not send email. Firebase updates when you next call invVolunteer (e.g. pending send).
 */
function rebalanceAllTents() {
  var sheet = getVolunteerSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    try {
      SpreadsheetApp.getUi().alert("No data rows.");
    } catch (e) {
      Logger.log("No data rows.");
    }
    return;
  }

  var ui = SpreadsheetApp.getUi();
  var confirm;
  try {
    confirm = ui.alert(
      "Rebalance all tents?",
      "Column H will be cleared, then Tent 1–7 reassigned for every row with a valid email (using column F).\n\n" +
        "This does not email anyone. To update Firebase for those volunteers, run Send pending dashboard invites for rows that still need a link, or rely on the next invite flow.\n\n" +
        "Continue?",
      ui.ButtonSet.YES_NO
    );
  } catch (e) {
    Logger.log("Open the Google Sheet and use 🙏 Prayer City → Rebalance all tents (column H).");
    return;
  }
  if (confirm !== ui.Button.YES) {
    return;
  }

  var lastRow = sheet.getLastRow();
  var cTent = CONFIG.TENT_COLUMN;
  for (var r = 2; r <= lastRow; r++) {
    sheet.getRange(r, cTent).clearContent();
  }

  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var email = String(data[i][CONFIG.EMAIL_COLUMN - 1] || "").trim();
    if (!email || email === "Not found") {
      continue;
    }
    var shifts = String(data[i][CONFIG.SHIFTS_COLUMN - 1] || "").trim();
    var rowNum = i + 1;
    var label = computeBalancedTent_(sheet, rowNum, shifts);
    sheet.getRange(rowNum, cTent).setValue(label);
    count++;
  }

  var doneMsg = "Done. Reassigned tents for " + count + " row(s).";
  try {
    ui.alert(doneMsg);
  } catch (e) {
    Logger.log(doneMsg);
  }
  Logger.log(doneMsg);
}

function sendPendingInvites() {
  const sheet = getVolunteerSheet_();
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
    const rowIndex = i + 1;
    let tent = String(data[i][CONFIG.TENT_COLUMN - 1] || "").trim();
    if (!parseTentNumber_(tent)) {
      tent = assignTentToRowIfEmpty_(sheet, rowIndex, shifts);
    }

    const send = sendDashboardInvite(name, email, phone, notes, shifts, String(rowIndex), tent, "", "");
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
