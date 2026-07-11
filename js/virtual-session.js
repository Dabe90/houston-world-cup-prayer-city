/**
 * Thursday virtual information session — dashboard block.
 */
(function (global) {
  var CFG = {
    sessionDate: '2026-06-11',
    label: 'Thursday, June 11, 2026',
    time: '6:00 PM',
    timezone: 'Central Time (Houston)',
    zoomUrl:
      'https://us06web.zoom.us/j/88179064654?pwd=fGNWdDayQeRuixN5pH3AfwxdiL45Xk.1',
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function daysUntilSession() {
    var parts = CFG.sessionDate.split('-');
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    var target = new Date(y, m, d);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function render(container) {
    if (!container) return false;
    var days = daysUntilSession();
    if (days != null && days < 0) {
      container.innerHTML = '';
      return false;
    }

    var countdown =
      days === 0
        ? 'Today'
        : days === 1
          ? 'Tomorrow'
          : days != null && days > 1
            ? days + ' days away'
            : '';

    container.innerHTML =
      '<div class="rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50 via-white to-teal-50/40 shadow-card overflow-hidden">' +
      '<div class="h-1 bg-gradient-to-r from-blue-600 via-teal-500 to-brand"></div>' +
      '<div class="px-4 sm:px-6 py-5 sm:py-6">' +
      '<p class="text-xs font-bold uppercase tracking-wider text-blue-700">Important · All volunteers</p>' +
      '<h2 class="text-xl sm:text-2xl font-bold text-slate-900 mt-1">Virtual information session — please attend</h2>' +
      (countdown
        ? '<p class="text-sm font-semibold text-blue-800 mt-2">' + esc(countdown) + '</p>'
        : '') +
      '<p class="text-sm text-slate-600 mt-3 leading-relaxed max-w-3xl">Thank you to everyone who joined us for <strong>Prayer City training</strong>. If you were not able to attend in person, please join us virtually — we will share <strong>prayer tent locations</strong>, <strong>free street parking</strong> near 1325 La Concha Lane, and everything you need before our first serve day this <strong>Sunday</strong>.</p>' +
      '<p class="text-base sm:text-lg font-bold text-slate-900 mt-4">' +
      esc(CFG.label) +
      ' · ' +
      esc(CFG.time) +
      ' <span class="font-semibold text-slate-500">' +
      esc(CFG.timezone) +
      '</span></p>' +
      '<a href="' +
      esc(CFG.zoomUrl) +
      '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 mt-4 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md">' +
      '<i class="fas fa-video"></i> Join Zoom meeting</a>' +
      '<p class="text-xs text-slate-500 mt-3 break-all">' +
      esc(CFG.zoomUrl) +
      '</p></div></div>';

    return true;
  }

  global.PrayerCityVirtualSession = {
    CFG: CFG,
    render: render,
  };
})(typeof window !== 'undefined' ? window : this);
