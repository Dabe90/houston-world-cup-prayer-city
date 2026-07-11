/**
 * Live countdown to Dec 31, 2030 — one billion souls vision.
 */
(function (global) {
  var TARGET_MS = new Date('2030-12-31T23:59:59-06:00').getTime();
  var timers = [];

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function html(compact) {
    var c = compact ? ' billion-countdown-compact' : '';
    return (
      '<section class="billion-countdown' +
      c +
      '" aria-live="polite" aria-label="Countdown to one billion souls by December 31, 2030">' +
      '<div class="billion-countdown-inner">' +
      '<div class="bc-copy">' +
      '<p class="bc-eyebrow">Our global target</p>' +
      '<p class="bc-title">One billion souls for Christ</p>' +
      '<p class="bc-sub">December 31, 2030 · Houston · Nigeria · every nation</p>' +
      '</div>' +
      '<div class="bc-timer" role="timer">' +
      '<div class="bc-unit"><span class="bc-num" data-bc="days">—</span><span class="bc-label">Days</span></div>' +
      '<div class="bc-unit"><span class="bc-num" data-bc="hours">—</span><span class="bc-label">Hrs</span></div>' +
      '<div class="bc-unit"><span class="bc-num" data-bc="mins">—</span><span class="bc-label">Min</span></div>' +
      '<div class="bc-unit"><span class="bc-num" data-bc="secs">—</span><span class="bc-label">Sec</span></div>' +
      '</div></div></section>'
    );
  }

  function tick(root) {
    var diff = Math.max(0, TARGET_MS - Date.now());
    var secs = Math.floor(diff / 1000);
    var days = Math.floor(secs / 86400);
    secs -= days * 86400;
    var hours = Math.floor(secs / 3600);
    secs -= hours * 3600;
    var mins = Math.floor(secs / 60);
    secs -= mins * 60;

    var map = { days: String(days), hours: pad(hours), mins: pad(mins), secs: pad(secs) };
    Object.keys(map).forEach(function (key) {
      var el = root.querySelector('[data-bc="' + key + '"]');
      if (!el) return;
      if (el.textContent !== map[key]) {
        el.textContent = map[key];
        el.classList.remove('bc-pop');
        void el.offsetWidth;
        el.classList.add('bc-pop');
        setTimeout(function () {
          el.classList.remove('bc-pop');
        }, 350);
      }
    });
  }

  function mount(selector, opts) {
    opts = opts || {};
    var host =
      typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!host) return null;
    host.innerHTML = html(!!opts.compact);
    var root = host.firstElementChild;
    tick(root);
    var id = setInterval(function () {
      tick(root);
    }, 1000);
    timers.push(id);
    return { root: root, stop: function () { clearInterval(id); } };
  }

  global.BillionCountdown = {
    TARGET_MS: TARGET_MS,
    mount: mount,
  };
})(typeof window !== 'undefined' ? window : this);
