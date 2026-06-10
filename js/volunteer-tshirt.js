/**
 * Volunteer T-shirt — size collection on dashboard.
 */
(function (global) {
  var assets = global.PrayerCityAssets || {};
  var assetUrl =
    typeof assets.assetUrl === 'function'
      ? assets.assetUrl
      : function (p) {
          return p;
        };

  var CFG = {
    image: assets.tshirt || assetUrl('images/prayer-city-tshirt.png'),
    donationUrl:
      'https://www.zeffy.com/en-US/donation-form/houston-world-cup-prayer-city-movement',
    contactEmail: 'ddbs.htx@gmail.com',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sizeOptionsHtml(selected) {
    var html =
      '<option value="">Choose your size</option>';
    CFG.sizes.forEach(function (sz) {
      html +=
        '<option value="' +
        esc(sz) +
        '"' +
        (selected === sz ? ' selected' : '') +
        '>' +
        esc(sz) +
        '</option>';
    });
    return html;
  }

  /**
   * @param {HTMLElement} container
   * @param {object} volunteerData
   * @param {{ onSave?: function(string): Promise|void }} options
   */
  function render(container, volunteerData, options) {
    if (!container) return;
    options = options || {};
    var d = volunteerData || {};
    var saved = String(d.shirtSize || '').trim();
    var mailSubject = encodeURIComponent('Prayer City volunteer T-shirt size');
    var mailBody = encodeURIComponent(
      'Hi Prayer City team,\n\nMy T-shirt size is: \n\nThank you!'
    );
    var mailto =
      'mailto:' +
      esc(CFG.contactEmail) +
      '?subject=' +
      mailSubject +
      '&body=' +
      mailBody;

    container.innerHTML =
      '<div class="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-white via-teal-50/30 to-brand-soft/20 shadow-card overflow-hidden">' +
      '<div class="px-4 sm:px-6 py-5 border-b border-slate-100 bg-white/80">' +
      '<p class="text-xs font-bold uppercase tracking-wider text-teal-700">Volunteer gear</p>' +
      '<h2 class="text-xl sm:text-2xl font-bold text-slate-900 mt-1">Prayer City T-shirts</h2>' +
      '<p class="text-sm text-slate-600 mt-2 leading-relaxed max-w-3xl">We are printing <strong>Houston Prayer City</strong> shirts for our volunteer family. <strong>Please send us your size</strong> so we can order yours before serve day.</p>' +
      '</div>' +
      '<div class="p-4 sm:p-6 grid md:grid-cols-2 gap-6 items-start">' +
      '<div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">' +
      '<img src="' +
      esc(CFG.image) +
      '" alt="Houston Prayer City volunteer T-shirt" class="w-full rounded-lg border border-slate-100" loading="lazy" />' +
      '</div>' +
      '<div class="space-y-4">' +
      '<p class="text-sm text-slate-700 leading-relaxed">Sizes available: <strong>S, M, L, XL, 2XL, 3XL</strong>. You will receive your shirt when you check in with the Prayer City coordinator on your serve day.</p>' +
      (saved
        ? '<p class="text-sm rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-teal-900"><i class="fas fa-check-circle mr-2"></i>We have your size on file: <strong>' +
          esc(saved) +
          '</strong>. You can update it below if needed.</p>'
        : '<p class="text-sm rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-amber-950"><i class="fas fa-tshirt mr-2"></i><strong>Action needed:</strong> send us your T-shirt size below.</p>') +
      '<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">' +
      '<label class="block text-xs font-bold uppercase tracking-wide text-slate-500" for="tshirt-size-select">Your T-shirt size</label>' +
      '<select id="tshirt-size-select" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-brand-light outline-none">' +
      sizeOptionsHtml(saved) +
      '</select>' +
      '<button type="button" id="tshirt-save-btn" class="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-light transition">Save my size</button>' +
      '<p id="tshirt-save-status" class="text-xs text-slate-500 min-h-[1rem]"></p>' +
      '</div>' +
      '<p class="text-xs text-slate-500">Saving above <strong>emails the team automatically</strong>. Or send your size manually to <a href="' +
      esc(mailto) +
      '" class="text-brand font-semibold hover:underline">' +
      esc(CFG.contactEmail) +
      '</a>.</p>' +
      '<div class="rounded-xl border border-slate-200 bg-slate-50/80 p-4">' +
      '<p class="text-sm text-slate-700 leading-relaxed">If you are able to make a donation toward your shirt, that would be wonderful — much appreciated. Gifts are processed through Zeffy (100% to the movement).</p>' +
      '<a href="' +
      esc(CFG.donationUrl) +
      '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand to-teal-600 text-white text-sm font-semibold hover:opacity-95 transition">Give via Zeffy <i class="fas fa-external-link-alt text-xs"></i></a>' +
      '</div></div></div></div>';

    var selectEl = container.querySelector('#tshirt-size-select');
    var saveBtn = container.querySelector('#tshirt-save-btn');
    var statusEl = container.querySelector('#tshirt-save-status');

    if (saveBtn && typeof options.onSave === 'function') {
      saveBtn.addEventListener('click', function () {
        var size = selectEl ? String(selectEl.value || '').trim() : '';
        if (!size) {
          if (statusEl) {
            statusEl.textContent = 'Please choose a size.';
            statusEl.className = 'text-xs text-red-600 min-h-[1rem]';
          }
          return;
        }
        if (statusEl) {
          statusEl.textContent = 'Saving…';
          statusEl.className = 'text-xs text-slate-500 min-h-[1rem]';
        }
        saveBtn.disabled = true;
        Promise.resolve(options.onSave(size))
          .then(function () {
            if (statusEl) {
              statusEl.textContent =
                'Saved — we emailed the team your size. Thank you!';
              statusEl.className = 'text-xs text-teal-700 font-medium min-h-[1rem]';
            }
            render(container, Object.assign({}, d, { shirtSize: size }), options);
          })
          .catch(function (e) {
            if (statusEl) {
              statusEl.textContent =
                (e && e.message) || 'Could not save. Try again or email us.';
              statusEl.className = 'text-xs text-red-600 min-h-[1rem]';
            }
          })
          .finally(function () {
            saveBtn.disabled = false;
          });
      });
    } else if (saveBtn) {
      saveBtn.classList.add('hidden');
    }
  }

  global.PrayerCityTshirt = {
    CFG: CFG,
    render: render,
  };
})(typeof window !== 'undefined' ? window : this);
