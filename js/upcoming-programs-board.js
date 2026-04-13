/**
 * Upcoming programs tiles: World Cup volunteer signup windows + ministry events.
 * Public page: full window copy on each day. Dashboard: World Cup tiles only for dates
 * with saved shifts (your slots as lines); ministry tiles always follow.
 */
(function (global) {
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var WC_VOLUNTEER_TILES = [
    {
      dateBadge: 'June 14, 2026',
      title: 'Sunday · Volunteer shifts',
      body: '10:00 AM – 3:00 PM · Hourly slots (10–11 … 2–3) · Prayer tents · downtown Houston',
      img: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?w=800&q=80',
      imgAlt: 'Hands raised in worship',
    },
    {
      dateBadge: 'June 17, 2026',
      title: 'Wednesday · Volunteer shifts',
      body: '10:00 AM – 3:00 PM · Hourly slots · Prayer tents · downtown Houston',
      img: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
      imgAlt: 'Soccer ball on field',
    },
    {
      dateBadge: 'June 20, 2026',
      title: 'Saturday · Volunteer shifts',
      body: '10:00 AM – 3:00 PM · Hourly slots · Prayer tents · downtown Houston',
      img: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&q=80',
      imgAlt: 'Crowd at outdoor gathering',
    },
    {
      dateBadge: 'June 23, 2026',
      title: 'Tuesday · Volunteer shifts',
      body: '10:00 AM – 3:00 PM · Hourly slots · Prayer tents · downtown Houston',
      img: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
      imgAlt: 'Sunrise over hills',
    },
    {
      dateBadge: 'June 26, 2026',
      title: 'Friday evening · Volunteer shifts',
      body: '4:00 PM – 9:00 PM · Hourly slots · Outreach &amp; intercession',
      img: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
      imgAlt: 'Evening event lights',
    },
    {
      dateBadge: 'June 29, 2026',
      title: 'Monday · Volunteer shifts',
      body: '10:00 AM – 3:00 PM · Hourly slots · Prayer tents · downtown Houston',
      img: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
      imgAlt: 'Friends together',
    },
    {
      dateBadge: 'July 4, 2026',
      title: 'Saturday · Holiday weekend',
      body: '10:00 AM – 3:00 PM · Hourly slots · All-hands prayer &amp; welcome',
      img: 'https://images.unsplash.com/photo-1533231355826-99f7e920b5ed?w=800&q=80',
      imgAlt: 'Celebration and community',
    },
  ];

  var MINISTRY_TILES = [
    {
      dateBadge: 'Date TBD',
      title: 'The Rec Special Service',
      body: 'An evening of worship, prayer, and Holy Spirit–filled Word.',
      img: 'https://images.unsplash.com/photo-1478147427287-4b93705222c9?w=800&q=80',
      imgAlt: 'Worship stage lights',
      accent: 'from-violet-600/95 via-indigo-900/70',
    },
    {
      dateBadge: 'Date TBD',
      title: 'DearDaughter.ai',
      body: 'A summit of faith, technology, AI and the Kingdom.',
      img: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80',
      imgAlt: 'Abstract light technology',
      accent: 'from-cyan-600/95 via-slate-900/70',
    },
    {
      dateBadge: 'Date TBD',
      title: 'Fall Fest',
      body: 'Revival, worship, and elevation — built for college students &amp; young people.',
      img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
      imgAlt: 'Mountain sunset inspiration',
      accent: 'from-amber-600/95 via-orange-950/75',
    },
  ];

  /** Strip trailing "(Sunday)" etc. so sheet/form dates match tile dateBadge. */
  function normalizeProgramDateKey(dateStr) {
    return String(dateStr || '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Map date label (e.g. June 14, 2026) → display lines "time · role" */
  function parseShiftsByDate(shiftsText) {
    var map = {};
    String(shiftsText || '')
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean)
      .forEach(function (line) {
        var parts = line.split(/\s*—\s*/);
        if (parts.length < 2) return;
        var date = normalizeProgramDateKey(parts[0].trim());
        if (!date) return;
        var rest;
        if (parts.length >= 3) {
          var time = parts[1].trim();
          var role = parts.slice(2).join(' — ').trim();
          rest = time + ' · ' + role;
        } else {
          rest = parts.slice(1).join(' — ').trim();
        }
        if (!map[date]) map[date] = [];
        map[date].push(rest);
      });
    return map;
  }

  function tileArticle(tile, extraClass) {
    var grad = tile.accent || 'from-black/70';
    var cls =
      'program-card group bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden ' +
      (extraClass || '');
    return (
      '<article class="' +
      cls +
      '">' +
      '<div class="h-36 sm:h-44 overflow-hidden relative">' +
      '<img class="program-card-img w-full h-full object-cover" src="' +
      escapeHtml(tile.img) +
      '" alt="' +
      escapeHtml(tile.imgAlt) +
      '" loading="lazy" />' +
      '<div class="absolute inset-0 bg-gradient-to-t ' + grad + ' to-transparent"></div>' +
      '<span class="absolute bottom-3 left-3 text-white font-bold text-sm drop-shadow-md">' +
      escapeHtml(tile.dateBadge) +
      '</span>' +
      '</div>' +
      '<div class="p-4 min-w-0">' +
      '<h3 class="font-semibold text-slate-900 break-words">' +
      escapeHtml(tile.title) +
      '</h3>' +
      (tile.bodyLines && tile.bodyLines.length
        ? '<ul class="mt-2 space-y-1.5 text-sm text-slate-700 list-none pl-0">' +
          tile.bodyLines
            .map(function (l) {
              return (
                '<li class="flex gap-2"><span class="text-brand shrink-0 font-bold" aria-hidden="true">·</span><span>' +
                escapeHtml(l) +
                '</span></li>'
              );
            })
            .join('') +
          '</ul>'
        : '<p class="text-sm text-slate-600 mt-1 break-words">' +
          tile.body +
          '</p>') +
      '</div>' +
      '</article>'
    );
  }

  function renderPublicBoard(container) {
    if (!container) return;
    var html = '';
    WC_VOLUNTEER_TILES.forEach(function (t) {
      html += tileArticle(t);
    });
    MINISTRY_TILES.forEach(function (t) {
      html += tileArticle(t);
    });
    container.innerHTML = html;
  }

  function renderDashboardBoard(container, opts) {
    if (!container) return;
    opts = opts || {};
    var byDate = parseShiftsByDate(opts.shiftsText || '');

    var html = '';
    WC_VOLUNTEER_TILES.forEach(function (t) {
      var badgeKey = normalizeProgramDateKey(t.dateBadge);
      var mine = byDate[badgeKey] || byDate[t.dateBadge];
      if (!mine || !mine.length) return;

      var dayPart = t.title.indexOf('·') !== -1 ? t.title.split('·')[0].trim() : t.title;
      var tile = {
        dateBadge: t.dateBadge,
        title: dayPart + ' · Your shift(s)',
        body: '',
        img: t.img,
        imgAlt: t.imgAlt,
        accent: t.accent,
        bodyLines: mine,
      };
      html += tileArticle(tile, 'ring-2 ring-brand/20');
    });

    MINISTRY_TILES.forEach(function (t) {
      html += tileArticle(t);
    });
    container.innerHTML = html;
  }

  global.PrayerCityPrograms = {
    renderPublicBoard: renderPublicBoard,
    renderDashboardBoard: renderDashboardBoard,
    WC_VOLUNTEER_TILES: WC_VOLUNTEER_TILES,
    MINISTRY_TILES: MINISTRY_TILES,
  };
})(typeof window !== 'undefined' ? window : this);
