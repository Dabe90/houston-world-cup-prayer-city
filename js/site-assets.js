/**
 * Public asset URLs — always absolute so images load from any page path.
 */
(function (global) {
  var SITE_ORIGIN = 'https://prayercityhtx.com';

  function assetUrl(path) {
    var p = String(path || '').replace(/^\//, '');
    if (/^https?:\/\//i.test(p)) return p;
    return SITE_ORIGIN + '/' + p;
  }

  global.PrayerCityAssets = {
    SITE_ORIGIN: SITE_ORIGIN,
    assetUrl: assetUrl,
    tshirt: assetUrl('images/prayer-city-tshirt.png'),
    shuttleBus: assetUrl('images/prayer-city-shuttle-bus.png'),
    tentSetup: assetUrl('images/prayer-city-tent-setup.png'),
    favicon: assetUrl('images/favicon.png'),
  };
})(typeof window !== 'undefined' ? window : this);
