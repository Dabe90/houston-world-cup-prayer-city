/**
 * President office chrome: auth gate + multi-page navigation.
 */
(function (global) {
  var PAGES = [
    { id: "home", href: "/cod/admin.html", label: "Office home" },
    { id: "students", href: "/cod/admin-students.html", label: "Students" },
    { id: "faculty", href: "/cod/admin-faculty.html", label: "Faculty" },
    { id: "calendar", href: "/cod/admin-calendar.html", label: "Calendar" },
    { id: "curriculum", href: "/cod/admin-curriculum.html", label: "Curriculum" },
    { id: "coordinator-views", href: "/cod/admin-coordinator-views.html", label: "Coordinator dashboards" },
    { id: "attendance", href: "/cod/admin-attendance.html", label: "Attendance" },
    { id: "messages", href: "/cod/admin-messages.html", label: "Messages" },
    { id: "operations", href: "/cod/admin-operations.html", label: "Operations" },
  ];

  function renderNav(activeId) {
    var host = document.getElementById("office-nav");
    if (!host) return;
    var html = "";
    if (activeId && activeId !== "home") {
      html +=
        '<a class="office-back" href="/cod/admin.html">← Back to office home</a>';
    }
    html += '<nav class="dash-nav" aria-label="President office">';
    PAGES.forEach(function (p) {
      html +=
        '<a href="' +
        p.href +
        '"' +
        (p.id === activeId ? ' class="active"' : "") +
        ">" +
        p.label +
        "</a>";
    });
    html += "</nav>";
    host.innerHTML = html;
  }

  function boot(activeId, onReady) {
    renderNav(activeId);
    if (!global.COD_FIREBASE || !global.COD_FIREBASE.init()) {
      var gate = document.getElementById("gate");
      if (gate) gate.innerHTML = "<p class='msg err'>Firebase is not configured.</p>";
      return;
    }
    global.COD_FIREBASE.auth().onAuthStateChanged(function (user) {
      if (!user) {
        window.location.href = "/cod/president-login.html";
        return;
      }
      global.COD_FIREBASE.resolveRole(user).then(function (role) {
        if (role !== "admin") {
          document.getElementById("gate").innerHTML =
            "<p class='msg err'>President access only.</p>";
          return;
        }
        document.getElementById("gate").hidden = true;
        var portal = document.getElementById("portal");
        if (portal) portal.hidden = false;
        global.COD_FIREBASE.ensureSettingsSeed();
        if (typeof onReady === "function") onReady(user);
      });
    });
  }

  global.COD_PRESIDENT_OFFICE = {
    PAGES: PAGES,
    renderNav: renderNav,
    boot: boot,
  };
})(typeof window !== "undefined" ? window : global);
