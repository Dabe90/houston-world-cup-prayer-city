/**
 * Class of David 1024 — header menu, header-on-scroll, reveal-on-scroll, and current-theme flags.
 */
(function (global) {
  var doc = document;
  doc.documentElement.classList.add("js");

  function initMenu() {
    var header = doc.querySelector(".site-header");
    var btn = doc.querySelector(".menu-btn");
    if (!header || !btn) return;
    btn.addEventListener("click", function () {
      var open = !header.classList.contains("nav-open");
      header.classList.toggle("nav-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    header.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest(".nav-links a") : null;
      if (!a) return;
      header.classList.remove("nav-open");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function initSolidHeader() {
    var header = doc.querySelector(".site-header.is-over");
    if (!header) return;
    function paint() {
      header.classList.toggle("is-solid", global.pageYOffset > 40);
    }
    global.addEventListener("scroll", paint, { passive: true });
    paint();
  }

  function initReveal() {
    var els = doc.querySelectorAll(".reveal");
    if (!els.length) return;
    if (!("IntersectionObserver" in global)) {
      els.forEach(function (el) {
        el.classList.add("in");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add("in");
          io.unobserve(en.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    els.forEach(function (el) {
      io.observe(el);
    });
  }

  function initThemeFlags() {
    var T = global.COD1024_THEMES;
    if (!T) return;
    var now = T.current();
    if (now) {
      var card = doc.querySelector('.theme-card[data-theme="' + now.key + '"]');
      if (card) {
        var flag = doc.createElement("span");
        flag.className = "now-flag";
        flag.textContent = "This month";
        card.appendChild(flag);
      }
    }
    doc.querySelectorAll("[data-current-theme]").forEach(function (el) {
      var t = T.nowOrNext();
      if (t) el.textContent = t.month + " is " + t.name + ".";
    });
  }

  function init() {
    initMenu();
    initSolidHeader();
    initReveal();
    initThemeFlags();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : this);
