(function () {
  var EDITION = '2027-06';
  var TARGET = new Date('2027-06-12T09:00:00+01:00');
  var SHARE_URL = 'https://prayercityhtx.com/alive?d=12jun2027';
  var SHARE_TEXT =
    'Alive Hangout — Saturday 12 June 2027. The outdoor Christian getaway for men, women, married & singles. Games, food, dance, guest ministers, and a call to holiness. Registration is compulsory: ' +
    SHARE_URL;

  function $(id) {
    return document.getElementById(id);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function tickCountdown() {
    var root = $('alive-countdown');
    if (!root) return;
    var now = Date.now();
    var diff = Math.max(0, TARGET.getTime() - now);
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    var secs = Math.floor((diff % 60000) / 1000);
    var set = function (id, val) {
      var el = $(id);
      if (el) el.textContent = pad(val);
    };
    set('alive-days', String(days));
    set('alive-hours', pad(hours));
    set('alive-mins', pad(mins));
    set('alive-secs', pad(secs));
    if (diff <= 0 && root.dataset.live !== '0') {
      root.dataset.live = '0';
    }
  }

  function setStatus(kind, message) {
    var el = $('alive-status');
    if (!el) return;
    el.className = 'alive-status is-on is-' + kind;
    el.textContent = message;
  }

  function functionsClient() {
    var cfg = window.__FIREBASE_CONFIG__;
    if (!cfg || !cfg.apiKey || typeof firebase === 'undefined') return null;
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    return firebase.app().functions('us-central1');
  }

  function payloadFromForm(form) {
    var get = function (name) {
      var field = form.elements[name];
      return field ? String(field.value || '').trim() : '';
    };
    return {
      edition: EDITION,
      name: get('name'),
      email: get('email'),
      phone: get('phone'),
      city: get('city'),
      stream: get('stream'),
      partySize: Number(get('partySize') || '1'),
      church: get('church'),
      heardFrom: get('heardFrom'),
      notes: get('notes'),
      wantToServe: !!(form.elements.wantToServe && form.elements.wantToServe.checked),
      website: get('website'),
    };
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var form = ev.target;
    var btn = $('alive-submit');
    var data = payloadFromForm(form);
    if (!data.name || !data.email || !data.phone || !data.stream) {
      setStatus('err', 'Please add your name, email, phone, and who you are coming as.');
      return;
    }
    var fns = functionsClient();
    if (!fns) {
      setStatus(
        'err',
        'Registration is taking a moment to load. Refresh, try another network, or DM @deardaughter_bs.'
      );
      return;
    }
    if (btn) btn.disabled = true;
    setStatus('wait', 'Saving your place…');
    fns
      .httpsCallable('submitAliveHangoutRsvp', { timeout: 60000 })(data)
      .then(function (res) {
        var msg =
          (res.data && res.data.message) ||
          'You are registered. Watch your email — we will send the outdoor venue.';
        setStatus('ok', msg);
        form.reset();
        if (form.elements.partySize) form.elements.partySize.value = '1';
      })
      .catch(function (err) {
        var code = err && err.code ? String(err.code) : '';
        var raw = (err && err.message) || 'Could not register. Try again.';
        if (code.indexOf('not-found') >= 0 || /NOT_FOUND/i.test(raw)) {
          raw = 'Registration is being switched on. Please try again in a few minutes, or DM @deardaughter_bs.';
        }
        setStatus('err', raw);
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function copyShare() {
    var text = SHARE_TEXT;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          setShareNote('Link copied. Send it to someone who should be there.');
        },
        function () {
          window.prompt('Copy this invite', text);
        }
      );
      return;
    }
    window.prompt('Copy this invite', text);
  }

  function setShareNote(msg) {
    var el = $('alive-share-note');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function bindShare() {
    var wa = $('alive-share-wa');
    if (wa) {
      wa.href = 'https://wa.me/?text=' + encodeURIComponent(SHARE_TEXT);
    }
    var copyBtn = $('alive-share-copy');
    if (copyBtn) copyBtn.addEventListener('click', copyShare);
  }

  function init() {
    tickCountdown();
    setInterval(tickCountdown, 1000);
    var form = $('alive-form');
    if (form) form.addEventListener('submit', onSubmit);
    bindShare();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
