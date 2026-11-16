/**
 * Class of David 1024 — portal tabs. Buttons with data-tab switch panes with data-pane.
 * Any element with data-go="pane" also switches. The URL hash keeps the open tab on reload.
 */
(function (global) {
  var tabs = [];
  var panes = [];
  var first = "";

  function names() {
    return panes.map(function (p) {
      return p.getAttribute("data-pane");
    });
  }

  function open(name, opts) {
    opts = opts || {};
    if (names().indexOf(name) < 0) name = first;
    panes.forEach(function (p) {
      p.hidden = p.getAttribute("data-pane") !== name;
    });
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-tab") === name;
      t.classList.toggle("is-active", on);
      if (on) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    if (opts.hash !== false && global.history && global.history.replaceState) {
      global.history.replaceState(null, "", "#" + name);
    }
    if (opts.scroll !== false) {
      var top = document.querySelector("[data-shell-top]");
      var y = top ? top.getBoundingClientRect().top + global.pageYOffset - 12 : 0;
      if (global.pageYOffset > y) global.scrollTo(0, Math.max(0, y));
    }
    document.dispatchEvent(new CustomEvent("cod1024:pane", { detail: { pane: name } }));
  }

  function badge(name, count) {
    var t = document.querySelector('[data-tab="' + name + '"] .tab-count');
    if (!t) return;
    var n = Number(count) || 0;
    t.textContent = n > 99 ? "99+" : String(n);
    t.hidden = n <= 0;
  }

  function init() {
    tabs = Array.prototype.slice.call(document.querySelectorAll("[data-tab]"));
    panes = Array.prototype.slice.call(document.querySelectorAll("[data-pane]"));
    if (!panes.length) return;
    first = panes[0].getAttribute("data-pane");
    document.addEventListener("click", function (e) {
      var el = e.target.closest ? e.target.closest("[data-tab],[data-go]") : null;
      if (!el) return;
      e.preventDefault();
      open(el.getAttribute("data-tab") || el.getAttribute("data-go"));
    });
    global.addEventListener("hashchange", function () {
      open(String(location.hash || "").slice(1), { hash: false, scroll: false });
    });
    open(String(location.hash || "").slice(1) || first, { hash: false, scroll: false });
  }

  global.COD1024_SHELL = { open: open, badge: badge };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
