/**
 * Mounts third-party social feed iframes from js/social-feed-embed-config.js
 * Loads SnapWidget / LightWidget helper scripts when embed URLs need them.
 */
(function () {
  var CFG = window.__PRAYER_CITY_SOCIAL_FEEDS__ || {};
  var DEFAULT_H = typeof CFG.defaultHeight === 'number' && CFG.defaultHeight > 200 ? CFG.defaultHeight : 400;

  function normalizeList(x) {
    if (!x) return [];
    if (Array.isArray(x)) return x;
    return [];
  }

  var ig = normalizeList(CFG.instagramEmbeds);
  var tt = normalizeList(CFG.tiktokEmbeds);

  if (typeof CFG.instagramEmbedSrc === 'string' && CFG.instagramEmbedSrc.trim()) {
    ig.push({ src: CFG.instagramEmbedSrc.trim(), label: CFG.instagramEmbedLabel || 'Instagram' });
  }
  if (typeof CFG.tiktokEmbedSrc === 'string' && CFG.tiktokEmbedSrc.trim()) {
    tt.push({ src: CFG.tiktokEmbedSrc.trim(), label: CFG.tiktokEmbedLabel || 'TikTok' });
  }

  function sanitizeUrl(s) {
    if (!s || typeof s !== 'string') return '';
    try {
      var u = new URL(s.trim());
      if (u.protocol !== 'https:') return '';
      return u.href;
    } catch (e) {
      return '';
    }
  }

  function normalizeEmbedItem(item) {
    if (!item) return null;
    if (typeof item === 'string') {
      var u = sanitizeUrl(item);
      return u ? { src: u, label: '', height: null } : null;
    }
    var src = sanitizeUrl(item.src);
    if (!src) return null;
    return {
      src: src,
      label: typeof item.label === 'string' ? item.label : '',
      height: typeof item.height === 'number' ? item.height : null,
    };
  }

  var igList = ig.map(normalizeEmbedItem).filter(Boolean);
  var ttList = tt.map(normalizeEmbedItem).filter(Boolean);

  function allUrls() {
    return igList.concat(ttList).map(function (x) {
      return x.src;
    });
  }

  function injectScripts(urlsBlob) {
    if (/snapwidget\.com/i.test(urlsBlob) && !window.__prayerCitySnapwidgetLoaded) {
      window.__prayerCitySnapwidgetLoaded = true;
      var s = document.createElement('script');
      s.src = 'https://snapwidget.com/js/snapwidget.js';
      s.async = true;
      document.head.appendChild(s);
    }
    if (/lightwidget\.com/i.test(urlsBlob) && !window.__prayerCityLightwidgetLoaded) {
      window.__prayerCityLightwidgetLoaded = true;
      var s2 = document.createElement('script');
      s2.src = 'https://cdn.lightwidget.com/widgets/lightwidget.js';
      s2.async = true;
      document.head.appendChild(s2);
    }
  }

  function renderEmbeds(mountId, list, platformTitle) {
    var mount = document.getElementById(mountId);
    if (!mount || !list.length) return;
    mount.innerHTML = '';
    list.forEach(function (item) {
      var h = item.height != null ? item.height : DEFAULT_H;
      var wrap = document.createElement('div');
      wrap.className = 'rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm';
      if (item.label) {
        var cap = document.createElement('p');
        cap.className =
          'text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2.5 py-2 bg-slate-50 border-b border-slate-100';
        cap.textContent = item.label;
        wrap.appendChild(cap);
      }
      var iframe = document.createElement('iframe');
      iframe.setAttribute('title', item.label || platformTitle + ' feed');
      iframe.className = 'w-full border-0 block';
      iframe.style.minHeight = h + 'px';
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('scrolling', 'no');
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.src = item.src;
      wrap.appendChild(iframe);
      mount.appendChild(wrap);
    });
  }

  injectScripts(allUrls().join(' '));

  var hasAny = igList.length > 0 || ttList.length > 0;
  var hint = document.getElementById('social-feed-setup-hint');
  var liveWrap = document.getElementById('social-feed-live-wrap');
  var igHost = document.getElementById('social-feed-instagram-host');
  var ttHost = document.getElementById('social-feed-tiktok-host');

  if (hasAny) {
    if (hint) hint.classList.add('hidden');
    if (liveWrap) liveWrap.classList.remove('hidden');
    if (igList.length === 0 && igHost) igHost.classList.add('hidden');
    if (ttList.length === 0 && ttHost) ttHost.classList.add('hidden');
    renderEmbeds('social-feed-instagram-embeds', igList, 'Instagram');
    renderEmbeds('social-feed-tiktok-embeds', ttList, 'TikTok');
  } else {
    if (liveWrap) liveWrap.classList.add('hidden');
    if (hint) hint.classList.remove('hidden');
  }
})();
