/**
 * Route Nigerian volunteers to ddbs-nig.html after sign-in (one sign-in for the whole site).
 */
(function (global) {
  var NIGERIA_HUB = 'ddbs-nig.html';
  var STAY_KEY = 'prayerCityStayOnUsHub';
  var REGION_COOKIE = 'prayer_city_region';
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
  // Cloudflare fronts the domain, so this same-origin endpoint reports the
  // visitor's real country (loc=XX). Used as a reliable geo fallback in case the
  // edge/CDN redirect does not fire for a given visitor.
  var TRACE_URL = '/cdn-cgi/trace';
  var GEO_DONE_KEY = 'prayerCityGeoChecked';

  function setRegionCookie(value) {
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      REGION_COOKIE +
      '=' +
      value +
      '; Path=/; Max-Age=' +
      COOKIE_MAX_AGE +
      '; SameSite=Lax' +
      secure;
  }

  function isNigeriaVolunteerPhone(phone) {
    if (global.NigeriaUnits && NigeriaUnits.isNigeriaPhone) {
      return NigeriaUnits.isNigeriaPhone(phone);
    }
    var ph = String(phone || '').replace(/\s/g, '');
    return (
      /^\+234\d{9,11}$/.test(ph) ||
      /^234\d{9,11}$/.test(ph) ||
      /^0[789]\d{9}$/.test(ph)
    );
  }

  function shouldAutoRouteToNigeria(volunteerData, email) {
    if (sessionStorage.getItem(STAY_KEY) === '1') return false;
    if (
      volunteerData &&
      (volunteerData.nigeriaHub === true || volunteerData.region === 'nigeria')
    ) {
      return true;
    }
    return isNigeriaVolunteerPhone(volunteerData && volunteerData.phone);
  }

  function markStayOnUsHub() {
    sessionStorage.setItem(STAY_KEY, '1');
    setRegionCookie('us');
  }

  function markStayOnNigeriaHub() {
    sessionStorage.removeItem(STAY_KEY);
    setRegionCookie('ng');
  }

  function clearStayOnUsHub() {
    sessionStorage.removeItem(STAY_KEY);
    document.cookie = REGION_COOKIE + '=; Path=/; Max-Age=0; SameSite=Lax';
  }

  function nigeriaHubUrl(extraSearch, extraHash) {
    var url = NIGERIA_HUB;
    var search = extraSearch != null ? extraSearch : window.location.search || '';
    var hash = extraHash != null ? extraHash : window.location.hash || '';
    // Avoid duplicating ?stay= when we already have a cookie destination.
    try {
      if (search) {
        var params = new URLSearchParams(search.charAt(0) === '?' ? search.slice(1) : search);
        params.delete('stay');
        var cleaned = params.toString();
        search = cleaned ? '?' + cleaned : '';
      }
    } catch (ignore) {}
    return url + search + hash;
  }

  function maybeRedirectToNigeriaHub(volunteerData, email) {
    if (!shouldAutoRouteToNigeria(volunteerData, email)) return false;
    var path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('ddbs-nig') !== -1 || path.indexOf('nigeria-dashboard') !== -1) {
      return false;
    }
    window.location.assign(nigeriaHubUrl());
    return true;
  }

  function parseStayQuery() {
    try {
      var stay = new URLSearchParams(window.location.search).get('stay');
      if (stay === 'us') markStayOnUsHub();
      else if (stay === 'ng') markStayOnNigeriaHub();
    } catch (ignore) {}
  }

  function getRegionCookie() {
    var m = document.cookie.match(/(?:^|; )prayer_city_region=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function onNigeriaPage() {
    var path = (window.location.pathname || '').toLowerCase();
    return path.indexOf('ddbs-nig') !== -1 || path.indexOf('nigeria-dashboard') !== -1;
  }

  function isRootUsPage() {
    var path = (window.location.pathname || '').toLowerCase();
    return path === '' || path === '/' || path === '/index.html';
  }

  /**
   * Best-effort geo redirect for anonymous visitors on the US root page.
   * Nigerian visitors are sent to the Nigeria hub. Respects an explicit US/NG
   * choice (?stay= or the region cookie) and only checks geo once per session.
   */
  function maybeGeoRedirect() {
    try {
      if (onNigeriaPage() || !isRootUsPage()) return;
      if (sessionStorage.getItem(STAY_KEY) === '1') return;
      var region = getRegionCookie();
      if (region === 'us') return;
      if (region === 'ng') {
        window.location.replace(nigeriaHubUrl());
        return;
      }
      if (sessionStorage.getItem(GEO_DONE_KEY) === '1') return;
      sessionStorage.setItem(GEO_DONE_KEY, '1');
      if (typeof fetch !== 'function') return;
      fetch(TRACE_URL, { cache: 'no-store' })
        .then(function (r) {
          return r && r.ok ? r.text() : '';
        })
        .then(function (txt) {
          var m = /(?:^|\n)loc=([A-Z]{2})/.exec(txt || '');
          if (m && m[1] === 'NG') {
            setRegionCookie('ng');
            window.location.replace(nigeriaHubUrl());
          }
        })
        .catch(function () {});
    } catch (ignore) {}
  }

  global.PrayerCityRouting = {
    NIGERIA_HUB: NIGERIA_HUB,
    isNigeriaVolunteerPhone: isNigeriaVolunteerPhone,
    shouldAutoRouteToNigeria: shouldAutoRouteToNigeria,
    maybeRedirectToNigeriaHub: maybeRedirectToNigeriaHub,
    markStayOnUsHub: markStayOnUsHub,
    markStayOnNigeriaHub: markStayOnNigeriaHub,
    clearStayOnUsHub: clearStayOnUsHub,
    parseStayQuery: parseStayQuery,
    maybeGeoRedirect: maybeGeoRedirect,
  };
})(typeof window !== 'undefined' ? window : this);
