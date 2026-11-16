(function (global) {
  function todayYMD() {
    var n = new Date();
    var y = n.getFullYear();
    var m = String(n.getMonth() + 1).padStart(2, "0");
    var d = String(n.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function formatDate(ymd) {
    var p = ymd.split("-");
    var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    return dt.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function dayFor(ymd) {
    var data = global.COD1024_SCRIPTURES;
    if (!data || !data.days) return null;
    for (var i = 0; i < data.days.length; i++) {
      if (data.days[i].date === ymd) return data.days[i];
    }
    return null;
  }

  function renderInto(root) {
    var data = global.COD1024_SCRIPTURES;
    if (!root || !data) return;
    var today = todayYMD();
    var todayRow = dayFor(today);
    var months = [];
    data.days.forEach(function (row) {
      if (months.indexOf(row.month) === -1) months.push(row.month);
    });

    var todayBox = document.createElement("div");
    todayBox.className = "scripture-today";
    if (todayRow) {
      todayBox.innerHTML =
        "<p class='kicker'>Today</p><p><strong>" +
        formatDate(todayRow.date) +
        "</strong> · " +
        todayRow.refs.join("; ") +
        "</p>";
    } else {
      todayBox.innerHTML =
        "<p class='kicker'>Today</p><p>No assigned reading today. Tuesday night prayer is still 10:00 PM WAT.</p>";
    }

    var sel = document.createElement("select");
    sel.id = "scripture-month";
    var all = document.createElement("option");
    all.value = "all";
    all.textContent = "October – December";
    sel.appendChild(all);
    months.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
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
    table.innerHTML = "<thead><tr><th>Date</th><th>Read</th></tr></thead>";
    var tbody = document.createElement("tbody");
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    function paint() {
      var filter = sel.value;
      tbody.innerHTML = "";
      data.days.forEach(function (row) {
        if (filter !== "all" && row.month !== filter) return;
        var tr = document.createElement("tr");
        if (row.date === today) tr.className = "is-today";
        tr.innerHTML =
          "<td class='dates'>" +
          formatDate(row.date) +
          "</td><td>" +
          row.refs.join("; ") +
          "</td>";
        tbody.appendChild(tr);
      });
    }
    sel.addEventListener("change", paint);
    paint();

    root.innerHTML = "";
    root.appendChild(todayBox);
    root.appendChild(toolbar);
    root.appendChild(tableWrap);
  }

  global.COD1024_SCRIPTURES_UI = {
    renderInto: renderInto,
    dayFor: dayFor,
    todayYMD: todayYMD,
  };
})(typeof window !== "undefined" ? window : this);
