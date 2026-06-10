/**
 * Verified stock photos (Unsplash) — dead links replaced Jun 2026.
 */
(function (global) {
  function url(photoId, w) {
    w = w || 900;
    return (
      'https://images.unsplash.com/photo-' +
      photoId +
      '?w=' +
      w +
      '&q=80&auto=format&fit=crop'
    );
  }

  /** All IDs return HTTP 200 (checked). */
  var IDS = {
    communityPrayer: '1529078155058-5d716f45d604',
    openBible: '1438232992991-995b7058bbb3',
    youthGroup: '1523240795612-9a054b0db644',
    booksStudy: '1516979187457-637abb4f9353',
    readingTogether: '1503676260728-1c00da094a0b',
    kidsWriting: '1529390079861-591de354faf5',
    handsBible: '1473163928189-364b2c4e1135',
    soccerBall: '1574629810360-7efbbe195018',
    stackBooks: '1519682337058-a94d519337bc',
    worshipHands: '1507692049790-de58290a4334',
    teamHuddle: '1528605248644-14dd04022da1',
    citySunset: '1469474968028-56623f02e42e',
    stadiumLights: '1492684223066-81342ee5ff30',
    friendsLaugh: '1529156069898-49953e39b3ac',
    crowdEvent: '1677442136019-21780ecad995',
    mountains: '1506905925346-21bda4d32df4',
    phoneSocial: '1611162617474-5b21e879e113',
  };

  var FALLBACK = url(IDS.openBible, 900);

  /** Legacy photo IDs that now 404 — map to replacements. */
  var DEAD_REPLACEMENTS = {
    '1491841550275-de78548fa1af': IDS.openBible,
    '1504052464689-1586d9d4d0c9': IDS.communityPrayer,
    '1511632765276-a27960c3a1e8': IDS.friendsLaugh,
    '1533231355826-99f7e920b5ed': IDS.stadiumLights,
    '1478147427287-4b93705222c9': IDS.worshipHands,
  };

  function fixUrl(src, w) {
    var s = String(src || '').trim();
    if (!s) return FALLBACK;
    var m = s.match(/photo-([0-9]+-[a-f0-9]+)/i);
    if (m && DEAD_REPLACEMENTS[m[1]]) {
      return url(DEAD_REPLACEMENTS[m[1]], w || 900);
    }
    return s;
  }

  var socialPool = [
    IDS.communityPrayer,
    IDS.openBible,
    IDS.youthGroup,
    IDS.booksStudy,
    IDS.readingTogether,
    IDS.kidsWriting,
    IDS.handsBible,
    IDS.soccerBall,
    IDS.stackBooks,
    IDS.worshipHands,
    IDS.teamHuddle,
    IDS.citySunset,
    IDS.stadiumLights,
    IDS.friendsLaugh,
    IDS.crowdEvent,
    IDS.mountains,
    IDS.phoneSocial,
  ].map(function (id) {
    return url(id, 900);
  });

  var counselorPool = socialPool.slice();

  var hero = {
    readingTogether: url(IDS.readingTogether, 400),
    stackBooks: url(IDS.stackBooks, 400),
    kidsWriting: url(IDS.kidsWriting, 400),
    openBible: url(IDS.openBible, 400),
  };

  global.PrayerCityStockImages = {
    IDS: IDS,
    FALLBACK: FALLBACK,
    url: url,
    fixUrl: fixUrl,
    socialPool: socialPool,
    counselorPool: counselorPool,
    hero: hero,
    onerrorAttr:
      ' onerror="this.onerror=null;this.src=\'' +
      FALLBACK.replace(/'/g, "\\'") +
      '\'"',
  };
})(typeof window !== 'undefined' ? window : this);
