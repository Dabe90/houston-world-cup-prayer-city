(function (global) {
  function todayYMD() {
    var n = new Date();
    var y = n.getFullYear();
    var m = String(n.getMonth() + 1).padStart(2, "0");
    var d = String(n.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function formatDate(ymd, opts) {
    var p = ymd.split("-");
    var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    return dt.toLocaleDateString(
      "en-GB",
      opts || {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }
    );
  }

  function formatLong(ymd) {
    return formatDate(ymd, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  }

  function dayFor(ymd) {
    var data = global.COD1024_SCRIPTURES;
    if (!data || !data.days) return null;
    for (var i = 0; i < data.days.length; i++) {
      if (data.days[i].date === ymd) return data.days[i];
    }
    return null;
  }

  function themeFor(ymd) {
    return global.COD1024_THEMES ? global.COD1024_THEMES.forDate(ymd) : null;
  }

  function mondayOf(ymd) {
    var p = ymd.split("-");
    var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    var dow = dt.getUTCDay();
    var back = dow === 0 ? 6 : dow - 1;
    dt.setUTCDate(dt.getUTCDate() - back);
    return dt.toISOString().slice(0, 10);
  }

  function addDays(ymd, n) {
    var p = ymd.split("-");
    var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  /** Readings for the week containing ymd. On a weekend or break, the next week with readings. */
  function weekOf(ymd) {
    var data = global.COD1024_SCRIPTURES;
    if (!data || !data.days || !data.days.length) return [];
    var start = mondayOf(ymd);
    var dow = new Date(ymd + "T12:00:00Z").getUTCDay();
    if (dow === 0 || dow === 6) start = addDays(start, 7);
    var end = addDays(start, 6);
    var rows = data.days.filter(function (r) {
      return r.date >= start && r.date <= end;
    });
    if (rows.length) return rows;
    var next = data.days.filter(function (r) {
      return r.date >= ymd;
    })[0];
    if (!next) return [];
    start = mondayOf(next.date);
    end = addDays(start, 6);
    return data.days.filter(function (r) {
      return r.date >= start && r.date <= end;
    });
  }

  function themeChip(t) {
    if (!t) return "";
    return '<span class="theme-chip theme-' + t.key + '">' + t.month + " · " + t.name + "</span>";
  }

  /** Small "today" card used on the portal home tabs. */
  function renderToday(root) {
    if (!root) return;
    var today = todayYMD();
    var row = dayFor(today);
    var t = themeFor(today);
    if (row) {
      root.innerHTML =
        themeChip(t) +
        '<p class="today-ref">' +
        row.refs.join(" · ") +
        "</p>" +
        '<p class="today-date">' +
        formatLong(row.date) +
        "</p>";
      return;
    }
    var week = weekOf(today);
    root.innerHTML =
      themeChip(t) +
      '<p class="today-ref today-rest">No reading today</p>' +
      '<p class="today-date">' +
      (week.length
        ? "Readings resume " + formatLong(week[0].date) + "."
        : "Readings for the next semester will be posted here.") +
      "</p>";
  }

  /** Mon–Fri list for this week. */
  function renderWeek(root) {
    if (!root) return;
    var today = todayYMD();
    var rows = weekOf(today);
    if (!rows.length) {
      root.innerHTML = "<p class='muted'>Readings for the next semester will be posted here.</p>";
      return;
    }
    var html = '<ol class="week-list">';
    rows.forEach(function (r) {
      html +=
        '<li class="' +
        (r.date === today ? "is-today" : r.date < today ? "is-past" : "") +
        '"><span class="wk-day">' +
        formatDate(r.date, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) +
        '</span><span class="wk-ref">' +
        r.refs.join(" · ") +
        "</span></li>";
    });
    html += "</ol>";
    root.innerHTML = html;
  }

  /** Full list with month filter, grouped under each month's theme. */
  function renderInto(root) {
    var data = global.COD1024_SCRIPTURES;
    if (!root || !data) return;
    var today = todayYMD();
    var todayRow = dayFor(today);
    var months = [];
    data.days.forEach(function (row) {
      if (months.indexOf(row.month) === -1) months.push(row.month);
    });

    var sel = document.createElement("select");
    sel.id = "scripture-month";
    var all = document.createElement("option");
    all.value = "all";
    all.textContent = "October – December";
    sel.appendChild(all);
    months.forEach(function (m) {
      var t = global.COD1024_THEMES ? global.COD1024_THEMES.forMonthName(m) : null;
      var opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m + (t ? " — " + t.name : "");
      sel.appendChild(opt);
    });
    if (todayRow) sel.value = todayRow.month;

    var toolbar = document.createElement("div");
    toolbar.className = "scripture-toolbar";
    var lab = document.createElement("label");
    lab.setAttribute("for", "scripture-month");
    lab.textContent = "Show";
    toolbar.appendChild(lab);
    toolbar.appendChild(sel);

    var tableWrap = document.createElement("div");
    tableWrap.className = "table-scroll";
    var table = document.createElement("table");
    table.className = "scripture-table";
    table.innerHTML = "<thead><tr><th>Date</th><th>Read</th></tr></thead>";
    var tbody = document.createElement("tbody");
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    function paint() {
      var filter = sel.value;
      tbody.innerHTML = "";
      var lastMonth = "";
      data.days.forEach(function (row) {
        if (filter !== "all" && row.month !== filter) return;
        if (row.month !== lastMonth) {
          lastMonth = row.month;
          var t = global.COD1024_THEMES ? global.COD1024_THEMES.forMonthName(row.month) : null;
          var head = document.createElement("tr");
          head.className = "month-row" + (t ? " theme-" + t.key : "");
          head.innerHTML =
            "<td colspan='2'><strong>" +
            row.month +
            "</strong>" +
            (t ? " · Theme: " + t.name : "") +
            "</td>";
          tbody.appendChild(head);
        }
        var tr = document.createElement("tr");
        if (row.date === today) tr.className = "is-today";
        tr.innerHTML =
          "<td class='dates'>" + formatDate(row.date) + "</td><td>" + row.refs.join("; ") + "</td>";
        tbody.appendChild(tr);
      });
    }
    sel.addEventListener("change", paint);
    paint();

    root.innerHTML = "";
    root.appendChild(toolbar);
    root.appendChild(tableWrap);
  }

  global.COD1024_SCRIPTURES_UI = {
    renderInto: renderInto,
    renderToday: renderToday,
    renderWeek: renderWeek,
    dayFor: dayFor,
    weekOf: weekOf,
    todayYMD: todayYMD,
    formatLong: formatLong,
  };
})(typeof window !== "undefined" ? window : this);
