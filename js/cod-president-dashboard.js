/**
 * Class of David — President / university admin dashboard loaders.
 */
(function (global) {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function studentDisplayName(d) {
    if (d.name) return d.name;
    return ((d.first || "") + " " + (d.last || "")).trim() || d.email || "—";
  }

  function renderOverview(settings, stats) {
    var el = document.getElementById("stat-grid");
    if (!el) return;
    var cards = [
      { num: stats.students, lbl: "Enrolled students" },
      { num: stats.coordinators, lbl: "Active coordinators" },
      { num: stats.pendingCoords, lbl: "Pending approvals" },
      { num: stats.published, lbl: "Published assignments" },
      { num: stats.inboxNew, lbl: "Inbox (new)" },
      { num: stats.draftsWaiting, lbl: "Awaiting approval" },
    ];
    el.innerHTML = cards
      .map(function (c) {
        return (
          '<div class="stat"><div class="num">' +
          esc(c.num) +
          '</div><div class="lbl">' +
          esc(c.lbl) +
          "</div></div>"
        );
      })
      .join("");
    var cohortEl = document.getElementById("cohort-label");
    if (cohortEl) {
      cohortEl.textContent =
        (settings && settings.cohortLabel) ||
        (global.COD_DATA && global.COD_DATA.COHORT_LABEL) ||
        "2026/2027";
    }
  }

  function renderUpcomingClass(settings) {
    var D = global.COD_DATA;
    if (!D) return;
    var next = D.nextClassSession(new Date());
    var time =
      (settings && settings.classSessionTime) || D.DEFAULT_CLASS_TIME || "TBA";
    var whenEl = document.getElementById("upcoming-when");
    var topicEl = document.getElementById("upcoming-topic");
    var countEl = document.getElementById("upcoming-countdown");
    var yearEl = document.getElementById("current-year-label");
    if (!whenEl || !next) return;
    var acad = D.academicYearForSessionDate(next);
    var yr = D.yearByNumber(acad);
    var cur = D.currentAcademicYear(new Date());
    var curYr = D.yearByNumber(cur);
    whenEl.textContent = D.formatLongDate(next) + " · " + time;
    topicEl.innerHTML =
      "<strong>Year " +
      acad +
      " session</strong> — " +
      esc(yr ? yr.title : "") +
      (yr && yr.calendarMonth ? " · " + esc(yr.calendarMonth) : "") +
      (yr && yr.teachers && yr.teachers[0]
        ? " · Lead: " + esc(yr.teachers[0].name)
        : "") +
      "<br/><span style='opacity:0.85'>" +
      esc(D.CLASS_RHYTHM) +
      " · " +
      esc(D.TUESDAY_PRAYER_LABEL) +
      "</span>";
    var days = D.daysUntil(next);
    if (days === 0) countEl.textContent = "Class is today";
    else if (days === 1) countEl.textContent = "Tomorrow";
    else if (days > 0) countEl.textContent = days + " days until class";
    else countEl.textContent = "Recent session";
    if (yearEl && curYr) {
      yearEl.textContent =
        "Current academic focus: Year " +
        cur +
        " — " +
        curYr.title +
        " (" +
        curYr.calendarMonth +
        ")";
    }
  }

  function renderCalendar() {
    var root = document.getElementById("class-calendar");
    var D = global.COD_DATA;
    if (!root || !D) return;
    var sessions = D.upcomingClassSessions(8, new Date());
    if (!sessions.length) {
      root.innerHTML = "<p style='color:var(--muted)'>No sessions scheduled.</p>";
      return;
    }
    var html =
      '<table class="table-compact"><thead><tr><th>Date</th><th>Year</th><th>Theme</th></tr></thead><tbody>';
    sessions.forEach(function (d) {
      var acad = D.academicYearForSessionDate(d);
      var yr = D.yearByNumber(acad);
      html +=
        "<tr><td>" +
        esc(D.formatLongDate(d)) +
        "</td><td>Year " +
        acad +
        "</td><td>" +
        esc(yr ? yr.title : "") +
        "</td></tr>";
    });
    html += "</tbody></table>";
    root.innerHTML = html;
  }

  function renderCurriculumProgress(publishedByYear) {
    var root = document.getElementById("curriculum-progress");
    var D = global.COD_DATA;
    if (!root || !D) return;
    var html = "";
    D.YEARS.forEach(function (y) {
      var pub = publishedByYear[y.year] || 0;
      var owners = D.ASSIGNMENT_OWNERS[y.year] || [];
      var expected = 0;
      owners.forEach(function (o) {
        expected += o.count || 0;
      });
      var badge =
        expected === 0
          ? "No assignments queued"
          : pub + " / " + expected + " published";
      html +=
        '<div class="year-row"><div class="year-num">' +
        y.year +
        '</div><div><strong>' +
        esc(y.title) +
        '</strong><br/><span style="font-size:0.85rem;color:var(--muted)">' +
        esc(y.calendarMonth) +
        " · " +
        esc(badge) +
        '</span></div><div class="badge">' +
        (pub >= expected && expected > 0 ? "On track" : expected ? "In progress" : "—") +
        "</div></div>";
    });
    root.innerHTML = html;
  }

  function loadAllUsers() {
    return global.COD_FIREBASE.db()
      .collection("cod_users")
      .get()
      .then(function (snap) {
        var users = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          d.uid = doc.id;
          users.push(d);
        });
        return users;
      });
  }

  function loadStudentsTable(users) {
    var root = document.getElementById("student-roster");
    if (!root) return;
    var students = users.filter(function (u) {
      return u.role === "student";
    });
    students.sort(function (a, b) {
      return String(a.studentId || "").localeCompare(String(b.studentId || ""));
    });
    var countEl = document.getElementById("stat-students-inline");
    if (countEl) countEl.textContent = students.length;
    if (!students.length) {
      root.innerHTML =
        "<p style='color:var(--muted)'>No students registered yet. Share <a href='/cod/register.html'>student registration</a>.</p>";
      return;
    }
    var html =
      '<div class="table-scroll"><table class="table-compact"><thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Location</th><th>Year</th><th>Phone</th></tr></thead><tbody>';
    students.forEach(function (s) {
      var loc = [s.state, s.country].filter(Boolean).join(", ");
      html +=
        "<tr><td><code>" +
        esc(s.studentId) +
        "</code></td><td>" +
        esc(studentDisplayName(s)) +
        "</td><td>" +
        esc(s.email) +
        "</td><td>" +
        esc(loc || "—") +
        "</td><td>" +
        esc(s.currentYear || 1) +
        "</td><td>" +
        esc(s.phone || "—") +
        "</td></tr>";
    });
    html += "</tbody></table></div>";
    root.innerHTML = html;
    var btn = document.getElementById("btn-export-students");
    if (btn) {
      btn.onclick = function () {
        exportStudentsCsv(students);
      };
    }
  }

  function exportStudentsCsv(students) {
    var rows = [
      ["Student ID", "First", "Last", "Email", "Phone", "State", "Country", "Year"],
    ];
    students.forEach(function (s) {
      rows.push([
        s.studentId || "",
        s.first || "",
        s.last || "",
        s.email || "",
        s.phone || "",
        s.state || "",
        s.country || "",
        s.currentYear || 1,
      ]);
    });
    var csv = rows
      .map(function (r) {
        return r
          .map(function (c) {
            return '"' + String(c).replace(/"/g, '""') + '"';
          })
          .join(",");
      })
      .join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cod-students-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
  }

  function loadFacultyTable(users, settings) {
    var root = document.getElementById("faculty-roster");
    if (!root || !global.COD_DATA) return;
    var allow = (settings && settings.coordinatorEmails) || [];
    var html =
      '<div class="table-scroll"><table class="table-compact"><thead><tr><th>Coordinator</th><th>Role</th><th>Login email</th><th>Status</th></tr></thead><tbody>';
    html +=
      '<tr><td><strong>Abe Damilola</strong></td><td>President / Instructor</td><td>ddbs.htx@gmail.com · abuxberkeley@gmail.com</td><td><span class="badge">Active</span></td></tr>';
    global.COD_DATA.coordinatorRoster().forEach(function (p) {
      var match = null;
      users.forEach(function (u) {
        if (u.coordinatorId === p.id) match = u;
      });
      var status = "Awaiting registration";
      if (match) {
        if (match.role === "pending_coordinator") status = "Pending approval";
        else if (match.role === "coordinator") status = "Active";
        else status = match.role || "Registered";
      } else if (
        allow.some(function (em) {
          return users.some(function (u) {
            return String(u.email || "").toLowerCase() === em;
          });
        })
      ) {
        status = "Allowlisted (no profile link yet)";
      }
      html +=
        "<tr><td><strong>" +
        esc(p.name) +
        "</strong></td><td>" +
        esc(p.role || "Coordinator") +
        "</td><td>" +
        esc((match && match.email) || "—") +
        "</td><td>" +
        esc(status) +
        "</td></tr>";
    });
    html += "</tbody></table></div>";
    root.innerHTML = html;
  }

  function collectStats(users, extras) {
    extras = extras || {};
    var students = users.filter(function (u) {
      return u.role === "student";
    }).length;
    var coordinators = users.filter(function (u) {
      return u.role === "coordinator";
    }).length;
    var pendingCoords = users.filter(function (u) {
      return u.role === "pending_coordinator";
    }).length;
    return {
      students: students,
      coordinators: coordinators,
      pendingCoords: pendingCoords,
      published: extras.published || 0,
      inboxNew: extras.inboxNew || 0,
      draftsWaiting: extras.draftsWaiting || 0,
    };
  }

  function countPublishedByYear() {
    return global.COD_FIREBASE.collections
      .assignments()
      .where("status", "==", "published")
      .get()
      .then(function (snap) {
        var byYear = {};
        snap.forEach(function (doc) {
          var y = doc.data().year;
          if (y) byYear[y] = (byYear[y] || 0) + 1;
        });
        return { count: snap.size, byYear: byYear };
      })
      .catch(function () {
        return { count: 0, byYear: {} };
      });
  }

  function refreshPresidentDashboard(settings) {
    return loadAllUsers().then(function (users) {
      return Promise.all([
        countPublishedByYear(),
        global.COD_FIREBASE.collections
          .drafts()
          .where("status", "==", "submitted_to_president")
          .get()
          .catch(function () {
            return { size: 0, empty: true };
          }),
        global.COD_FIREBASE.collections
          .adminInbox()
          .where("status", "==", "new")
          .get()
          .catch(function () {
            return { size: 0 };
          }),
      ]).then(function (parts) {
        var pub = parts[0];
        var drafts = parts[1];
        var inbox = parts[2];
        var stats = collectStats(users, {
          published: pub.count,
          draftsWaiting: drafts.size || 0,
          inboxNew: inbox.size || 0,
        });
        renderOverview(settings, stats);
        renderUpcomingClass(settings);
        renderCalendar();
        renderCurriculumProgress(pub.byYear);
        loadStudentsTable(users);
        loadFacultyTable(users, settings);
        return users;
      });
    });
  }

  global.COD_PRESIDENT_DASH = {
    esc: esc,
    renderUpcomingClass: renderUpcomingClass,
    refreshPresidentDashboard: refreshPresidentDashboard,
    loadAllUsers: loadAllUsers,
    studentDisplayName: studentDisplayName,
  };
})(typeof window !== "undefined" ? window : global);
