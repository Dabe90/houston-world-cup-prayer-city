(function (global) {
  var TERMS = [
    { id: "s1", label: "Semester 1" },
    { id: "s2", label: "Semester 2" },
    { id: "s3", label: "Semester 3" },
    { id: "s4", label: "Semester 4" },
  ];

  function termGroup(id) {
    if (id === "s2a" || id === "s2b") return "s2";
    if (id === "s4a" || id === "s4b") return "s4";
    return id;
  }

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

    var termSel = document.createElement("select");
    termSel.id = "scripture-term";
    var all = document.createElement("option");
    all.value = "all";
    all.textContent = "All terms";
    termSel.appendChild(all);
    TERMS.forEach(function (t) {
      var opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.label;
      termSel.appendChild(opt);
    });
    if (todayRow) termSel.value = termGroup(todayRow.term);
    else termSel.value = "s1";

    var toolbar = document.createElement("div");
    toolbar.className = "scripture-toolbar";
    var lab = document.createElement("label");
    lab.setAttribute("for", "scripture-term");
    lab.textContent = "Show";
    toolbar.appendChild(lab);
    toolbar.appendChild(termSel);

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
        "<p class='kicker'>Today</p><p>No assigned reading today (weekend, holiday, or outside term). Tuesday night prayer is still 10:00 PM WAT.</p>";
    }

    var tableWrap = document.createElement("div");
    tableWrap.className = "table-scroll";
    var table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Date</th><th>Read</th></tr></thead>";
    var tbody = document.createElement("tbody");
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    function paint() {
      var filter = termSel.value;
      tbody.innerHTML = "";
      data.days.forEach(function (row) {
        if (filter !== "all" && termGroup(row.term) !== filter) return;
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
    termSel.addEventListener("change", paint);
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
