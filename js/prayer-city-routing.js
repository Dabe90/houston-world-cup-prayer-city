/**
 * Route Nigerian volunteers to ddbs-nig.html after sign-in (one sign-in for the whole site).
 */
(function (global) {
  var NIGERIA_HUB = 'ddbs-nig.html';
  var STAY_KEY = 'prayerCityStayOnUsHub';

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
  }

  function clearStayOnUsHub() {
    sessionStorage.removeItem(STAY_KEY);
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
      if (new URLSearchParams(window.location.search).get('stay') === 'us') {
        markStayOnUsHub();
      }
    } catch (ignore) {}
  }

  global.PrayerCityRouting = {
    NIGERIA_HUB: NIGERIA_HUB,
    isNigeriaVolunteerPhone: isNigeriaVolunteerPhone,
    shouldAutoRouteToNigeria: shouldAutoRouteToNigeria,
    maybeRedirectToNigeriaHub: maybeRedirectToNigeriaHub,
    markStayOnUsHub: markStayOnUsHub,
    clearStayOnUsHub: clearStayOnUsHub,
    parseStayQuery: parseStayQuery,
  };
})(typeof window !== 'undefined' ? window : this);
