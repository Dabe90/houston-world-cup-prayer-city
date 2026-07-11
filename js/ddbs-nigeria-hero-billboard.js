/**
 * DDBS Nigeria hero billboard — welcome slide + upcoming program flyers.
 */
(function (global) {
  var DEFAULT_MS = 5000;
  var WELCOME_MS = 6000;

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

  function welcomeSlideHtml() {
    return (
      '<article class="hero-slide hero-slide-welcome hero-mesh min-w-full shrink-0" data-slide="0" aria-label="Welcome">' +
      '<div class="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12 lg:py-14 h-full">' +
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center min-h-[280px] sm:min-h-[320px] lg:min-h-[360px]">' +
      '<div class="min-w-0">' +
      '<p class="text-brand-accent font-semibold tracking-wide text-xs sm:text-sm mb-3 sm:mb-4">Dear Daughter Bible Study Group · Nigeria</p>' +
      '<h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold leading-[1.15] sm:leading-tight mb-4 sm:mb-6">Teaching the undiluted Word of God across every nation</h1>' +
      '<p class="text-base sm:text-lg text-white/95 font-medium mb-4 sm:mb-6 max-w-xl">Your unit hub for weekly meetings, mid-week Bible Study, programs, and ministry together — all times in WAT (Nigeria).</p>' +
      '<p class="verse-font text-white/85 italic text-base sm:text-lg leading-relaxed border-l-4 border-brand-accent pl-4 sm:pl-5">“Your word is a lamp for my feet, a light on my path.” — Psalm 119:105</p>' +
      '</div>' +
      '<div class="hidden lg:grid grid-cols-2 gap-3">' +
      '<img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&amp;q=80&amp;auto=format&amp;fit=crop" alt="Young people studying together" class="rounded-2xl object-cover h-40 w-full shadow-lift border border-white/20" loading="lazy" />' +
      '<img src="https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&amp;q=80&amp;auto=format&amp;fit=crop" alt="Open Bible study" class="rounded-2xl object-cover h-40 w-full shadow-lift border border-white/20 mt-8" loading="lazy" />' +
      '<img src="https://images.unsplash.com/photo-1529390079861-591de354faf5?w=400&amp;q=80&amp;auto=format&amp;fit=crop" alt="Community in fellowship" class="rounded-2xl object-cover h-40 w-full shadow-lift border border-white/20 -mt-4" loading="lazy" />' +
      '<img src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=400&amp;q=80&amp;auto=format&amp;fit=crop" alt="Reading scripture" class="rounded-2xl object-cover h-40 w-full shadow-lift border border-white/20" loading="lazy" />' +
      '</div>' +
      '</div></div></article>'
    );
  }

  function eventSlideHtml(slide, index) {
    var details = (slide.details || [])
      .map(function (line) {
        return '<li class="flex items-start gap-2"><i class="fas fa-circle text-[5px] mt-2 text-brand-accent shrink-0" aria-hidden="true"></i><span>' + esc(line) + '</span></li>';
      })
      .join('');
    return (
      '<article class="hero-slide hero-slide-event min-w-full shrink-0 bg-gradient-to-br ' +
      esc(slide.accent) +
      '" data-slide="' +
      index +
      '" aria-label="' +
      esc(slide.title) +
      '">' +
      '<div class="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-10 lg:py-12 h-full">' +
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 items-center min-h-[300px] sm:min-h-[340px] lg:min-h-[380px]">' +
      '<div class="min-w-0 order-2 lg:order-1 text-white">' +
      '<p class="text-brand-accent font-semibold tracking-wide text-[10px] sm:text-xs uppercase mb-2">' +
      esc(slide.eyebrow) +
      '</p>' +
      '<h2 class="text-2xl sm:text-3xl md:text-4xl font-display font-bold leading-tight mb-1">' +
      esc(slide.title) +
      '</h2>' +
      '<p class="text-base sm:text-lg text-white/90 font-medium mb-4">' +
      esc(slide.subtitle) +
      '</p>' +
      '<ul class="text-sm sm:text-base text-white/85 space-y-1.5 mb-4">' +
      details +
      '</ul>' +
      '<p class="text-sm sm:text-base text-white/90 leading-relaxed border-l-4 border-brand-accent pl-4 mb-5">' +
      esc(slide.invite) +
      '</p>' +
      '<div class="flex flex-wrap gap-2 sm:gap-3">' +
      '<a href="https://www.instagram.com/deardaughter_bs" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-full bg-white text-brand font-semibold text-xs sm:text-sm px-4 py-2.5 shadow-md hover:bg-brand-accent hover:text-brand transition">' +
      '<i class="fab fa-instagram" aria-hidden="true"></i> @deardaughter_bs</a>' +
      '<a href="' +
      esc(slide.ctaHref || '#programs') +
      '" class="hero-billboard-programs-link inline-flex items-center gap-2 rounded-full border-2 border-white/70 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 hover:bg-white/10 transition">' +
      esc(slide.ctaLabel || 'View programs') +
      ' <i class="fas fa-arrow-right text-[10px]" aria-hidden="true"></i></a>' +
      '</div></div>' +
      '<div class="order-1 lg:order-2 flex justify-center lg:justify-end">' +
      '<div class="hero-flyer-frame w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[360px] xl:max-w-[400px]">' +
      '<img src="' +
      esc(slide.image) +
      '" alt="' +
      esc(slide.imageAlt || slide.title) +
      '" class="hero-flyer-img w-full h-auto rounded-2xl shadow-lift border-2 border-white/25 object-contain bg-white/5" loading="lazy" />' +
      '</div></div>' +
      '</div></div></article>'
    );
  }

  function renderSlides(root) {
    var track = root.querySelector('[data-hero-track]');
    if (!track) return;
    var html = '';
    SLIDES.forEach(function (slide, i) {
      html += slide.type === 'welcome' ? welcomeSlideHtml() : eventSlideHtml(slide, i);
    });
    track.innerHTML = html;
    track.style.width = SLIDES.length * 100 + '%';
    track.querySelectorAll('.hero-slide').forEach(function (el) {
      el.style.width = 100 / SLIDES.length + '%';
    });
  }

  function renderDots(root, count, active) {
    var dots = root.querySelector('[data-hero-dots]');
    if (!dots) return;
    dots.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'hero-dot w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ' +
        (i === active ? 'bg-brand-accent scale-110 w-6 sm:w-7' : 'bg-white/40 hover:bg-white/70');
      btn.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      btn.setAttribute('data-dot', String(i));
      dots.appendChild(btn);
    }
  }

  function mount(selector) {
    var root = document.querySelector(selector);
    if (!root) return null;

    renderSlides(root);
    var track = root.querySelector('[data-hero-track]');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var index = 0;
    var timer = null;
    var paused = false;

    function goTo(i, animate) {
      index = ((i % SLIDES.length) + SLIDES.length) % SLIDES.length;
      var pct = (index * 100) / SLIDES.length;
      track.style.transition = animate === false ? 'none' : 'transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)';
      track.style.transform = 'translateX(-' + pct + '%)';
      renderDots(root, SLIDES.length, index);
      root.setAttribute('data-active-slide', String(index));
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      if (reducedMotion || paused) return;
      var ms = SLIDES[index].duration || DEFAULT_MS;
      timer = setTimeout(function () {
        goTo(index + 1, true);
        schedule();
      }, ms);
    }

    function pause() {
      paused = true;
      if (timer) clearTimeout(timer);
    }

    function resume() {
      paused = false;
      schedule();
    }

    root.querySelector('[data-hero-prev]')?.addEventListener('click', function () {
      goTo(index - 1, true);
      schedule();
    });
    root.querySelector('[data-hero-next]')?.addEventListener('click', function () {
      goTo(index + 1, true);
      schedule();
    });
    root.querySelector('[data-hero-dots]')?.addEventListener('click', function (e) {
      var dot = e.target.closest('[data-dot]');
      if (!dot) return;
      goTo(parseInt(dot.getAttribute('data-dot'), 10), true);
      schedule();
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

    goTo(0, false);
    if (!reducedMotion) schedule();

    return { goTo: goTo, pause: pause, resume: resume };
  }

  global.DDBSNigeriaHeroBillboard = {
    SLIDES: SLIDES,
    mount: mount,
  };

  document.addEventListener('DOMContentLoaded', function () {
    mount('#hero-billboard');
  });
})(typeof window !== 'undefined' ? window : this);
