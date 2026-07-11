/**
 * Serve-day flow — tent, parking, coordinator check-in (all volunteer roles).
 */
(function (global) {
  var assets = global.PrayerCityAssets || {};
  var assetUrl =
    typeof assets.assetUrl === 'function'
      ? assets.assetUrl
      : function (p) {
          return p;
        };

  var TENT_ADDRESS = '1325 La Concha Lane, Houston, TX';
  var TENT_MAP_QUERY = encodeURIComponent(TENT_ADDRESS);
  var TENT_MAP_URL =
    'https://www.google.com/maps/search/?api=1&query=' + TENT_MAP_QUERY;
  var TENT_MAP_EMBED_URL =
    'https://maps.google.com/maps?q=' + TENT_MAP_QUERY + '&z=16&output=embed';

  var CFG = {
    tentAddress: TENT_ADDRESS,
    parkingNote:
      'Free street parking is available near the prayer tents at 1325 La Concha Lane, Houston, TX. Arrive a few minutes early to find a spot.',
    tentMapUrl: TENT_MAP_URL,
    mapEmbedUrl: TENT_MAP_EMBED_URL,
    tentImage: assets.tentSetup || assetUrl('images/prayer-city-tent-setup.png'),
    coordinatorName: 'Tricia Hill',
    coordinatorTitle: 'Prayer City Coordinator',
    coordinatorPhone: '832-277-3831',
  };

  var ROLE_ON_SHIFT = {
    'prayer-partners':
      'Welcome guests, listen, pray, and point hearts to Jesus. Join morning worship at the tent when you can — even if your shift starts later.',
    counselors:
      'Serve in your assigned zone with calm gospel conversations. Win souls to Christ with love. Coordinate with the coordinator for referrals.',
    'logistics-welfare':
      'Keep supplies, shade, snacks, and flow smooth. Support guests and volunteers at the tent.',
    'photography-video':
      'Capture the story respectfully (ask consent). Cover your assigned area; upload selects via dashboard when you can.',
    'social-media':
      'Share hope-filled updates from your assigned area. Invite others to Prayer City — humble, invitational, Christ-centered.',
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function rolesFromVolunteer(d) {
    if (typeof global.findVolunteerRolesFromShifts !== 'function') return [];
    var combined = [d.shifts || '', d.position || '', d.timeslot || '', d.tent || ''].join(' ');
    return global.findVolunteerRolesFromShifts(combined);
  }

  function phoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function phoneLinkHtml(phone) {
    if (!phone) return '';
    return (
      '<a href="tel:' +
      esc(phoneDigits(phone)) +
      '" class="text-brand hover:underline">' +
      esc(phone) +
      '</a>'
    );
  }

  function contactsHtml(showContacts, d) {
    if (!showContacts) {
      return (
        '<div class="rounded-xl border border-slate-200 bg-white p-4">' +
        '<p class="text-sm text-slate-600 leading-relaxed">' +
        '<i class="fas fa-lock text-slate-400 mr-1" aria-hidden="true"></i>' +
        '<strong>Day-of phone number</strong> for Tricia Hill (Prayer City Coordinator) is shown when you ' +
        '<a href="/" class="text-brand font-semibold hover:underline">sign in to your dashboard</a> or ' +
        '<a href="volunteer-hub.html" class="text-brand font-semibold hover:underline">volunteer hub</a>.' +
        '</p></div>'
      );
    }
    var coordPhone = String(d.coordinatorPhone || CFG.coordinatorPhone || '').trim();
    return (
      '<div class="rounded-xl border border-slate-200 bg-white p-4">' +
      '<p class="text-xs font-bold uppercase text-slate-500">' +
      esc(CFG.coordinatorName) +
      ' · Coordinator</p>' +
      '<p class="text-sm font-semibold text-slate-900 mt-1">' +
      phoneLinkHtml(coordPhone) +
      '</p>' +
      '<p class="text-xs text-slate-500 mt-2">Call if you need help finding the tent on serve day.</p></div>' +
      '<div class="rounded-xl border border-rose-200/80 bg-rose-50/50 p-4">' +
      '<p class="text-xs font-bold uppercase text-rose-800 tracking-wide">Day-of emergency</p>' +
      '<p class="text-sm text-slate-700 mt-2 leading-relaxed">Lost, running late, or need help on serve day? Call <strong>' +
      esc(CFG.coordinatorName) +
      '</strong> at ' +
      phoneLinkHtml(coordPhone) +
      '.</p></div>'
    );
  }

  function renderServeDayFlow(container, volunteerData, opts) {
    if (!container) return;
    var d = volunteerData || {};
    opts = opts || {};
    var showContacts = !!opts.showContacts;
    var roles = rolesFromVolunteer(d);
    var tent = String(d.tent || '').trim();
    var tentLabel = tent
      ? esc(tent) + ' · ' + esc(CFG.tentAddress)
      : esc(CFG.tentAddress);

    var roleBlocks = '';
    if (roles.length) {
      roles.forEach(function (g) {
        var tip = ROLE_ON_SHIFT[g.id] || '';
        roleBlocks +=
          '<div class="rounded-xl border border-slate-100 bg-slate-50/80 p-4">' +
          '<p class="text-sm font-bold text-brand flex items-center gap-2">' +
          '<i class="fas ' +
          esc(g.icon) +
          '"></i>' +
          esc(g.label) +
          '</p>' +
          '<p class="text-sm text-slate-600 mt-2 leading-relaxed">' +
          esc(tip) +
          '</p></div>';
      });
    } else {
      roleBlocks =
        '<p class="text-sm text-slate-600">Your coordinator will direct you based on your signup after check-in.</p>';
    }

    container.innerHTML =
      '<div class="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-soft/40 via-white to-teal-50/30 shadow-card overflow-hidden">' +
      '<div class="px-4 sm:px-6 py-5 border-b border-slate-100 bg-white/80">' +
      '<p class="text-xs font-bold uppercase tracking-wider text-teal-700">Serve day · NRG area</p>' +
      '<h2 class="text-xl sm:text-2xl font-bold text-slate-900 mt-1">World Cup Houston — let’s win souls to Christ</h2>' +
      '<p class="text-sm text-slate-600 mt-2 leading-relaxed max-w-3xl">Not everyone serves on the very first game day — but we’re counting down with excitement for this season. When <strong>your</strong> shift comes, follow this flow.</p>' +
      '</div>' +
      '<div class="p-4 sm:p-6 space-y-6">' +
      '<div class="grid md:grid-cols-2 gap-5">' +
      '<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">' +
      '<h3 class="text-sm font-bold text-slate-900 uppercase tracking-wide">Parking · free street parking</h3>' +
      '<p class="text-sm font-semibold text-slate-900 mt-3">' +
      esc(CFG.tentAddress) +
      '</p>' +
      '<p class="text-sm text-teal-800 font-medium mt-2">' +
      esc(CFG.parkingNote) +
      '</p>' +
      '<a href="' +
      esc(CFG.tentMapUrl) +
      '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-brand hover:underline">' +
      '<i class="fas fa-map-marker-alt"></i> Open map</a>' +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">' +
      '<h3 class="text-sm font-bold text-slate-900 uppercase tracking-wide">Prayer tents · NRG area</h3>' +
      '<img src="' +
      esc(CFG.tentImage) +
      '" alt="Prayer City tent example" class="w-full rounded-lg border border-slate-100 mt-3" loading="lazy" />' +
      '<p class="text-sm font-semibold text-slate-900 mt-3">' +
      esc(CFG.tentAddress) +
      '</p>' +
      '<p class="text-xs text-slate-500 mt-2">All Prayer City tents are at this address.</p>' +
      '<p class="text-sm font-semibold text-brand mt-3">Your assigned tent: <span class="text-slate-900">' +
      tentLabel +
      '</span></p>' +
      '<a href="' +
      esc(CFG.tentMapUrl) +
      '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-brand hover:underline">' +
      '<i class="fas fa-map-marker-alt"></i> Open tent map</a>' +
      '</div></div>' +
      '<div class="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">' +
      '<div class="px-4 py-3 border-b border-slate-100 bg-slate-50/80">' +
      '<h3 class="text-sm font-bold text-slate-900 uppercase tracking-wide">Map</h3>' +
      '</div>' +
      '<iframe title="Prayer City tent & parking map" src="' +
      esc(CFG.mapEmbedUrl) +
      '" class="w-full h-56 sm:h-64 border-0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' +
      '</div>' +
      '<div class="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 sm:p-5">' +
      '<h3 class="text-sm font-bold text-amber-950 uppercase tracking-wide">Your step-by-step flow</h3>' +
      '<ol class="mt-3 space-y-2 text-sm text-slate-700 list-decimal list-inside leading-relaxed">' +
      '<li>Park on the street near <strong>' +
      esc(CFG.tentAddress) +
      '</strong> (free street parking).</li>' +
      '<li>Walk to the prayer tents and check in with <strong>' +
      esc(CFG.coordinatorName) +
      '</strong> at ' +
      phoneLinkHtml(CFG.coordinatorPhone) +
      '.</li>' +
      '<li>Receive your T-shirt, volunteer tags, and briefing.</li>' +
      '<li>Join morning worship &amp; prayer at the tent; ' +
      esc(CFG.coordinatorName) +
      ' will pray with you if your shift starts later.</li>' +
      '<li>Get materials; serve in your assigned area.</li>' +
      (showContacts
        ? '<li>Coordinator phone number is listed below.</li>'
        : '<li>Sign in to see Tricia’s day-of phone number.</li>') +
      '</ol></div>' +
      contactsHtml(showContacts, d) +
      '<div><h3 class="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">On shift — your role</h3>' +
      '<div class="space-y-3">' +
      roleBlocks +
      '</div></div>' +
      '<div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-600 leading-relaxed space-y-2">' +
      '<p><strong class="text-slate-800">Serving as a group?</strong> Email <a href="mailto:ddbs.htx@gmail.com" class="text-brand font-semibold hover:underline">ddbs.htx@gmail.com</a> with your names and dates — see <a href="faq.html" class="text-brand font-semibold hover:underline">FAQ</a> for details.</p>' +
      '<p><strong class="text-slate-800">Serving remotely?</strong> Social Media &amp; Virtual Support volunteers share daily posts from your <a href="/" class="text-brand font-semibold hover:underline">dashboard</a> on game days — no travel needed.</p>' +
      '<p><strong class="text-slate-800">Friday June 26:</strong> evening volunteer shifts run <strong>6:00 PM – 10:00 PM</strong>. All other serve days: shifts start at <strong>11:00 AM</strong>.</p>' +
      '</div>' +
      '</div></div>';
  }

  function formatTentDisplay(tent) {
    var label = String(tent || '').trim();
    if (label) {
      return label + ' · ' + CFG.tentAddress;
    }
    return CFG.tentAddress;
  }

  global.PrayerCityServeDay = {
    CFG: CFG,
    ROLE_ON_SHIFT: ROLE_ON_SHIFT,
    formatTentDisplay: formatTentDisplay,
    renderServeDayFlow: renderServeDayFlow,
  };
})(typeof window !== 'undefined' ? window : this);
