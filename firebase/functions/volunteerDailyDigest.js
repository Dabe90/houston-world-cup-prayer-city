'use strict';

const crypto = require('crypto');
const { buildServeDayFlowBlock } = require('./serveDayFlowContent');

/**
 * Role-based daily digest text — mirrors js/volunteer-daily-content.js and
 * js/volunteer-role-guides.js (same seeds / pools so the email matches the dashboard).
 */

const SITE_DEFAULT = 'https://prayercityhtx.com/volunteer/';

/** Same handles as volunteer hub — IG/TikTok have no reliable “prefill caption” link in email like X. */
const SOCIAL_INSTAGRAM_URL = 'https://www.instagram.com/ddbs.global/';
const SOCIAL_TIKTOK_URL = 'https://www.tiktok.com/@ddbs.global';

const GUIDES = [
  {
    id: 'prayer-partners',
    label: 'Prayer Partners',
    patterns: ['prayer partners', 'prayer partner'],
  },
  {
    id: 'counselors',
    label: 'Counselors',
    patterns: ['counselors', 'counselor'],
  },
  {
    id: 'logistics-welfare',
    label: 'Logistics and Welfare',
    patterns: ['logistics and welfare', 'logistics'],
  },
  {
    id: 'photography-video',
    label: 'Photography and Video',
    patterns: ['photography and video', 'photography'],
  },
  {
    id: 'social-media',
    label: 'Social Media and Virtual Support',
    patterns: ['social media and virtual support', 'social media', 'virtual support'],
  },
];

const PHOTO_DIGEST_LINES = [
  'Ask permission before capturing identifiable faces; default to respectful distance.',
  'Upload selects via your dashboard (Firebase Storage) so coordinators see them quickly.',
  'Avoid blocking walkways or prayer areas with stands; keep gear low-profile in crowds.',
  'When in doubt, prioritize guest dignity over “the shot” — celebrate unity, don’t stage people without consent.',
];

const LOGISTICS_RSS_FEED_URLS = [
  'https://news.google.com/rss/search?q=Houston+%22FIFA+World+Cup%22+2026+OR+Houston+NRG+World+Cup+2026+OR+%22NRG+Stadium%22+FIFA+2026&hl=en-US&gl=US&ceid=US:en',
];

const SCRIPTURE_LINES = [
  { ref: 'Philippians 4:6', text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.' },
  { ref: 'Psalm 46:10', text: 'Be still, and know that I am God; I will be exalted among the nations.' },
  { ref: 'Matthew 5:14', text: 'You are the light of the world. A town built on a hill cannot be hidden.' },
  { ref: 'Isaiah 41:10', text: 'So do not fear, for I am with you; do not be dismayed, for I am your God.' },
  { ref: 'Romans 15:13', text: 'May the God of hope fill you with all joy and peace as you trust in him.' },
  { ref: 'Joshua 1:9', text: 'Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.' },
  { ref: '2 Chronicles 7:14', text: 'If my people… will humble themselves and pray… I will hear from heaven and will forgive their sin and heal their land.' },
  { ref: 'Psalm 67:1–2', text: 'May God be gracious to us and bless us and make his face shine on us—so that your ways may be known on earth.' },
  { ref: 'John 3:16', text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
  { ref: 'Acts 1:8', text: 'You will receive power when the Holy Spirit comes on you; and you will be my witnesses… to the ends of the earth.' },
  { ref: 'Psalm 96:3', text: 'Declare his glory among the nations, his marvelous deeds among all peoples.' },
  { ref: 'Matthew 9:37–38', text: 'The harvest is plentiful but the workers are few. Ask the Lord of the harvest, therefore, to send out workers into his harvest field.' },
  { ref: 'Romans 10:13', text: 'Everyone who calls on the name of the Lord will be saved.' },
  { ref: 'James 5:16', text: 'The prayer of a righteous person is powerful and effective.' },
  { ref: 'Psalm 34:18', text: 'The Lord is close to the brokenhearted and saves those who are crushed in spirit.' },
  { ref: 'Jeremiah 29:7', text: 'Seek the peace and prosperity of the city to which I have carried you… Pray to the Lord for it.' },
  { ref: '1 Timothy 2:1–2', text: 'I urge… that petitions, prayers… be made for all people—for kings and all those in authority.' },
  { ref: 'Psalm 22:28', text: 'For dominion belongs to the Lord and he rules over the nations.' },
  { ref: 'Hebrews 4:16', text: 'Let us then approach God’s throne of grace with confidence, so that we may receive mercy and find grace to help us in our time of need.' },
  { ref: 'Psalm 147:3', text: 'He heals the brokenhearted and binds up their wounds.' },
];

const WORLD_CUP_HOUSTON_FIRST_GAME_DATE = '2026-06-14';
/** In-person training (June 7) — past; kept only to suppress old “upcoming training” copy. */
const VOLUNTEER_TRAINING_DATE = '2026-06-07';
const VIRTUAL_INFO_SESSION_DATE = '2026-06-11';
const VIRTUAL_INFO_SESSION_LABEL = 'Thursday, June 11, 2026';
const VIRTUAL_INFO_SESSION_TIME = '6:00 PM';
const VIRTUAL_INFO_SESSION_TIMEZONE = 'Central Time (Houston)';
const PRAYERCITY_ZOOM_URL =
  'https://us06web.zoom.us/j/88179064654?pwd=fGNWdDayQeRuixN5pH3AfwxdiL45Xk.1';
const PRAYERCITY_DONATION_URL =
  'https://www.zeffy.com/en-US/donation-form/houston-world-cup-prayer-city-movement';
const PRAYERCITY_TSHIRT_IMAGE_URL = 'https://prayercityhtx.com/images/prayer-city-tshirt.png';
const PRAYERCITY_VIDEO_YOUTUBE_URL = 'https://youtu.be/3Sn8ysMi1Lk';
const PRAYERCITY_SIGNUP_URL = 'https://prayercityhtx.com/volunteer/';
const DIGEST_EMAIL_SUBJECT =
  'Thu Jun 11 virtual session (6pm). All You Need to Know about Sunday.';

/** One per day for every digest (same for all recipients that day). */
const FAITH_EXALTATIONS = [
  'Exalt the Lord today: his faithfulness is not a mood — it is his character. Let gratitude lead your first words and your last thought.',
  'Jesus is worthy of more than our spare attention. Lift his name in worship, in quiet trust, and in how you welcome others.',
  'Faith is not the absence of questions; it is the presence of trust. Today, anchor your heart in what God has already spoken.',
  'The same Spirit who raised Christ from the dead is at work in you. Walk today with quiet confidence, not self-reliance.',
  'We exalt Christ not to perform religion, but because he alone is the Savior of the world — and Houston gets to echo that truth.',
  'Let your serving be a song of praise: small faithfulness in ordinary moments becomes a fragrance of worship.',
  'God is not distant in the noise of the city; he is near. Exalt him for his nearness, his patience, and his mercy.',
  'When the task list grows, lift your eyes: the Lord reigns. Peace is not the absence of pressure; it is Christ with you in it.',
  'Exalt Jesus for the cross — the place where love and justice kissed, and where every volunteer story finds its meaning.',
  'Today, boast in the Lord: his strength is made perfect when we admit we need him. Humility and worship belong together.',
  'The nations are gathering; the Church is praying. Exalt God for weaving Houston into a moment of gospel opportunity.',
  'Faith looks up before it looks around. Begin with adoration — who God is — and watch courage follow.',
  'We exalt Christ who holds all things together. Your shift, your words, and your prayers are threads in his tapestry.',
  'Let “Hallowed be your name” be more than a line you repeat — let it be the posture of your heart on site and online.',
  'God’s promises are not decorations; they are anchors. Exalt him today for being trustworthy when emotions fluctuate.',
  'Jesus is King of kings — exalt him for his gentle reign over anxious hearts and his bold reign over sin and death.',
  'Lift up the Lord who hears the cry of the humble. Your intercession joins a chorus older than the World Cup.',
  'Faith exalts what is true over what is loud. Today, let the gospel be the loudest truth in your mind and mouth.',
];

const SOCIAL_HOOKS = [
  'Houston is lifting up Jesus during the World Cup — and you belong in the story.',
  'Today: pray with us for Houston, for visitors, and for hearts open to the gospel.',
  'Prayer City isn’t a program — it’s people who believe God still moves cities.',
  'From the streets to the stadium: we’re asking heaven to touch earth in Houston.',
  'Your share could be someone’s invitation to meet Jesus. No hype — just hope.',
  'World Cup crowds + gospel courage = a moment we don’t want to waste.',
  'We’re not loud for attention — we’re loud because Jesus is worthy.',
  'Tag a friend who needs encouragement — then pray one sentence for them.',
  'Houston Prayer City: tents of prayer, hearts of worship, arms of welcome.',
  'If you’ve ever felt small — remember: prayer moves the hand that holds the world.',
  'Salvation, healing, unity: we’re asking God for all three in this season.',
  'Virtual or on-site — the same Spirit is praying through you today.',
  'Invite someone to pray with us. Sometimes the bravest step is simply asking.',
  'Jesus prayed for unity; we’re still answering that prayer in Houston.',
  'One city. Many nations. One name above every name.',
];

const PRAYER_THEMES = [
  { label: 'Salvation', prompts: ['Ask God to draw the lost to Jesus in Houston’s streets and stadiums.', 'Pray for soft hearts among tourists who have never heard the gospel clearly.', 'Intercede for young people to respond to Christ in this season.'] },
  { label: 'Healing', prompts: ['Pray for physical healing for those in pain and for strength for medical workers.', 'Lift up emotional healing after trauma, loneliness, and fear.', 'Ask God to heal relationships and divisions in families and teams.'] },
  { label: 'Deliverance', prompts: ['Pray against fear, addiction, and oppression; proclaim freedom in Jesus’ name.', 'Intercede for protection over vulnerable people in large crowds.', 'Ask God to break chains of hatred and prejudice.'] },
  { label: 'Houston (city)', prompts: ['Pray for churches to walk in unity and generosity.', 'Ask blessing on civic leaders, police, medics, and transit workers.', 'Pray for safety, hospitality, and wise planning across neighborhoods.'] },
  { label: 'USA & nations', prompts: ['Pray for the United States — justice, peace, and revival.', 'Lift up every nation represented at the World Cup — salvation in every language.', 'Ask God to use global attention on Houston for his glory among the nations.'] },
];

const COUNSELOR_POOL = [
  { title: 'Clear, simple gospel', tip: 'Share the death and resurrection of Jesus, our need for forgiveness, and the gift of new life through faith — in plain language, one conversation at a time.', ref: '1 Corinthians 15:3–4' },
  { title: 'Invitation, not pressure', tip: 'Invite a person to pray with you; let the Holy Spirit do the convincing. Your job is faithful kindness, not winning an argument.', ref: 'Romans 2:4' },
  { title: 'Testimony beats theory', tip: 'Briefly share what Jesus changed in you. Stories open doors where abstract debate closes them.', ref: 'Psalm 66:16' },
  { title: 'Listen, then speak', tip: 'Ask what they believe about God and life. Listening earns trust for the moment you share hope.', ref: 'Proverbs 18:13' },
  { title: 'The prayer of faith', tip: 'Offer to pray on the spot for peace, forgiveness, or clarity. Many come to Christ in prayer, not in debate.', ref: 'Romans 10:9–10' },
  { title: 'Follow up with love', tip: 'If someone responds to Jesus, connect them to Scripture, a local church, and a next step — today, not someday.', ref: 'Matthew 28:19–20' },
  { title: 'Power of the Spirit', tip: 'Depend on the Spirit’s boldness and compassion. Outreach that lasts is soaked in prayer, not adrenaline.', ref: 'Acts 4:31' },
  { title: 'Crowds and individuals', tip: 'Whether one person or many, love the one in front of you. Jesus modeled ministry in both settings.', ref: 'Luke 15:7' },
];

const LOGISTICS_STATIC = [
  'Map choke points early: entrances, merch lines, and prayer tent corners — add signage and a volunteer “pointer” before crowds peak.',
  'Heat + long shifts: rotate rest every 90 minutes where possible; keep electrolytes and shade for staff and guests.',
  'Radio or group chat: test before doors open; use short codes (“CODE BLUE” = medical) agreed with venue security.',
  'Accessibility: keep aisles wide enough for wheels and strollers; never block ramps for “temporary” storage.',
  'Lost & found + kids: one designated lead per zone; never let one volunteer escort a child alone — use pairs.',
  'Waste and recycling: extra bins before halftime surges; clear bags often to prevent spills and slips.',
  'Crowd mood: assign calm, smiling volunteers at friction points — tone de-escalates faster than rules shouted.',
];

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function todayYmdChicago() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function safeUtcDateFromYmd(ymd) {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  // Use a midday UTC anchor to avoid DST edge cases.
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

function daysUntilYmd(fromYmd, targetYmd) {
  const from = safeUtcDateFromYmd(fromYmd);
  const target = safeUtcDateFromYmd(targetYmd);
  if (!from || !target) return null;
  const ms = target.getTime() - from.getTime();
  return Math.ceil(ms / 86400000);
}

function formatMdyLongChicago(ymd) {
  const d = safeUtcDateFromYmd(ymd);
  if (!d) return ymd;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickN(arr, n, rng) {
  const a = arr.slice();
  const out = [];
  while (a.length && out.length < n) {
    const j = Math.floor(rng() * a.length);
    out.push(a.splice(j, 1)[0]);
  }
  return out;
}

function findRolesFromShifts(shiftsText) {
  const t = String(shiftsText || '')
    .toLowerCase()
    .replace(/\u2013|\u2014|\u2212/g, '-')
    .replace(/\s+/g, ' ');
  if (!t.trim()) return [];
  const out = [];
  const seen = {};
  for (const g of GUIDES) {
    const hit = g.patterns.some((p) => t.includes(p));
    if (hit && !seen[g.id]) {
      seen[g.id] = true;
      out.push(g);
    }
  }
  return out;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** First word of stored display name (e.g. "Cheryl Turner" → "Cheryl"). */
function firstNameFromVolunteerName(displayName) {
  const s = String(displayName || '').trim();
  if (!s) return '';
  const first = (s.split(/\s+/)[0] || '').replace(/^[,.\s]+|[,.\s]+$/g, '');
  return first || '';
}

function normalizeEmailForDigest(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/** HMAC token for one-click unsubscribe (verified by volunteerDigestUnsubscribe). */
function digestUnsubscribeToken(email, secret) {
  const e = normalizeEmailForDigest(email);
  if (!e || !secret) return '';
  return crypto.createHmac('sha256', String(secret)).update(e).digest('base64url');
}

/** Separate from unsubscribe so tokens are not interchangeable. */
function digestResubscribeToken(email, secret) {
  const e = normalizeEmailForDigest(email);
  if (!e || !secret) return '';
  return crypto
    .createHmac('sha256', String(secret))
    .update(`resub:v1|${e}`)
    .digest('base64url');
}

function buildDigestUnsubscribeFooter(email, secret, baseUrl) {
  const e = normalizeEmailForDigest(email);
  if (!e || !secret || !baseUrl) {
    return { plain: '', html: '' };
  }
  const t = digestUnsubscribeToken(e, secret);
  const url = `${String(baseUrl).replace(/\/?$/, '')}?email=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  return {
    plain: `\n\n---\nTo stop receiving these daily task emails, open this link once:\n${url}`,
    html: `<p style="margin-top:20px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;">To stop receiving these daily task emails: <a href="${escapeHtml(url)}">Unsubscribe</a> (one click).</p>`,
  };
}

function buildDigestResubscribeFooter(email, secret, resubBaseUrl) {
  const e = normalizeEmailForDigest(email);
  if (!e || !secret || !resubBaseUrl) {
    return { plain: '', html: '' };
  }
  const t = digestResubscribeToken(e, secret);
  const url = `${String(resubBaseUrl).replace(/\/?$/, '')}?email=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  return {
    plain: `\nTo receive these daily emails again, open this link once:\n${url}`,
    html: `<p style="margin-top:12px;font-size:12px;color:#64748b;">Want these emails again? <a href="${escapeHtml(url)}">Resubscribe</a> (one click).</p>`,
  };
}

/** Scripture + short prayer + faith exaltation — included in every digest. */
function buildUniversalDailySpiritualBlock(dateStr) {
  const rng = mulberry32(hashStr(`digest-spirit-${dateStr}`));
  const v = SCRIPTURE_LINES[Math.floor(rng() * SCRIPTURE_LINES.length)];
  const ex = FAITH_EXALTATIONS[Math.floor(rng() * FAITH_EXALTATIONS.length)];
  const prayer =
    'Lord, thank you for your Word. Align our hearts with it, give us grace to serve faithfully today, and let Jesus be exalted in Houston. Amen.';
  const plain =
    `TODAY’S SCRIPTURE FOR PRAYER\n“${v.text}”\n— ${v.ref} (NIV)\n\nPrayer for Today\n${prayer}\n\nFaith exaltation — lift Jesus high today\n${ex}`;
  const html =
    `<div style="margin:24px 0;padding:0;border-radius:16px;overflow:hidden;border:1px solid #cbd5e1;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);box-shadow:0 4px 20px rgba(15,61,92,0.08);">` +
    `<div style="height:4px;background:linear-gradient(90deg,#0f3d5c,#0d9488,#c9a227);"></div>` +
    `<div style="padding:22px 24px 20px;">` +
    `<p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:0.12em;color:#0d9488;text-transform:uppercase;">Today’s scripture for prayer</p>` +
    `<p style="margin:0;font-size:17px;color:#0f172a;line-height:1.55;font-style:italic;font-family:Georgia,'Times New Roman',serif;">“${escapeHtml(v.text)}”</p>` +
    `<p style="margin:10px 0 0;font-size:13px;color:#475569;font-weight:600;">— ${escapeHtml(v.ref)} (NIV)</p>` +
    `<div style="margin:22px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:0.12em;color:#c9a227;text-transform:uppercase;">Prayer for Today</p>` +
    `<p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">${escapeHtml(prayer)}</p>` +
    `</div>` +
    `</div>` +
    `<div style="padding:20px 24px 24px;background:linear-gradient(135deg,rgba(15,61,92,0.05),rgba(13,148,136,0.07));border-top:1px solid #e2e8f0;">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:0.12em;color:#0f3d5c;text-transform:uppercase;">Faith exaltation</p>` +
    `<p style="margin:0;font-size:15px;color:#1e293b;line-height:1.65;">${escapeHtml(ex)}</p>` +
    `</div>` +
    `</div>`;
  return { plain, html };
}

/** Site home (dashboard) — same daily modules as email; derived from volunteer hub URL. */
function dashboardHomeUrl(siteBase) {
  const s = String(siteBase || '').trim() || SITE_DEFAULT;
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    return `${u.origin}/`;
  } catch {
    return 'https://prayercityhtx.com/';
  }
}

function extractRssItemTitles(xml, maxItems) {
  const titles = [];
  const parts = String(xml || '').split('<item');
  for (let i = 1; i < parts.length && titles.length < maxItems; i++) {
    const tm = parts[i].match(/<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/title>/i);
    if (!tm) continue;
    let title = (tm[1] || tm[2] || '').replace(/\s+/g, ' ').trim();
    if (!title || /^google news$/i.test(title)) continue;
    if (title.startsWith('"') && title.endsWith('"')) title = title.slice(1, -1).trim();
    titles.push(title);
  }
  return titles;
}

function isLogisticsRssRelevant(title) {
  const t = String(title || '').toLowerCase();
  const hasWC = /\bworld cup\b/.test(t) || (/\bfifa\b/.test(t) && /\b2026\b/.test(t));
  if (!hasWC) return false;
  if (/\b(premier league|champions league|uefa champions|uefa europa|uefa conference|\bepl\b|la liga|bundesliga|serie a|ligue 1)\b/i.test(t)) {
    return false;
  }
  return (
    t.includes('houston') ||
    t.includes('nrg') ||
    /host cities|host stadium|16\s*cities|all\s*16/i.test(t) ||
    (/\b2026\b/.test(t) &&
      /\b(stadium|venue|schedule|ticket|security|fifa)\b/.test(t) &&
      (t.includes('usa') || t.includes('u.s.') || t.includes('united states') || t.includes('america')))
  );
}

async function fetchLogisticsHeadlineForDigest() {
  const fetchOpts = { headers: { 'User-Agent': 'PrayerCityDailyDigest/1.0 (logistics RSS)' } };
  const seen = new Set();
  const filtered = [];
  try {
    for (const url of LOGISTICS_RSS_FEED_URLS) {
      const res = await fetch(url, fetchOpts);
      if (!res.ok) continue;
      const xml = await res.text();
      const titles = extractRssItemTitles(xml, 40);
      for (const raw of titles) {
        if (!isLogisticsRssRelevant(raw)) continue;
        const key = raw.toLowerCase().slice(0, 120);
        if (seen.has(key)) continue;
        seen.add(key);
        filtered.push(raw);
        if (filtered.length >= 24) break;
      }
      if (filtered.length >= 24) break;
    }
    if (filtered.length === 0) return null;
    const day = Math.floor(Date.now() / 86400000);
    return filtered[day % filtered.length];
  } catch (_) {
    return null;
  }
}

function buildSocialSnippet(siteBase, dateStr) {
  const rng = mulberry32(hashStr(`soc10-${dateStr}`));
  const hooks = pickN(SOCIAL_HOOKS, 10, rng);
  const verses = pickN(SCRIPTURE_LINES, 10, rng);
  const hook = hooks[0];
  const v = verses[0];
  const base = siteBase.replace(/\/?$/, '/');
  const hashtags = '#HoustonPrayerCity #WorldCup #PrayForHouston';
  const body =
    `${hook}\n\n${v.text}\n— ${v.ref} (NIV)\n\nJoin Houston Prayer City — pray, serve, invite: ${base}\n\n${hashtags}`;
  const shareText = `${hook}\n\n${v.text}\n— ${v.ref} (NIV)\n\nJoin Houston Prayer City: ${base}\n\n${hashtags}`;
  const encBase = encodeURIComponent(base);
  const encText = encodeURIComponent(shareText);
  const shareTwitterUrl = `https://twitter.com/intent/tweet?text=${encText}`;
  const shareFacebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encBase}`;
  const shareInstagramUrl = SOCIAL_INSTAGRAM_URL;
  const shareTiktokUrl = SOCIAL_TIKTOK_URL;
  return {
    title: `Suggested post · ${dateStr}`,
    body,
    ref: v.ref,
    hook,
    verseText: v.text,
    verseRef: v.ref,
    hashtags,
    shareTwitterUrl,
    shareFacebookUrl,
    shareInstagramUrl,
    shareTiktokUrl,
  };
}

function buildSocialPostMockupHtml(sn, dateStr) {
  const handle = '@PrayerCityHTX';
  return (
    `<div style="margin-top:6px;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;background:#ffffff;box-shadow:0 10px 36px rgba(15,61,92,0.12);">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">` +
    `<tr><td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;background:linear-gradient(90deg,#f8fafc,#ffffff);">` +
    `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr>` +
    `<td style="width:48px;vertical-align:middle;">` +
    `<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0f3d5c,#0d9488);color:#fff;font-weight:900;font-size:13px;line-height:44px;text-align:center;font-family:system-ui,sans-serif;">PC</div>` +
    `</td><td style="vertical-align:middle;padding-left:12px;">` +
    `<div style="font-weight:800;font-size:15px;color:#0f172a;font-family:system-ui,sans-serif;">Houston Prayer City</div>` +
    `<div style="font-size:13px;color:#64748b;margin-top:2px;">${escapeHtml(handle)} · ${escapeHtml(dateStr)}</div>` +
    `</td></tr></table></td></tr>` +
    `<tr><td style="padding:18px 18px 6px;font-size:16px;color:#0f172a;line-height:1.55;font-family:system-ui,sans-serif;">${escapeHtml(sn.hook)}</td></tr>` +
    `<tr><td style="padding:0 18px 14px;font-size:15px;color:#334155;line-height:1.55;font-style:italic;font-family:Georgia,serif;">“${escapeHtml(sn.verseText)}”</td></tr>` +
    `<tr><td style="padding:0 18px 16px;font-size:13px;color:#475569;font-weight:600;">— ${escapeHtml(sn.verseRef)} (NIV)</td></tr>` +
    `<tr><td style="padding:0 18px 18px;font-size:12px;color:#64748b;line-height:1.5;">${escapeHtml(sn.hashtags)}</td></tr>` +
    `<tr><td style="padding:16px 14px 18px;background:#f8fafc;border-top:1px solid #e2e8f0;">` +
    `<p style="margin:0 0 12px;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">Share this post</p>` +
    `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="border-collapse:collapse;margin:0 auto;">` +
    `<tr>` +
    `<td style="padding:6px;vertical-align:middle;">` +
    `<a href="${escapeHtml(sn.shareTwitterUrl)}" style="display:inline-block;padding:10px 16px;border-radius:9999px;background:#0f1419;color:#ffffff;font-weight:800;font-size:12px;text-decoration:none;font-family:system-ui,sans-serif;">X</a>` +
    `</td>` +
    `<td style="padding:6px;vertical-align:middle;">` +
    `<a href="${escapeHtml(sn.shareFacebookUrl)}" style="display:inline-block;padding:10px 16px;border-radius:9999px;background:#1877f2;color:#ffffff;font-weight:800;font-size:12px;text-decoration:none;font-family:system-ui,sans-serif;">Facebook</a>` +
    `</td>` +
    `</tr><tr>` +
    `<td style="padding:6px;vertical-align:middle;">` +
    `<a href="${escapeHtml(sn.shareInstagramUrl)}" style="display:inline-block;padding:10px 16px;border-radius:9999px;background:linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);color:#ffffff;font-weight:800;font-size:12px;text-decoration:none;font-family:system-ui,sans-serif;">Instagram</a>` +
    `</td>` +
    `<td style="padding:6px;vertical-align:middle;">` +
    `<a href="${escapeHtml(sn.shareTiktokUrl)}" style="display:inline-block;padding:10px 16px;border-radius:9999px;background:#000000;color:#ffffff;font-weight:800;font-size:12px;text-decoration:none;font-family:system-ui,sans-serif;border:1px solid #25f4ee;">TikTok</a>` +
    `</td>` +
    `</tr></table>` +
    `<p style="margin:14px auto 0;font-size:11px;color:#94a3b8;line-height:1.45;text-align:center;max-width:420px;">` +
    `X opens with this full caption ready to post. Facebook opens a share window for your Prayer City link (paste the text above into your post if you want the same words). ` +
    `Instagram and TikTok cannot prefill from email—copy the text above, tap the button to open the app or profile, then paste into a new post or Story.` +
    `</p>` +
    `</td></tr></table></div>`
  );
}

function buildPrayerSection(dateStr) {
  const rng = mulberry32(hashStr(`pray5-${dateStr}`));
  const lines = [];
  for (const theme of PRAYER_THEMES) {
    const pool = theme.prompts.slice();
    const pick = pool[Math.floor(rng() * pool.length)];
    const verse = SCRIPTURE_LINES[Math.floor(rng() * SCRIPTURE_LINES.length)];
    lines.push(`• ${theme.label}: ${pick}\n  Scripture: “${verse.text}” — ${verse.ref}`);
  }
  return lines.join('\n\n');
}

function buildPrayerSectionHtml(dateStr) {
  const rng = mulberry32(hashStr(`pray5-${dateStr}`));
  const parts = [];
  for (const theme of PRAYER_THEMES) {
    const pool = theme.prompts.slice();
    const pick = pool[Math.floor(rng() * pool.length)];
    const verse = SCRIPTURE_LINES[Math.floor(rng() * SCRIPTURE_LINES.length)];
    parts.push(
      `<li style="margin:0 0 14px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;list-style:none;">` +
        `<p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:0.08em;color:#0d9488;text-transform:uppercase;">${escapeHtml(theme.label)}</p>` +
        `<p style="margin:0;font-size:14px;color:#0f172a;line-height:1.55;font-weight:600;">${escapeHtml(pick)}</p>` +
        `<p style="margin:10px 0 0;font-size:13px;color:#475569;line-height:1.5;font-style:italic;">“${escapeHtml(verse.text)}” <span style="font-style:normal;font-weight:600;color:#64748b;">— ${escapeHtml(verse.ref)}</span></p>` +
        `</li>`
    );
  }
  return `<ul style="margin:0;padding:0;">${parts.join('')}</ul>`;
}

function buildCounselorSection(dateStr) {
  const rng = mulberry32(hashStr(`counsel-${dateStr}`));
  const tips = pickN(COUNSELOR_POOL, 3, rng);
  return tips.map((t, i) => `${i + 1}. ${t.title}\n   ${t.tip}\n   (${t.ref})`).join('\n\n');
}

function buildCounselorSectionHtml(dateStr) {
  const rng = mulberry32(hashStr(`counsel-${dateStr}`));
  const tips = pickN(COUNSELOR_POOL, 3, rng);
  return tips
    .map((t, i) => {
      return (
        `<div style="margin-bottom:12px;padding:14px 16px;border-radius:12px;border:1px solid #fde68a;background:linear-gradient(135deg,#fffbeb,#ffffff);">` +
        `<p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#b45309;">Tip ${i + 1} · ${escapeHtml(t.title)}</p>` +
        `<p style="margin:0;font-size:14px;color:#334155;line-height:1.55;">${escapeHtml(t.tip)}</p>` +
        `<p style="margin:10px 0 0;font-size:12px;font-weight:700;color:#0f3d5c;">${escapeHtml(t.ref)}</p>` +
        `</div>`
      );
    })
    .join('');
}

function buildLogisticsStaticSection(dateStr) {
  const rng = mulberry32(hashStr(`logstat-${dateStr}`));
  return pickN(LOGISTICS_STATIC, 4, rng).map((line) => `• ${line}`).join('\n');
}

function buildTipsListHtml(lines) {
  return (
    `<ul style="margin:0;padding:0;">` +
    lines
      .map(
        (line) =>
          `<li style="margin:0 0 10px;padding:12px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;list-style:none;font-size:14px;color:#334155;line-height:1.55;">${escapeHtml(line)}</li>`
      )
      .join('') +
    `</ul>`
  );
}

function buildEmailBannerHtml(dateStr) {
  const daysToVirtual = daysUntilYmd(dateStr, VIRTUAL_INFO_SESSION_DATE);
  const showVirtual =
    typeof daysToVirtual === 'number' && daysToVirtual >= 0;

  const sessionPill = showVirtual
    ? `<div style="margin-top:16px;text-align:center;">` +
      `<span style="display:inline-block;padding:10px 14px;border-radius:9999px;background:rgba(255,255,255,0.14);border:1px solid rgba(147,197,253,0.65);color:rgba(255,255,255,0.96);font-weight:900;font-size:12px;letter-spacing:0.06em;line-height:1.2;">` +
      `VIRTUAL INFO SESSION · ${escapeHtml(VIRTUAL_INFO_SESSION_LABEL)} · ${escapeHtml(VIRTUAL_INFO_SESSION_TIME)}` +
      `</span>` +
      `</div>`
    : '';

  return (
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 28px;border-radius:16px;overflow:hidden;box-shadow:0 14px 44px rgba(15,61,92,0.22);">` +
    `<tr>` +
    `<td style="background:linear-gradient(125deg,#0f3d5c 0%,#0d9488 42%,#1a5f8a 78%,#0f3d5c 100%);padding:28px 20px;text-align:center;">` +
    `<div style="font-size:14px;line-height:1;color:rgba(253,230,138,0.95);margin-bottom:10px;" aria-hidden="true">⚽<span style="color:rgba(255,255,255,0.5);"> · </span>🙏</div>` +
    `<div style="font-size:11px;font-weight:900;letter-spacing:0.42em;color:rgba(255,255,255,0.75);margin-bottom:8px;">HOUSTON</div>` +
    `<div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:900;color:#ffffff;line-height:1.05;text-shadow:0 4px 18px rgba(0,0,0,0.35);letter-spacing:0.02em;">WORLD CUP<br/><span style="color:#fde68a;">PRAYER CITY</span></div>` +
    `<div style="margin-top:14px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.92);letter-spacing:0.12em;">VOLUNTEER HEARTBEAT · HOUSTON</div>` +
    sessionPill +
    `</td></tr></table>`
  );
}

function buildCountdownBlock(dateStr) {
  const days = daysUntilYmd(dateStr, WORLD_CUP_HOUSTON_FIRST_GAME_DATE);
  const targetLabel = formatMdyLongChicago(WORLD_CUP_HOUSTON_FIRST_GAME_DATE);
  if (days == null) return { plain: '', html: '' };

  const clamped = Math.max(0, days);
  const dayWord = clamped === 1 ? 'day' : 'days';
  const plain =
    `COUNTDOWN TO SUNDAY\n` +
    `${clamped} ${dayWord} until the first World Cup games in Houston (${targetLabel}).\n` +
    `We’re excited — not everyone serves on day one, but we’re counting down with joy and we can’t wait to win souls to Christ with you.\n` +
    `Join Thursday’s virtual session (6pm) for tent locations, shuttle details, and serve-day flow.\n` +
    `Let’s fill Houston with prayer and faith — invite one person today.`;

  const html =
    `<div style="margin:-6px 0 22px;border-radius:16px;overflow:hidden;border:1px solid #cbd5e1;background:linear-gradient(135deg,rgba(15,61,92,0.08),rgba(13,148,136,0.12));box-shadow:0 8px 30px rgba(15,61,92,0.12);">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">` +
    `<tr>` +
    `<td style="padding:18px 18px 18px;vertical-align:middle;">` +
    `<div style="font-size:11px;font-weight:900;letter-spacing:0.16em;color:#0f3d5c;text-transform:uppercase;">Countdown to Sunday</div>` +
    `<div style="margin-top:6px;font-family:Georgia,'Times New Roman',serif;font-weight:900;color:#0f172a;line-height:1.05;font-size:22px;">` +
    `${clamped} <span style="color:#0d9488;">${dayWord}</span> to kickoff in Houston` +
    `</div>` +
    `<div style="margin-top:8px;font-size:13px;color:#334155;line-height:1.5;">` +
    `First World Cup games in Houston: <strong>${escapeHtml(targetLabel)}</strong>. ` +
    `We’re counting down with excitement — ready to <strong>win souls to Christ</strong>. ` +
    `Thursday virtual session (6pm) + your dashboard have shuttle, tent, and serve-day details.` +
    `</div>` +
    `</td>` +
    `<td style="width:116px;padding:0 14px 0 0;vertical-align:middle;text-align:center;">` +
    `<div style="display:inline-block;padding:12px 12px;border-radius:16px;background:rgba(255,255,255,0.85);border:1px solid rgba(148,163,184,0.55);">` +
    `<div style="font-size:10px;font-weight:900;letter-spacing:0.14em;color:#64748b;text-transform:uppercase;">Days</div>` +
    `<div style="margin-top:6px;font-size:30px;font-weight:900;color:#0f3d5c;line-height:1;">${clamped}</div>` +
    `</div>` +
    `</td>` +
    `</tr>` +
    `</table>` +
    `</div>`;

  return { plain, html };
}

function buildVolunteerDigestSubject_(dateStr) {
  const days = daysUntilYmd(dateStr, WORLD_CUP_HOUSTON_FIRST_GAME_DATE);
  if (typeof days === 'number' && days >= 0) {
    const clamped = Math.max(0, days);
    const dayWord = clamped === 1 ? 'day' : 'days';
    return `${clamped} ${dayWord} to Sunday · ${DIGEST_EMAIL_SUBJECT}`;
  }
  return DIGEST_EMAIL_SUBJECT;
}

function buildVirtualInfoSessionBlock(dateStr) {
  const days = daysUntilYmd(dateStr, VIRTUAL_INFO_SESSION_DATE);
  if (days == null || days < 0) return { plain: '', html: '' };

  const plain =
    `VIRTUAL INFORMATION SESSION (PLEASE ATTEND)\n` +
    `${VIRTUAL_INFO_SESSION_LABEL} at ${VIRTUAL_INFO_SESSION_TIME} ${VIRTUAL_INFO_SESSION_TIMEZONE}\n\n` +
    `Thank you to everyone who joined us for Prayer City training — we are grateful for you. ` +
    `If you missed the in-person night, please join us virtually. Your attendance matters: ` +
    `prayer tent locations, parking and shuttle arrangements to NRG Stadium, team details, and everything you need before our first serve day this Sunday.\n\n` +
    `Join on Zoom:\n${PRAYERCITY_ZOOM_URL}`;

  const html =
    `<div style="margin:0 0 24px;border-radius:16px;border:1px solid #93c5fd;background:linear-gradient(135deg,#eff6ff,#ffffff);overflow:hidden;box-shadow:0 10px 36px rgba(37,99,235,0.14);">` +
    `<div style="height:4px;background:linear-gradient(90deg,#2563eb,#0d9488,#0f3d5c);"></div>` +
    `<div style="padding:18px 20px 20px;">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.14em;color:#1d4ed8;text-transform:uppercase;">Important · All volunteers</p>` +
    `<h2 style="margin:0 0 10px;font-size:18px;font-weight:900;color:#0f172a;letter-spacing:-0.01em;">Virtual information session — please attend</h2>` +
    `<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.65;">` +
    `Thank you to everyone who joined us for <strong>Prayer City training</strong>. If you were not able to attend in person, please join us virtually — we will share ` +
    `<strong>prayer tent locations</strong>, <strong>parking and shuttle plans</strong> to NRG Stadium, and everything you need before our first serve day this <strong>Sunday</strong>.` +
    `</p>` +
    `<p style="margin:0;font-size:15px;font-weight:900;color:#0f172a;">` +
    `${escapeHtml(VIRTUAL_INFO_SESSION_LABEL)} · ${escapeHtml(VIRTUAL_INFO_SESSION_TIME)} ` +
    `<span style="font-weight:600;color:#475569;">${escapeHtml(VIRTUAL_INFO_SESSION_TIMEZONE)}</span>` +
    `</p>` +
    `<p style="margin:14px 0 0;">` +
    `<a href="${escapeHtml(PRAYERCITY_ZOOM_URL)}" style="display:inline-block;padding:12px 18px;border-radius:9999px;background:#2563eb;color:#ffffff;font-weight:900;font-size:13px;text-decoration:none;box-shadow:0 6px 18px rgba(37,99,235,0.22);">Join Zoom meeting →</a>` +
    `</p>` +
    `<p style="margin:12px 0 0;font-size:12px;color:#64748b;word-break:break-all;">${escapeHtml(PRAYERCITY_ZOOM_URL)}</p>` +
    `</div></div>`;

  return { plain, html };
}

function buildTshirtVolunteerBlock() {
  const plain =
    `PRAYER CITY T-SHIRTS\n` +
    `We are printing Houston Prayer City volunteer T-shirts. Please reply to this email with your shirt size (S, M, L, XL, 2XL, or 3XL).\n\n` +
    `If you are able to make a donation toward your shirt, that would be wonderful — much appreciated:\n` +
    PRAYERCITY_DONATION_URL;

  const html =
    `<div style="margin:0 0 24px;border-radius:16px;border:1px solid #e2e8f0;background:#ffffff;overflow:hidden;box-shadow:0 4px 18px rgba(15,61,92,0.08);">` +
    `<div style="padding:18px 20px 20px;">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.14em;color:#0d9488;text-transform:uppercase;">Prayer City volunteer T-shirts</p>` +
    `<img src="${escapeHtml(PRAYERCITY_TSHIRT_IMAGE_URL)}" alt="Houston Prayer City volunteer T-shirt" width="600" style="width:100%;max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;display:block;margin:0 0 14px;" />` +
    `<p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.65;">` +
    `We are printing <strong>Houston Prayer City</strong> shirts for our volunteer family. Please <strong>reply to this email</strong> with your size: <strong>S, M, L, XL, 2XL, or 3XL</strong>.` +
    `</p>` +
    `<p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.65;">` +
    `If you are able to make a donation toward your shirt, that would be wonderful — much appreciated (100% to the movement via Zeffy).` +
    `</p>` +
    `<a href="${escapeHtml(PRAYERCITY_DONATION_URL)}" style="display:inline-block;padding:12px 18px;border-radius:9999px;background:linear-gradient(90deg,#0f3d5c,#0d9488);color:#ffffff;font-weight:900;font-size:13px;text-decoration:none;">Give via Zeffy →</a>` +
    `</div></div>`;

  return { plain, html };
}

function buildVideoShareBlock(siteBase) {
  const signupUrl = String(siteBase || PRAYERCITY_SIGNUP_URL).replace(/\/?$/, '/') || PRAYERCITY_SIGNUP_URL;
  const videoUrl = PRAYERCITY_VIDEO_YOUTUBE_URL;
  const thumbUrl = 'https://img.youtube.com/vi/3Sn8ysMi1Lk/maxresdefault.jpg';

  const plain =
    `ALL ABOUT PRAYER CITY (VIDEO)\n` +
    `${videoUrl}\n\n` +
    `Please share this with friends and family — and invite them to sign up:\n${signupUrl}`;

  const html =
    `<div style="margin:0 0 24px;border-radius:16px;border:1px solid #cbd5e1;background:#ffffff;overflow:hidden;box-shadow:0 10px 36px rgba(15,61,92,0.12);">` +
    `<div style="padding:18px 20px 0;">` +
    `<p style="margin:0 0 6px;font-size:11px;font-weight:900;letter-spacing:0.14em;color:#0d9488;text-transform:uppercase;">Share this today</p>` +
    `<h2 style="margin:0 0 10px;font-size:18px;font-weight:900;color:#0f172a;letter-spacing:-0.01em;">All About Prayer City (video)</h2>` +
    `<p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">` +
    `Would you help us spread the word? Share this video with your friends and family and invite them to sign up. Let’s build anticipation and fill Houston with prayer, love, and Gospel courage.` +
    `</p>` +
    `</div>` +
    `<a href="${escapeHtml(videoUrl)}" style="display:block;text-decoration:none;" target="_blank" rel="noopener noreferrer">` +
    `<div style="margin:14px 20px 0;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;background:#0f172a;">` +
    `<img src="${escapeHtml(thumbUrl)}" alt="All About Prayer City video thumbnail" width="600" style="display:block;width:100%;height:auto;max-width:100%;" />` +
    `</div>` +
    `<div style="padding:12px 20px 0;color:#0f3d5c;font-weight:900;font-size:13px;">Tap to watch on YouTube →</div>` +
    `</a>` +
    `<div style="padding:16px 20px 20px;">` +
    `<a href="${escapeHtml(signupUrl)}" style="display:inline-block;padding:12px 18px;border-radius:9999px;background:linear-gradient(90deg,#0f3d5c,#0d9488);color:#ffffff;font-weight:900;font-size:13px;text-decoration:none;box-shadow:0 6px 18px rgba(15,61,92,0.22);">Invite someone to sign up</a>` +
    `</div>` +
    `</div>`;

  return { plain, html };
}

function digestSectionCardHtml(eyebrow, title, bodyHtml, accent) {
  const bar =
    accent === 'gold'
      ? '#c9a227'
      : accent === 'navy'
        ? '#1a5f8a'
        : '#0d9488';
  return (
    `<div style="margin:0 0 24px;border-radius:16px;border:1px solid #e2e8f0;background:#ffffff;overflow:hidden;box-shadow:0 4px 18px rgba(15,61,92,0.07);">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr>` +
    `<td width="5" style="background:${bar};"></td>` +
    `<td style="padding:20px 22px 22px;">` +
    (eyebrow
      ? `<p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:0.14em;color:#94a3b8;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>`
      : '') +
    `<h2 style="margin:0 0 14px;font-size:15px;font-weight:900;letter-spacing:0.06em;color:#0f172a;text-transform:uppercase;font-family:system-ui,sans-serif;">${escapeHtml(title)}</h2>` +
    `${bodyHtml}` +
    `</td></tr></table></div>`
  );
}

/**
 * @param {{
 *   email?: string,
 *   name?: string,
 *   shifts?: string,
 *   position?: string,
 *   timeslot?: string,
 *   tent?: string,
 *   siteBase?: string,
 *   digestUnsubscribeSecret?: string,
 *   digestUnsubscribeBaseUrl?: string,
 *   digestResubscribeBaseUrl?: string,
 * }} vol
 */
async function buildDailyVolunteerDigest(vol) {
  const siteBase = (vol.siteBase || SITE_DEFAULT).replace(/\/?$/, '');
  const dateStr = todayYmdChicago();
  const combined = [vol.shifts || '', vol.position || '', vol.timeslot || '', vol.tent || ''].join(' ');
  const roles = findRolesFromShifts(combined);
  if (roles.length === 0) {
    return null;
  }

  const displayDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const firstName = firstNameFromVolunteerName(vol.name);
  const dearName = firstName ? `Dear ${firstName},` : 'Dear volunteer,';
  const dashboardUrl = dashboardHomeUrl(siteBase);

  const sections = [];
  const htmlChunks = [];

  if (roles.some((r) => r.id === 'social-media')) {
    const sn = buildSocialSnippet(siteBase, dateStr);
    sections.push(`TODAY’S POST (FOR SHARING)\n\n${sn.body}`);
    htmlChunks.push(
      digestSectionCardHtml(
        'Social team',
        'Today’s post for you',
        buildSocialPostMockupHtml(sn, dateStr),
        'navy'
      )
    );
  }

  if (roles.some((r) => r.id === 'prayer-partners')) {
    const block = buildPrayerSection(dateStr);
    sections.push(`Prayer Points for Today\n\n${block}`);
    htmlChunks.push(
      digestSectionCardHtml('', 'Prayer Points for Today', buildPrayerSectionHtml(dateStr), 'teal')
    );
  }

  if (roles.some((r) => r.id === 'counselors')) {
    const block = buildCounselorSection(dateStr);
    sections.push(`Tips for the Day\n\n${block}`);
    htmlChunks.push(
      digestSectionCardHtml('Counseling', 'Tips for the Day', buildCounselorSectionHtml(dateStr), 'gold')
    );
  }

  if (roles.some((r) => r.id === 'photography-video')) {
    const photoRng = mulberry32(hashStr(`photo-${dateStr}`));
    const photoLines = pickN(PHOTO_DIGEST_LINES, 3, photoRng);
    const block = photoLines.map((line) => `• ${line}`).join('\n');
    sections.push(`Tips for the Day\n\n${block}`);
    htmlChunks.push(
      digestSectionCardHtml('Photo & video', 'Tips for the Day', buildTipsListHtml(photoLines), 'navy')
    );
  }

  if (roles.some((r) => r.id === 'logistics-welfare')) {
    const staticTips = buildLogisticsStaticSection(dateStr);
    let block = `${staticTips}`;
    const headline = await fetchLogisticsHeadlineForDigest();
    if (headline) {
      block += `\n\nHouston / World Cup 2026 (news snapshot)\n“${headline}”`;
    }
    sections.push(`Tips for the Day\n\n${block}`);
    const lines = staticTips.split('\n').map((l) => l.replace(/^•\s*/, '').trim());
    let inner = '';
    if (headline) {
      inner +=
        `<div style="margin-bottom:16px;padding:14px 16px;border-radius:12px;background:linear-gradient(135deg,rgba(13,148,136,0.1),#ecfeff);border:1px solid #99f6e4;">` +
        `<p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#0f766e;letter-spacing:0.1em;text-transform:uppercase;">Houston · World Cup 2026</p>` +
        `<p style="margin:0;font-size:14px;color:#0f172a;font-weight:700;line-height:1.45;">${escapeHtml(headline)}</p>` +
        `<p style="margin:8px 0 0;font-size:11px;color:#0f766e;">Curated headline (Google News)</p>` +
        `</div>`;
    }
    inner += buildTipsListHtml(lines);
    htmlChunks.push(
      digestSectionCardHtml('Logistics & welfare', 'Tips for the Day', inner, 'teal')
    );
  }

  const roleLabels = roles.map((r) => r.label).join(' · ');
  const daysToVirtual = daysUntilYmd(dateStr, VIRTUAL_INFO_SESSION_DATE);
  const subject = buildVolunteerDigestSubject_(dateStr);

  const introPlain =
    `${dearName}\n\n` +
    `Thank you to everyone who joined us for Prayer City training — we are truly grateful for you.\n\n` +
    (typeof daysToVirtual === 'number' && daysToVirtual >= 0
      ? `Please join our virtual information session on ${VIRTUAL_INFO_SESSION_LABEL} at ${VIRTUAL_INFO_SESSION_TIME} ${VIRTUAL_INFO_SESSION_TIMEZONE} — all you need to know before Sunday: prayer tent locations, parking and shuttle to NRG Stadium, and key serve-day details.\n\n` +
        `Zoom: ${PRAYERCITY_ZOOM_URL}\n\n`
      : '') +
    `Thank you for walking with us as a Houston Prayer City volunteer. Here is your encouragement and focus for today (${displayDate}) — shaped by your role(s): ${roleLabels}.\n\n` +
    `Whenever you want the full dashboard — prayer points, serving tips, social inspiration, and more — it’s ready for you here:\n${dashboardUrl}\n`;

  const universalSpirit = buildUniversalDailySpiritualBlock(dateStr);

  const countdown = buildCountdownBlock(dateStr);
  const serveDay = buildServeDayFlowBlock({
    roleIds: roles.map((r) => r.id),
    tent: vol.tent || '',
  });
  const virtualSession = buildVirtualInfoSessionBlock(dateStr);
  const tshirt = buildTshirtVolunteerBlock();
  const video = buildVideoShareBlock(siteBase);

  const closingPlain = `\n\nWith gratitude,\n\nDamilola\nPrayer City HTX`;

  const unsub = buildDigestUnsubscribeFooter(
    vol.email,
    vol.digestUnsubscribeSecret,
    vol.digestUnsubscribeBaseUrl
  );
  const resub = buildDigestResubscribeFooter(
    vol.email,
    vol.digestUnsubscribeSecret,
    vol.digestResubscribeBaseUrl
  );

  const plainBody =
    introPlain +
    (countdown.plain ? `\n\n---\n\n${countdown.plain}` : '') +
    (serveDay.plain ? `\n\n---\n\n${serveDay.plain}` : '') +
    (virtualSession.plain ? `\n\n---\n\n${virtualSession.plain}` : '') +
    (tshirt.plain ? `\n\n---\n\n${tshirt.plain}` : '') +
    (video.plain ? `\n\n---\n\n${video.plain}` : '') +
    `\n\n` +
    universalSpirit.plain +
    `\n\n---\n\n` +
    `${sections.join('\n\n---\n\n')}` +
    closingPlain +
    unsub.plain +
    (resub.plain ? `\n${resub.plain}` : '');

  const introHtml =
    `<p style="margin:0;font-size:18px;color:#0f172a;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(dearName)}</p>` +
    `<p style="margin:14px 0 0;font-size:15px;color:#334155;line-height:1.65;">Thank you to everyone who joined us for <strong>Prayer City training</strong> — your presence and prayers blessed our city. We are truly grateful for you.</p>` +
    (typeof daysToVirtual === 'number' && daysToVirtual >= 0
      ? `<p style="margin:14px 0 0;font-size:15px;color:#334155;line-height:1.65;">Please join our <strong>virtual information session</strong> on <strong>${escapeHtml(VIRTUAL_INFO_SESSION_LABEL)}</strong> at <strong>${escapeHtml(VIRTUAL_INFO_SESSION_TIME)}</strong> ${escapeHtml(VIRTUAL_INFO_SESSION_TIMEZONE)} — <strong>all you need to know before Sunday</strong>: prayer tent locations, parking, shuttle to NRG Stadium, and key serve-day details.</p>`
      : '') +
    `<p style="margin:14px 0 0;font-size:15px;color:#334155;line-height:1.65;">Thank you for walking with us as a <strong style="color:#0f3d5c;">Houston Prayer City</strong> volunteer. Here is your encouragement and focus for <strong style="color:#0f3d5c;">${escapeHtml(displayDate)}</strong> — shaped by your role(s): <span style="color:#0f766e;font-weight:700;">${escapeHtml(roleLabels)}</span>.</p>` +
    `<p style="margin:14px 0 0;font-size:15px;color:#334155;line-height:1.65;">Whenever you want the full dashboard — prayer points, serving tips, social inspiration, and more — it’s ready for you whenever you open it.</p>` +
    `<p style="margin:20px 0 0;text-align:center;">` +
    `<a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:14px 28px;border-radius:9999px;background:linear-gradient(90deg,#0f3d5c,#0d9488);color:#ffffff;font-weight:800;font-size:15px;text-decoration:none;box-shadow:0 6px 20px rgba(15,61,92,0.28);">Open your volunteer dashboard</a>` +
    `</p>`;

  const closingHtml =
    `<div style="margin-top:32px;padding-top:22px;border-top:1px solid #e2e8f0;">` +
    `<p style="margin:0;font-size:15px;color:#334155;line-height:1.65;">With gratitude,</p>` +
    `<p style="margin:12px 0 0;font-size:16px;color:#0f3d5c;font-weight:800;">Damilola</p>` +
    `<p style="margin:4px 0 0;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#c9a227;text-transform:uppercase;">Prayer City HTX</p>` +
    `</div>`;

  const sep =
    `<div style="height:1px;background:linear-gradient(90deg,transparent,rgba(148,163,184,0.55),transparent);margin:10px 0 26px;"></div>`;

  const htmlBody =
    `<div style="background:linear-gradient(180deg,#e0f2fe 0%,#f8fafc 48%,#ffffff 100%);padding:28px 12px 40px;">` +
    `<div style="max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">` +
    buildEmailBannerHtml(dateStr) +
    countdown.html +
    introHtml +
    sep +
    serveDay.html +
    sep +
    virtualSession.html +
    (virtualSession.html ? sep : '') +
    tshirt.html +
    sep +
    video.html +
    sep +
    universalSpirit.html +
    sep +
    htmlChunks.join(sep) +
    closingHtml +
    unsub.html +
    resub.html +
    `</div></div>`;

  return { subject, plainBody, htmlBody, roleIds: roles.map((r) => r.id) };
}

module.exports = {
  todayYmdChicago,
  findRolesFromShifts,
  buildDailyVolunteerDigest,
  digestUnsubscribeToken,
  digestResubscribeToken,
  SITE_DEFAULT,
};
