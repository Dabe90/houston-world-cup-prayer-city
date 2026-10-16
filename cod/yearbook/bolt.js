(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderSlide(slide, i) {
    var el = document.createElement("section");
    el.className = "bolt-slide";
    el.dataset.index = String(i);
    if (slide.align === "center" || slide.type === "cover" || slide.type === "quote") {
      el.classList.add("center");
    }
    if (slide.type === "page") {
      el.classList.add("bolt-page");
      el.innerHTML =
        '<img src="' + esc(slide.src) + '" alt="' + esc(slide.caption || "Yearbook page") + '" loading="lazy" />' +
        (slide.caption ? '<p class="bolt-page-cap">' + esc(slide.caption) + "</p>" : "");
      return el;
    }
    if (slide.type === "people") {
      var people = (slide.people || [])
        .map(function (p) {
          var img = p.img
            ? '<img src="' + esc(p.img) + '" alt="" width="88" height="88" loading="lazy" />'
            : "";
          return (
            '<div class="person-card">' +
            img +
            "<h3>" + esc(p.name) + "</h3>" +
            "<p>" + esc(p.role) + "</p>" +
            "</div>"
          );
        })
        .join("");
      el.innerHTML =
        (slide.kicker ? '<p class="kicker">' + esc(slide.kicker) + "</p>" : "") +
        (slide.title ? '<h2 class="headline wide">' + esc(slide.title) + "</h2>" : "") +
        '<div class="people-grid">' + people + "</div>";
      return el;
    }
    if (slide.type === "quote") {
      el.innerHTML =
        (slide.kicker ? '<p class="kicker">' + esc(slide.kicker) + "</p>" : "") +
        '<blockquote class="quote-text">“' + esc(slide.text) + "”</blockquote>" +
        (slide.attr ? '<p class="quote-attr">— ' + esc(slide.attr) + "</p>" : "");
      return el;
    }
    // cover / section
    var body = (slide.body || [])
      .map(function (p) { return '<p class="lead">' + esc(p) + "</p>"; })
      .join("");
    var titleHtml = slide.titleHtml || esc(slide.title || "");
    el.innerHTML =
      (slide.kicker ? '<p class="kicker">' + esc(slide.kicker) + "</p>" : "") +
      (slide.title || slide.titleHtml ? '<h2 class="headline' + (slide.wide ? " wide" : "") + '">' + titleHtml + "</h2>" : "") +
      body +
      (slide.foot ? '<p class="lead" style="margin-top:20px;font-size:0.92rem;color:var(--faint)">' + esc(slide.foot) + "</p>" : "");
    return el;
  }

  function init(slides) {
    var deck = document.getElementById("bolt-deck");
    if (!deck || !slides || !slides.length) return;

    slides.forEach(function (slide, i) {
      deck.appendChild(renderSlide(slide, i));
    });

    var nodes = deck.querySelectorAll(".bolt-slide");
    var idx = 0;
    var nowEl = document.querySelector("[data-bolt-now]");
    var totEl = document.querySelector("[data-bolt-tot]");
    var prevBtn = document.querySelector("[data-bolt-prev]");
    var nextBtn = document.querySelector("[data-bolt-next]");

    if (totEl) totEl.textContent = String(nodes.length);

    function show(n) {
      idx = Math.max(0, Math.min(nodes.length - 1, n));
      nodes.forEach(function (node, i) {
        node.classList.toggle("active", i === idx);
      });
      if (nowEl) nowEl.textContent = String(idx + 1);
      if (prevBtn) prevBtn.disabled = idx === 0;
      if (nextBtn) nextBtn.disabled = idx === nodes.length - 1;
      history.replaceState(null, "", "#slide-" + (idx + 1));
    }

    function next() { show(idx + 1); }
    function prev() { show(idx - 1); }

    if (prevBtn) prevBtn.addEventListener("click", prev);
    if (nextBtn) nextBtn.addEventListener("click", next);

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      if (e.key === "Home") { e.preventDefault(); show(0); }
      if (e.key === "End") { e.preventDefault(); show(nodes.length - 1); }
    });

    var hash = location.hash.match(/slide-(\d+)/);
    show(hash ? parseInt(hash[1], 10) - 1 : 0);
  }

  window.CodBolt = { init: init };
})();
