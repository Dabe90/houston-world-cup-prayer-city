/**
 * DDBS Nigeria public landing — units, programs, gallery, scroll reveals.
 */
(function (global) {
  function galleryPhotos() {
    var manifest = global.NIGERIA_GALLERY_MANIFEST;
    if (!manifest || !manifest.items) return [];
    return manifest.items
      .filter(function (item) {
        return item.type === 'image' && item.src;
      })
      .map(function (item) {
        return item.src;
      });
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initReveal() {
    var els = document.querySelectorAll('.ng-reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach(function (el) {
      io.observe(el);
    });
  }

  function renderAliveStrip() {
    var strip = document.getElementById('ng-alive-photos');
    if (!strip) return;
    var photos = galleryPhotos().slice(0, 6);
    if (!photos.length) {
      strip.classList.add('hidden');
      return;
    }
    strip.innerHTML = photos.map(function (src, i) {
      return (
        '<div class="ng-alive-photo rounded-xl overflow-hidden aspect-[4/5] shadow-md" style="animation-delay:' +
        i * 0.12 +
        's">' +
        '<img src="' +
        esc(src) +
        '" alt="" loading="lazy" class="w-full h-full object-cover" /></div>'
      );
    }).join('');
  }

  function renderUnits() {
    var grid = document.getElementById('ng-landing-units');
    if (!grid || !global.NigeriaUnits) return;
    var units = NigeriaUnits.enlistableUnits
      ? NigeriaUnits.enlistableUnits()
      : NigeriaUnits.NIGERIA_UNITS || [];
    grid.innerHTML = units
      .map(function (u, i) {
        var schedule = NigeriaUnits.meetingScheduleLabel(u);
        return (
          '<button type="button" class="ng-unit-card ng-card ng-reveal rounded-2xl bg-white border border-slate-100 p-5 shadow-card text-left w-full transition ring-offset-2 focus:outline-none focus:ring-2 focus:ring-brand/40" data-unit-id="' +
          esc(u.id) +
          '" aria-pressed="false" style="transition-delay:' +
          i * 0.05 +
          's">' +
          '<div class="w-12 h-12 rounded-xl bg-gradient-to-br ' +
          u.gradient +
          ' text-white flex items-center justify-center mb-3 text-lg"><i class="fas ' +
          u.icon +
          '"></i></div>' +
          '<h3 class="font-semibold text-slate-900">' +
          esc(u.label) +
          '</h3>' +
          '<p class="text-xs font-semibold text-brand mt-2">' +
          esc(schedule) +
          '</p>' +
          '<p class="text-xs text-slate-600 mt-2 leading-relaxed">' +
          esc(u.summary || '') +
          '</p>' +
          '<p class="ng-unit-card-hint text-[10px] font-semibold text-brand mt-3 uppercase tracking-wide">Tap to select</p></button>'
        );
      })
      .join('');
    grid.querySelectorAll('.ng-unit-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleWorkforceUnit(btn.getAttribute('data-unit-id'));
      });
    });
    syncUnitCardSelection();
    renderWorkforceUnitPicks();
  }

  var workforceSelected = {};

  function toggleWorkforceUnit(unitId) {
    if (!unitId || !global.NigeriaUnits) return;
    if (workforceSelected[unitId]) {
      delete workforceSelected[unitId];
    } else {
      var u = NigeriaUnits.getUnit(unitId);
      if (!u) return;
      workforceSelected[unitId] = { id: u.id, label: u.label };
    }
    syncUnitCardSelection();
    renderWorkforceUnitPicks();
    openWorkforcePanel();
  }

  function syncUnitCardSelection() {
    document.querySelectorAll('.ng-unit-card[data-unit-id]').forEach(function (card) {
      var id = card.getAttribute('data-unit-id');
      var on = !!workforceSelected[id];
      card.classList.toggle('is-selected', on);
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderWorkforceUnitPicks() {
    var wrap = document.getElementById('ng-workforce-unit-picks');
    var hint = document.getElementById('ng-workforce-unit-hint');
    if (!wrap) return;
    var ids = Object.keys(workforceSelected);
    if (!ids.length) {
      wrap.innerHTML =
        '<span class="text-xs text-slate-500 italic">No units selected — tap unit cards above.</span>';
      if (hint) hint.classList.remove('hidden');
      return;
    }
    if (hint) hint.classList.add('hidden');
    wrap.innerHTML = ids
      .map(function (id) {
        var u = workforceSelected[id];
        return (
          '<span class="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand text-xs font-semibold px-3 py-1">' +
          esc(u.label) +
          '<button type="button" class="ng-unit-pick-remove ml-1 text-brand/70 hover:text-brand leading-none" data-unit="' +
          esc(id) +
          '" aria-label="Remove ' +
          esc(u.label) +
          '">&times;</button></span>'
        );
      })
      .join('');
    wrap.querySelectorAll('.ng-unit-pick-remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        delete workforceSelected[btn.getAttribute('data-unit')];
        syncUnitCardSelection();
        renderWorkforceUnitPicks();
      });
    });
  }

  function getWorkforceUnitIds() {
    return Object.keys(workforceSelected);
  }

  function openWorkforcePanel() {
    var panel = document.getElementById('ng-workforce-details');
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.setAttribute('open', '');
    try {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {}
  }

  function closeWorkforcePanel() {
    var panel = document.getElementById('ng-workforce-details');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.removeAttribute('open');
  }

  function initWorkforceCollapse() {
    var toggle = document.getElementById('ng-workforce-toggle');
    var closeBtn = document.getElementById('ng-workforce-close');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var panel = document.getElementById('ng-workforce-details');
        if (panel && panel.classList.contains('hidden')) openWorkforcePanel();
        else closeWorkforcePanel();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeWorkforcePanel);
    if (window.location.hash === '#serve') {
      setTimeout(function () {
        var serve = document.getElementById('serve');
        if (serve) serve.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
    document.querySelectorAll('a[href="#serve"]').forEach(function (link) {
      link.addEventListener('click', function () {
        setTimeout(function () {
          var serve = document.getElementById('serve');
          if (serve) serve.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      });
    });
  }

  function programCard(tile, delay) {
    var P = global.DDBSNigeriaPrograms;
    var enriched = tile.displayImage ? tile : P ? P.enrichEvent(tile) : tile;
    var img = enriched.displayImage || enriched.image || enriched.img || '';
    var hasFlyer = !!enriched.hasFlyer;
    var date =
      tile.dateKey && P ? P.formatDateLabel(tile) : tile.dateBadge || '';
    var imgClass = hasFlyer
      ? 'ng-program-img w-full h-full object-contain bg-white p-2'
      : 'ng-program-img w-full h-full object-cover';
    var mediaHeight = hasFlyer ? 'h-48 sm:h-52' : 'h-36';
    var overlay = hasFlyer
      ? 'bg-gradient-to-t from-slate-900/75 via-transparent to-transparent'
      : 'bg-gradient-to-t from-slate-900/85 to-transparent';
    return (
      '<article class="ng-program-card ng-card ng-reveal shrink-0 w-[280px] sm:w-[300px] rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-card snap-start" style="transition-delay:' +
      (delay || 0) +
      's">' +
      '<div class="' +
      mediaHeight +
      ' overflow-hidden relative ' +
      (hasFlyer ? 'bg-slate-100' : '') +
      '">' +
      '<img class="' +
      imgClass +
      '" src="' +
      esc(img) +
      '" alt="" loading="lazy" />' +
      '<div class="absolute inset-0 ' +
      overlay +
      '"></div>' +
      '<span class="absolute bottom-2 left-3 text-white text-xs font-bold drop-shadow">' +
      esc(date) +
      '</span></div>' +
      '<div class="p-4"><h3 class="font-semibold text-slate-900 text-sm leading-snug">' +
      esc(tile.title) +
      '</h3></div></article>'
    );
  }

  function renderPrograms() {
    var row = document.getElementById('ng-landing-programs');
    if (!row || !global.DDBSNigeriaPrograms) return;
    var tiles = DDBSNigeriaPrograms.featuredTiles().slice(0, 6);
    row.innerHTML = tiles
      .map(function (t, i) {
        return programCard(t, i * 0.07);
      })
      .join('');
  }

  function renderGallery() {
    var grid = document.getElementById('ng-landing-gallery');
    var manifest = global.NIGERIA_GALLERY_MANIFEST;
    if (!grid || !manifest || !manifest.items || !manifest.items.length) return;
    grid.innerHTML = manifest.items
      .filter(function (item) {
        return item.type === 'image';
      })
      .map(function (item, i) {
        var wide = i % 5 === 0 ? ' sm:col-span-2 sm:row-span-2' : '';
        return (
          '<button type="button" class="ng-gallery-tile ng-reveal group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-square focus:outline-none focus:ring-2 focus:ring-ng-green' +
          wide +
          '" style="transition-delay:' +
          (i * 0.04) +
          's" data-ng-gallery-src="' +
          esc(item.src) +
          '" aria-label="View ' +
          esc(item.name) +
          '">' +
          '<img src="' +
          esc(item.src) +
          '" alt="' +
          esc(item.name) +
          '" loading="lazy" class="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-110" />' +
          '<div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition"></div>' +
          '</button>'
        );
      })
      .join('');
    initGalleryLightbox();
  }

  function initGalleryLightbox() {
    var tiles = document.querySelectorAll('[data-ng-gallery-src]');
    if (!tiles.length) return;
    var backdrop = document.getElementById('ng-gallery-lightbox');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'ng-gallery-lightbox';
      backdrop.className =
        'hidden fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4';
      backdrop.innerHTML =
        '<button type="button" class="absolute top-4 right-4 text-white text-2xl w-10 h-10" aria-label="Close">&times;</button>' +
        '<img class="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" alt="" />';
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop || e.target.getAttribute('aria-label') === 'Close') {
          backdrop.classList.add('hidden');
        }
      });
    }
    var img = backdrop.querySelector('img');
    tiles.forEach(function (tile) {
      tile.addEventListener('click', function () {
        if (img) img.src = tile.getAttribute('data-ng-gallery-src') || '';
        backdrop.classList.remove('hidden');
      });
    });
  }

  function openSignupPanel() {
    var panel = document.getElementById('ng-signup-details');
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.setAttribute('open', '');
    try {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {}
  }

  function closeSignupPanel() {
    var panel = document.getElementById('ng-signup-details');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.removeAttribute('open');
  }

  function initSignupCollapse() {
    var toggle = document.getElementById('ng-signup-toggle');
    var closeBtn = document.getElementById('ng-signup-close');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var panel = document.getElementById('ng-signup-details');
        if (panel && panel.classList.contains('hidden')) openSignupPanel();
        else closeSignupPanel();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeSignupPanel);
    if (window.location.hash === '#join') {
      setTimeout(openSignupPanel, 400);
    }
    document.querySelectorAll('a[href="#join"]').forEach(function (link) {
      link.addEventListener('click', function () {
        setTimeout(openSignupPanel, 150);
      });
    });
  }

  function scrollToAuth() {
    var auth = document.getElementById('auth-panel');
    if (auth) {
      auth.classList.remove('hidden');
      auth.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var checking = document.getElementById('auth-checking');
    if (checking) checking.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init() {
    renderAliveStrip();
    renderUnits();
    renderPrograms();
    renderGallery();
    initSignupCollapse();
    initWorkforceCollapse();
    initReveal();
    document.querySelectorAll('[data-ng-scroll-auth]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        scrollToAuth();
      });
    });
  }

  global.NigeriaLanding = {
    init: init,
    openSignupPanel: openSignupPanel,
    closeSignupPanel: closeSignupPanel,
    openWorkforcePanel: openWorkforcePanel,
    closeWorkforcePanel: closeWorkforcePanel,
    getWorkforceUnitIds: getWorkforceUnitIds,
    clearWorkforceUnits: function () {
      workforceSelected = {};
      syncUnitCardSelection();
      renderWorkforceUnitPicks();
    },
    setVisible: function (show) {
      var wrap = document.getElementById('ng-public-landing');
      var hero = document.getElementById('hero-billboard');
      if (wrap) wrap.classList.toggle('hidden', !show);
      if (hero) hero.classList.toggle('hidden', !show);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
