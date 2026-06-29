/**
 * Renders Prayer City gallery.
 *
 * Supports multiple day sections via window.PRAYER_CITY_GALLERY_DAYS
 * (each item: { id, title, order, items: [{ name, type, src }] }).
 * Falls back to the legacy single window.PRAYER_CITY_GALLERY_MANIFEST.
 */
(function (global) {
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function photoMarkup(item, globalIdx) {
    return (
      '<button type="button" class="gallery-photo group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2" data-gallery-idx="' +
      globalIdx +
      '" aria-label="View photo ' +
      escapeHtml(item.name) +
      '">' +
      '<img src="' +
      escapeHtml(item.src) +
      '" alt="' +
      escapeHtml(item.name) +
      '" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-105" />' +
      '</button>'
    );
  }

  function videoMarkup(item) {
    return (
      '<div class="rounded-xl overflow-hidden border border-slate-200 bg-black shadow-sm">' +
      '<video class="w-full aspect-video bg-black" controls playsinline preload="metadata" src="' +
      escapeHtml(item.src) +
      '">' +
      'Your browser does not support video playback.</video>' +
      '<p class="px-3 py-2 text-xs text-slate-600 bg-white border-t border-slate-100">' +
      escapeHtml(item.name) +
      '</p></div>'
    );
  }

  function renderDays(container, days) {
    if (!container || !days || !days.length) return false;

    var sorted = days
      .filter(function (d) {
        return d && d.items && d.items.length;
      })
      .slice()
      .sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });

    if (!sorted.length) return false;

    // Build a flat list of all photos across every day for the shared lightbox.
    var allPhotos = [];
    var html = '';

    sorted.forEach(function (day, dayIndex) {
      var photos = day.items.filter(function (i) {
        return i.type === 'image';
      });
      var videos = day.items.filter(function (i) {
        return i.type === 'video';
      });

      html += '<section class="gallery-day' + (dayIndex > 0 ? ' mt-12 pt-10 border-t border-slate-200' : '') + '">';

      if (day.title) {
        html +=
          '<h2 class="text-xl font-bold text-slate-900 mb-6">' + escapeHtml(day.title) + '</h2>';
      }

      if (photos.length) {
        html +=
          '<div class="mb-10">' +
          '<h3 class="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">' +
          '<i class="fas fa-camera text-brand" aria-hidden="true"></i> Photos (' +
          photos.length +
          ')</h3>' +
          '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">';
        photos.forEach(function (item) {
          var globalIdx = allPhotos.length;
          allPhotos.push(item);
          html += photoMarkup(item, globalIdx);
        });
        html += '</div></div>';
      }

      if (videos.length) {
        html +=
          '<div>' +
          '<h3 class="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">' +
          '<i class="fas fa-video text-brand" aria-hidden="true"></i> Videos (' +
          videos.length +
          ')</h3>' +
          '<div class="grid gap-6 sm:grid-cols-2">';
        videos.forEach(function (item) {
          html += videoMarkup(item);
        });
        html += '</div></div>';
      }

      html += '</section>';
    });

    container.innerHTML = html;

    var modal = document.getElementById('gallery-lightbox');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'gallery-lightbox';
      modal.className = 'fixed inset-0 z-[100] hidden items-center justify-center bg-black/90 p-4';
      modal.innerHTML =
        '<button type="button" id="gallery-lightbox-close" class="absolute top-4 right-4 text-white/90 hover:text-white text-2xl w-10 h-10" aria-label="Close">&times;</button>' +
        '<button type="button" id="gallery-lightbox-prev" class="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-3xl px-2" aria-label="Previous">&#8249;</button>' +
        '<button type="button" id="gallery-lightbox-next" class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-3xl px-2" aria-label="Next">&#8250;</button>' +
        '<img id="gallery-lightbox-img" class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" alt="" />';
      document.body.appendChild(modal);
    }

    var current = 0;
    var imgEl = document.getElementById('gallery-lightbox-img');

    function show(idx) {
      if (!allPhotos.length) return;
      current = (idx + allPhotos.length) % allPhotos.length;
      imgEl.src = allPhotos[current].src;
      imgEl.alt = allPhotos[current].name;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden';
    }

    function hide() {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
      imgEl.removeAttribute('src');
    }

    container.querySelectorAll('.gallery-photo').forEach(function (btn) {
      btn.addEventListener('click', function () {
        show(parseInt(btn.getAttribute('data-gallery-idx'), 10) || 0);
      });
    });

    document.getElementById('gallery-lightbox-close').onclick = hide;
    document.getElementById('gallery-lightbox-prev').onclick = function () {
      show(current - 1);
    };
    document.getElementById('gallery-lightbox-next').onclick = function () {
      show(current + 1);
    };
    modal.addEventListener('click', function (e) {
      if (e.target === modal) hide();
    });
    document.addEventListener('keydown', function (e) {
      if (modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') hide();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });

    return true;
  }

  // Backward-compatible single-manifest entry point.
  function render(container, manifest) {
    if (!manifest || !manifest.items) return false;
    return renderDays(container, [
      { id: manifest.id || 'day1', title: manifest.title, order: manifest.order || 1, items: manifest.items },
    ]);
  }

  // Collect every registered day plus any legacy single manifest.
  function collectDays() {
    var days = (global.PRAYER_CITY_GALLERY_DAYS || []).slice();
    var legacy = global.PRAYER_CITY_GALLERY_MANIFEST;
    if (legacy && legacy.items && legacy.items.length) {
      var alreadyHasDay1 = days.some(function (d) {
        return (d.id || '') === (legacy.id || 'day1');
      });
      if (!alreadyHasDay1) {
        days.push({
          id: legacy.id || 'day1',
          title: legacy.title,
          order: legacy.order || 1,
          items: legacy.items,
        });
      }
    }
    return days;
  }

  global.PrayerCityGallery = { render: render, renderDays: renderDays, collectDays: collectDays };
})(window);
