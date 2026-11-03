/**
 * Load the Tailwind CDN without blocking first paint.
 * Some Nigerian ISPs stall on cdn.tailwindcss.com; the page must stay readable.
 */
(function (global) {
  function loadTailwind(config) {
    global.__TW_CONFIG = config || global.__TW_CONFIG || {};
    if (global.tailwind) {
      try {
        global.tailwind.config = global.__TW_CONFIG;
      } catch (e) {}
      document.documentElement.classList.add("tw-ready");
      return;
    }
    if (document.querySelector("script[data-tw-cdn]")) return;
    var s = document.createElement("script");
    s.src = "https://cdn.tailwindcss.com";
    s.async = true;
    s.dataset.twCdn = "1";
    s.onload = function () {
      try {
        if (global.tailwind) global.tailwind.config = global.__TW_CONFIG;
      } catch (e) {}
      document.documentElement.classList.add("tw-ready");
    };
    s.onerror = function () {
      document.documentElement.classList.add("tw-fallback");
    };
    document.head.appendChild(s);
    setTimeout(function () {
      if (!global.tailwind) document.documentElement.classList.add("tw-fallback");
    }, 4000);
  }
  global.loadTailwind = loadTailwind;
})(typeof window !== "undefined" ? window : this);
