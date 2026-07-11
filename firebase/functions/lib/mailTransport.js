'use strict';

const { normalizeEmail } = require('./adminAuth');

/**
 * Send mail through the existing Apps Script webhook (daily_volunteer_digest handler).
 * @param {{ scriptUrl: string, secret: string, email: string, subject: string, plainBody: string, htmlBody?: string }} opts
 */
async function sendMailViaAppsScript(opts) {
  const email = normalizeEmail(opts.email);
  const subject = String(opts.subject || '').trim();
  const plainBody = String(opts.plainBody || '').trim();
  const scriptUrl = String(opts.scriptUrl || '').trim();
  const secret = String(opts.secret || '').trim();

  if (!email || !email.includes('@')) {
    return { ok: false, error: 'invalid_email', permanent: true };
  }
  if (!subject || !plainBody) {
    return { ok: false, error: 'missing_subject_or_body' };
  }
  if (!scriptUrl || !secret) {
    return { ok: false, error: 'mail_not_configured' };
  }

  const res = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'daily_volunteer_digest',
      secret,
      email,
      subject,
      plainBody,
      htmlBody: opts.htmlBody || '',
    }),
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_) {
    /* non-json */
  }

  if (!res.ok || !parsed?.ok) {
    return {
      ok: false,
      error: (parsed && (parsed.error || parsed.message)) || text.slice(0, 400) || 'mail_failed',
      permanent: parsed?.permanent === true,
      status: res.status,
    };
  }

  return { ok: true };
}

module.exports = { sendMailViaAppsScript };
