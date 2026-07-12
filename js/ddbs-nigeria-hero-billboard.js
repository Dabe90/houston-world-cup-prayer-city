/**
 * DDBS Nigeria hero billboard — permanent welcome slide + upcoming program flyers.
 * Event slides follow the ministry calendar (hide programs ended more than 5 days ago).
 * Infinite forward loop (always slides left / content enters from right).
 */
(function (global) {
  var DEFAULT_MS = 5000;
  var WELCOME_MS = 6000;
  var TRANSITION_MS = 850;

  var WELCOME_SLIDE = { type: 'welcome', duration: WELCOME_MS };

  /** Rich copy / flyer accents for known programs (matched by title). */
  var PROGRAM_SLIDE_META = [
    {
      match: /recharge|leadership conference/i,
      duration: 6000,
      eyebrow: 'Leadership Conference · July 6–11, 2026',
      title: 'Recharge 2026',
      subtitle: 'Theme: Deep Waters',
      details: [
        '8 PM daily (WAT) on our Telegram page',
        'Host: Abe Damilola · Guests: Tricia Hill & Ope Badaru',
        'Building leaders who go deeper in God',
      ],
      invite:
        'Join us every evening this week — DM @deardaughter_bs on Telegram for the link. All Dear Daughter members and friends are welcome.',
      image: 'images/ddbs-nigeria/recharge-leadership-conference-2026.png',
      imageAlt: 'Recharge Leadership Conference 2026 flyer',
      accent: 'from-violet-600 via-indigo-700 to-brand',
    },
    {
      match: /how much do you know|couples game/i,
      duration: DEFAULT_MS,
      eyebrow: 'Mid-week Bible Study · Wednesday, July 15',
      title: 'How Much Do You Know',
      subtitle: 'Couples Game Night',
      details: ['Talk · Games · Word · Q&A session', '8 PM WAT · Telegram (DM for link)'],
      invite:
        'Bring your spouse and join the fun — test how well you know each other, grow in the Word, and connect with other couples in Dear Daughter.',
      image: 'images/ddbs-nigeria/couples-game-how-much-do-you-know.png',
      imageAlt: 'How Much Do You Know couples game flyer',
      accent: 'from-rose-700 via-red-800 to-rose-900',
    },
    {
      match: /movie night/i,
      duration: DEFAULT_MS,
      eyebrow: 'Mid-week Bible Study · Wednesday, July 22',
      title: 'Movie Night',
      subtitle: 'Couple-themed evening',
      details: ['8:00 PM prompt (WAT)', 'Telegram page — DM for link'],
      invite:
        'Popcorn, fellowship, and faith — grab your partner and join us online for a relaxed movie night with the Dear Daughter family.',
      image: 'images/ddbs-nigeria/movie-night-july-2026.png',
      imageAlt: 'Movie Night July 2026 flyer',
      accent: 'from-red-800 via-rose-900 to-slate-900',
    },
    {
      match: /unstoppable generation/i,
      duration: DEFAULT_MS,
      eyebrow: 'Special Monthly Prayer · Friday, July 24',
      title: 'Unstoppable Generation',
      subtitle: 'A night of prayer and intercession',
      details: ['8:00 PM (WAT)', 'Follow @deardaughter_bs for the Telegram link'],
      invite:
        'Stand with us in prayer for an unstoppable generation — young and old, near and far. You are invited to pray with us.',
      image: 'images/ddbs-nigeria/unstoppable-generation-prayer.png',
      imageAlt: 'Unstoppable Generation special monthly prayer flyer',
      accent: 'from-sky-600 via-blue-700 to-indigo-900',
    },
    {
      match: /five wines of marriage/i,
      duration: DEFAULT_MS,
      eyebrow: 'Special Bible Study · Friday, July 25',
      title: 'Five Wines of Marriage',
      subtitle: 'A spiritual blending for love that lasts',
      details: [
        'Building covenant · Nourishing love · Finishing strong',
        '8:00 PM (WAT) · Telegram (DM for link)',
      ],
      invite:
        'Married or preparing for marriage? Join us for a rich Word session on covenant love — invite a friend and grow together.',
      image: 'images/ddbs-nigeria/five-wines-of-marriage.png',
      imageAlt: 'Five Wines of Marriage flyer',
      accent: 'from-rose-900 via-red-950 to-slate-900',
    },
  ];

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function metaForEvent(ev) {
    var title = String(ev.title || '');
    for (var i = 0; i < PROGRAM_SLIDE_META.length; i++) {
      if (PROGRAM_SLIDE_META[i].match.test(title)) return PROGRAM_SLIDE_META[i];
    }
    return null;
  }

  function slideFromEvent(ev) {
    var meta = metaForEvent(ev);
    var P = global.DDBSNigeriaPrograms;
    var label = P && P.formatDateLabel ? P.formatDateLabel(ev) : ev.dateKey;
    var kind = P && P.kindBadge ? P.kindBadge(ev.kind) : ev.kind === 'midweek' ? 'Wed Bible Study' : 'Special program';
    var image = (meta && meta.image) || ev.flyer || ev.displayImage || ev.image;
    return {
      type: 'event',
      duration: (meta && meta.duration) || DEFAULT_MS,
      eyebrow: (meta && meta.eyebrow) || kind + ' · ' + label,
      title: (meta && meta.title) || ev.title,
      subtitle: (meta && meta.subtitle) || (ev.kind === 'midweek' ? 'Mid-week Bible Study' : 'Upcoming program'),
      details: (meta && meta.details) || [label + ' (WAT)', 'DM @deardaughter_bs on Telegram for the link'],
      invite:
        (meta && meta.invite) ||
        'You are invited — join Dear Daughter for this program. Follow @deardaughter_bs for the Telegram link.',
      image: image,
      imageAlt: (meta && meta.imageAlt) || ev.title,
      accent: (meta && meta.accent) || 'from-brand via-indigo-800 to-slate-900',
      ctaLabel: 'View programs',
      ctaHref: '#programs',
      dateKey: ev.dateKey,
    };
  }

  /**
   * Welcome slide is permanent. Remaining slides = next upcoming calendar programs
   * (prefer specials with flyers, then fill with other upcoming).
   */
  function buildSlides() {
    var slides = [WELCOME_SLIDE];
    var P = global.DDBSNigeriaPrograms;
    if (!P || !P.heroPrograms) {
      return slides;
    }
    var programs = P.heroPrograms(12);
    var withFlyer = [];
    var rest = [];
    programs.forEach(function (ev) {
      if (ev.hasFlyer || metaForEvent(ev)) withFlyer.push(ev);
      else rest.push(ev);
    });
    // Prefer specials / flyer programs first for the slider story
    var specials = withFlyer.filter(function (e) {
      return e.kind !== 'midweek';
    });
    var midweekFlyers = withFlyer.filter(function (e) {
      return e.kind === 'midweek';
    });
    var ordered = specials.concat(midweekFlyers).concat(rest);
    var seen = {};
    ordered.forEach(function (ev) {
      if (slides.length >= 7) return;
      var key = ev.dateKey + '|' + ev.title;
      if (seen[key]) return;
      seen[key] = true;
      slides.push(slideFromEvent(ev));
    });
    return slides;
  }

  var SLIDES = buildSlides();

  function slideHtml(slide, logicalIndex) {
    if (slide.type === 'welcome') {
      return (
        '<article class="hero-slide hero-slide-welcome hero-mesh" data-logical="' +
        logicalIndex +
        '" aria-label="Welcome">' +
        '<div class="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-5 h-full flex items-center">' +
        '<div class="min-w-0 w-full">' +
        '<p class="hero-anim hero-anim-1 hero-eyebrow text-brand-accent font-semibold uppercase text-[10px] sm:text-xs mb-2">Dear Daughter Bible Study Group · Nigeria</p>' +
        '<h1 class="hero-anim hero-anim-2 hero-headline text-xl sm:text-2xl md:text-3xl font-display font-semibold leading-[1.12] mb-2 sm:mb-3">Teaching the undiluted Word of God to all nations</h1>' +
        '<p class="hero-anim hero-anim-3 text-sm sm:text-base text-white/95 font-medium mb-3 max-w-2xl leading-relaxed">A warm, global family on mission for <strong class="text-brand-accent">one billion souls for Christ</strong> by December 31, 2030.</p>' +
        '<div class="hero-anim hero-anim-5 flex flex-wrap gap-2">' +
        '<a href="#serve" class="inline-flex items-center gap-2 rounded-full bg-white text-brand font-bold text-xs sm:text-sm px-4 py-2 shadow-lift hover:scale-[1.03] transition-transform"><i class="fas fa-shield-halved text-xs" aria-hidden="true"></i> Join the Kingdom Workforce</a>' +
        '<a href="#join" class="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/35 text-white font-semibold text-xs px-4 py-2 hover:bg-white/25 transition">Join the family <i class="fas fa-arrow-right text-xs"></i></a>' +
        '</div></div></div></article>'
      );
    }

    var details = (slide.details || [])
      .map(function (line) {
        return (
          '<li class="flex items-start gap-2"><i class="fas fa-circle text-[5px] mt-2.5 text-brand-accent shrink-0" aria-hidden="true"></i><span>' +
          esc(line) +
          '</span></li>'
        );
      })
      .join('');

    return (
      '<article class="hero-slide hero-slide-event hero-flyer-mesh" data-logical="' +
      logicalIndex +
      '" aria-label="' +
      esc(slide.title) +
      '">' +
      '<div class="hero-flyer-bg" style="background-image:url(\'' +
      esc(slide.image) +
      '\')" aria-hidden="true"></div>' +
      '<div class="hero-flyer-overlay" aria-hidden="true"></div>' +
      '<div class="hero-flyer-content max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-5 h-full flex items-center">' +
      '<div class="max-w-2xl min-w-0 flex flex-col justify-center text-white">' +
      '<p class="hero-anim hero-anim-1 hero-eyebrow text-brand-accent font-semibold uppercase text-[10px] sm:text-xs mb-2 sm:mb-3">' +
      esc(slide.eyebrow) +
      '</p>' +
      '<h2 class="hero-anim hero-anim-2 hero-headline text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] font-display font-semibold leading-[1.1] mb-2">' +
      esc(slide.title) +
      '</h2>' +
      '<p class="hero-anim hero-anim-3 text-base sm:text-lg text-white/92 font-medium mb-4 leading-snug">' +
      esc(slide.subtitle) +
      '</p>' +
      '<ul class="hero-anim hero-anim-4 text-sm sm:text-base text-white/88 space-y-1.5 mb-4 leading-relaxed">' +
      details +
      '</ul>' +
      '<p class="hero-anim hero-anim-5 font-verse italic text-base sm:text-lg text-white/92 leading-relaxed border-l-4 border-brand-accent pl-4 mb-5">' +
      esc(slide.invite) +
      '</p>' +
      '<div class="hero-anim hero-anim-6 flex flex-wrap gap-2 sm:gap-3">' +
      '<a href="https://www.instagram.com/deardaughter_bs" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-full bg-white text-brand font-semibold text-xs sm:text-sm px-4 py-2.5 shadow-lg hover:bg-brand-accent hover:text-brand transition-all duration-300 hover:scale-[1.02]">' +
      '<i class="fab fa-instagram" aria-hidden="true"></i> @deardaughter_bs</a>' +
      '<a href="' +
      esc(slide.ctaHref || '#programs') +
      '" class="hero-billboard-programs-link inline-flex items-center gap-2 rounded-full border-2 border-white/70 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 hover:bg-white/12 transition-all duration-300 hover:scale-[1.02]">' +
      esc(slide.ctaLabel || 'View programs') +
      ' <i class="fas fa-arrow-right text-[10px]" aria-hidden="true"></i></a>' +
      '</div></div></div></article>'
    );
  }

  function renderSlides(track) {
    var count = SLIDES.length;
    var last = count - 1;
    var html = slideHtml(SLIDES[last], last);
    SLIDES.forEach(function (slide, i) {
      html += slideHtml(slide, i);
    });
    html += slideHtml(SLIDES[0], 0);
    track.innerHTML = html;
  }

  function renderDots(root, activeLogical, slideMs) {
    var dots = root.querySelector('[data-hero-dots]');
    if (!dots) return;
    dots.innerHTML = '';
    for (var i = 0; i < SLIDES.length; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      var isActive = i === activeLogical;
      btn.className =
        'hero-dot-wrap hero-dot h-2 sm:h-2.5 rounded-full transition-all duration-300 ' +
        (isActive ? 'is-active w-7 sm:w-9 bg-white/25' : 'w-2 sm:w-2.5 bg-white/40 hover:bg-white/65');
      btn.style.setProperty('--hero-slide-ms', (slideMs || DEFAULT_MS) + 'ms');
      btn.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      btn.setAttribute('data-dot', String(i));
      if (isActive) {
        var bar = document.createElement('span');
        bar.className = 'hero-dot-progress';
        bar.setAttribute('aria-hidden', 'true');
        btn.appendChild(bar);
      }
      dots.appendChild(btn);
    }
  }

  function setActiveSlide(track, position) {
    var slides = track.querySelectorAll('.hero-slide');
    slides.forEach(function (el) {
      el.classList.remove('is-active');
    });
    var active = slides[position];
    if (active) {
      void active.offsetWidth;
      active.classList.add('is-active');
    }
  }

  function mount(selector) {
    var root = document.querySelector(selector);
    if (!root) return null;

    SLIDES = buildSlides();
    if (!SLIDES.length) SLIDES = [WELCOME_SLIDE];

    var track = root.querySelector('[data-hero-track]');
    if (!track) return null;
    renderSlides(track);

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var count = SLIDES.length;
    var position = 1;
    var timer = null;
    var paused = false;
    var animating = false;

    function logicalIndex() {
      if (position === 0) return count - 1;
      if (position === count + 1) return 0;
      return position - 1;
    }

    function applyPosition(pos, animate) {
      position = pos;
      track.style.transition = animate
        ? 'transform ' + TRANSITION_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1)'
        : 'none';
      track.style.transform = 'translateX(-' + position * 100 + '%)';
      setActiveSlide(track, position);
      var ms = SLIDES[logicalIndex()].duration || DEFAULT_MS;
      renderDots(root, logicalIndex(), ms);
      root.setAttribute('data-active-slide', String(logicalIndex()));
    }

    function afterTransition(fn) {
      function onEnd(e) {
        if (e.propertyName !== 'transform') return;
        track.removeEventListener('transitionend', onEnd);
        animating = false;
        fn();
      }
      track.addEventListener('transitionend', onEnd);
    }

    function normalizeLoop() {
      if (position === 0) {
        applyPosition(count, false);
      } else if (position === count + 1) {
        applyPosition(1, false);
      }
    }

    function goNext() {
      if (animating || count < 2) return;
      animating = true;
      applyPosition(position + 1, true);
      afterTransition(function () {
        normalizeLoop();
        if (!paused && !reducedMotion) schedule();
      });
    }

    function goPrev() {
      if (animating || count < 2) return;
      animating = true;
      applyPosition(position - 1, true);
      afterTransition(function () {
        normalizeLoop();
        if (!paused && !reducedMotion) schedule();
      });
    }

    function goToLogical(i) {
      if (animating || i < 0 || i >= count) return;
      clearTimeout(timer);
      animating = true;
      applyPosition(i + 1, true);
      afterTransition(function () {
        if (!paused && !reducedMotion) schedule();
      });
    }

    function schedule() {
      clearTimeout(timer);
      if (paused || reducedMotion || count < 2) return;
      var ms = SLIDES[logicalIndex()].duration || DEFAULT_MS;
      timer = setTimeout(goNext, ms);
    }

    function pause() {
      paused = true;
      clearTimeout(timer);
    }

    function resume() {
      paused = false;
      schedule();
    }

    root.querySelector('[data-hero-prev]') &&
      root.querySelector('[data-hero-prev]').addEventListener('click', function () {
        clearTimeout(timer);
        goPrev();
      });
    root.querySelector('[data-hero-next]') &&
      root.querySelector('[data-hero-next]').addEventListener('click', function () {
        clearTimeout(timer);
        goNext();
      });
    root.addEventListener('click', function (e) {
      var dot = e.target.closest('[data-dot]');
      if (!dot) return;
      goToLogical(parseInt(dot.getAttribute('data-dot'), 10));
    });
    root.addEventListener('mouseenter', pause);
    root.addEventListener('mouseleave', resume);
    root.addEventListener('focusin', pause);
    root.addEventListener('focusout', function (e) {
      if (!root.contains(e.relatedTarget)) resume();
    });

    root.querySelectorAll('.hero-billboard-programs-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var dash = document.getElementById('dash-shell');
        var tabBtn = document.querySelector('.tab-btn[data-tab="programs"]');
        if (dash && !dash.classList.contains('hidden') && tabBtn) {
          e.preventDefault();
          tabBtn.click();
          dash.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
          return;
        }
        var auth = document.getElementById('auth-panel');
        if (auth && !auth.classList.contains('hidden')) {
          e.preventDefault();
          auth.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        }
      });
    });

    if (location.hash === '#programs') {
      setTimeout(function () {
        var tabBtn = document.querySelector('.tab-btn[data-tab="programs"]');
        var dash = document.getElementById('dash-shell');
        if (dash && !dash.classList.contains('hidden') && tabBtn) tabBtn.click();
      }, 400);
    }

    applyPosition(1, false);
    if (!reducedMotion) schedule();

    return { goNext: goNext, goPrev: goPrev, pause: pause, resume: resume };
  }

  global.DDBSNigeriaHeroBillboard = {
    buildSlides: buildSlides,
    mount: mount,
  };

  function init() {
    mount('#hero-billboard');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
