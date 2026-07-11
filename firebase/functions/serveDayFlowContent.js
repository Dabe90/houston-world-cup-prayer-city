'use strict';

const TENT_LOCATION_ADDRESS = '1325 La Concha Lane, Houston, TX';
const PARKING_NOTE =
  'Free street parking is available near the prayer tents at 1325 La Concha Lane, Houston, TX. Plan to arrive a few minutes early to find a spot.';
const TENT_MAP_URL =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(TENT_LOCATION_ADDRESS);
const TENT_SETUP_IMAGE = 'https://prayercityhtx.com/images/prayer-city-tent-setup.png';
const COORDINATOR_NAME = 'Tricia Hill';
const COORDINATOR_TITLE = 'Prayer City Coordinator';
const COORDINATOR_PHONE = '832-277-3831';

const ROLE_ON_SHIFT = {
  'prayer-partners':
    'At your tent: welcome guests, listen with care, pray with people, and gently point hearts to Jesus. Join morning worship and prayer at the tent when your shift allows — even if your shift starts later.',
  counselors:
    'Cover your assigned area with calm, loving gospel conversations. Win souls to Christ with clarity and kindness. Check in with the coordinator for your zone and any referral needs.',
  'logistics-welfare':
    'Help supplies, shade, snacks, and flow stay smooth at the tent and along your route. Support volunteers and guests; flag needs to the coordinator.',
  'photography-video':
    'Capture the story respectfully (consent first). Cover your assigned area and celebrate unity — upload via your dashboard when you can.',
  'social-media':
    'Share hope-filled updates from the field (your assigned area). Point people to Prayer City online and invite friends to serve — tone: humble, invitational, Christ-centered.',
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function roleTipsPlain(roleIds) {
  if (!roleIds || !roleIds.length) {
    return 'Your coordinator will direct you based on your volunteer role after check-in.';
  }
  return roleIds
    .map((id) => {
      const tip = ROLE_ON_SHIFT[id];
      if (!tip) return '';
      const label = id.replace(/-/g, ' ');
      return `• ${label}: ${tip}`;
    })
    .filter(Boolean)
    .join('\n');
}

function roleTipsHtml(roleIds) {
  if (!roleIds || !roleIds.length) {
    return '<p style="margin:0;font-size:14px;color:#334155;">Your coordinator will direct you based on your volunteer role after check-in.</p>';
  }
  return (
    '<ul style="margin:0;padding-left:1.2rem;font-size:14px;color:#334155;line-height:1.65;">' +
    roleIds
      .map((id) => {
        const tip = ROLE_ON_SHIFT[id];
        if (!tip) return '';
        return `<li style="margin:0 0 10px;"><strong>${escapeHtml(id.replace(/-/g, ' '))}</strong> — ${escapeHtml(tip)}</li>`;
      })
      .join('') +
    '</ul>'
  );
}

/**
 * @param {{ roleIds?: string[], tent?: string }} opts
 */
function buildServeDayFlowBlock(opts) {
  opts = opts || {};
  const roleIds = opts.roleIds || [];
  const tent = String(opts.tent || '').trim();
  const tentLine = tent
    ? `All prayer tents are at ${TENT_LOCATION_ADDRESS}. Your assigned tent: ${tent} — confirm at check-in.`
    : `All prayer tents are at ${TENT_LOCATION_ADDRESS}. Your assigned tent number is on your dashboard — confirm at check-in.`;

  const plain =
    `SERVE DAY — YOUR FLOW (NRG AREA)\n\n` +
    `The World Cup is here in Houston — what an exciting season! Not everyone serves on the very first game day, but we are counting down with joy and we cannot wait to win souls to Christ with you.\n\n` +
    `1. On your serve day, come to ${TENT_LOCATION_ADDRESS} (NRG Stadium area).\n` +
    `2. ${PARKING_NOTE}\n` +
    `3. Walk to the prayer tents and check in with ${COORDINATOR_NAME}, ${COORDINATOR_TITLE} — receive your T-shirt, volunteer tags, and a short briefing.\n` +
    `4. Morning worship and prayer at the tent each day; ${COORDINATOR_NAME} will pray with you if your shift starts later.\n` +
    `5. Get materials and your assigned area for prayer, evangelism, or your role.\n` +
    `6. Day-of help — ${COORDINATOR_NAME}: ${COORDINATOR_PHONE}\n\n` +
    `Map (prayer tents & parking area): ${TENT_MAP_URL}\n\n` +
    `YOUR ROLE ON SERVE DAY:\n${roleTipsPlain(roleIds)}`;

  const html =
    `<div style="margin:0 0 24px;border-radius:16px;border:1px solid #cbd5e1;background:#ffffff;overflow:hidden;box-shadow:0 10px 36px rgba(15,61,92,0.1);">` +
    `<div style="padding:18px 20px 0;">` +
    `<p style="margin:0 0 6px;font-size:11px;font-weight:900;letter-spacing:0.14em;color:#0d9488;text-transform:uppercase;">Serve day · NRG area</p>` +
    `<h2 style="margin:0 0 10px;font-size:18px;font-weight:900;color:#0f172a;">Excited for World Cup Houston — ready to win souls to Christ</h2>` +
    `<p style="margin:0;font-size:14px;color:#334155;line-height:1.65;">Not everyone serves on the very first game day — but we’re counting down with joy. Here’s your step-by-step flow when <strong>your</strong> shift arrives.</p>` +
    `</div>` +
    `<div style="padding:16px 20px 0;">` +
    `<p style="margin:0 0 8px;font-size:12px;font-weight:900;letter-spacing:0.12em;color:#0f3d5c;text-transform:uppercase;">Parking · free street parking</p>` +
    `<p style="margin:0 0 8px;font-size:15px;font-weight:800;color:#0f172a;">${escapeHtml(TENT_LOCATION_ADDRESS)}</p>` +
    `<p style="margin:0 0 12px;font-size:14px;color:#334155;">${escapeHtml(PARKING_NOTE)}</p>` +
    `<a href="${escapeHtml(TENT_MAP_URL)}" style="display:inline-block;margin-bottom:16px;padding:10px 16px;border-radius:9999px;background:#0f3d5c;color:#fff;font-weight:800;font-size:13px;text-decoration:none;">Open map →</a>` +
    `</div>` +
    `<div style="padding:0 20px 16px;">` +
    `<p style="margin:0 0 8px;font-size:12px;font-weight:900;letter-spacing:0.12em;color:#0f3d5c;text-transform:uppercase;">Prayer tents · NRG area</p>` +
    `<img src="${escapeHtml(TENT_SETUP_IMAGE)}" alt="Prayer City tent setup example" width="600" style="width:100%;max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;display:block;margin:0 0 10px;" />` +
    `<p style="margin:0 0 10px;font-size:15px;font-weight:800;color:#0f172a;">${escapeHtml(TENT_LOCATION_ADDRESS)}</p>` +
    `<p style="margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.55;">All Prayer City tents are at this location. ${escapeHtml(tentLine)}</p>` +
    `</div>` +
    `<div style="padding:0 20px 20px;">` +
    `<ol style="margin:0;padding-left:1.25rem;font-size:14px;color:#334155;line-height:1.65;">` +
    `<li style="margin-bottom:8px;">Park on the street near <strong>${escapeHtml(TENT_LOCATION_ADDRESS)}</strong> (free street parking).</li>` +
    `<li style="margin-bottom:8px;">Walk to the prayer tents and check in with <strong>${escapeHtml(COORDINATOR_NAME)}</strong> (${escapeHtml(COORDINATOR_TITLE)}) — T-shirt, volunteer tags, briefing.</li>` +
    `<li style="margin-bottom:8px;">Join morning worship &amp; prayer at the tent when you can; ${escapeHtml(COORDINATOR_NAME)} will pray with you if your shift starts later.</li>` +
    `<li style="margin-bottom:8px;">Collect materials; serve in your assigned area (prayer, evangelism, or your role).</li>` +
    `<li>Day-of help: <strong>${escapeHtml(COORDINATOR_NAME)}</strong> <a href="tel:8322773831" style="color:#0f3d5c;font-weight:800;text-decoration:none;">${escapeHtml(COORDINATOR_PHONE)}</a></li>` +
    `</ol>` +
    `<p style="margin:16px 0 8px;font-size:12px;font-weight:900;letter-spacing:0.12em;color:#0d9488;text-transform:uppercase;">Your role on serve day</p>` +
    roleTipsHtml(roleIds) +
    `</div></div>`;

  return { plain, html };
}

module.exports = {
  TENT_LOCATION_ADDRESS,
  PARKING_NOTE,
  TENT_MAP_URL,
  COORDINATOR_NAME,
  COORDINATOR_PHONE,
  ROLE_ON_SHIFT,
  buildServeDayFlowBlock,
};
