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
  MARK_UNDELIVERABLE_URL:
    "https://us-central1-bible-study-dashboard-99f2d.cloudfunctions.net/markEmailUndeliverable",
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
  /** Column K: T-shirt size from dashboard (S, M, L, X). */
  TSHIRT_SIZE_COLUMN: 11,

  /** Notified when a volunteer saves a T-shirt size on the dashboard. */
  TEAM_NOTIFY_EMAIL: "ddbs.htx@gmail.com",

  /** Never send dashboard invites or other mail to these addresses. */
  EMAIL_BLOCKLIST: ["marykaarto@gmail.com", "emcocke@gmail.com", "ellenwright051084@gmail.com"],

  /** Gmail label applied after a bounce thread is processed (avoids re-scanning). */
  BOUNCE_PROCESSED_LABEL: "PrayerCity-Bounce-Processed",

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

function isEmailBlocked_(email) {
  var e = String(email || "")
    .trim()
    .toLowerCase();
  if (!e) return false;
  var list = CONFIG.EMAIL_BLOCKLIST || [];
  for (var i = 0; i < list.length; i++) {
    if (String(list[i] || "").trim().toLowerCase() === e) return true;
  }
  return false;
}

/**
 * Persistent registry of addresses that bounced / are undeliverable. Stored in
 * Script Properties so it survives every run and is checked at the moment of
 * sending — once an address is in here it is NEVER emailed again.
 */
var UNDELIVERABLE_PROP_KEY_ = "PC_UNDELIVERABLE_EMAILS";
/** Cached registry for the current execution (loaded once, refreshed on add). */
var UNDELIVERABLE_CACHE_ = null;

function getUndeliverableRegistry_() {
  if (UNDELIVERABLE_CACHE_) return UNDELIVERABLE_CACHE_;
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(UNDELIVERABLE_PROP_KEY_);
    var obj = raw ? JSON.parse(raw) : {};
    UNDELIVERABLE_CACHE_ = obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    UNDELIVERABLE_CACHE_ = {};
  }
  return UNDELIVERABLE_CACHE_;
}

function addUndeliverableEmails_(emails) {
  var list = Array.isArray(emails) ? emails : [emails];
  var reg = getUndeliverableRegistry_();
  var added = 0;
  list.forEach(function (e) {
    var x = String(e || "")
      .trim()
      .toLowerCase();
    if (!x || x.indexOf("@") < 1) return;
    if (!reg[x]) {
      reg[x] = Date.now();
      added++;
    }
  });
  if (added) {
    PropertiesService.getScriptProperties().setProperty(
      UNDELIVERABLE_PROP_KEY_,
      JSON.stringify(reg)
    );
    UNDELIVERABLE_CACHE_ = reg;
  }
  return added;
}

/** Registry-only check (does not consult the static blocklist). */
function isInUndeliverableRegistry_(email) {
  var e = String(email || "")
    .trim()
    .toLowerCase();
  if (!e) return false;
  return !!getUndeliverableRegistry_()[e];
}

/** True if this address must never receive mail (blocklisted OR previously bounced). */
function isUndeliverableEmail_(email) {
  var e = String(email || "")
    .trim()
    .toLowerCase();
  if (!e) return false;
  if (isEmailBlocked_(e)) return true;
  return isInUndeliverableRegistry_(e);
}

/**
 * Quota/rate-limit errors are temporary; bad-address bounces are permanent.
 * @returns {'permanent'|'temporary'}
 */
function classifySendError_(err) {
  var msg = String((err && err.message) || err || "").toLowerCase();
  if (
    /quota|rate limit|too many|user-rate|service invoked too many|limit exceeded|daily sending|temporarily unavailable|try again later|timeout|timed out|internal error|backend error|urlfetch|blocked|suspended|minute|per day|mail service|gmail service|email send|limit:|exceeded/.test(
      msg
    )
  ) {
    return "temporary";
  }
  if (
    /invalid\s+(email|address|recipient)|bad\s+recipient|no\s+such\s+(user|mailbox|recipient)|user\s+unknown|mailbox\s+not\s+found|recipient.*rejected|5\.1\.1|550\s*5\.1\.1|address\s+not\s+found|undeliver|delivery\s+status\s+notification|mail\s+delivery\s+failed|does\s+not\s+exist|account\s+disabled|recipient\s+address\s+rejected|permanent\s+error/.test(
      msg
    )
  ) {
    return "permanent";
  }
  return "temporary";
}

/** Volunteer sheet statuses that must never receive mail again. */
function isForeverSkipVolunteerStatus_(status) {
  var s = String(status || "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (/^removed\s*[—\-]/.test(s)) return true;
  if (/^skip\s*[—\-]/.test(s)) return true;
  if (/undeliver/.test(s)) return true;
  if (/^invite failed/.test(s)) return true;
  if (/^failed/i.test(s) && !/retry/.test(s)) return true;
  return false;
}

function markVolunteerUndeliverableOnSheet_(email, detail) {
  var target = String(email || "")
    .trim()
    .toLowerCase();
  if (!target) return 0;
  var sheet = getVolunteerSheet_();
  var data = sheet.getDataRange().getValues();
  var note = detail ? String(detail).replace(/\s+/g, " ").slice(0, 48) : "";
  var status = "Skip — undeliverable" + (note ? " (" + note + ")" : "");
  var n = 0;
  for (var r = 1; r < data.length; r++) {
    var rowEmail = String(data[r][CONFIG.EMAIL_COLUMN - 1] || "")
      .trim()
      .toLowerCase();
    if (rowEmail !== target) continue;
    sheet.getRange(r + 1, CONFIG.STATUS_COLUMN).setValue(status);
    n++;
  }
  return n;
}

/** Tell Firebase to stop daily digest + all mail for this address. */
function syncUndeliverableToFirestore_(emails, reason, source) {
  var url = String(CONFIG.MARK_UNDELIVERABLE_URL || "").trim();
  var secret = String(CONFIG.SELF_SERVE_MAIL_SECRET || "").trim();
  if (!url || !secret) return { ok: false, reason: "not_configured" };

  var list = [];
  if (Array.isArray(emails)) {
    emails.forEach(function (e) {
      var x = String(e || "")
        .trim()
        .toLowerCase();
      if (x && x.indexOf("@") > 0) list.push(x);
    });
  }
  if (!list.length) return { ok: false, reason: "no_emails" };

  try {
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        secret: secret,
        emails: list,
        reason: reason || "undeliverable",
        source: source || "apps_script",
      }),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    var text = res.getContentText();
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
  if (code !== 200) {
    return { ok: false, reason: "HTTP " + code + " " + text };
  }
  return { ok: true };
}

function stopMailToUndeliverableAddress_(email, detail, source) {
  var e = String(email || "")
    .trim()
    .toLowerCase();
  if (!e || e.indexOf("@") < 1) return;
  addUndeliverableEmails_([e]);
  markVolunteerUndeliverableOnSheet_(e, detail);
  syncUndeliverableToFirestore_([e], detail || "undeliverable", source || "apps_script");
}

/**
 * Scan Gmail for delivery failures (bounces) and stop future mail to those addresses.
 * Run daily or from the sheet menu after sends.
 */
function processGmailDeliveryFailures_() {
  var labelName = String(CONFIG.BOUNCE_PROCESSED_LABEL || "PrayerCity-Bounce-Processed");
  var processedLabel = GmailApp.getUserLabelByName(labelName);
  if (!processedLabel) {
    processedLabel = GmailApp.createLabel(labelName);
  }

  var queries = [
    'from:(mailer-daemon OR postmaster) newer_than:14d -label:' + labelName,
    'subject:("Address not found" OR "Delivery Status Notification" OR undelivered OR "Mail Delivery Failed") newer_than:14d -label:' +
      labelName,
  ];

  var seen = {};
  var marked = 0;
  var threadsScanned = 0;

  queries.forEach(function (q) {
    var threads = GmailApp.search(q, 0, 40);
    threads.forEach(function (thread) {
      threadsScanned++;
      var bodies = thread.getMessages().map(function (m) {
        return (m.getPlainBody() || "") + "\n" + (m.getSubject() || "");
      });
      var blob = bodies.join("\n").toLowerCase();
      if (
        !/address not found|undeliver|mail delivery failed|user unknown|mailbox not found|550 5\.1\.1|does not exist|recipient address rejected|delivery status notification/.test(
          blob
        )
      ) {
        thread.addLabel(processedLabel);
        return;
      }

      var found = extractFailedRecipientEmailsFromBounce_(bodies.join("\n"));
      found.forEach(function (addr) {
        if (seen[addr]) return;
        seen[addr] = true;
        if (isEmailBlocked_(addr)) return;
        stopMailToUndeliverableAddress_(addr, "gmail bounce", "gmail_bounce");
        marked++;
      });
      thread.addLabel(processedLabel);
    });
  });

  return { threadsScanned: threadsScanned, marked: marked };
}

/** Pull likely failed recipient emails from a bounce message body. */
function extractFailedRecipientEmailsFromBounce_(text) {
  var out = [];
  var seen = {};
  var s = String(text || "");
  var patterns = [
    /(?:final-recipient|original-recipient|to|recipient)[:\s]+(?:rfc822;\s*)?<?([\w.+-]+@[\w.-]+\.[a-z]{2,24})>?/gi,
    /wasn't delivered to\s+<?([\w.+-]+@[\w.-]+\.[a-z]{2,24})>?/gi,
    /couldn't be found[^@\n]*<?([\w.+-]+@[\w.-]+\.[a-z]{2,24})>?/gi,
    /<?([\w.+-]+@[\w.-]+\.[a-z]{2,24})>?\s+because the address/gi,
  ];
  patterns.forEach(function (re) {
    var m;
    while ((m = re.exec(s)) !== null) {
      var e = String(m[1] || "")
        .trim()
        .toLowerCase();
      if (!e || seen[e]) continue;
      if (/mailer-daemon|postmaster|noreply|no-reply|prayercity|ddbs\.htx|google\.com/.test(e)) continue;
      seen[e] = true;
      out.push(e);
    }
  });
  return out;
}

function processGmailDeliveryFailuresMenu_() {
  var r = processGmailDeliveryFailures_();
  var msg =
    "Gmail bounce scan complete.\n\nThreads scanned: " +
    r.threadsScanned +
    "\nAddresses marked undeliverable (no more mail): " +
    r.marked +
    "\n\nThese are synced to Firebase so daily digests will skip them too.";
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

/** Mark existing failed / undeliverable volunteer rows and sync to Firebase. */
function applyUndeliverableStatusesOnVolunteerSheet_() {
  var sheet = getVolunteerSheet_();
  var data = sheet.getDataRange().getValues();
  var emails = [];
  var sheetMarked = 0;

  for (var r = 1; r < data.length; r++) {
    var status = String(data[r][CONFIG.STATUS_COLUMN - 1] || "").trim();
    var email = String(data[r][CONFIG.EMAIL_COLUMN - 1] || "")
      .trim()
      .toLowerCase();
    if (!email || email.indexOf("@") < 1) continue;
    if (isEmailBlocked_(email)) continue;

    if (isForeverSkipVolunteerStatus_(status)) {
      if (!/^skip\s*[—\-]\s*undeliverable/i.test(status)) {
        sheet.getRange(r + 1, CONFIG.STATUS_COLUMN).setValue("Skip — undeliverable (prior failure)");
        sheetMarked++;
      }
      emails.push(email);
    }
  }

  var unique = [];
  var seen = {};
  emails.forEach(function (e) {
    if (!seen[e]) {
      seen[e] = true;
      unique.push(e);
    }
  });

  var sync = unique.length
    ? syncUndeliverableToFirestore_(unique, "prior sheet failure", "volunteer_sheet")
    : { ok: true };

  var msg =
    "Volunteer sheet: marked " +
    sheetMarked +
    " row(s) undeliverable.\nSynced to Firebase: " +
    unique.length +
    " address(es)." +
    (sync.ok ? "" : "\nFirebase sync issue: " + (sync.reason || "unknown"));
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

function installGmailBounceScanTrigger_() {
  var fn = "processGmailDeliveryFailures_";
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
  // Every 4 hours so a bounce is caught well before the next daily digest.
  ScriptApp.newTrigger(fn).timeBased().everyHours(4).create();
  // Also seed the registry from addresses already marked undeliverable so we
  // never email previously-bounced people again, even before the next scan.
  var seeded = seedUndeliverableRegistryFromSheet_();
  var msg =
    "Automatic Gmail bounce scan is ON (every 4 hours).\n\n" +
    "Seeded " + seeded + " previously-undeliverable address(es) into the do-not-send registry.\n\n" +
    "Bounced addresses will not be emailed again (digests, invites, or sign-in links).";
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

/**
 * Backfill the do-not-send registry from every volunteer-sheet row already in a
 * "forever skip" state (undeliverable / failed / removed) and re-sync them to
 * Firebase. Safe to run anytime. Returns the number of addresses added.
 */
function seedUndeliverableRegistryFromSheet_() {
  var sheet = getVolunteerSheet_();
  var data = sheet.getDataRange().getValues();
  var emails = [];
  var seen = {};
  for (var r = 1; r < data.length; r++) {
    var status = String(data[r][CONFIG.STATUS_COLUMN - 1] || "").trim();
    var email = String(data[r][CONFIG.EMAIL_COLUMN - 1] || "")
      .trim()
      .toLowerCase();
    if (!email || email.indexOf("@") < 1) continue;
    if (!isForeverSkipVolunteerStatus_(status)) continue;
    if (seen[email]) continue;
    seen[email] = true;
    emails.push(email);
  }
  var added = addUndeliverableEmails_(emails);
  if (emails.length) {
    syncUndeliverableToFirestore_(emails, "seed from sheet", "registry_seed");
  }
  // Also seed from the PastLeads (sign-up outreach) sheet so previously-bounced
  // sign-up addresses are ignored too.
  try {
    if (typeof seedUndeliverableRegistryFromPastLeads_ === "function") {
      added += seedUndeliverableRegistryFromPastLeads_();
    }
  } catch (e) {
    Logger.log("seed from past leads: " + e);
  }
  return added;
}

/** Menu: seed the do-not-send registry now (does not change triggers). */
function seedUndeliverableRegistryMenu_() {
  var added = seedUndeliverableRegistryFromSheet_();
  var total = Object.keys(getUndeliverableRegistry_()).length;
  var msg =
    "Do-not-send registry updated.\n\n" +
    "Newly added from sheet: " + added + "\n" +
    "Total addresses that will never be emailed: " + total;
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

function removeGmailBounceScanTrigger_() {
  var fn = "processGmailDeliveryFailures_";
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
  try {
    SpreadsheetApp.getUi().alert("Daily Gmail bounce scan is OFF.");
  } catch (e) {
    Logger.log("Daily Gmail bounce scan is OFF.");
  }
}

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
        if (send.permanent) {
          stopMailToUndeliverableAddress_(email, send.reason, "invite_send");
          sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Skip — undeliverable");
        } else {
          sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Invite failed — see log");
        }
      }
    }
  });

  Logger.log("Finished. New rows processed: " + newRowsAdded);
}

// =============================================
// 2. FIREBASE LINK + actually email the volunteer
// =============================================
/** POST row data to invVolunteer → Firestore onboarding + sign-in link. */
function requestDashboardSignInLink_(payload) {
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

  return { ok: true, signInLink: result.signInLink };
}

/** timeslot/position are legacy; shifts (column F) is the source of truth. */
function sendDashboardInvite(name, email, phone, notes, shifts, sheetRowId, tent, timeslot, position) {
  if (!email || email === "Not found") {
    return { ok: false, reason: "invalid email", permanent: true };
  }

  email = String(email).trim().toLowerCase();
  if (isUndeliverableEmail_(email)) {
    return { ok: false, reason: "blocked/undeliverable — do not email", permanent: true };
  }
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

  const linkResult = requestDashboardSignInLink_(payload);
  if (!linkResult.ok) {
    return linkResult;
  }

  const subject = CONFIG.EMAIL_SUBJECT_DASHBOARD;
  var body =
    CONFIG.EMAIL_OPENING +
    "Thank you for signing up! Open this link to sign in to your volunteer dashboard (you can set a password on that page for next time):\n\n" +
    linkResult.signInLink +
    "\n\n" +
    "IMPORTANT: If the site asks you to confirm your email, type exactly this address (same one this message was sent to):\n" +
    email +
    "\n\n" +
    "If the link does not open, copy the whole URL above into your browser.\n\n" +
    CONFIG.EMAIL_SIGNOFF;

  try {
    GmailApp.sendEmail(email, subject, body);
  } catch (e) {
    var err = "GmailApp.sendEmail failed: " + String(e);
    var permanent = classifySendError_(e) === "permanent";
    if (permanent) {
      stopMailToUndeliverableAddress_(email, err, "invite_send");
    }
    return { ok: false, reason: err, permanent: permanent };
  }

  Logger.log("Email delivered to " + email);
  return { ok: true };
}

/**
 * Rich welcome for volunteers who signed up on another site (e.g. jesusmarchhtx.com).
 * Adds a sheet row if missing, creates Firebase onboarding, emails dashboard + Prayer City guide.
 */
function inviteCrossSiteVolunteer_(opts) {
  opts = opts || {};
  var firstName = String(opts.firstName || "").trim();
  var lastName = String(opts.lastName || "").trim();
  var fullName = String(opts.fullName || (firstName + " " + lastName).trim()).trim();
  var email = String(opts.email || "").trim();
  var phone = normalizePhoneForSheet_(opts.phone);
  var role = String(opts.role || "Prayer Partners").trim();
  var sourceSite = String(opts.sourceSite || "jesusmarchhtx.com").trim();
  var notes =
    String(opts.notes || "").trim() ||
    "Signed up via " + sourceSite + " — " + role + ".";
  var shifts =
    String(opts.shifts || "").trim() ||
    role + " — signed up via " + sourceSite + " (choose serve dates on dashboard or reply to team)";

  if (!email || email === "Not found") {
    return { ok: false, reason: "invalid email" };
  }

  var sheet = getVolunteerSheet_();
  var rowNum = findRowByEmail_(sheet, email);
  if (!rowNum) {
    rowNum = sheet.getLastRow() + 1;
    var today = Utilities.formatDate(new Date(), "America/Chicago", "M/d/yyyy HH:mm:ss");
    sheet.getRange(rowNum, CONFIG.DATE_COLUMN).setValue(today);
    sheet.getRange(rowNum, CONFIG.NAME_COLUMN).setValue(fullName);
    sheet.getRange(rowNum, CONFIG.EMAIL_COLUMN).setValue(email);
    sheet.getRange(rowNum, CONFIG.PHONE_COLUMN).setValue(phone);
    sheet.getRange(rowNum, CONFIG.NOTES_COLUMN).setValue(notes);
    sheet.getRange(rowNum, CONFIG.SHIFTS_COLUMN).setValue(shifts);
    sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("pending");
  }

  var tent = String(sheet.getRange(rowNum, CONFIG.TENT_COLUMN).getValue() || "").trim();
  if (!parseTentNumber_(tent)) {
    tent = assignTentToRowIfEmpty_(sheet, rowNum, shifts);
  }

  var payload = {
    email: email,
    name: fullName,
    phone: phone,
    notes: notes,
    shifts: shifts,
    sheetRowId: String(rowNum),
    tent: tent,
    timeslot: "",
    position: role,
  };

  var linkResult = requestDashboardSignInLink_(payload);
  if (!linkResult.ok) {
    sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Invite failed — see log");
    return linkResult;
  }

  var greeting = firstName || fullName.split(" ")[0] || "friend";
  var subject =
    greeting + ", welcome to Houston Prayer City — your volunteer dashboard";
  var body = buildCrossSiteWelcomeBody_(greeting, email, linkResult.signInLink, role, sourceSite);
  var htmlBody = buildCrossSiteWelcomeHtml_(greeting, email, linkResult.signInLink, role, sourceSite);

  try {
    GmailApp.sendEmail(email, subject, body, { htmlBody: htmlBody });
  } catch (e) {
    var err = String(e);
    if (classifySendError_(e) === "permanent") {
      stopMailToUndeliverableAddress_(email, err, "invite_send");
      sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Skip — undeliverable");
    } else {
      sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Invite failed — see log");
    }
    return { ok: false, reason: "GmailApp.sendEmail failed: " + err, permanent: classifySendError_(e) === "permanent" };
  }

  sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Invited");
  Logger.log("Cross-site welcome sent to " + email + " (row " + rowNum + ")");
  return { ok: true, rowNum: rowNum, tent: tent };
}

/** One-click: Tashanna Andrews — Prayer Partners from jesusmarchhtx.com */
function inviteTashannaAndrewsFromJesusMarch() {
  var result = inviteCrossSiteVolunteer_({
    firstName: "Tashanna",
    lastName: "Andrews",
    email: "tkishaandrews@yahoo.com",
    phone: "8325383052",
    role: "Prayer Partners",
    sourceSite: "jesusmarchhtx.com",
    notes: "Signed up via jesusmarchhtx.com — Prayer Partners. DOB 1983-02-07.",
    shifts:
      "Prayer Partners — signed up via jesusmarchhtx.com (choose World Cup serve dates on dashboard or email ddbs.htx@gmail.com)",
  });

  var msg = result.ok
    ? "Welcome email sent to Tashanna Andrews (tkishaandrews@yahoo.com).\nRow: " +
      result.rowNum +
      "\nTent: " +
      result.tent
    : "Failed: " + (result.reason || "unknown");

  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
  return result;
}

function normalizePhoneForSheet_(phone) {
  var digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.charAt(0) === "1") {
    digits = digits.slice(1);
  }
  return digits.length === 10 ? digits : String(phone || "").trim();
}

function buildCrossSiteWelcomeBody_(greeting, email, signInLink, role, sourceSite) {
  return (
    "Dear " +
    greeting +
    ",\n\n" +
    "Thank you for signing up as a " +
    role +
    " through " +
    sourceSite +
    ". We are so glad you are joining the Houston World Cup Prayer City Movement — the same heart for prayer and Gospel welcome that flows through Jesus March Houston, now serving guests at prayer tents in the NRG Stadium area during the World Cup.\n\n" +
    "WHAT IS PRAYER CITY?\n" +
    "We are welcoming well over half a million visitors to Houston with prayer tents, warm prayer partners, and counselors who point people to Jesus. Nations are coming to us — and we want many to encounter Christ and carry the gospel home.\n\n" +
    "YOUR VOLUNTEER DASHBOARD (start here)\n" +
    "Open this link to sign in and access everything you need — training, serve-day parking & tent details, T-shirt size, daily prayer/social toolkit, and your shift info:\n\n" +
    signInLink +
    "\n\n" +
    "IMPORTANT: If the site asks you to confirm your email, type exactly:\n" +
    email +
    "\n\n" +
    "You can set a password on the dashboard for next time.\n\n" +
    "BEFORE YOUR SERVE DAY\n" +
    "1. Join our virtual info session — Thursday, June 11, 2026 · 6:00 PM Central Time\n" +
    "   Zoom: https://us06web.zoom.us/j/88179064654?pwd=fGNWdDayQeRuixN5pH3AfwxdiL45Xk.1\n" +
    "2. Save your T-shirt size on the dashboard (S–X).\n" +
    "3. Read your Prayer Partners training: https://prayercityhtx.com/training/prayer-partners.html\n" +
    "4. Free street parking near the prayer tents at 1325 La Concha Lane, Houston TX. Arrive a few minutes early to find a spot.\n" +
    "5. Volunteer hours: most serve days 11:00 AM – 3:00 PM; Friday June 26 is 6:00 PM – 10:00 PM.\n" +
    "6. All prayer tents are at 1325 La Concha Lane, Houston TX. Check in with Tricia Hill, Prayer City Coordinator, for your T-shirt, volunteer tag, and briefing.\n" +
    "7. Day-of help: Tricia Hill 832-277-3831\n" +
    "   Tent map: https://www.google.com/maps/search/?api=1&query=1325%20La%20Concha%20Lane%20Houston%20TX\n\n" +
    "PICK YOUR SERVE DATES\n" +
    "If you have not chosen specific World Cup days yet, open your dashboard or reply to ddbs.htx@gmail.com and we will help you pick shifts that fit your schedule.\n\n" +
    "FAQ: https://prayercityhtx.com/faq.html\n" +
    "Volunteer hub: https://prayercityhtx.com/volunteer-hub.html\n\n" +
    "We love you and we are honored to serve Houston together.\n\n" +
    "With love,\n" +
    "Damilola\n" +
    "Prayer City HTX · Dear Daughter Bible Study Group\n" +
    "ddbs.htx@gmail.com"
  );
}

function buildCrossSiteWelcomeHtml_(greeting, email, signInLink, role, sourceSite) {
  var esc = function (s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };
  return (
    '<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:640px;line-height:1.65;padding:8px;">' +
    '<p style="font-size:17px;font-weight:800;color:#0f3d5c;">Dear ' +
    esc(greeting) +
    ",</p>" +
    '<p style="font-size:15px;color:#334155;">Thank you for signing up as a <strong>' +
    esc(role) +
    "</strong> through <strong>" +
    esc(sourceSite) +
    '</strong>. We are so glad you are joining the <strong>Houston World Cup Prayer City Movement</strong> — the same heart for prayer and Gospel welcome that flows through Jesus March Houston, now serving guests at prayer tents in the <strong>NRG Stadium area</strong> during the World Cup.</p>' +
    '<div style="margin:20px 0;padding:16px 18px;border-radius:12px;background:#e8f4fc;border:1px solid #bae6fd;">' +
    '<p style="margin:0 0 8px;font-size:12px;font-weight:900;letter-spacing:0.1em;color:#0f3d5c;text-transform:uppercase;">Your volunteer dashboard</p>' +
    '<p style="margin:0 0 14px;font-size:14px;color:#334155;">Training, serve-day parking & tent info, T-shirt size, daily toolkit, and your shifts — all in one place.</p>' +
    '<a href="' +
    esc(signInLink) +
    '" style="display:inline-block;padding:12px 20px;border-radius:9999px;background:#0f3d5c;color:#fff;font-weight:800;font-size:14px;text-decoration:none;">Open my dashboard →</a>' +
    '<p style="margin:14px 0 0;font-size:12px;color:#64748b;">Confirm email as: <strong>' +
    esc(email) +
    "</strong></p></div>" +
    '<p style="font-size:15px;color:#334155;"><strong>What is Prayer City?</strong> Prayer tents near NRG, warm welcome, prayer partners, and counselors — pointing visitors to Jesus as Houston hosts the World Cup.</p>' +
    '<p style="margin:16px 0 8px;font-size:12px;font-weight:900;letter-spacing:0.1em;color:#0d9488;text-transform:uppercase;">Before your serve day</p>' +
    '<ul style="margin:0;padding-left:1.2rem;font-size:14px;color:#334155;">' +
    "<li><strong>Thu Jun 11, 6pm CT</strong> — virtual info session on Zoom (link on your dashboard too)</li>" +
    "<li>Save your <strong>T-shirt size</strong> on the dashboard</li>" +
    '<li><a href="https://prayercityhtx.com/training/prayer-partners.html" style="color:#0f3d5c;font-weight:700;">Prayer Partners training guide</a></li>' +
    "<li><strong>Free street parking</strong> near <strong>1325 La Concha Lane, Houston TX</strong> — <a href=\"https://www.google.com/maps/search/?api=1&amp;query=1325%20La%20Concha%20Lane%20Houston%20TX\" style=\"color:#0f3d5c;font-weight:700;\">Tent &amp; parking map</a></li>" +
    "<li>Most serve days: <strong>11:00 AM – 3:00 PM</strong> · <strong>Friday June 26: 6:00 PM – 10:00 PM</strong></li>" +
    "<li>Check in with <strong>Tricia Hill</strong> at your tent</li>" +
    "<li>Day-of: Tricia Hill <a href=\"tel:8322773831\" style=\"color:#0f3d5c;\">832-277-3831</a></li>" +
    "</ul>" +
    '<p style="font-size:14px;color:#334155;">Need serve dates? Pick shifts on your dashboard or email <a href="mailto:ddbs.htx@gmail.com" style="color:#0f3d5c;">ddbs.htx@gmail.com</a>.</p>' +
    '<p style="font-size:14px;color:#334155;"><a href="https://prayercityhtx.com/faq.html" style="color:#0f3d5c;font-weight:700;">FAQ</a> · <a href="https://prayercityhtx.com/volunteer-hub.html" style="color:#0f3d5c;font-weight:700;">Volunteer hub</a></p>' +
    '<p style="margin-top:24px;font-size:15px;color:#334155;">We love you and we are honored to serve Houston together.<br/><br/>With love,<br/><strong style="color:#0f3d5c;">Damilola</strong><br/>Prayer City HTX<br/>Dear Daughter Bible Study Group</p>' +
    "</div>"
  );
}

// =============================================
// 3. MENU + automatic Gmail sync (time-driven trigger)
// =============================================
function onOpen() {
  buildPrayerCitySpreadsheetMenu_();
}

/** Single sheet menu (only one onOpen allowed per Apps Script project). */
function buildPrayerCitySpreadsheetMenu_() {
  SpreadsheetApp.getUi()
    .createMenu("🙏 Prayer City")
    .addItem("Sync Gmail & send new invites", "extractLeadEmailsToSheet")
    .addItem("Send pending dashboard invites", "sendPendingInvites")
    .addItem("Invite Tashanna Andrews (Jesus March → Prayer City)", "inviteTashannaAndrewsFromJesusMarch")
    .addSeparator()
    .addItem("Past contacts — send first outreach now", "sendPastContactsOutreach")
    .addItem("Past contacts — Turn ON daily first (7am)", "installPastOutreachFirstBatchDailyTrigger")
    .addItem("Past contacts — Turn OFF daily first", "removePastOutreachFirstBatchDailyTrigger")
    .addItem("Past contacts — Turn ON daily follow-up (9am)", "installPastOutreachDailyTrigger")
    .addItem("Past contacts — Turn OFF daily follow-up", "removePastOutreachDailyTrigger")
    .addItem("Past contacts — Turn ON ALL daily (7am + 9am)", "installPastOutreachAllDailyTriggers")
    .addItem("Past contacts — Turn OFF ALL daily", "removePastOutreachAllDailyTriggers")
    .addItem("Past contacts — restore wrongly skipped", "restoreMisclassifiedUndeliverableLeads")
    .addItem("Past contacts — apply email blocklist", "applyEmailBlocklistToPastLeads")
    .addItem("Past contacts — stop repeat failures (Mary + 3-day)", "stopChronicDeliveryFailuresOnPastLeads")
    .addSeparator()
    .addItem("SMS — Twilio setup instructions", "showTwilioSetupInstructions")
    .addItem("SMS — send test to my phone", "sendSmsTestToMyPhone")
    .addItem("SMS — send to members now", "sendSmsMembersNow")
    .addItem("SMS — send to invite list now", "sendSmsInviteNow")
    .addItem("SMS — Turn ON daily members (10am)", "installSmsMembersDailyTrigger")
    .addItem("SMS — Turn OFF daily members", "removeSmsMembersDailyTrigger")
    .addItem("SMS — Turn ON daily invite list (11am)", "installSmsInviteDailyTrigger")
    .addItem("SMS — Turn OFF daily invite list", "removeSmsInviteDailyTrigger")
    .addSeparator()
    .addItem("Rebalance all tents (column H)", "rebalanceAllTents")
    .addSeparator()
    .addItem("Email volunteer schedule to organizer", "emailVolunteerScheduleToOrganizer")
    .addItem("Remove Ellen Wright from volunteer sheet", "removeEllenWrightFromVolunteerList_")
    .addItem("Apply email blocklist to volunteer sheet", "applyEmailBlocklistToVolunteerSheet_")
    .addItem("Stop mail to failed addresses (sheet → Firebase)", "applyUndeliverableStatusesOnVolunteerSheet_")
    .addSeparator()
    .addItem("Process Gmail bounces (stop repeat sends)", "processGmailDeliveryFailuresMenu_")
    .addItem("Seed do-not-send registry from sheet", "seedUndeliverableRegistryMenu_")
    .addItem("Turn ON auto bounce scan (every 4h)", "installGmailBounceScanTrigger_")
    .addItem("Turn OFF auto bounce scan", "removeGmailBounceScanTrigger_")
    .addSeparator()
    .addItem("T-shirt sizes — verify webhook handler", "verifyTshirtWebhookHandler_")
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
    if (isForeverSkipVolunteerStatus_(status)) continue;
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
      if (send.permanent) {
        sheet.getRange(i + 1, CONFIG.STATUS_COLUMN).setValue("Skip — undeliverable");
      }
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
//
// Also handles type "volunteer_sheet_update" (POST from Firebase Callable) to
// update columns A, F, I, J and rebalance Tent (H) when shifts (F) change.
// =============================================

function findRowByEmail_(sheet, email) {
  var target = String(email || "")
    .trim()
    .toLowerCase();
  if (!target) return 0;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    var cell = String(data[r][CONFIG.EMAIL_COLUMN - 1] || "")
      .trim()
      .toLowerCase();
    if (cell === target) return r + 1;
  }
  return 0;
}

function handleVolunteerSheetUpdate_(data) {
  if (data.secret !== CONFIG.SELF_SERVE_MAIL_SECRET) {
    return jsonResponse({ ok: false, error: "unauthorized" });
  }
  var email = String(data.email || "")
    .trim()
    .toLowerCase();
  if (!email) return jsonResponse({ ok: false, error: "missing_email" });

  var dateStr = String(data.dateStr || "").trim();
  var position = String(data.position || "").trim();
  var timeslot = String(data.timeslot || "").trim();
  var shifts = String(data.shifts || "").trim();
  var shirtSize = String(data.shirtSize || "").trim().toUpperCase();
  var name = String(data.name || "").trim();

  if (!dateStr && !position && !timeslot && !shifts && !shirtSize) {
    return jsonResponse({ ok: false, error: "nothing_to_update" });
  }

  var sheet = getVolunteerSheet_();
  var rowNum = findRowByEmail_(sheet, email);
  var shirtOnly = shirtSize && !dateStr && !position && !timeslot && !shifts;
  if (!rowNum && !shirtOnly) {
    return jsonResponse({ ok: false, error: "email_not_in_sheet" });
  }

  if (dateStr && rowNum) sheet.getRange(rowNum, CONFIG.DATE_COLUMN).setValue(dateStr);
  if (position && rowNum) sheet.getRange(rowNum, CONFIG.POSITION_COLUMN).setValue(position);
  if (timeslot && rowNum) sheet.getRange(rowNum, CONFIG.TIMESLOT_COLUMN).setValue(timeslot);
  if (shifts && rowNum) {
    sheet.getRange(rowNum, CONFIG.SHIFTS_COLUMN).setValue(shifts);
    var tent = computeBalancedTent_(sheet, rowNum, shifts);
    sheet.getRange(rowNum, CONFIG.TENT_COLUMN).setValue(tent);
  }

  if (shirtSize) {
    if (shirtSize === "XL") shirtSize = "X";
    var allowed = { S: 1, M: 1, L: 1, X: 1 };
    if (!allowed[shirtSize]) {
      return jsonResponse({ ok: false, error: "invalid_shirt_size" });
    }
    if (rowNum) {
      sheet.getRange(rowNum, CONFIG.TSHIRT_SIZE_COLUMN).setValue(shirtSize);
    }
    var notifyTo = String(CONFIG.TEAM_NOTIFY_EMAIL || "").trim();
    if (notifyTo) {
      var displayName = name || email.split("@")[0] || "Volunteer";
      var subject = "T-shirt size: " + displayName + " — " + shirtSize;
      var plain =
        "A volunteer saved their Prayer City T-shirt size on the dashboard.\n\n" +
        "Name: " +
        displayName +
        "\nEmail: " +
        email +
        "\nSize: " +
        shirtSize +
        (rowNum
          ? "\nSheet row: " + rowNum
          : "\n(Sheet row not found — size not written to column K)") +
        "\n\n— Prayer City dashboard";
      try {
        GmailApp.sendEmail(notifyTo, subject, plain);
      } catch (err) {
        return jsonResponse({ ok: false, error: String(err) });
      }
    }
    if (shirtOnly) {
      return jsonResponse({
        ok: true,
        row: rowNum || 0,
        sheetRow: rowNum || 0,
        emailed: !!String(CONFIG.TEAM_NOTIFY_EMAIL || "").trim(),
      });
    }
  }

  return jsonResponse({ ok: true, row: rowNum });
}

/**
 * POST JSON from Cloud Function sendDailyVolunteerRoleDigests:
 * { type: "daily_volunteer_digest", secret, email, subject, plainBody, htmlBody? }
 */
function handleDailyVolunteerDigest_(data) {
  if (data.secret !== CONFIG.SELF_SERVE_MAIL_SECRET) {
    return jsonResponse({ ok: false, error: "unauthorized" });
  }
  var email = String(data.email || "")
    .trim()
    .toLowerCase();
  var subject = String(data.subject || "").trim();
  var plainBody = String(data.plainBody || "").trim();
  var htmlBody = String(data.htmlBody || "").trim();
  if (!email || !subject || !plainBody) {
    return jsonResponse({ ok: false, error: "missing_fields" });
  }
  if (isUndeliverableEmail_(email)) {
    return jsonResponse({ ok: false, error: "undeliverable", permanent: true });
  }
  try {
    var opts = {};
    if (htmlBody) opts.htmlBody = htmlBody;
    GmailApp.sendEmail(email, subject, plainBody, opts);
  } catch (err) {
    var errMsg = String(err);
    var permanent = classifySendError_(err) === "permanent";
    if (permanent) {
      stopMailToUndeliverableAddress_(email, errMsg, "digest_send");
    }
    return jsonResponse({ ok: false, error: errMsg, permanent: permanent });
  }
  return jsonResponse({ ok: true });
}

/** Build schedule from sheet (column F shifts, H tent) and email CONFIG.TEAM_NOTIFY_EMAIL. */
function emailVolunteerScheduleToOrganizer() {
  var sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var email = String(row[CONFIG.EMAIL_COLUMN - 1] || "")
      .trim()
      .toLowerCase();
    if (!email || email.indexOf("@") === -1) continue;
    if (isEmailBlocked_(email)) continue;
    rows.push({
      name: String(row[CONFIG.NAME_COLUMN - 1] || "").trim(),
      email: email,
      phone: String(row[CONFIG.PHONE_COLUMN - 1] || "").trim(),
      shifts: String(row[CONFIG.SHIFTS_COLUMN - 1] || "").trim(),
      tent: String(row[CONFIG.TENT_COLUMN - 1] || "").trim(),
    });
  }

  var byDate = {};
  var dateOrder = [
    "June 14, 2026",
    "June 17, 2026",
    "June 20, 2026",
    "June 23, 2026",
    "June 26, 2026",
    "June 29, 2026",
    "July 4, 2026",
  ];
  var unscheduled = [];

  rows.forEach(function (vol) {
    var lines = String(vol.shifts || "")
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    if (!lines.length) {
      if (vol.name) unscheduled.push(vol);
      return;
    }
    lines.forEach(function (line) {
      var parts = line.split(/\s*—\s*/);
      if (parts.length < 2) return;
      var date = parts[0].trim();
      var time = parts.length >= 3 ? parts[1].trim() : "";
      var role = parts.length >= 3 ? parts.slice(2).join(" — ").trim() : parts.slice(1).join(" — ").trim();
      if (!byDate[date]) byDate[date] = {};
      var tk = time || "(time TBD)";
      if (!byDate[date][tk]) byDate[date][tk] = [];
      byDate[date][tk].push({
        name: vol.name || vol.email,
        role: role,
        tent: vol.tent || "—",
        phone: vol.phone || "",
      });
    });
  });

  var plain = ["Houston World Cup Prayer City — Volunteer schedule (from sheet)", ""];
  var html =
    '<div style="font-family:system-ui,sans-serif;max-width:720px">' +
    "<h1 style=\"font-size:20px\">Volunteer schedule</h1>";

  dateOrder.forEach(function (date) {
    if (!byDate[date]) return;
    plain.push("=== " + date + " ===");
    html += "<h2 style=\"font-size:16px;margin:16px 0 6px\">" + date + "</h2>";
    var times = Object.keys(byDate[date]).sort();
    times.forEach(function (time) {
      plain.push("  " + time);
      html += "<h3 style=\"font-size:13px;margin:10px 0 4px\">" + time + "</h3><ul>";
      byDate[date][time]
        .sort(function (a, b) {
          return String(a.name).localeCompare(String(b.name));
        })
        .forEach(function (p) {
          plain.push("    • " + p.name + " · " + p.role + " · " + p.tent);
          html +=
            "<li>" +
            p.name +
            " · " +
            p.role +
            " · " +
            p.tent +
            (p.phone ? " · " + p.phone : "") +
            "</li>";
        });
      plain.push("");
      html += "</ul>";
    });
  });

  if (unscheduled.length) {
    plain.push("— No shifts saved —");
    html += "<p><strong>No shifts saved yet</strong></p><ul>";
    unscheduled.forEach(function (v) {
      plain.push("  • " + v.name + " (" + v.email + ")");
      html += "<li>" + v.name + "</li>";
    });
    html += "</ul>";
  }
  html += "</div>";

  var to = CONFIG.TEAM_NOTIFY_EMAIL;
  var subject = "Prayer City volunteer schedule — all serve days";
  GmailApp.sendEmail(to, subject, plain.join("\n"), { htmlBody: html });
  try {
    SpreadsheetApp.getUi().alert("Schedule emailed to " + to);
  } catch (e) {
    Logger.log("Schedule emailed to " + to);
  }
}

/** Clear shifts/tent and mark status for blocked or opted-out emails on the volunteer sheet. */
function removeVolunteerByEmailFromSheet_(email) {
  var target = String(email || "")
    .trim()
    .toLowerCase();
  if (!target) return 0;
  var sheet = getVolunteerSheet_();
  var data = sheet.getDataRange().getValues();
  var removed = 0;
  for (var r = 1; r < data.length; r++) {
    var rowEmail = String(data[r][CONFIG.EMAIL_COLUMN - 1] || "")
      .trim()
      .toLowerCase();
    if (rowEmail !== target) continue;
    var rowNum = r + 1;
    sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Removed — opted out");
    sheet.getRange(rowNum, CONFIG.SHIFTS_COLUMN).clearContent();
    sheet.getRange(rowNum, CONFIG.TENT_COLUMN).clearContent();
    removed++;
  }
  return removed;
}

/** Remove volunteer row(s) by first + last name; sync email to Firebase undeliverable/opt-out if found. */
function removeVolunteerByNameFromSheet_(firstName, lastName) {
  var f = String(firstName || "")
    .trim()
    .toLowerCase();
  var l = String(lastName || "")
    .trim()
    .toLowerCase();
  if (!f || !l) return 0;
  var sheet = getVolunteerSheet_();
  var data = sheet.getDataRange().getValues();
  var removed = 0;
  var emails = [];
  for (var r = 1; r < data.length; r++) {
    var name = String(data[r][CONFIG.NAME_COLUMN - 1] || "")
      .trim()
      .toLowerCase();
    var parts = name.split(/\s+/).filter(Boolean);
    if (parts[0] !== f || parts.slice(1).join(" ") !== l) continue;
    var rowNum = r + 1;
    var email = String(data[r][CONFIG.EMAIL_COLUMN - 1] || "")
      .trim()
      .toLowerCase();
    sheet.getRange(rowNum, CONFIG.STATUS_COLUMN).setValue("Removed — opted out");
    sheet.getRange(rowNum, CONFIG.SHIFTS_COLUMN).clearContent();
    sheet.getRange(rowNum, CONFIG.TENT_COLUMN).clearContent();
    if (email && email.indexOf("@") > 0) emails.push(email);
    removed++;
  }
  if (emails.length) {
    syncUndeliverableToFirestore_(emails, "removed from volunteer list", "volunteer_sheet_remove");
  }
  return removed;
}

function removeEllenWrightFromVolunteerList_() {
  var n = removeVolunteerByNameFromSheet_("Ellen", "Wright");
  var msg =
    "Removed " +
    n +
    " row(s) for Ellen Wright from the volunteer sheet (status → Removed — opted out)." +
    (n ? "\n\nIf she had a dashboard account, run removeVolunteerByName in Firebase or use removeVolunteerHttp with her email." : "\n\nNo matching row found on the sheet — check spelling or remove from Firestore manually.");
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

function applyEmailBlocklistToVolunteerSheet_() {
  var list = CONFIG.EMAIL_BLOCKLIST || [];
  var total = 0;
  list.forEach(function (email) {
    total += removeVolunteerByEmailFromSheet_(email);
  });
  var msg = "Marked " + total + " row(s) as Removed — opted out (blocklist).";
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

/**
 * Sheet menu: confirms the deployed web app recognizes volunteer_tshirt_size.
 * If you see bad_type, paste this file into Apps Script and Deploy → New deployment (Web app).
 */
function verifyTshirtWebhookHandler_() {
  var url = String(
    PropertiesService.getScriptProperties().getProperty("WEB_APP_URL") || ""
  ).trim();
  if (!url) {
    var msg =
      "Set script property WEB_APP_URL to your deployed web app URL\n" +
      "(Deploy → Manage deployments → copy /exec URL),\n" +
      "or compare APPS_SCRIPT_SELF_SERVE_MAIL_URL in Firebase secrets.";
    try {
      SpreadsheetApp.getUi().alert(msg);
    } catch (e) {
      Logger.log(msg);
    }
    return;
  }

  var payload = {
    type: "volunteer_tshirt_size",
    secret: "probe-wrong-secret",
    email: "probe@example.com",
    shirtSize: "M",
  };
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true,
  });
  var code = res.getResponseCode();
  var body = String(res.getContentText() || "").trim();
  var verdict;
  if (body.indexOf("bad_type") !== -1) {
    verdict =
      "FAIL — deployed web app is OLD (bad_type).\n\n" +
      "Paste PrayerCityFormPipeline.gs, save, then Deploy → Manage deployments → Edit → New version → Deploy.";
  } else if (body.indexOf("unauthorized") !== -1) {
    verdict =
      "OK — handler is live (unauthorized = expected for probe secret).\n\n" +
      "T-shirt saves from the dashboard should now write column K and email " +
      CONFIG.TEAM_NOTIFY_EMAIL +
      ".";
  } else {
    verdict = "Unexpected response (HTTP " + code + "):\n" + body;
  }
  try {
    SpreadsheetApp.getUi().alert(verdict);
  } catch (e) {
    Logger.log(verdict);
  }
}

/**
 * POST JSON from Firebase Callable notifyVolunteerTshirtSize:
 * { type: "volunteer_tshirt_size", secret, email, name?, shirtSize }
 */
function handleVolunteerTshirtSize_(data) {
  if (data.secret !== CONFIG.SELF_SERVE_MAIL_SECRET) {
    return jsonResponse({ ok: false, error: "unauthorized" });
  }
  var email = String(data.email || "")
    .trim()
    .toLowerCase();
  var name = String(data.name || "").trim();
  var shirtSize = String(data.shirtSize || "").trim().toUpperCase();
  if (shirtSize === "XL") shirtSize = "X";
  var allowed = { S: 1, M: 1, L: 1, X: 1 };
  if (!email || !shirtSize || !allowed[shirtSize]) {
    return jsonResponse({ ok: false, error: "missing_fields" });
  }

  var sheet = getVolunteerSheet_();
  var rowNum = findRowByEmail_(sheet, email);
  if (rowNum) {
    sheet.getRange(rowNum, CONFIG.TSHIRT_SIZE_COLUMN).setValue(shirtSize);
  }

  var notifyTo = String(CONFIG.TEAM_NOTIFY_EMAIL || "").trim();
  if (!notifyTo) {
    return jsonResponse({ ok: true, sheetRow: rowNum || 0, emailed: false });
  }

  var displayName = name || email.split("@")[0] || "Volunteer";
  var subject = "T-shirt size: " + displayName + " — " + shirtSize;
  var plain =
    "A volunteer saved their Prayer City T-shirt size on the dashboard.\n\n" +
    "Name: " +
    displayName +
    "\nEmail: " +
    email +
    "\nSize: " +
    shirtSize +
    (rowNum ? "\nSheet row: " + rowNum : "\n(Sheet row not found — size not written to column K)") +
    "\n\n— Prayer City dashboard";

  try {
    GmailApp.sendEmail(notifyTo, subject, plain);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }

  return jsonResponse({ ok: true, sheetRow: rowNum || 0, emailed: true });
}

function doPost(e) {
  var data = {};
  try {
    data = JSON.parse((e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return jsonResponse({ ok: false, error: "invalid_json" });
  }

  if (data.type === "volunteer_sheet_update") {
    return handleVolunteerSheetUpdate_(data);
  }

  if (data.type === "daily_volunteer_digest") {
    return handleDailyVolunteerDigest_(data);
  }

  if (data.type === "volunteer_tshirt_size") {
    return handleVolunteerTshirtSize_(data);
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
  if (isUndeliverableEmail_(email)) {
    return jsonResponse({ ok: false, error: "undeliverable", permanent: true });
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
    var errMsg = String(err);
    var permanent = classifySendError_(err) === "permanent";
    if (permanent) {
      stopMailToUndeliverableAddress_(email, errMsg, "self_serve_signin");
    }
    return jsonResponse({ ok: false, error: errMsg, permanent: permanent });
  }

  return jsonResponse({ ok: true });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
