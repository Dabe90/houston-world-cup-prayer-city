/**
 * Nigeria hub helpers — explicit links / post-login only.
 * No anonymous geo auto-routing (everyone can open the US root freely).
 */
(function (global) {
  var NIGERIA_HUB = '/ng';
  var STAY_KEY = 'prayerCityStayOnUsHub';
  var REGION_COOKIE = 'prayer_city_region';
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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
    if (getRegionCookie() === 'us') return false;
    try {
      var stay = new URLSearchParams(window.location.search).get('stay');
      if (stay === 'us') return false;
    } catch (ignore) {}
    // Super users use both hubs — never force them off the US dashboard.
    if (
      global.PrayerCitySuperUser &&
      typeof global.PrayerCitySuperUser.isSuperUser === 'function' &&
      global.PrayerCitySuperUser.isSuperUser(email)
    ) {
      return false;
    }
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

  function isNigeriaHubPath(pathname) {
    var path = String(pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
    return (
      path === '/ng' ||
      path === '/nigeria' ||
      path.indexOf('ddbs-nig') !== -1 ||
      path.indexOf('nigeria-dashboard') !== -1
    );
  }

  function maybeRedirectToNigeriaHub(volunteerData, email) {
    if (!shouldAutoRouteToNigeria(volunteerData, email)) return false;
    if (isNigeriaHubPath(window.location.pathname)) return false;
    window.location.assign(nigeriaHubUrl());
    return true;
  }

  function parseStayQuery() {
    try {
      var stay = new URLSearchParams(window.location.search).get('stay');
      if (stay === 'us') markStayOnUsHub();
      else if (stay === 'ng') markStayOnNigeriaHub();
      else if (getRegionCookie() === 'us') {
        sessionStorage.setItem(STAY_KEY, '1');
      }
    } catch (ignore) {}
  }

  function getRegionCookie() {
    var m = document.cookie.match(/(?:^|; )prayer_city_region=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function onNigeriaPage() {
    return isNigeriaHubPath(window.location.pathname);
  }

  /**
   * Geo auto-routing disabled — visitors choose US (/) or Nigeria (/ng).
   * Kept as a no-op so older pages that call it do not break.
   */
  function maybeGeoRedirect() {
    /* intentionally empty */
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
    getRegionCookie: getRegionCookie,
    onNigeriaPage: onNigeriaPage,
    maybeGeoRedirect: maybeGeoRedirect,
  };
})(typeof window !== 'undefined' ? window : this);
