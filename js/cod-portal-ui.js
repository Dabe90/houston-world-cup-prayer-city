/**
 * Shared schedule + announcements UI for COD portals.
 */
(function (global) {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;");
  }

  function renderScheduleBlock(settings, academicYear) {
    var D = global.COD_DATA;
    if (!D) return "";
    var brief = D.sessionBrief(academicYear || D.currentAcademicYear(), settings);
    if (!brief) return "";
    var next = D.nextClassSession(new Date());
    var nextBrief = next ? D.sessionBrief(D.academicYearForSessionDate(next), settings) : brief;
    var mats = (nextBrief.materials || [])
      .map(function (m) {
        return '<a href="' + esc(m.href) + '">' + esc(m.label) + "</a>";
      })
      .join(" · ");
    return (
      '<div class="card" style="margin-top:16px;background:linear-gradient(180deg,#fff,#faf6ef);">' +
      '<p class="kicker">Rhythm (WAT)</p>' +
      "<p><strong>" +
      esc(D.TUESDAY_PRAYER_LABEL) +
      "</strong></p>" +
      "<p><strong>Upcoming class:</strong> " +
      esc(next ? D.formatLongDate(next) : brief.classDateLabel) +
      " · " +
      esc(nextBrief.classTime) +
      "</p>" +
      "<p style='color:var(--muted);font-size:0.92rem;'>" +
      esc(brief.calendarMonth) +
      " · Year " +
      brief.academicYear +
      " — " +
      esc(brief.title) +
      "</p>" +
      (mats ? "<p style='font-size:0.88rem;margin-top:10px;'>Materials: " + mats + "</p>" : "") +
      "</div>"
    );
  }

  function renderTeachingCards(settings, coordinatorId) {
    var D = global.COD_DATA;
    if (!D || !coordinatorId) return "";
    var years = D.teachingYearsForPerson(coordinatorId);
    if (!years.length) return "";
    var person = D.PEOPLE && D.PEOPLE[coordinatorId] ? D.PEOPLE[coordinatorId] : null;
    var html = '<div class="grid-2" style="margin-top:16px;">';
    years.forEach(function (y) {
      var brief = D.sessionBrief(y.year, settings);
      var photo = person && person.image ? person.image : brief.lead && brief.lead.image ? brief.lead.image : "";
      var img = photo
        ? '<img src="' + esc(photo) + '" alt="' + esc(person && person.name ? person.name : "") + '" width="56" height="56" style="border-radius:50%;object-fit:cover;" />'
        : "";
      var mats = (brief.materials || [])
        .map(function (m) {
          return '<a href="' + esc(m.href) + '">' + esc(m.label) + "</a>";
        })
        .join("<br/>");
      html +=
        '<div class="card"><div style="display:flex;gap:12px;align-items:center;">' +
        img +
        "<div><strong>" +
        esc(y.calendarMonth) +
        " · Year " +
        y.year +
        "</strong><br/>" +
        esc(y.title) +
        "</div></div>" +
        "<p style='font-size:0.9rem;margin:12px 0 6px;'><strong>Teach:</strong> " +
        esc(brief.classDateLabel) +
        " · " +
        esc(brief.classTime) +
        "</p>" +
        "<p style='font-size:0.85rem;color:var(--muted);'>" +
        esc(D.TUESDAY_PRAYER_LABEL) +
        "</p>" +
        (mats ? "<p style='font-size:0.85rem;margin-top:8px;'>" + mats + "</p>" : "") +
        '<p style="font-size:0.85rem;margin-top:8px;"><a href="/cod/coordinator.html">Write assignment → President for approval</a></p>' +
        "</div>";
    });
    html += "</div>";
    return html;
  }

  function audienceLabel(msg) {
    var a = (msg && msg.audience) || "all";
    if (a === "students") return "All students";
    if (a === "coordinators") return "All coordinators";
    if (a === "coordinator") {
      return "Coordinator: " + (msg.targetCoordinatorName || msg.targetCoordinatorId || "one person");
    }
    if (a === "student") return "Student";
    return "Everyone";
  }

  function fillAudienceSelect(sel, opts) {
    if (!sel || !global.COD_DATA) return;
    opts = opts || {};
    var html =
      '<option value="all">Everyone (students + coordinators)</option>' +
      '<option value="students">All students</option>' +
      '<option value="coordinators">All coordinators</option>';
    html += '<optgroup label="A specific coordinator">';
    if (opts.includePresident !== false) {
      html += '<option value="coordinator:damilola">President — Abe Damilola</option>';
    }
    global.COD_DATA.coordinatorRoster().forEach(function (p) {
      html +=
        '<option value="coordinator:' + p.id + '">' + esc(p.name) + "</option>";
    });
    html += "</optgroup>";
    sel.innerHTML = html;
  }

  function renderAnnouncements(root, list) {
    if (!root) return;
    if (!list || !list.length) {
      root.innerHTML = "<p style='color:var(--muted);'>No messages yet.</p>";
      return;
    }
    var html = "";
    list.forEach(function (a) {
      html +=
        '<div style="border-bottom:1px solid var(--hair);padding:12px 0;">' +
        "<strong>" +
        esc(a.subject) +
        "</strong>" +
        '<p style="margin:4px 0 0;font-size:0.8rem;color:var(--faint);">' +
        esc(a.createdByName || a.createdBy || "Staff") +
        " · " +
        esc(audienceLabel(a)) +
        "</p>" +
        '<p style="margin:6px 0 0;font-size:0.92rem;color:var(--muted);white-space:pre-wrap;">' +
        esc(a.body) +
        "</p></div>";
    });
    root.innerHTML = html;
  }

  function wireAnnouncements(root, viewer) {
    if (!root || !global.COD_FIREBASE) return function () {};
    return global.COD_FIREBASE.listenAnnouncements(viewer || { role: "admin" }, function (list) {
      renderAnnouncements(root, list);
    });
  }

  function bindComposer(opts) {
    opts = opts || {};
    var audienceEl = document.getElementById(opts.audienceId || "msg-audience");
    var subjectEl = document.getElementById(opts.subjectId || "msg-subject");
    var bodyEl = document.getElementById(opts.bodyId || "msg-body");
    var btn = document.getElementById(opts.buttonId || "btn-send-msg");
    var status = document.getElementById(opts.statusId || "msg-status");
    fillAudienceSelect(audienceEl, opts);
    if (!btn) return;
    btn.addEventListener("click", function () {
      var dest = audienceEl ? audienceEl.value : "all";
      if (status) {
        status.hidden = false;
        status.className = "msg info";
        status.textContent = "Sending…";
      }
      global.COD_FIREBASE.postAnnouncement(
        subjectEl ? subjectEl.value : "",
        bodyEl ? bodyEl.value : "",
        dest
      )
        .then(function () {
          if (status) {
            status.className = "msg ok";
            status.textContent = "Message sent.";
          }
          if (subjectEl) subjectEl.value = "";
          if (bodyEl) bodyEl.value = "";
        })
        .catch(function (e) {
          if (status) {
            status.className = "msg err";
            status.textContent = e.message || String(e);
          }
        });
    });
  }

  global.COD_PORTAL_UI = {
    renderScheduleBlock: renderScheduleBlock,
    renderTeachingCards: renderTeachingCards,
    renderAnnouncements: renderAnnouncements,
    wireAnnouncements: wireAnnouncements,
    fillAudienceSelect: fillAudienceSelect,
    bindComposer: bindComposer,
    audienceLabel: audienceLabel,
  };
})(typeof window !== "undefined" ? window : global);
