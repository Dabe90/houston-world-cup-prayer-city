/**
 * Compact “Before your shift” checklist for signed-in dashboard.
 */
(function (global) {
  var ZOOM_URL =
    'https://us06web.zoom.us/j/88179064654?pwd=fGNWdDayQeRuixN5pH3AfwxdiL45Xk.1';
  var VIRTUAL_SESSION_DATE = '2026-06-11';
  var VIRTUAL_LABEL = 'Thursday, June 11, 2026 · 6:00 PM CT';
  var CONTACT_EMAIL = 'ddbs.htx@gmail.com';

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function daysUntilYmd(ymd) {
    var p = String(ymd || '').split('-');
    if (p.length !== 3) return null;
    var t = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    var n = new Date();
    t.setHours(0, 0, 0, 0);
    n.setHours(0, 0, 0, 0);
    return Math.round((t - n) / 86400000);
  }

  function render(container, volunteerData) {
    if (!container) return;
    var d = volunteerData || {};
    var serve = global.PrayerCityServeDay && global.PrayerCityServeDay.CFG;
    var tent = String(d.tent || '').trim();
    var shirt = String(d.shirtSize || '').trim();
    var showVirtual = daysUntilYmd(VIRTUAL_SESSION_DATE);
    showVirtual = showVirtual == null || showVirtual >= 0;

    var items = [];
    if (showVirtual) {
      items.push(
        '<li class="flex gap-2"><span class="text-brand font-bold shrink-0">1.</span><span>Join the <strong>virtual info session</strong> (' +
          esc(VIRTUAL_LABEL) +
          ') — <a href="' +
          esc(ZOOM_URL) +
          '" target="_blank" rel="noopener noreferrer" class="text-brand font-semibold hover:underline">Zoom link</a></span></li>'
      );
    }
    items.push(
      '<li class="flex gap-2"><span class="text-brand font-bold shrink-0">' +
        (showVirtual ? '2' : '1') +
        '.</span><span><strong>Save your T-shirt size</strong> on your dashboard' +
        (shirt ? ' <span class="text-teal-700">(saved: ' + esc(shirt) + ')</span>' : ' <span class="text-amber-700">(action needed)</span>') +
        ' — <a href="#tshirt-section" class="text-brand font-semibold hover:underline">Go to T-shirts</a></span></li>'
    );
    items.push(
      '<li class="flex gap-2"><span class="text-brand font-bold shrink-0">' +
        (showVirtual ? '3' : '2') +
        '.</span><span><strong>Park at the shuttle pick-up</strong> (not NRG): ' +
        (serve ? esc(serve.shuttleName) + ', ' + esc(serve.shuttleAddress) + '. ' + esc(serve.shuttleParking) : 'Walmart, 2391 S Wayside Dr') +
        ' — <a href="#serve-day-flow-section" class="text-brand font-semibold hover:underline">Serve-day details</a></span></li>'
    );
    items.push(
      '<li class="flex gap-2"><span class="text-brand font-bold shrink-0">' +
        (showVirtual ? '4' : '3') +
        '.</span><span><strong>Arrive ~30–45 minutes before your shift</strong> for shuttle, check-in, and briefing with ' +
        (serve ? esc(serve.coordinatorName) : 'Tricia Hill') +
        '.</span></li>'
    );
    items.push(
      '<li class="flex gap-2"><span class="text-brand font-bold shrink-0">' +
        (showVirtual ? '5' : '4') +
        '.</span><span><strong>Bring:</strong> comfortable clothes, walking shoes, water, sunscreen, charged phone, and a willing heart. Volunteer tag &amp; T-shirt provided at check-in.</span></li>'
    );
    items.push(
      '<li class="flex gap-2"><span class="text-brand font-bold shrink-0">' +
        (showVirtual ? '6' : '5') +
        '.</span><span><strong>Your tent:</strong> ' +
        (tent ? esc(tent) : 'Posted on your dashboard when assigned — confirm at check-in') +
        '.</span></li>'
    );
    var shuttleName =
      (serve && serve.shuttleDriverName) || 'Claudia';
    var shuttlePhone =
      (serve && serve.shuttleDriverPhone) || '979-231-6324';
    var coordName =
      (serve && serve.coordinatorName) || 'Tricia Hill';
    var coordPhone =
      (serve && serve.coordinatorPhone) || '346-664-8066';
    items.push(
      '<li class="flex gap-2"><span class="text-brand font-bold shrink-0">' +
        (showVirtual ? '7' : '6') +
        '.</span><span><strong>Day-of emergency:</strong> ' +
        esc(shuttleName) +
        ' (shuttle) <a href="tel:9792316324" class="text-brand font-semibold hover:underline">' +
        esc(shuttlePhone) +
        '</a> · ' +
        esc(coordName) +
        ' (coordinator) <a href="tel:3466648066" class="text-brand font-semibold hover:underline">' +
        esc(coordPhone) +
        '</a></span></li>'
    );

    container.innerHTML =
      '<div class="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-soft/50 via-white to-amber-50/30 shadow-card overflow-hidden">' +
      '<div class="px-4 sm:px-6 py-4 border-b border-slate-100 bg-white/90">' +
      '<p class="text-xs font-bold uppercase tracking-wider text-brand">Your serve day</p>' +
      '<h2 class="text-lg sm:text-xl font-bold text-slate-900 mt-1">Before your shift — quick checklist</h2>' +
      '<p class="text-sm text-slate-600 mt-1">Not everyone serves on the first game day — when <strong>your</strong> shift comes, follow this list. Full flow with photos is below.</p>' +
      '</div><ol class="px-4 sm:px-6 py-4 space-y-3 text-sm text-slate-700 leading-relaxed list-none">' +
      items.join('') +
      '</ol></div>';
  }

  global.PrayerCityVolunteerChecklist = { render: render };
})(typeof window !== 'undefined' ? window : this);
