'use strict';

/** Lowercase emails that must never receive Prayer City mail (digest, invites, etc.). */
const BLOCKED_EMAILS = new Set([
  'marykaarto@gmail.com',
  'emcocke@gmail.com',
  'ellenwright051084@gmail.com',
]);

function isEmailBlocked(email) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  return e ? BLOCKED_EMAILS.has(e) : false;
}

/**
 * Classify a mail delivery error from Gmail / Apps Script.
 * Quota and rate limits are temporary; bad-address bounces are permanent.
 * @returns {'permanent'|'temporary'}
 */
function classifyDeliveryError(errMsg) {
  const msg = String(errMsg || '').toLowerCase();
  if (
    /quota|rate limit|too many|user-rate|service invoked too many|limit exceeded|daily sending|temporarily unavailable|try again later|timeout|timed out|internal error|backend error|urlfetch|blocked|suspended|minute|per day|mail service|gmail service|email send|limit:|exceeded/.test(
      msg
    )
  ) {
    return 'temporary';
  }
  if (
    /invalid\s+(email|address|recipient)|bad\s+recipient|no\s+such\s+(user|mailbox|recipient)|user\s+unknown|mailbox\s+not\s+found|recipient.*rejected|5\.1\.1|550\s*5\.1\.1|address\s+not\s+found|undeliver|delivery\s+status\s+notification|mail\s+delivery\s+failed|does\s+not\s+exist|account\s+disabled|recipient\s+address\s+rejected|permanent\s+error/.test(
      msg
    )
  ) {
    return 'permanent';
  }
  return 'temporary';
}

module.exports = { isEmailBlocked, BLOCKED_EMAILS, classifyDeliveryError };
