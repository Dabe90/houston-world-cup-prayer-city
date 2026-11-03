/**
 * Counts a visit on our own site. One "arrived" ping when this script runs,
 * and one "readable" ping when the page can actually be read.
 * No name, email, or address is sent.
 */
(function () {
  var storageKey = 'pcVisit';
  var sessionId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try {
    var saved = sessionStorage.getItem(storageKey);
    if (saved) sessionId = saved;
    else sessionStorage.setItem(storageKey, sessionId);
  } catch (e) {}

  var readableSent = false;

  function netLabel() {
    try {
      return String((navigator.connection && navigator.connection.effectiveType) || '').slice(0, 8);
    } catch (e) {
      return '';
    }
  }

  function send(phase, extra) {
    var body = JSON.stringify({
      path: location.pathname || '/',
      phase: phase,
      session: sessionId,
      screen: window.innerWidth < 720 ? 'phone' : 'wide',
      net: netLabel(),
      dcl: extra && extra.dcl ? extra.dcl : 0,
      resp: extra && extra.resp ? extra.resp : 0,
    });
    try {
      if (navigator.sendBeacon) {
        var queued = navigator.sendBeacon('/api/visit', new Blob([body], { type: 'application/json' }));
        if (queued) return;
      }
    } catch (e) {}
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body,
      keepalive: true,
    }).catch(function () {});
  }

  function timing() {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    return {
      dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
      resp: nav ? Math.round(nav.responseStart) : 0,
    };
  }

  function markReadable() {
    if (readableSent) return;
    readableSent = true;
    send('readable', timing());
  }

  send('arrived');

  var path = location.pathname || '/';
  var nigeria = path === '/ng' || path === '/ng/' || /ddbs-nig\.html$/.test(path);
  if (!nigeria) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markReadable);
    else markReadable();
    return;
  }

  var tries = 0;
  (function waitForHeadline() {
    var track = document.querySelector('[data-hero-track]');
    if (track && track.textContent.indexOf('undiluted Word') !== -1) {
      markReadable();
      return;
    }
    if (tries++ > 50) return;
    setTimeout(waitForHeadline, 200);
  })();
})();
