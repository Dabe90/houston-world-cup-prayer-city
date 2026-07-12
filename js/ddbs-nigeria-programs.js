/**
 * DDBS Nigeria 2026 ministry calendar (WAT). Mid-week Bible Study is every Wednesday.
 */
(function (global) {
  var YEAR = 2026;

  function ev(month, day, endDay, title, kind) {
    return {
      year: YEAR,
      month: month,
      day: day,
      endDay: endDay || null,
      title: title,
      kind: kind || 'special',
      dateKey: YEAR + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
    };
  }

  function mid(month, day, title) {
    return ev(month, day, null, title, 'midweek');
  }

  var EVENTS = [
    // January
    ev(1, 5, 10, 'Fasting and Prayer'),
    ev(1, 5, 31, 'Jesus March Pre-Prayer'),
    ev(1, 29, null, '9th Year Anniversary: Bring Forth'),
    ev(1, 31, null, 'Jesus March Nigeria'),
    mid(1, 7, 'Harvest of Thanks'),
    mid(1, 14, 'Go Forth'),
    mid(1, 21, 'The Commanding Soldier'),
    mid(1, 28, 'Prep for 9th Year Anniversary'),
    ev(2, 1, null, '9th Year Anniversary (continued)'),

    // February
    ev(2, 9, 14, 'Workers Fasting and Prayer'),
    ev(2, 9, null, 'Baptismal Class begins'),
    ev(2, 11, 14, 'Jeje Love: Abe Damilola and Moderators'),
    ev(2, 11, null, 'Love can repair all things'),
    ev(2, 12, null, 'Movie Night'),
    ev(2, 13, null, 'Marriage Power Night – The Beautiful Marriage'),
    ev(2, 14, null, 'Wisdom for successful Marriage'),
    ev(2, 18, null, 'Moderators Special Program'),
    ev(2, 27, null, 'Holy Ghost Special Service – The Spirit of God'),
    ev(2, 28, null, 'Special Monthly Bible Study: Five Red flag Questions'),
    mid(2, 4, 'Good love or Bad love?'),
    mid(2, 11, 'Moderators: Jeje Love'),
    mid(2, 18, 'Moderators Special Program'),
    mid(2, 25, 'Why church brothers go for outside sister?'),

    // March
    ev(3, 9, 14, 'Workers Fasting and Prayer'),
    ev(3, 12, 14, 'Marathon Prayer'),
    ev(3, 27, null, 'Holy Ghost Special Service – The Spirit of Might'),
    ev(3, 28, null, 'Special Monthly Bible Study: How to Find a Good Partner'),
    mid(3, 4, 'Heroes of Faith: Lucy F. Farrow'),
    mid(3, 11, 'How to kill depression'),
    mid(3, 19, 'Moderators: How to get out of financial poverty'),
    mid(3, 25, 'There is Hope for You'),

    // April
    ev(4, 6, 11, 'Workers Fasting and Prayer'),
    ev(4, 24, null, 'Holy Ghost Special Service – Joy Unlimited'),
    ev(4, 25, null, 'Special Monthly Bible Study: How to lose a Good Partner'),
    ev(4, 29, null, 'Choir Special Program'),
    mid(4, 1, 'The Hope of Glory'),
    mid(4, 8, 'Movie Night'),
    mid(4, 15, 'Moderators: In-laws from Philistine'),
    mid(4, 22, 'Saviour of sinners'),
    mid(4, 29, 'Choir Special Program'),

    // May
    ev(5, 4, 9, 'Workers Fasting and Prayer'),
    ev(5, 16, null, 'Baptismal Class Graduation'),
    ev(5, 16, null, 'Bible Study Group Special program'),
    ev(5, 29, null, 'Holy Ghost Special Service – Victory Assured'),
    ev(5, 30, null, 'Special Monthly Bible Study: How to keep a Good Partner'),
    mid(5, 6, 'Heroes of Faith: Prophet Samson Akande – Baba Abiye'),
    mid(5, 13, 'Healer of the righteous'),
    mid(5, 20, 'Moderators: How to find Mrs Right'),
    mid(5, 27, "Don't Give up!"),

    // June
    ev(6, 8, 13, 'Workers Fasting and Prayer'),
    ev(6, 13, null, 'Dear Daughter Alive Hangout'),
    ev(6, 26, null, 'Holy Ghost Special Service – A New Beginning'),
    ev(6, 27, null, 'Special Monthly Bible Study: Dy/Dx of Relationship'),
    mid(6, 3, 'Helper of the Helpless'),
    mid(6, 10, 'Movie Night'),
    mid(6, 17, "Women's Conference: Women Unleashed"),
    mid(6, 24, 'Testimony Night'),

    // July
    ev(7, 6, 11, 'Recharge Leadership Conference'),
    ev(7, 18, null, 'COD Graduation'),
    ev(7, 24, null, 'Special Prayer: Unstoppable Generation'),
    ev(7, 25, null, 'Special Bible Study: Five Wines of Marriage'),
    mid(7, 1, 'A New Beginning'),
    mid(7, 8, 'Common Marriage Quarrels and Resolution (Husband and wife teaching)'),
    mid(7, 15, 'Moderators: Couples Game: How much do you know'),
    mid(7, 22, 'Movie Night (Couple related)'),
    mid(7, 29, 'Tech Conference/Biblical Financial Literacy'),

    // August
    ev(8, 3, 8, 'Workers Prayer and Fasting'),
    ev(8, 15, null, 'Alive 4.0 Awards'),
    ev(8, 28, null, 'Holy Ghost Special Service – A Man of War'),
    ev(8, 29, null, 'Special Monthly Bible Study – Five Wines of Marriage – Part 2'),
    mid(8, 5, "Don't Quit!"),
    mid(8, 12, 'Saviour of the addict'),
    mid(8, 19, 'Moderators: Is falling for Temptation the end?'),
    mid(8, 26, 'Can I marry him without having feelings for her?'),

    // September
    ev(9, 7, 12, 'Workers Prayer and Fasting'),
    ev(9, 25, null, 'Holy Ghost Special Service: Rejoice'),
    ev(9, 26, null, 'Special Monthly Bible Study: Five Wines of Marriage – Part 3'),
    ev(9, 26, null, 'Fit for Christ [All States]'),
    mid(9, 2, 'Heroes of Faith: Charles Parham'),
    mid(9, 9, 'International Medical Conference'),
    mid(9, 16, 'Moderators: How to approach a girl?'),
    mid(9, 23, 'Fit for Christ'),
    mid(9, 30, 'Ultimate Solution: Thanksgiving'),

    // October
    ev(10, 5, 10, 'Workers Prayer and Fasting'),
    ev(10, 8, 10, 'Marathon Prayers'),
    ev(10, 30, null, "Holy Ghost Special Service: On Eagles' Wings"),
    ev(10, 31, null, 'Special Monthly Bible Study: How Rahab got her Man'),
    mid(10, 7, 'Thanksgiving Unlimited - Choir'),
    mid(10, 14, 'Faith-Unlimited'),
    mid(10, 21, 'Moderators: What to do when you like a brother'),
    mid(10, 28, 'Faith-Healing'),

    // November
    ev(11, 9, 14, 'Workers Prayer and Fasting'),
    ev(11, 27, null, 'Holy Ghost Special Service: The Ever-Present Help'),
    ev(11, 28, null, 'Special Monthly Bible Study: How to avoid a Bed of thorns'),
    mid(11, 4, 'Raptured in His Word 1'),
    mid(11, 11, 'Movie Night'),
    mid(11, 18, 'Moderators: How to tell your Christian Parents about your relationship'),
    mid(11, 25, 'Raptured in His Word 2'),

    // December
    ev(12, 7, 12, 'Dear Daughter Leadership Conference'),
    ev(12, 23, null, 'Christmas Carol: Jesus, our Joy!'),
    ev(12, 25, null, 'Holy Ghost Special Service: Open Doors'),
    ev(12, 26, null, 'Special Monthly Bible Study: Ask Dad'),
    mid(12, 2, 'Heroes of Faith: Reverend Uma Ukpai'),
    mid(12, 9, 'Faith-Possible'),
    mid(12, 16, "Moderators: What to do when your parents don't accept him/her"),
    mid(12, 23, 'Carol - Tentative'),
  ];

  var MONTH_NAMES = [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  function lagosTodayYmd() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  /** Keep a program on featured/hero lists until this many days after it ends. */
  var PAST_GRACE_DAYS = 5;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function eventEndYmd(e) {
    var endDay = e.endDay || e.day;
    return e.year + '-' + pad2(e.month) + '-' + pad2(endDay);
  }

  function ymdToUtcMs(ymd) {
    var p = String(ymd || '').split('-');
    if (p.length !== 3) return 0;
    return Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  /** Days since the program ended (negative = still upcoming / in progress). */
  function daysPastEnd(e, todayYmd) {
    todayYmd = todayYmd || lagosTodayYmd();
    return Math.floor((ymdToUtcMs(todayYmd) - ymdToUtcMs(eventEndYmd(e))) / 86400000);
  }

  /** Hide programs once they have been over for more than PAST_GRACE_DAYS. */
  function isVisibleProgram(e, todayYmd) {
    return daysPastEnd(e, todayYmd) <= PAST_GRACE_DAYS;
  }

  function formatDateLabel(e) {
    var start = MONTH_NAMES[e.month] + ' ' + e.day + ', ' + e.year;
    if (e.endDay && e.endDay !== e.day) {
      return MONTH_NAMES[e.month] + ' ' + e.day + '–' + e.endDay + ', ' + e.year;
    }
    return start;
  }

  function sortEvents(list) {
    return list.slice().sort(function (a, b) {
      if (a.month !== b.month) return a.month - b.month;
      if (a.day !== b.day) return a.day - b.day;
      if (a.kind === b.kind) return a.title.localeCompare(b.title);
      return a.kind === 'midweek' ? -1 : 1;
    });
  }

  function upcoming(limit) {
    var today = lagosTodayYmd();
    var max = limit || 12;
    return sortEvents(
      EVENTS.filter(function (e) {
        return isVisibleProgram(e, today) && eventEndYmd(e) >= today;
      })
    ).slice(0, max);
  }

  function byMonth(month) {
    var today = lagosTodayYmd();
    return sortEvents(
      EVENTS.filter(function (e) {
        return e.month === month && isVisibleProgram(e, today);
      })
    );
  }

  function kindBadge(kind) {
    return kind === 'midweek' ? 'Wed Bible Study' : 'Special program';
  }

  var THEME_IMAGES = {
    prayer:
      'https://images.unsplash.com/photo-1507692049790-de58290a4334?w=800&q=80&auto=format&fit=crop',
    bible:
      'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800&q=80&auto=format&fit=crop',
    marriage:
      'https://images.unsplash.com/photo-1518191107773-3e7d0d1b3b2a?w=800&q=80&auto=format&fit=crop',
    love:
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80&auto=format&fit=crop',
    movie:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80&auto=format&fit=crop',
    choir:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80&auto=format&fit=crop',
    baptism:
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80&auto=format&fit=crop',
    conference:
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80&auto=format&fit=crop',
    moderators:
      'https://images.unsplash.com/photo-1478737270239-2f02ca77fc08?w=800&q=80&auto=format&fit=crop',
    financial:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80&auto=format&fit=crop',
    testimony:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80&auto=format&fit=crop',
    christmas:
      'https://images.unsplash.com/photo-1512389142860-9c449e58b814?w=800&q=80&auto=format&fit=crop',
    women:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80&auto=format&fit=crop',
    tech:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&auto=format&fit=crop',
    medical:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80&auto=format&fit=crop',
    default:
      'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=800&q=80&auto=format&fit=crop',
  };

  function themeForEvent(ev) {
    var t = String(ev.title || '').toLowerCase();
    if (ev.kind === 'midweek') return { key: 'bible', image: THEME_IMAGES.bible };
    if (t.indexOf('prayer') >= 0 || t.indexOf('fasting') >= 0 || t.indexOf('marathon') >= 0) {
      return { key: 'prayer', image: THEME_IMAGES.prayer };
    }
    if (t.indexOf('marriage') >= 0 || t.indexOf('couple') >= 0 || t.indexOf('husband') >= 0) {
      return { key: 'marriage', image: THEME_IMAGES.marriage };
    }
    if (t.indexOf('love') >= 0 || t.indexOf('jeje') >= 0) {
      return { key: 'love', image: THEME_IMAGES.love };
    }
    if (t.indexOf('movie') >= 0) return { key: 'movie', image: THEME_IMAGES.movie };
    if (t.indexOf('choir') >= 0 || t.indexOf('carol') >= 0) {
      return { key: 'choir', image: THEME_IMAGES.choir };
    }
    if (t.indexOf('baptism') >= 0) return { key: 'baptism', image: THEME_IMAGES.baptism };
    if (t.indexOf('conference') >= 0 || t.indexOf('leadership') >= 0) {
      return { key: 'conference', image: THEME_IMAGES.conference };
    }
    if (t.indexOf('moderator') >= 0) {
      return { key: 'moderators', image: THEME_IMAGES.moderators };
    }
    if (t.indexOf('financial') >= 0 || t.indexOf('poverty') >= 0) {
      return { key: 'financial', image: THEME_IMAGES.financial };
    }
    if (t.indexOf('testimony') >= 0 || t.indexOf('thanksgiving') >= 0) {
      return { key: 'testimony', image: THEME_IMAGES.testimony };
    }
    if (t.indexOf('christmas') >= 0) return { key: 'christmas', image: THEME_IMAGES.christmas };
    if (t.indexOf('women') >= 0) return { key: 'women', image: THEME_IMAGES.women };
    if (t.indexOf('tech') >= 0) return { key: 'tech', image: THEME_IMAGES.tech };
    if (t.indexOf('medical') >= 0) return { key: 'medical', image: THEME_IMAGES.medical };
    if (t.indexOf('bible study') >= 0 || t.indexOf('heroes of faith') >= 0) {
      return { key: 'bible', image: THEME_IMAGES.bible };
    }
    if (t.indexOf('holy ghost') >= 0) return { key: 'prayer', image: THEME_IMAGES.prayer };
    return { key: 'default', image: THEME_IMAGES.default };
  }

  function flyerForEvent(ev) {
    var t = String(ev.title || '').toLowerCase();
    if (/recharge|leadership conference/.test(t)) {
      return 'images/ddbs-nigeria/recharge-leadership-conference-2026.png';
    }
    if (/how much do you know|couples game/.test(t)) {
      return 'images/ddbs-nigeria/couples-game-how-much-do-you-know.png';
    }
    if (/movie night/.test(t)) {
      return 'images/ddbs-nigeria/movie-night-july-2026.png';
    }
    if (/unstoppable generation/.test(t)) {
      return 'images/ddbs-nigeria/unstoppable-generation-prayer.png';
    }
    if (/five wines of marriage/.test(t)) {
      return 'images/ddbs-nigeria/five-wines-of-marriage.png';
    }
    return null;
  }

  function enrichEvent(ev) {
    var theme = themeForEvent(ev);
    var flyer = flyerForEvent(ev);
    return Object.assign({}, ev, {
      themeKey: theme.key,
      image: theme.image,
      flyer: flyer,
      displayImage: flyer || theme.image,
      hasFlyer: !!flyer,
    });
  }

  /** Recent past (within grace) + next upcoming — drops programs ended >5 days ago. */
  function featuredTiles() {
    var today = lagosTodayYmd();
    var visible = sortEvents(
      EVENTS.filter(function (e) {
        return isVisibleProgram(e, today);
      })
    );
    var recentPast = visible.filter(function (e) {
      return eventEndYmd(e) < today;
    });
    var liveOrUpcoming = visible.filter(function (e) {
      return eventEndYmd(e) >= today;
    });
    var out = [];
    if (recentPast.length) {
      out.push(
        enrichEvent(Object.assign({}, recentPast[recentPast.length - 1], { slot: 'past' }))
      );
    }
    liveOrUpcoming.slice(0, 5).forEach(function (e) {
      out.push(enrichEvent(Object.assign({}, e, { slot: 'upcoming' })));
    });
    return out;
  }

  /** Live / upcoming programs for the hero slider. */
  function heroPrograms(limit) {
    var today = lagosTodayYmd();
    var max = limit || 6;
    return sortEvents(
      EVENTS.filter(function (e) {
        return isVisibleProgram(e, today) && eventEndYmd(e) >= today;
      })
    )
      .slice(0, max)
      .map(function (e) {
        return enrichEvent(Object.assign({}, e, { slot: 'upcoming' }));
      });
  }

  global.DDBSNigeriaPrograms = {
    YEAR: YEAR,
    EVENTS: EVENTS,
    MONTH_NAMES: MONTH_NAMES,
    PAST_GRACE_DAYS: PAST_GRACE_DAYS,
    upcoming: upcoming,
    byMonth: byMonth,
    featuredTiles: featuredTiles,
    heroPrograms: heroPrograms,
    enrichEvent: enrichEvent,
    themeForEvent: themeForEvent,
    flyerForEvent: flyerForEvent,
    formatDateLabel: formatDateLabel,
    kindBadge: kindBadge,
    lagosTodayYmd: lagosTodayYmd,
    eventEndYmd: eventEndYmd,
    isVisibleProgram: isVisibleProgram,
  };
})(typeof window !== 'undefined' ? window : this);
