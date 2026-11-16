'use strict';

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { sendMailViaAppsScript } = require('./lib/mailTransport');

const SITE = 'https://prayercityhtx.com';
const CONTACT = 'ddbs.htx@gmail.com';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildWelcome(profile) {
  const first = String(profile.first || '').trim() || 'friend';
  const studentId = String(profile.studentId || '').trim();
  const portal = `${SITE}/cod1024/students`;

  const subject = 'Welcome to Class of David 1024';
  const plainBody = [
    `Dear ${first},`,
    '',
    'Welcome to Class of David 1024. Four semesters from now, you will not be the same.',
    '',
    studentId ? `Your student ID: ${studentId}` : '',
    `Sign in to your portal: ${portal}`,
    '',
    'What to expect:',
    '- Daily scripture, Monday to Friday, in your portal',
    '- Tuesday night prayer at 10:00 PM WAT',
    '- Homework from your coordinator each week',
    '',
    `Questions? Write to ${CONTACT}.`,
    '',
    'Dear Daughter Bible Study Group',
  ]
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n');

  const htmlBody = `<!DOCTYPE html><html><body style="margin:0;background:#f6f3fb;font-family:Arial,Helvetica,sans-serif;color:#1d1733;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3fb;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#120e24;padding:28px 28px 22px;text-align:center;">
<img src="${SITE}/images/dear-daughter-logo-light.png" width="96" alt="Dear Daughter Bible Study" style="display:block;margin:0 auto 14px;" />
<div style="color:#e0b85c;font-size:13px;font-weight:bold;letter-spacing:1px;">CLASS OF DAVID 1024</div>
<div style="color:#ffffff;font-family:Georgia,serif;font-size:24px;line-height:1.3;margin-top:8px;">Four semesters from now, <em style="color:#e0b85c;">you will not be the same.</em></div>
</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6;">
<p style="margin:0 0 14px;">Dear ${escapeHtml(first)},</p>
<p style="margin:0 0 18px;">Welcome to Class of David 1024. We are glad you said yes.</p>
${studentId ? `<p style="margin:0 0 18px;padding:12px 16px;background:#f6f3fb;border-radius:10px;">Your student ID: <strong>${escapeHtml(studentId)}</strong></p>` : ''}
<p style="margin:0 0 8px;font-weight:bold;">What to expect</p>
<ul style="margin:0 0 22px;padding-left:20px;">
<li>Daily scripture, Monday to Friday, in your portal</li>
<li>Tuesday night prayer at 10:00 PM WAT</li>
<li>Homework from your coordinator each week</li>
</ul>
<p style="margin:0 0 24px;text-align:center;"><a href="${portal}" style="display:inline-block;background:#3b2a6e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px;">Open my portal</a></p>
<p style="margin:0;color:#5b5470;font-size:13px;">Questions? Write to <a href="mailto:${CONTACT}" style="color:#3b2a6e;">${CONTACT}</a>.</p>
</td></tr>
<tr><td style="padding:16px 28px;background:#faf8fd;color:#8a83a0;font-size:12px;text-align:center;">Dear Daughter Bible Study Group</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, plainBody, htmlBody };
}

function createOnCod1024StudentCreated({ appsScriptSelfServeMailUrl, selfServeMailSecret }) {
  return onDocumentCreated(
    {
      document: 'cod_users/{uid}',
      region: 'us-central1',
      timeoutSeconds: 90,
      secrets: [appsScriptSelfServeMailUrl, selfServeMailSecret],
    },
    async (event) => {
      const snap = event.data;
      if (!snap) return;
      const profile = snap.data() || {};
      if (profile.program !== 'cod1024' || profile.role !== 'student' || !profile.email) return;
      if (profile.welcomeEmailSentAt) return;
      // Automated test accounts use example.com and must not hit the mail webhook.
      if (/@example\.com$/i.test(profile.email)) return;

      const mail = buildWelcome(profile);
      const res = await sendMailViaAppsScript({
        scriptUrl: appsScriptSelfServeMailUrl.value(),
        secret: selfServeMailSecret.value(),
        email: profile.email,
        ...mail,
      });

      if (!res.ok) {
        console.warn('cod1024 welcome email failed', event.params.uid, res.error);
        return;
      }
      await snap.ref.set({ welcomeEmailSentAt: new Date() }, { merge: true });
    }
  );
}

module.exports = { createOnCod1024StudentCreated, buildWelcome };
