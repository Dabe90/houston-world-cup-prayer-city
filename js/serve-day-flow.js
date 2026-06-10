/**
 * Serve-day flow — shuttle, tent, coordinator check-in (all volunteer roles).
 */
(function (global) {
  var assets = global.PrayerCityAssets || {};
  var assetUrl =
    typeof assets.assetUrl === 'function'
      ? assets.assetUrl
      : function (p) {
          return p;
        };

  var CFG = {
    shuttleName: 'Walmart',
    shuttleAddress: '2391 S Wayside Dr, Houston, TX 77023',
    shuttleParking:
      'Park on the left side next to Automotive and Curbside Pick-up.',
    shuttleMapUrl:
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent('Walmart 2391 S Wayside Dr Houston TX 77023'),
    shuttleBusImage: assets.shuttleBus || assetUrl('images/prayer-city-shuttle-bus.png'),
    tentImage: assets.tentSetup || assetUrl('images/prayer-city-tent-setup.png'),
    coordinatorName: 'Tricia Hill',
    coordinatorTitle: 'Prayer City Coordinator',
    coordinatorPhone: '346-664-8066',
    shuttleDriverName: 'Claudia',
    shuttleDriverPhone: '979-231-6324',
    shuttleInterval: 'about every 30 minutes',
  };

  var ROLE_ON_SHIFT = {
    'prayer-partners':
      'Welcome guests, listen, pray, and point hearts to Jesus. Join morning worship at the tent when you can — even if your shift starts later.',
    counselors:
      'Serve in your assigned zone with calm gospel conversations. Win souls to Christ with love. Coordinate with the coordinator for referrals.',
    'logistics-welfare':
      'Keep supplies, shade, snacks, and flow smooth. Support guests and volunteers; shuttle runs every 30 minutes back to the Walmart lot.',
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
        '<strong>Day-of phone numbers</strong> (shuttle driver &amp; coordinator) are shown when you ' +
        '<a href="/" class="text-brand font-semibold hover:underline">sign in to your dashboard</a> or ' +
        '<a href="volunteer-hub.html" class="text-brand font-semibold hover:underline">volunteer hub</a>.' +
        '</p></div>'
      );
    }
    var shuttleName = String(d.shuttleDriverName || CFG.shuttleDriverName || 'Shuttle driver').trim();
    var shuttlePhone = String(d.shuttleDriverPhone || CFG.shuttleDriverPhone || '').trim();
    var coordPhone = String(d.coordinatorPhone || CFG.coordinatorPhone || '').trim();
    return (
      '<div class="grid sm:grid-cols-2 gap-4">' +
      '<div class="rounded-xl border border-slate-200 bg-white p-4">' +
      '<p class="text-xs font-bold uppercase text-slate-500">Shuttle driver</p>' +
      '<p class="text-sm font-semibold text-slate-900 mt-1">' +
      esc(shuttleName) +
      '</p>' +
      '<p class="text-sm font-semibold text-slate-900 mt-0.5">' +
      phoneLinkHtml(shuttlePhone) +
      '</p></div>' +
      '<div class="rounded-xl border border-slate-200 bg-white p-4">' +
      '<p class="text-xs font-bold uppercase text-slate-500">' +
      esc(CFG.coordinatorName) +
      ' · Coordinator</p>' +
      '<p class="text-sm font-semibold text-slate-900 mt-1">' +
      phoneLinkHtml(coordPhone) +
      '</p></div></div>' +
      '<div class="rounded-xl border border-rose-200/80 bg-rose-50/50 p-4">' +
      '<p class="text-xs font-bold uppercase text-rose-800 tracking-wide">Day-of emergency</p>' +
      '<p class="text-sm text-slate-700 mt-2 leading-relaxed">Lost, running late, or need help on serve day? Call <strong>' +
      esc(shuttleName) +
      '</strong> (shuttle) at ' +
      phoneLinkHtml(shuttlePhone) +
      ' or <strong>' +
      esc(CFG.coordinatorName) +
      '</strong> (coordinator) at ' +
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
    var tentLabel = tent ? esc(tent) : 'See your dashboard after check-in';

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
      '<h3 class="text-sm font-bold text-slate-900 uppercase tracking-wide">Prayer City Shuttle Bus</h3>' +
      '<img src="' +
      esc(CFG.shuttleBusImage) +
      '" alt="Prayer City Shuttle Bus" class="w-full rounded-lg border border-slate-100 mt-3" loading="lazy" />' +
      '<p class="text-sm font-semibold text-slate-900 mt-3">' +
      esc(CFG.shuttleName) +
      '</p>' +
      '<p class="text-sm text-slate-600">' +
      esc(CFG.shuttleAddress) +
      '</p>' +
      '<p class="text-sm text-teal-800 font-medium mt-2">' +
      esc(CFG.shuttleParking) +
      '</p>' +
      '<p class="text-xs text-slate-500 mt-2">Look for <strong>Prayer City Shuttle Bus</strong> on the vehicle. Runs ' +
      esc(CFG.shuttleInterval) +
      ' — to NRG tents and back to your car all day.</p>' +
      '<a href="' +
      esc(CFG.shuttleMapUrl) +
      '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-brand hover:underline">' +
      '<i class="fas fa-map-marker-alt"></i> Open pick-up map</a>' +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">' +
      '<h3 class="text-sm font-bold text-slate-900 uppercase tracking-wide">Prayer tent (NRG · &lt; 5 min from stadium)</h3>' +
      '<img src="' +
      esc(CFG.tentImage) +
      '" alt="Prayer City tent example" class="w-full rounded-lg border border-slate-100 mt-3" loading="lazy" />' +
      '<p class="text-xs text-slate-500 mt-2">Exact location announced soon — this is what to expect.</p>' +
      '<p class="text-sm font-semibold text-brand mt-3">Your assigned tent: <span class="text-slate-900">' +
      tentLabel +
      '</span></p>' +
      '</div></div>' +
      '<div class="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 sm:p-5">' +
      '<h3 class="text-sm font-bold text-amber-950 uppercase tracking-wide">Your step-by-step flow</h3>' +
      '<ol class="mt-3 space-y-2 text-sm text-slate-700 list-decimal list-inside leading-relaxed">' +
      '<li>Park at the Walmart shuttle pick-up (avoid NRG parking).</li>' +
      '<li>Find the Prayer City shuttle bus.</li>' +
      '<li>Ride to your assigned tent near NRG (~30 min loop).</li>' +
      '<li>Check in with <strong>' +
      esc(CFG.coordinatorName) +
      '</strong>, ' +
      esc(CFG.coordinatorTitle) +
      ' — T-shirt, volunteer tags, briefing.</li>' +
      '<li>Join morning worship &amp; prayer at the tent; ' +
      esc(CFG.coordinatorName) +
      ' will pray with you if your shift starts later.</li>' +
      '<li>Get materials; serve in your assigned area.</li>' +
      (showContacts
        ? '<li>Shuttle &amp; coordinator phone numbers are listed below.</li>'
        : '<li>Sign in to see day-of phone numbers for the shuttle and coordinator.</li>') +
      '</ol></div>' +
      contactsHtml(showContacts, d) +
      '<div><h3 class="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">On shift — your role</h3>' +
      '<div class="space-y-3">' +
      roleBlocks +
      '</div></div>' +
      '<div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-600 leading-relaxed space-y-2">' +
      '<p><strong class="text-slate-800">Serving as a group?</strong> Email <a href="mailto:ddbs.htx@gmail.com" class="text-brand font-semibold hover:underline">ddbs.htx@gmail.com</a> with your names and dates — see <a href="faq.html" class="text-brand font-semibold hover:underline">FAQ</a> for details.</p>' +
      '<p><strong class="text-slate-800">Serving remotely?</strong> Social Media &amp; Virtual Support volunteers share daily posts from your <a href="/" class="text-brand font-semibold hover:underline">dashboard</a> on game days — no shuttle needed.</p>' +
      '</div>' +
      '</div></div>';
  }

  global.PrayerCityServeDay = {
    CFG: CFG,
    ROLE_ON_SHIFT: ROLE_ON_SHIFT,
    renderServeDayFlow: renderServeDayFlow,
  };
})(typeof window !== 'undefined' ? window : this);
