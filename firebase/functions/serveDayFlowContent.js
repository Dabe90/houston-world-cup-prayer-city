'use strict';

const SHUTTLE_PICKUP_NAME = 'Walmart';
const SHUTTLE_PICKUP_ADDRESS = '2391 S Wayside Dr, Houston, TX 77023';
const SHUTTLE_PARKING_NOTE =
  'Park on the left side next to Automotive and Curbside Pick-up.';
const SHUTTLE_MAP_URL =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('Walmart 2391 S Wayside Dr Houston TX 77023');
const SHUTTLE_BUS_IMAGE = 'https://prayercityhtx.com/images/prayer-city-shuttle-bus.png';
const TENT_SETUP_IMAGE = 'https://prayercityhtx.com/images/prayer-city-tent-setup.png';
const COORDINATOR_NAME = 'Tricia Hill';
const COORDINATOR_TITLE = 'Prayer City Coordinator';
const COORDINATOR_PHONE = '346-664-8066';
const SHUTTLE_DRIVER_NAME = 'Claudia';
const SHUTTLE_DRIVER_PHONE = '979-231-6324';

const ROLE_ON_SHIFT = {
  'prayer-partners':
    'At your tent: welcome guests, listen with care, pray with people, and gently point hearts to Jesus. Join morning worship and prayer at the tent when your shift allows — even if your shift starts later.',
  counselors:
    'Cover your assigned area with calm, loving gospel conversations. Win souls to Christ with clarity and kindness. Check in with the coordinator for your zone and any referral needs.',
  'logistics-welfare':
    'Help supplies, shade, snacks, and flow stay smooth at the tent and along your route. Support volunteers and guests; flag needs to the coordinator. Shuttle runs every 30 minutes if someone needs to reach their car.',
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
    ? `Your assigned tent (${tent}) is on your dashboard and confirmed at check-in.`
    : 'Your assigned tent is on your dashboard — confirm at check-in.';

  const plain =
    `SERVE DAY — YOUR FLOW (NRG AREA)\n\n` +
    `The World Cup is here in Houston — what an exciting season! Not everyone serves on the very first game day, but we are counting down with joy and we cannot wait to win souls to Christ with you.\n\n` +
    `1. On your serve day, come to the shuttle pick-up (park safely — do not worry about stadium parking).\n` +
    `2. Shuttle pick-up: ${SHUTTLE_PICKUP_NAME}, ${SHUTTLE_PICKUP_ADDRESS}. ${SHUTTLE_PARKING_NOTE}\n` +
    `3. Look for the black Prayer City Shuttle Bus (Prayer City logo / lettering on the side).\n` +
    `4. The shuttle runs about every 30 minutes — pick-up and drop-off for volunteers.\n` +
    `5. Ride to your assigned prayer tent in the NRG Stadium area (less than 5 minutes from the stadium). ${tentLine}\n` +
    `6. Shuttle stays available all day if you need to go back to your car.\n` +
    `7. Check in with ${COORDINATOR_NAME}, ${COORDINATOR_TITLE} — receive your T-shirt, volunteer tags, and a short briefing.\n` +
    `8. Morning worship and prayer at the tent each day; ${COORDINATOR_NAME} will pray with you if your shift starts later.\n` +
    `9. Get materials and your assigned area for prayer, evangelism, or your role.\n` +
    `10. Day-of emergency — Claudia (shuttle): ${SHUTTLE_DRIVER_PHONE} · ${COORDINATOR_NAME} (coordinator): ${COORDINATOR_PHONE}\n\n` +
    `Map (shuttle pick-up): ${SHUTTLE_MAP_URL}\n\n` +
    `YOUR ROLE ON SERVE DAY:\n${roleTipsPlain(roleIds)}`;

  const html =
    `<div style="margin:0 0 24px;border-radius:16px;border:1px solid #cbd5e1;background:#ffffff;overflow:hidden;box-shadow:0 10px 36px rgba(15,61,92,0.1);">` +
    `<div style="padding:18px 20px 0;">` +
    `<p style="margin:0 0 6px;font-size:11px;font-weight:900;letter-spacing:0.14em;color:#0d9488;text-transform:uppercase;">Serve day · NRG area</p>` +
    `<h2 style="margin:0 0 10px;font-size:18px;font-weight:900;color:#0f172a;">Excited for World Cup Houston — ready to win souls to Christ</h2>` +
    `<p style="margin:0;font-size:14px;color:#334155;line-height:1.65;">Not everyone serves on the very first game day — but we’re counting down with joy. Here’s your step-by-step flow when <strong>your</strong> shift arrives.</p>` +
    `</div>` +
    `<div style="padding:16px 20px 0;">` +
    `<p style="margin:0 0 8px;font-size:12px;font-weight:900;letter-spacing:0.12em;color:#0f3d5c;text-transform:uppercase;">Prayer City Shuttle Bus</p>` +
    `<img src="${escapeHtml(SHUTTLE_BUS_IMAGE)}" alt="Prayer City Shuttle Bus" width="600" style="width:100%;max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;display:block;margin:0 0 12px;" />` +
    `<p style="margin:0 0 8px;font-size:15px;font-weight:800;color:#0f172a;">${escapeHtml(SHUTTLE_PICKUP_NAME)} · ${escapeHtml(SHUTTLE_PICKUP_ADDRESS)}</p>` +
    `<p style="margin:0 0 12px;font-size:14px;color:#334155;">${escapeHtml(SHUTTLE_PARKING_NOTE)} Look for <strong>Prayer City Shuttle Bus</strong> lettering. Runs about <strong>every 30 minutes</strong> — to NRG tents and back to your car all day.</p>` +
    `<a href="${escapeHtml(SHUTTLE_MAP_URL)}" style="display:inline-block;margin-bottom:16px;padding:10px 16px;border-radius:9999px;background:#0f3d5c;color:#fff;font-weight:800;font-size:13px;text-decoration:none;">Open pick-up map →</a>` +
    `</div>` +
    `<div style="padding:0 20px 16px;">` +
    `<p style="margin:0 0 8px;font-size:12px;font-weight:900;letter-spacing:0.12em;color:#0f3d5c;text-transform:uppercase;">Prayer tent (NRG area · &lt; 5 min from stadium)</p>` +
    `<img src="${escapeHtml(TENT_SETUP_IMAGE)}" alt="Prayer City tent setup example" width="600" style="width:100%;max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;display:block;margin:0 0 10px;" />` +
    `<p style="margin:0;font-size:13px;color:#64748b;line-height:1.55;">Exact tent spot will be announced — this is what to look for. ${escapeHtml(tentLine)}</p>` +
    `</div>` +
    `<div style="padding:0 20px 20px;">` +
    `<ol style="margin:0;padding-left:1.25rem;font-size:14px;color:#334155;line-height:1.65;">` +
    `<li style="margin-bottom:8px;">Park at the Walmart pick-up — avoid stadium parking stress.</li>` +
    `<li style="margin-bottom:8px;">Board the Prayer City shuttle (runs ~every 30 min).</li>` +
    `<li style="margin-bottom:8px;">Ride to your assigned tent near NRG.</li>` +
    `<li style="margin-bottom:8px;">Check in with <strong>${escapeHtml(COORDINATOR_NAME)}</strong> (${escapeHtml(COORDINATOR_TITLE)}) — T-shirt, volunteer tags, briefing.</li>` +
    `<li style="margin-bottom:8px;">Join morning worship &amp; prayer at the tent when you can; ${escapeHtml(COORDINATOR_NAME)} will pray with you if your shift starts later.</li>` +
    `<li style="margin-bottom:8px;">Collect materials; serve in your assigned area (prayer, evangelism, or your role).</li>` +
    `<li>Day-of emergency: <strong>${escapeHtml(SHUTTLE_DRIVER_NAME)}</strong> (shuttle) <a href="tel:9792316324" style="color:#0f3d5c;font-weight:800;text-decoration:none;">${escapeHtml(SHUTTLE_DRIVER_PHONE)}</a> · <strong>${escapeHtml(COORDINATOR_NAME)}</strong> (coordinator) <a href="tel:3466648066" style="color:#0f3d5c;font-weight:800;text-decoration:none;">${escapeHtml(COORDINATOR_PHONE)}</a></li>` +
    `</ol>` +
    `<p style="margin:16px 0 8px;font-size:12px;font-weight:900;letter-spacing:0.12em;color:#0d9488;text-transform:uppercase;">Your role on serve day</p>` +
    roleTipsHtml(roleIds) +
    `</div></div>`;

  return { plain, html };
}

module.exports = {
  SHUTTLE_PICKUP_ADDRESS,
  SHUTTLE_MAP_URL,
  COORDINATOR_NAME,
  ROLE_ON_SHIFT,
  buildServeDayFlowBlock,
};
