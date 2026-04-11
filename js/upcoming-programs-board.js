/**
 * Upcoming programs tiles: World Cup volunteer signup windows + ministry events.
 * Dashboard uses the same tile grid as the public page.
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
      body: 'Gathering around faith, Scripture, and the tools that help daughters grow.',
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

  function tileArticle(tile, extraClass) {
    var grad = tile.accent || 'from-black/70';
    var cls =
      'program-card group bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden ' +
      (extraClass || '');
    return (
      '<article class="' +
      cls +
      '">' +
      '<div class="h-44 overflow-hidden relative">' +
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
      '<div class="p-4">' +
      '<h3 class="font-semibold text-slate-900">' +
      escapeHtml(tile.title) +
      '</h3>' +
      '<p class="text-sm text-slate-600 mt-1">' +
      tile.body +
      '</p>' +
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

  /** Same tile grid as the public sign-up page (volunteer dates + ministry nights). */
  function renderDashboardBoard(container) {
    renderPublicBoard(container);
  }

  global.PrayerCityPrograms = {
    renderPublicBoard: renderPublicBoard,
    renderDashboardBoard: renderDashboardBoard,
    WC_VOLUNTEER_TILES: WC_VOLUNTEER_TILES,
    MINISTRY_TILES: MINISTRY_TILES,
  };
})(typeof window !== 'undefined' ? window : this);
