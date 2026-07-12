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

  function revealInViewport() {
    document.querySelectorAll('.ng-reveal:not(.is-visible)').forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        el.classList.add('is-visible');
      }
    });
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
      { threshold: 0.05, rootMargin: '0px 0px 80px 0px' }
    );
    els.forEach(function (el) {
      io.observe(el);
    });
    revealInViewport();
    window.addEventListener('scroll', revealInViewport, { passive: true });
    window.addEventListener('resize', revealInViewport, { passive: true });
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

  function getEnlistableUnits() {
    if (!global.NigeriaUnits) return [];
    return NigeriaUnits.enlistableUnits
      ? NigeriaUnits.enlistableUnits()
      : NigeriaUnits.NIGERIA_UNITS || [];
  }

  var workforceSelected = {};
  var unitsModalDraft = {};
  var unitsModalLastFocus = null;

  function updateUnitsPickSummary() {
    var el = document.getElementById('ng-units-pick-summary');
    if (!el) return;
    var ids = Object.keys(workforceSelected);
    if (!ids.length) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.classList.remove('hidden');
    var labels = ids.map(function (id) {
      return workforceSelected[id].label;
    });
    el.innerHTML =
      '<span class="inline-flex items-center gap-1.5 text-ng-green font-semibold"><i class="fas fa-check-circle" aria-hidden="true"></i>' +
      ids.length +
      ' selected:</span> ' +
      esc(labels.join(', '));
  }

  function renderUnitsModalList() {
    var list = document.getElementById('ng-units-modal-list');
    if (!list) return;
    var units = getEnlistableUnits();
    if (!units.length) {
      list.innerHTML = '<p class="text-sm text-slate-500 p-4 text-center">No units available right now.</p>';
      return;
    }
    list.innerHTML = units
      .map(function (u) {
        var schedule = NigeriaUnits.meetingScheduleLabel(u);
        var checked = !!unitsModalDraft[u.id];
        return (
          '<label class="ng-unit-modal-row' +
          (checked ? ' is-checked' : '') +
          '" data-unit-id="' +
          esc(u.id) +
          '">' +
          '<input type="checkbox" class="ng-unit-modal-check" value="' +
          esc(u.id) +
          '"' +
          (checked ? ' checked' : '') +
          ' />' +
          '<span class="ng-unit-modal-icon bg-gradient-to-br ' +
          esc(u.gradient || 'from-brand to-ng-green') +
          '" aria-hidden="true"><i class="fas ' +
          esc(u.icon || 'fa-users') +
          '"></i></span>' +
          '<span class="ng-unit-modal-body min-w-0">' +
          '<span class="font-semibold text-slate-900 text-sm leading-snug block">' +
          esc(u.label) +
          '</span>' +
          '<span class="text-xs font-semibold text-brand mt-0.5 block">' +
          esc(schedule) +
          '</span>' +
          '<span class="text-xs text-slate-600 mt-1.5 leading-relaxed block">' +
          esc(u.summary || '') +
          '</span></span></label>'
        );
      })
      .join('');
    list.querySelectorAll('.ng-unit-modal-check').forEach(function (input) {
      input.addEventListener('change', function () {
        var id = input.value;
        if (input.checked) {
          var u = NigeriaUnits.getUnit(id);
          if (u) unitsModalDraft[id] = { id: u.id, label: u.label };
        } else {
          delete unitsModalDraft[id];
        }
        syncUnitsModalRowState();
        updateUnitsModalCount();
      });
    });
    updateUnitsModalCount();
  }

  function syncUnitsModalRowState() {
    document.querySelectorAll('.ng-unit-modal-row[data-unit-id]').forEach(function (row) {
      var id = row.getAttribute('data-unit-id');
      var on = !!unitsModalDraft[id];
      row.classList.toggle('is-checked', on);
      var input = row.querySelector('.ng-unit-modal-check');
      if (input) input.checked = on;
    });
  }

  function updateUnitsModalCount() {
    var countEl = document.getElementById('ng-units-modal-count');
    var confirmBtn = document.getElementById('ng-units-modal-confirm');
    var n = Object.keys(unitsModalDraft).length;
    if (countEl) {
      countEl.textContent = n === 0 ? 'None selected' : n === 1 ? '1 unit selected' : n + ' units selected';
    }
    if (confirmBtn) confirmBtn.disabled = n === 0;
  }

  function openUnitsModal() {
    var modal = document.getElementById('ng-units-modal');
    if (!modal) return;
    unitsModalDraft = {};
    Object.keys(workforceSelected).forEach(function (id) {
      unitsModalDraft[id] = {
        id: workforceSelected[id].id,
        label: workforceSelected[id].label,
      };
    });
    renderUnitsModalList();
    unitsModalLastFocus = document.activeElement;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ng-units-modal-open');
    requestAnimationFrame(function () {
      modal.classList.add('is-open');
    });
    var closeBtn = document.getElementById('ng-units-modal-close');
    if (closeBtn) {
      try {
        closeBtn.focus();
      } catch (e) {}
    }
  }

  function closeUnitsModal() {
    var modal = document.getElementById('ng-units-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('ng-units-modal-open');
    modal.setAttribute('aria-hidden', 'true');
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      modal.classList.add('hidden');
      if (unitsModalLastFocus && typeof unitsModalLastFocus.focus === 'function') {
        try {
          unitsModalLastFocus.focus();
        } catch (e) {}
      }
    }
    modal.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 280);
  }

  function confirmUnitsModal() {
    var ids = Object.keys(unitsModalDraft);
    if (!ids.length) return;
    workforceSelected = {};
    ids.forEach(function (id) {
      workforceSelected[id] = {
        id: unitsModalDraft[id].id,
        label: unitsModalDraft[id].label,
      };
    });
    closeUnitsModal();
    renderWorkforceUnitPicks();
    updateUnitsPickSummary();
    openWorkforcePanel({ requireUnits: false });
  }

  function renderUnits() {
    renderWorkforceUnitPicks();
    updateUnitsPickSummary();
    updateWorkforceSticky();
  }

  function highlightUnitsGrid() {
    var anchor = document.getElementById('ng-units-anchor');
    if (anchor) {
      try {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {}
      anchor.classList.add('ng-units-highlight');
      setTimeout(function () {
        anchor.classList.remove('ng-units-highlight');
      }, 2400);
    }
    openUnitsModal();
  }

  function isWorkforceFormOpen() {
    var panel = document.getElementById('ng-workforce-details');
    return panel && !panel.classList.contains('hidden');
  }

  function updateWorkforceSticky() {
    var bar = document.getElementById('ng-workforce-sticky-picks');
    var chips = document.getElementById('ng-workforce-sticky-chips');
    if (!bar || !chips) return;
    var ids = Object.keys(workforceSelected);
    if (!isWorkforceFormOpen() || !ids.length) {
      bar.classList.add('hidden');
      chips.innerHTML = '';
      return;
    }
    bar.classList.remove('hidden');
    chips.innerHTML = ids
      .map(function (id) {
        var u = workforceSelected[id];
        return (
          '<span class="inline-flex items-center rounded-full bg-brand/10 text-brand text-[10px] font-semibold px-2 py-0.5">' +
          esc(u.label) +
          '</span>'
        );
      })
      .join('');
  }

  function renderWorkforceUnitPicks() {
    var wrap = document.getElementById('ng-workforce-unit-picks');
    var hint = document.getElementById('ng-workforce-unit-hint');
    if (!wrap) return;
    var ids = Object.keys(workforceSelected);
    if (!ids.length) {
      wrap.innerHTML =
        '<button type="button" id="ng-workforce-pick-empty" class="text-xs text-brand font-semibold hover:underline">No units selected — choose areas to serve</button>';
      var emptyBtn = document.getElementById('ng-workforce-pick-empty');
      if (emptyBtn) emptyBtn.addEventListener('click', openUnitsModal);
      if (hint) hint.classList.remove('hidden');
      updateWorkforceSticky();
      updateUnitsPickSummary();
      return;
    }
    if (hint) hint.classList.add('hidden');
    wrap.innerHTML = ids
      .map(function (id) {
        var u = workforceSelected[id];
        return (
          '<span class="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand text-xs font-semibold px-3 py-1.5">' +
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
        renderWorkforceUnitPicks();
        updateUnitsPickSummary();
      });
    });
    updateWorkforceSticky();
    updateUnitsPickSummary();
  }

  function getWorkforceUnitIds() {
    return Object.keys(workforceSelected);
  }

  function openWorkforcePanel(opts) {
    opts = opts || {};
    var panel = document.getElementById('ng-workforce-details');
    if (!panel) return;
    var ids = Object.keys(workforceSelected);
    if (!ids.length && opts.requireUnits !== false) {
      highlightUnitsGrid();
      var hint = document.getElementById('ng-workforce-unit-hint');
      if (hint) hint.classList.remove('hidden');
      return;
    }
    panel.classList.remove('hidden');
    panel.setAttribute('open', '');
    updateWorkforceSticky();
    try {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {}
  }

  function closeWorkforcePanel() {
    var panel = document.getElementById('ng-workforce-details');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.removeAttribute('open');
    var bar = document.getElementById('ng-workforce-sticky-picks');
    if (bar) bar.classList.add('hidden');
  }

  function initUnitsModal() {
    var seeBtn = document.getElementById('ng-see-areas-btn');
    var backdrop = document.getElementById('ng-units-modal-backdrop');
    var closeBtn = document.getElementById('ng-units-modal-close');
    var cancelBtn = document.getElementById('ng-units-modal-cancel');
    var confirmBtn = document.getElementById('ng-units-modal-confirm');
    var changeBtn = document.getElementById('ng-workforce-change-units');
    if (seeBtn) seeBtn.addEventListener('click', openUnitsModal);
    if (backdrop) backdrop.addEventListener('click', closeUnitsModal);
    if (closeBtn) closeBtn.addEventListener('click', closeUnitsModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeUnitsModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmUnitsModal);
    if (changeBtn) changeBtn.addEventListener('click', openUnitsModal);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var modal = document.getElementById('ng-units-modal');
      if (modal && !modal.classList.contains('hidden')) {
        e.preventDefault();
        closeUnitsModal();
      }
    });
  }

  function initWorkforceCollapse() {
    var toggle = document.getElementById('ng-workforce-toggle');
    var closeBtn = document.getElementById('ng-workforce-close');
    var stickyMore = document.getElementById('ng-workforce-sticky-more');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var panel = document.getElementById('ng-workforce-details');
        if (panel && panel.classList.contains('hidden')) {
          openWorkforcePanel({ requireUnits: true });
        } else {
          closeWorkforcePanel();
        }
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeWorkforcePanel);
    if (stickyMore) {
      stickyMore.addEventListener('click', openUnitsModal);
    }
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

  function initMobileNav() {
    document.querySelectorAll('#ng-mobile-nav a[href="#join"]').forEach(function (link) {
      link.addEventListener('click', function () {
        setTimeout(openSignupPanel, 200);
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
      '<article class="ng-program-card ng-card ng-reveal shrink-0 w-[min(85vw,280px)] sm:w-[300px] rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-card snap-start" style="transition-delay:' +
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
    if (typeof revealInViewport === 'function') revealInViewport();
  }

  var GALLERY_PREVIEW_COUNT = 5;

  function galleryTileHtml(item, delay) {
    return (
      '<button type="button" class="ng-gallery-tile ng-reveal group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-square focus:outline-none focus:ring-2 focus:ring-ng-green" style="transition-delay:' +
      (delay || 0) +
      's" data-ng-gallery-src="' +
      esc(item.src) +
      '" aria-label="View photo">' +
      '<img src="' +
      esc(item.src) +
      '" alt="Jesus March Nigeria" loading="lazy" class="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-110" />' +
      '<div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition"></div>' +
      '</button>'
    );
  }

  function renderGallery() {
    var grid = document.getElementById('ng-landing-gallery');
    var moreGrid = document.getElementById('ng-landing-gallery-more');
    var viewMoreBtn = document.getElementById('ng-gallery-view-more');
    var manifest = global.NIGERIA_GALLERY_MANIFEST;
    if (!grid || !manifest || !manifest.items || !manifest.items.length) return;

    var images = manifest.items.filter(function (item) {
      return item.type === 'image' && item.src;
    });
    var preview = images.slice(0, GALLERY_PREVIEW_COUNT);
    var rest = images.slice(GALLERY_PREVIEW_COUNT);

    grid.innerHTML = preview
      .map(function (item, i) {
        return galleryTileHtml(item, i * 0.04);
      })
      .join('');

    if (moreGrid) {
      if (rest.length) {
        moreGrid.innerHTML = rest
          .map(function (item, i) {
            return galleryTileHtml(item, i * 0.03);
          })
          .join('');
        moreGrid.classList.add('hidden');
      } else {
        moreGrid.innerHTML = '';
        moreGrid.classList.add('hidden');
      }
    }

    if (viewMoreBtn) {
      if (rest.length) {
        viewMoreBtn.classList.remove('hidden');
        viewMoreBtn.textContent = '';
        viewMoreBtn.innerHTML =
          'View more in gallery <span class="text-brand-accent/90 font-semibold">(' +
          rest.length +
          ')</span> <i class="fas fa-images text-xs" aria-hidden="true"></i>';
        if (!viewMoreBtn.dataset.bound) {
          viewMoreBtn.dataset.bound = '1';
          viewMoreBtn.addEventListener('click', function () {
            var expanded = moreGrid && !moreGrid.classList.contains('hidden');
            if (expanded) {
              moreGrid.classList.add('hidden');
              viewMoreBtn.innerHTML =
                'View more in gallery <span class="text-brand-accent/90 font-semibold">(' +
                rest.length +
                ')</span> <i class="fas fa-images text-xs" aria-hidden="true"></i>';
            } else {
              moreGrid.classList.remove('hidden');
              moreGrid.querySelectorAll('.ng-reveal').forEach(function (el) {
                el.classList.add('is-visible');
              });
              viewMoreBtn.innerHTML =
                'Show less <i class="fas fa-chevron-up text-xs" aria-hidden="true"></i>';
              try {
                moreGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } catch (e) {}
            }
          });
        }
      } else {
        viewMoreBtn.classList.add('hidden');
      }
    }

    initGalleryLightbox();
  }

  function initGalleryLightbox() {
    if (global.__ngGalleryLightboxBound) return;
    global.__ngGalleryLightboxBound = true;

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

    document.addEventListener('click', function (e) {
      var tile = e.target.closest && e.target.closest('[data-ng-gallery-src]');
      if (!tile) return;
      var img = backdrop.querySelector('img');
      if (img) img.src = tile.getAttribute('data-ng-gallery-src') || '';
      backdrop.classList.remove('hidden');
    });
  }

  function openSignupPanel() {
    var join = document.getElementById('join');
    if (join) {
      try {
        join.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {}
    }
    var panel = document.getElementById('ng-signup-details');
    if (!panel) return;
    panel.classList.remove('hidden');
  }

  function closeSignupPanel() {
    var panel = document.getElementById('ng-signup-details');
    if (!panel) return;
    panel.classList.add('hidden');
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
    if (window.NigeriaDashboard && NigeriaDashboard.openAuthPanel) {
      NigeriaDashboard.openAuthPanel();
      return;
    }
    try {
      sessionStorage.setItem('ngAuthPanelOpen', '1');
    } catch (e) {}
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
    initUnitsModal();
    initWorkforceCollapse();
    initMobileNav();
    initReveal();
    revealInViewport();
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
    openUnitsModal: openUnitsModal,
    getWorkforceUnitIds: getWorkforceUnitIds,
    clearWorkforceUnits: function () {
      workforceSelected = {};
      renderWorkforceUnitPicks();
      updateUnitsPickSummary();
      updateWorkforceSticky();
    },
    setVisible: function (show) {
      var wrap = document.getElementById('ng-public-landing');
      var hero = document.getElementById('hero-billboard');
      var mobileNav = document.getElementById('ng-mobile-nav');
      var countdown = document.getElementById('landing-billion-countdown');
      var stickyPicks = document.getElementById('ng-workforce-sticky-picks');
      var unitsModal = document.getElementById('ng-units-modal');
      if (wrap) wrap.classList.toggle('hidden', !show);
      if (hero) hero.classList.toggle('hidden', !show);
      if (countdown) countdown.classList.toggle('hidden', !show);
      if (mobileNav) mobileNav.classList.toggle('hidden', !show);
      if (stickyPicks && !show) stickyPicks.classList.add('hidden');
      if (unitsModal && !show) {
        unitsModal.classList.add('hidden');
        unitsModal.classList.remove('is-open');
        unitsModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('ng-units-modal-open');
      }
      document.body.classList.toggle('pb-[4.5rem]', show);
      document.body.classList.toggle('lg:pb-0', true);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
