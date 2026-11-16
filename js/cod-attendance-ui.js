/**
 * Class attendance UI — Amarachi marks; coordinators, President, and students can view.
 */
(function (global) {
  function studentName(s) {
    return ((s.first || "") + " " + (s.last || "")).trim() || s.name || s.email || "—";
  }

  function firstMonday(year, monthIndex) {
    var d = new Date(year, monthIndex, 1);
    var day = d.getDay();
    var add = day === 1 ? 0 : (8 - day) % 7;
    d.setDate(1 + add);
    return d;
  }

  function sessionOptions1024() {
    var months = [
      [2026, 9], [2026, 10], [2026, 11],
      [2027, 0], [2027, 1], [2027, 2], [2027, 3], [2027, 4], [2027, 5], [2027, 6],
      [2027, 9], [2027, 10], [2027, 11],
      [2028, 0], [2028, 1], [2028, 2], [2028, 3], [2028, 4], [2028, 5], [2028, 6],
    ];
    return months.map(function (pair, i) {
      var d = firstMonday(pair[0], pair[1]);
      var ymd =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0");
      var year = pair[0] === 2026 || (pair[0] === 2027 && pair[1] <= 6) ? 1 : 2;
      return { id: "1024-" + ymd, date: d, year: year };
    });
  }

  function sessionOptions() {
    if (global.COD_PROGRAM_CTX && global.COD_PROGRAM_CTX.is1024()) {
      return sessionOptions1024();
    }
    var D = global.COD_DATA;
    var sessions = [];
    (D.YEARS || []).forEach(function (y) {
      var d = D.classSessionDateForAcademicYear(y.year);
      if (d) sessions.push(d);
    });
    D.upcomingClassSessions(12, new Date()).forEach(function (d) {
      sessions.push(d);
    });
    var seen = {};
    var out = [];
    sessions.forEach(function (d) {
      var id = D.sessionIdFromDate(d);
      if (seen[id]) return;
      seen[id] = true;
      out.push({ id: id, date: d, year: D.academicYearForSessionDate(d) });
    });
    out.sort(function (a, b) {
      return a.date.getTime() - b.date.getTime();
    });
    return out;
  }

  function fillSelect(sel) {
    if (!sel) return;
    sel.innerHTML = "";
    sessionOptions().forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = global.COD_DATA.formatLongDate(s.date) + " · Year " + s.year;
      sel.appendChild(opt);
    });
  }

  function academicYearForSessionId(sid) {
    var hit = sessionOptions().filter(function (s) {
      return s.id === sid;
    })[0];
    if (hit) return hit.year;
    return global.COD_DATA.academicYearForSessionDate(new Date(sid + "T12:00:00"));
  }

  function renderRoster(root, students, presentMap, editable) {
    if (!root) return;
    presentMap = presentMap || {};
    if (!students.length) {
      root.innerHTML = "<p style='color:var(--muted)'>No students enrolled yet.</p>";
      return;
    }
    var presentCount = 0;
    var html = '<div class="table-scroll"><table class="table-compact"><thead><tr>';
    html += editable ? "<th></th>" : "";
    html += "<th>Student ID</th><th>Name</th><th>Status</th></tr></thead><tbody>";
    students.forEach(function (s) {
      var here = !!presentMap[s.uid];
      if (here) presentCount++;
      html += "<tr>";
      if (editable) {
        html +=
          '<td><input type="checkbox" class="att-chk" data-uid="' +
          s.uid +
          '"' +
          (here ? " checked" : "") +
          " /></td>";
      }
      html +=
        "<td><code>" +
        (s.studentId || "") +
        "</code></td><td>" +
        studentName(s) +
        "</td><td>" +
        (here ? "Present" : "Absent") +
        "</td></tr>";
    });
    html += "</tbody></table></div>";
    html +=
      "<p style='font-size:0.88rem;color:var(--muted);margin-top:10px;'>" +
      presentCount +
      " of " +
      students.length +
      " present</p>";
    root.innerHTML = html;
  }

  function collectPresent() {
    var present = {};
    document.querySelectorAll(".att-chk").forEach(function (cb) {
      if (cb.checked) present[cb.getAttribute("data-uid")] = true;
    });
    return present;
  }

  function bind(opts) {
    opts = opts || {};
    var sel = document.getElementById(opts.selectId || "att-session");
    var root = document.getElementById(opts.rosterId || "att-roster");
    var saveBtn = document.getElementById(opts.saveId || "btn-save-att");
    var msg = document.getElementById(opts.msgId || "att-msg");
    var meta = document.getElementById(opts.metaId || "att-meta");
    var editable = opts.editable === true;
    var students = [];

    function showMsg(text, kind) {
      if (!msg) return;
      msg.hidden = false;
      msg.className = "msg " + (kind || "info");
      msg.textContent = text;
    }

    function loadRoster() {
      if (!sel || !root) return Promise.resolve();
      var sid = sel.value;
      return Promise.all([
        students.length
          ? Promise.resolve(students)
          : global.COD_FIREBASE.listStudents().then(function (list) {
              students = list;
              return list;
            }),
        global.COD_FIREBASE.getClassAttendance(sid),
      ]).then(function (parts) {
        var doc = parts[1] || {};
        renderRoster(root, students, doc.present, editable);
        if (meta) {
          var who = doc.markedByName || doc.markedByEmail || "";
          meta.textContent = who
            ? "Last marked by " + who
            : "Not marked yet";
        }
      });
    }

    fillSelect(sel);
    if (sel) sel.addEventListener("change", loadRoster);
    if (saveBtn) {
      if (!editable) {
        saveBtn.hidden = true;
      } else {
        saveBtn.addEventListener("click", function () {
          var sid = sel.value;
          showMsg("Saving…", "info");
          global.COD_FIREBASE.saveClassAttendance(
            sid,
            academicYearForSessionId(sid),
            collectPresent()
          )
            .then(function () {
              showMsg("Attendance saved for " + sid + ".", "ok");
              return loadRoster();
            })
            .catch(function (e) {
              showMsg(e.message || String(e), "err");
            });
        });
      }
    }
    return loadRoster();
  }

  function renderStudentStanding(root, uid, rows) {
    if (!root) return;
    uid = String(uid || "");
    var sessions = sessionOptions();
    var byId = {};
    (rows || []).forEach(function (r) {
      byId[r.sessionId || r.id] = r;
    });
    var marked = 0;
    var absences = 0;
    var html = "<table><thead><tr><th>Class</th><th>Your status</th></tr></thead><tbody>";
    var any = false;
    sessions.forEach(function (s) {
      var doc = byId[s.id];
      if (!doc || !doc.present) return;
      any = true;
      marked++;
      var here = !!doc.present[uid];
      if (!here) absences++;
      html +=
        "<tr><td>" +
        global.COD_DATA.formatLongDate(s.date) +
        " · Year " +
        s.year +
        "</td><td>" +
        (here ? "Present" : "<strong>Absent</strong>") +
        "</td></tr>";
    });
    html += "</tbody></table>";
    if (!any) {
      root.innerHTML = "<p style='color:var(--muted);'>Attendance has not been marked yet.</p>";
      return;
    }
    var warn = "";
    if (absences >= 2) {
      warn =
        "<div class='msg err'>You have " +
        absences +
        " recorded absences. Missing class can get you dropped from Class of David.</div>";
    } else if (absences === 1) {
      warn =
        "<div class='msg err'>You were marked absent. Missing class can get you dropped from Class of David.</div>";
    } else {
      warn = "<div class='msg ok'>You are marked present for recorded classes.</div>";
    }
    root.innerHTML =
      warn +
      html +
      "<p style='font-size:0.88rem;color:var(--muted);margin-top:10px;'>Marked by Nnodum Amarachi. " +
      absences +
      " absent · " +
      marked +
      " class" +
      (marked === 1 ? "" : "es") +
      " on record.</p>";
  }

  function bindStudent(uid) {
    var root = document.getElementById("student-attendance");
    if (!root || !global.COD_FIREBASE.listClassAttendance) return Promise.resolve();
    return global.COD_FIREBASE.listClassAttendance().then(function (rows) {
      renderStudentStanding(root, uid, rows);
    });
  }

  global.COD_ATTENDANCE_UI = {
    bind: bind,
    bindStudent: bindStudent,
    fillSelect: fillSelect,
    sessionOptions: sessionOptions,
    renderStudentStanding: renderStudentStanding,
  };
})(typeof window !== "undefined" ? window : global);
