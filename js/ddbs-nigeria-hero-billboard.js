/**
 * DDBS Nigeria hero billboard — welcome slide + upcoming program flyers.
 * Infinite forward loop (always slides left / content enters from right).
 */
(function (global) {
  var DEFAULT_MS = 5000;
  var WELCOME_MS = 6000;
  var TRANSITION_MS = 850;

  var SLIDES = [
    { type: 'welcome', duration: WELCOME_MS },
    {
      type: 'event',
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
      ctaLabel: 'See full calendar',
      ctaHref: '#programs',
    },
    {
      type: 'event',
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
      ctaLabel: 'View programs',
      ctaHref: '#programs',
    },
    {
      type: 'event',
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
      ctaLabel: 'View programs',
      ctaHref: '#programs',
    },
    {
      type: 'event',
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
      ctaLabel: 'View programs',
      ctaHref: '#programs',
    },
    {
      type: 'event',
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
      ctaLabel: 'View programs',
      ctaHref: '#programs',
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

  function slideHtml(slide, logicalIndex) {
    if (slide.type === 'welcome') {
      return (
        '<article class="hero-slide hero-slide-welcome hero-mesh" data-logical="' +
        logicalIndex +
        '" aria-label="Welcome">' +
        '<div class="max-w-7xl mx-auto px-3 sm:px-6 py-10 sm:py-14 lg:py-16 h-full">' +
        '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center min-h-[min(60vh,480px)] sm:min-h-[min(65vh,520px)] lg:min-h-[min(72vh,560px)]">' +
        '<div class="min-w-0">' +
        '<p class="hero-anim hero-anim-1 hero-eyebrow text-brand-accent font-semibold uppercase text-[10px] sm:text-xs mb-3 sm:mb-4">Dear Daughter Bible Study Group · Nigeria</p>' +
        '<h1 class="hero-anim hero-anim-2 hero-headline text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-display font-semibold leading-[1.12] mb-4 sm:mb-6">Teaching the undiluted Word of God to all nations</h1>' +
        '<p class="hero-anim hero-anim-3 text-base sm:text-lg text-white/95 font-medium mb-4 sm:mb-6 max-w-xl leading-relaxed">A warm, global family on mission for <strong class="text-brand-accent">one billion souls for Christ</strong> by December 31, 2030 — through Bible Study, Jesus March, prayer, and faithful service.</p>' +
        '<div class="hero-anim hero-anim-5 flex flex-wrap gap-3 mb-4 sm:mb-6">' +
        '<a href="#serve" class="inline-flex items-center gap-2 rounded-full bg-white text-brand font-bold text-sm sm:text-base px-5 sm:px-6 py-2.5 sm:py-3 shadow-lift hover:scale-[1.03] transition-transform"><i class="fas fa-shield-halved text-xs" aria-hidden="true"></i> Join the Kingdom Workforce</a>' +
        '<a href="#join" class="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/35 text-white font-semibold text-sm px-5 py-2.5 hover:bg-white/25 transition">Join the family <i class="fas fa-arrow-right text-xs"></i></a>' +
        '</div>' +
        '<p class="hero-anim hero-anim-4 font-verse italic text-white/90 text-lg sm:text-xl leading-relaxed border-l-4 border-brand-accent pl-4 sm:pl-5">“Your word is a lamp for my feet, a light on my path.” — Psalm 119:105</p>' +
        '</div>' +
        '<div class="hidden lg:grid grid-cols-2 gap-3">' +
        '<img src="images/prayer-city-day2-team.jpeg" alt="Jesus March Nigeria — team on the move" class="hero-photo-tile rounded-2xl object-cover h-40 w-full shadow-lift border border-white/20" loading="lazy" />' +
        '<img src="images/prayer-city-outreach-signs.jpeg" alt="Jesus March Nigeria — outreach" class="hero-photo-tile rounded-2xl object-cover h-40 w-full shadow-lift border border-white/20 mt-8" loading="lazy" style="animation-delay:-3s" />' +
        '<img src="images/prayer-city-day2-team.jpeg" alt="Jesus March Nigeria — worship and prayer" class="hero-photo-tile rounded-2xl object-cover h-40 w-full shadow-lift border border-white/20 -mt-4" loading="lazy" style="animation-delay:-6s" />' +
        '<img src="images/prayer-city-outreach-signs.jpeg" alt="Jesus March Nigeria — carrying the Word" class="hero-photo-tile rounded-2xl object-cover h-40 w-full shadow-lift border border-white/20" loading="lazy" style="animation-delay:-9s" />' +
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
      '<div class="hero-flyer-content max-w-7xl mx-auto px-3 sm:px-6 py-10 sm:py-14 lg:py-16 h-full">' +
      '<div class="max-w-2xl lg:max-w-3xl min-h-[min(60vh,480px)] sm:min-h-[min(65vh,520px)] lg:min-h-[min(72vh,560px)] flex flex-col justify-center text-white">' +
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

    var track = root.querySelector('[data-hero-track]');
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
      if (animating) return;
      if (position >= count + 1) return;
      animating = true;
      applyPosition(position + 1, true);
      afterTransition(function () {
        normalizeLoop();
        schedule();
      });
    }

    function goPrev() {
      if (animating) return;
      if (position <= 0) return;
      animating = true;
      applyPosition(position - 1, true);
      afterTransition(function () {
        normalizeLoop();
        schedule();
      });
    }

    function moveSteps(direction, remaining, onDone) {
      if (remaining <= 0) {
        if (onDone) onDone();
        return;
      }
      animating = true;
      applyPosition(position + (direction === 'next' ? 1 : -1), true);
      afterTransition(function () {
        normalizeLoop();
        moveSteps(direction, remaining - 1, onDone);
      });
    }

    function goToLogical(target) {
      if (timer) clearTimeout(timer);
      var current = logicalIndex();
      if (target === current) return;
      var forward = (target - current + count) % count;
      var backward = (current - target + count) % count;
      if (forward <= backward) moveSteps('next', forward, schedule);
      else moveSteps('prev', backward, schedule);
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      if (reducedMotion || paused || animating) return;
      var ms = SLIDES[logicalIndex()].duration || DEFAULT_MS;
      timer = setTimeout(goNext, ms);
    }

    function pause() {
      paused = true;
      if (timer) clearTimeout(timer);
    }

    function resume() {
      paused = false;
      schedule();
    }

    var prevBtn = root.querySelector('[data-hero-prev]');
    var nextBtn = root.querySelector('[data-hero-next]');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (timer) clearTimeout(timer);
        goPrev();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (timer) clearTimeout(timer);
        goNext();
      });
    }
    root.querySelector('[data-hero-dots]')?.addEventListener('click', function (e) {
      var dot = e.target.closest('[data-dot]');
      if (!dot) return;
      if (timer) clearTimeout(timer);
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
    SLIDES: SLIDES,
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
