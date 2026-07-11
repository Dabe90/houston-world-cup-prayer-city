/**
 * Route Nigerian volunteers to ddbs-nig.html after sign-in (one sign-in for the whole site).
 */
(function (global) {
  var NIGERIA_HUB = 'ddbs-nig.html';
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

  function maybeRedirectToNigeriaHub(volunteerData, email) {
    if (!shouldAutoRouteToNigeria(volunteerData, email)) return false;
    var path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('ddbs-nig') !== -1 || path.indexOf('nigeria-dashboard') !== -1) {
      return false;
    }
    window.location.assign(NIGERIA_HUB);
    return true;
  }

  function parseStayQuery() {
    try {
      var stay = new URLSearchParams(window.location.search).get('stay');
      if (stay === 'us') markStayOnUsHub();
      else if (stay === 'ng') markStayOnNigeriaHub();
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
  };
})(typeof window !== 'undefined' ? window : this);
