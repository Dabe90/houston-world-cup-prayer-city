/**
 * Coordinator/President UI for private class materials and Sample HW.
 */
(function (global) {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;");
  }

  function yearMeta(year) {
    var catalog = global.COD_STAFF_MATERIALS && global.COD_STAFF_MATERIALS.YEARS;
    return catalog ? catalog[String(year)] : null;
  }

  function fileKind(path) {
    var s = String(path || "").toLowerCase();
    if (s.indexOf(".pdf") >= 0) return "pdf";
    if (s.indexOf(".doc") >= 0) return "doc";
    if (s.indexOf(".ppt") >= 0) return "ppt";
    return "file";
  }

  function fileButton(file) {
    return (
      '<button type="button" class="btn btn-outline staff-file-btn" data-staff-path="' +
      esc(file.path) +
      '" data-staff-label="' +
      esc(file.label) +
      '">' +
      esc(file.label) +
      "</button>"
    );
  }

  function yearBlock(year, opts) {
    opts = opts || {};
    var meta = yearMeta(year);
    if (!meta) return "";
    var files = [];
    if (opts.classFiles !== false) files = files.concat(meta.classFiles || []);
    if (opts.sampleHw) files = files.concat(meta.sampleHw || []);
    if (opts.sampleHwOnly) files = meta.sampleHw || [];
    if (opts.classOnly) files = meta.classFiles || [];
    if (!files.length) return "";
    return (
      '<div class="staff-year-block">' +
      "<p><strong>Year " +
      year +
      " · " +
      esc(meta.month) +
      " — " +
      esc(meta.title) +
      "</strong></p>" +
      '<div class="staff-file-row">' +
      files.map(fileButton).join("") +
      "</div></div>"
    );
  }

  function uniqueYears(list) {
    var seen = {};
    var out = [];
    (list || []).forEach(function (n) {
      var y = Number(n);
      if (!y || seen[y]) return;
      seen[y] = true;
      out.push(y);
    });
    return out;
  }

  function teachingYears(coordinatorId) {
    var D = global.COD_DATA;
    if (!D || !coordinatorId) return [];
    return (D.teachingYearsForPerson(coordinatorId) || []).map(function (y) {
      return y.year;
    });
  }

  function assignmentYears(coordinatorId) {
    var D = global.COD_DATA;
    if (!D || !coordinatorId) return [];
    return (D.assignmentQuotaForCoordinator(coordinatorId) || []).map(function (q) {
      return q.year;
    });
  }

  function allCatalogYears() {
    var years = [];
    for (var y = 1; y <= 9; y++) years.push(y);
    return years;
  }

  function renderCoordinatorPrep(classRoot, hwRoot, coordinatorId) {
    var teach = uniqueYears(teachingYears(coordinatorId));
    var assign = uniqueYears(assignmentYears(coordinatorId));
    var classYears = uniqueYears(teach.concat(assign).concat(allCatalogYears()));
    var hwYears = uniqueYears(teach.concat(assign).concat(allCatalogYears()));
    if (classRoot) {
      classRoot.innerHTML =
        classYears
          .map(function (y) {
            return yearBlock(y, { classOnly: true });
          })
          .join("") || "<p style='color:var(--muted);'>No class material uploaded yet.</p>";
    }
    if (hwRoot) {
      hwRoot.innerHTML =
        hwYears
          .map(function (y) {
            return yearBlock(y, { sampleHwOnly: true });
          })
          .join("") || "<p style='color:var(--muted);'>No Sample HW uploaded yet.</p>";
    }
  }

  function renderAllYears(root) {
    if (!root) return;
    var html = "";
    for (var y = 1; y <= 9; y++) {
      html += yearBlock(y, { classFiles: true, sampleHw: true });
    }
    root.innerHTML = html || "<p style='color:var(--muted);'>No staff files yet.</p>";
  }

  function closeViewer() {
    var el = document.getElementById("staff-file-viewer");
    if (!el) return;
    el.hidden = true;
    document.body.classList.remove("staff-viewer-open");
    var frame = el.querySelector(".staff-viewer-frame");
    if (frame) frame.src = "about:blank";
  }

  function ensureViewer() {
    var el = document.getElementById("staff-file-viewer");
    if (el) return el;
    el = document.createElement("div");
    el.id = "staff-file-viewer";
    el.className = "staff-viewer";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML =
      '<div class="staff-viewer-bar">' +
      '<button type="button" class="btn btn-outline staff-viewer-close">Close</button>' +
      '<span class="staff-viewer-title">Class material</span>' +
      "</div>" +
      '<iframe class="staff-viewer-frame" title="Class material" hidden></iframe>' +
      '<div class="staff-viewer-fallback">Getting your file…</div>' +
      '<div class="staff-viewer-actions">' +
      '<a class="btn btn-primary staff-viewer-open" href="#" rel="noopener">Open PDF</a>' +
      "</div>";
    document.body.appendChild(el);
    el.querySelector(".staff-viewer-close").addEventListener("click", closeViewer);
    el.querySelector(".staff-viewer-open").addEventListener("click", function (e) {
      var href = el.querySelector(".staff-viewer-open").getAttribute("href");
      if (!href || href === "#") {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      window.location.assign(href);
    });
    return el;
  }

  function showResolvedFile(url, label, storagePath) {
    var el = ensureViewer();
    var kind = fileKind(storagePath || url);
    var title = label || "Class material";
    el.querySelector(".staff-viewer-title").textContent = title;
    var open = el.querySelector(".staff-viewer-open");
    open.hidden = false;
    open.href = url;
    open.textContent = kind === "pdf" ? "Open PDF" : "Open file";
    var frame = el.querySelector(".staff-viewer-frame");
    var fallback = el.querySelector(".staff-viewer-fallback");
    if (kind === "pdf") {
      frame.hidden = false;
      frame.src = url;
      fallback.textContent = "If the pages stay blank, tap Open PDF below.";
    } else {
      frame.hidden = true;
      frame.src = "about:blank";
      fallback.textContent = "Word and PowerPoint files open in another app. Tap Open file.";
    }
    el.hidden = false;
    document.body.classList.add("staff-viewer-open");
  }

  function openStaffFile(storagePath, label) {
    var el = ensureViewer();
    el.hidden = false;
    document.body.classList.add("staff-viewer-open");
    el.querySelector(".staff-viewer-title").textContent = label || "Class material";
    el.querySelector(".staff-viewer-open").hidden = true;
    el.querySelector(".staff-viewer-frame").hidden = true;
    el.querySelector(".staff-viewer-fallback").textContent = "Getting your file…";
    var api = global.COD_FIREBASE;
    if (!api || !api.staffFileUrl) {
      el.querySelector(".staff-viewer-fallback").textContent =
        "Staff files are not available on this page.";
      return Promise.reject(new Error("Staff files are not available on this page."));
    }
    return api
      .staffFileUrl(storagePath)
      .then(function (url) {
        showResolvedFile(url, label, storagePath);
        return url;
      })
      .catch(function (err) {
        el.querySelector(".staff-viewer-fallback").textContent =
          (err && err.message) || "Could not open that file. Sign out, sign back in, and try again.";
        throw err;
      });
  }

  function bindDownloads(root) {
    var host = root || document;
    host.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-staff-path]");
      if (!btn) return;
      e.preventDefault();
      var storagePath = btn.getAttribute("data-staff-path");
      var label = btn.getAttribute("data-staff-label") || btn.textContent;
      btn.disabled = true;
      var original = btn.textContent;
      btn.textContent = "Opening…";
      openStaffFile(storagePath, label)
        .catch(function () {})
        .then(function () {
          btn.textContent = original;
          btn.disabled = false;
        });
    });
  }

  global.COD_STAFF_UI = {
    renderCoordinatorPrep: renderCoordinatorPrep,
    renderAllYears: renderAllYears,
    bindDownloads: bindDownloads,
    openStaffFile: openStaffFile,
    teachingYears: teachingYears,
    assignmentYears: assignmentYears,
  };
})(typeof window !== "undefined" ? window : global);
