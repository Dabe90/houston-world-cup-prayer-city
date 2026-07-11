'use strict';

const GALLERY_URL = 'https://prayercityhtx.com/gallery.html';
const INSTAGRAM_URL = 'https://www.instagram.com/ddbs.global/';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstName(name) {
  const n = String(name || '').trim();
  if (!n) return 'Friend';
  return n.split(/\s+/)[0];
}

/**
 * @param {{ name?: string }} [opts]
 */
function buildCampaignThankYouEmail(opts = {}) {
  const greeting = firstName(opts.name);
  const subject = 'Thank you — Houston World Cup Prayer City';

  const plainBody = [
    `Dear ${greeting},`,
    '',
    'Thank you for your support, prayers, and heart for Houston World Cup Prayer City. Together we welcomed guests, served with joy, and lifted up our city in prayer.',
    '',
    'We are deeply grateful to everyone who volunteered, prayed with us, and cheered us on. The campaign has wrapped, and we are already looking forward to exciting Christian events coming soon.',
    '',
    'Relive the memories — photos and videos from our serve days are in the gallery:',
    GALLERY_URL,
    '',
    'Stay connected — follow us on Instagram:',
    INSTAGRAM_URL,
    '',
    'With gratitude,',
    'Houston World Cup Prayer City',
  ].join('\n');

  const htmlBody =
    '<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0f172a;line-height:1.55;font-size:15px">' +
    `<p>Dear ${escapeHtml(greeting)},</p>` +
    '<p>Thank you for your support, prayers, and heart for <strong>Houston World Cup Prayer City</strong>. Together we welcomed guests, served with joy, and lifted up our city in prayer.</p>' +
    '<p>We are deeply grateful to everyone who volunteered, prayed with us, and cheered us on. The campaign has wrapped, and we are already looking forward to <strong>exciting Christian events coming soon</strong>.</p>' +
    '<p style="margin:24px 0">' +
    `<a href="${escapeHtml(GALLERY_URL)}" style="display:inline-block;margin-right:8px;padding:12px 18px;border-radius:9999px;background:#0f3d5c;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none">View gallery photos &amp; videos</a>` +
    `<a href="${escapeHtml(INSTAGRAM_URL)}" style="display:inline-block;padding:12px 18px;border-radius:9999px;background:#c9a227;color:#0f3d5c;font-weight:700;font-size:14px;text-decoration:none">Follow on Instagram</a>` +
    '</p>' +
    '<p style="font-size:13px;color:#64748b">Gallery: <a href="' +
    escapeHtml(GALLERY_URL) +
    '" style="color:#0f3d5c">' +
    escapeHtml(GALLERY_URL) +
    '</a><br>Instagram: <a href="' +
    escapeHtml(INSTAGRAM_URL) +
    '" style="color:#0f3d5c">@ddbs.global</a></p>' +
    '<p>With gratitude,<br><strong>Houston World Cup Prayer City</strong></p>' +
    '</div>';

  return { subject, plainBody, htmlBody };
}

module.exports = { buildCampaignThankYouEmail, GALLERY_URL, INSTAGRAM_URL };
