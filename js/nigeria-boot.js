/**
 * Loads sign-in, attendance, and reports only when this visit needs them.
 * A public reading of the landing stays on the small stylesheet and landing scripts.
 */
(function (global) {
  var APP = [
    '/js/vendor/firebase/firebase-app-compat.js',
    '/js/vendor/firebase/firebase-auth-compat.js',
    '/js/vendor/firebase/firebase-firestore-compat.js',
    '/js/vendor/firebase/firebase-storage-compat.js',
    '/js/vendor/firebase/firebase-functions-compat.js',
    'js/firebase-config.js?v=20261101a',
    'js/ddbs-nigeria-meeting-notes.js?v=20260915a',
    'js/monthly-unit-report.js?v=20261103p',
    'js/nigeria-dashboard-report.js?v=20261007d',
    'js/prayer-city-super-user.js?v=20261103q',
    'js/prayer-city-routing.js?v=20260915c',
    'js/nigeria-dashboard.js?v=20261103q',
  ];

  var DASH_HASHES = {
    auth: 1,
    units: 1,
    home: 1,
    programs: 1,
    reports: 1,
    'kingdom-workforce': 1,
    'new-members': 1,
    'my-members': 1,
  };

  var loading = null;
  var lateStylesStarted = false;

  function hasSavedAuth() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('firebase:authUser:') === 0) {
          var value = localStorage.getItem(key);
          if (value && value !== 'null' && value.length > 20) return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function needsAppNow() {
    try {
      if (hasSavedAuth()) return true;
      if (sessionStorage.getItem('ddbsNgHubView') === 'dash') return true;
      if (sessionStorage.getItem('ngAuthPanelOpen') === '1') return true;
    } catch (e) {}
    var q = global.location.search || '';
    if (/[?&]mode=signIn(?:&|$)/.test(q) || /[?&]oobCode=/.test(q)) return true;
    var hash = (global.location.hash || '').replace('#', '').split('&')[0].split('?')[0];
    return !!DASH_HASHES[hash];
  }

  function loadAll(srcs) {
    return new Promise(function (resolve, reject) {
      var left = srcs.length;
      if (!left) {
        resolve();
        return;
      }
      var failed = false;
      srcs.forEach(function (src) {
        var script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = function () {
          left -= 1;
          if (!left && !failed) resolve();
        };
        script.onerror = function () {
          if (failed) return;
          failed = true;
          reject(new Error(src));
        };
        document.head.appendChild(script);
      });
    });
  }

  function ensureApp() {
    if (loading) return loading;
    loading = loadAll(APP).catch(function (err) {
      loading = null;
      throw err;
    });
    return loading;
  }

  function whenReady() {
    return ensureApp()
      .then(function () {
        return new Promise(function (resolve) {
          var started = Date.now();
          (function wait() {
            if (global.__ngDashReady || global.__ngDashFailed) {
              resolve(!!global.__ngDashReady);
              return;
            }
            if (Date.now() - started > 20000) {
              resolve(false);
              return;
            }
            setTimeout(wait, 40);
          })();
        });
      })
      .catch(function () {
        return false;
      });
  }

  function preloadApp() {
    APP.forEach(function (src) {
      if (document.querySelector('link[rel="preload"][href="' + src + '"]')) return;
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = src;
      document.head.appendChild(link);
    });
  }

  function loadLateStyles() {
    if (lateStylesStarted) return;
    lateStylesStarted = true;
    var hrefs = [
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    ];
    hrefs.forEach(function (href) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  var FORM_IDS = { 'auth-form': 1, 'ng-signup-form': 1, 'ng-workforce-form': 1 };
  var replayingSubmit = false;

  document.addEventListener(
    'submit',
    function (event) {
      if (replayingSubmit) return;
      var form = event.target;
      if (!form || !FORM_IDS[form.id]) return;
      if (global.__ngDashReady) return;
      event.preventDefault();
      event.stopPropagation();
      var status = document.getElementById('auth-panel-status');
      if (form.id === 'auth-form' && status) {
        status.className = 'rounded-xl border px-3 py-2.5 text-sm border-slate-200 bg-slate-50 text-slate-600';
        status.textContent = 'Loading sign-in…';
      }
      whenReady().then(function (ok) {
        if (!ok || !form.isConnected) return;
        replayingSubmit = true;
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        replayingSubmit = false;
      });
    },
    true
  );

  document.addEventListener(
    'click',
    function (event) {
      var node = event.target;
      if (node && node.nodeType === 3) node = node.parentElement;
      if (!node || !node.closest) return;
      if (node.closest('[data-ng-scroll-auth], #ng-signup-toggle, #ng-see-areas-btn, #ng-workforce-form, #ng-signup-form')) {
        preloadApp();
        ensureApp();
      }
      var action = node.closest('#btn-email-link, #btn-forgot-password, #btn-ng-save-password, #btn-ng-password-reset-email');
      if (!action || global.__ngDashReady) return;
      event.preventDefault();
      action.setAttribute('aria-busy', 'true');
      whenReady().then(function (ok) {
        action.removeAttribute('aria-busy');
        if (!ok) return;
        action.click();
      });
    },
    true
  );

  global.NgBoot = {
    ensureApp: ensureApp,
    whenReady: whenReady,
    needsAppNow: needsAppNow,
    preloadApp: preloadApp,
  };

  if (needsAppNow()) {
    preloadApp();
    ensureApp();
  }

  global.addEventListener('load', loadLateStyles);
  setTimeout(loadLateStyles, 4000);
})(window);
