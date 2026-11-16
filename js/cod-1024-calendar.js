/**
 * Class of David 1024 — two-year calendar (shown inside the portals, not on the public page).
 */
(function (global) {
  var YEARS = [
    {
      label: "Year 1",
      range: "October 2026 – September 2027",
      blocks: [
        {
          kind: "term",
          name: "Semester 1",
          start: "2026-10-05",
          end: "2026-12-22",
          dates: "Mon 5 Oct 2026 → Tue 22 Dec 2026",
          note: "12 weeks of class (week 12 is Mon–Tue only). 57 scripture days. No mid-term.",
        },
        {
          kind: "break",
          name: "Christmas",
          start: "2026-12-23",
          end: "2027-01-05",
          dates: "Wed 23 Dec 2026 → Tue 5 Jan 2027",
          note: "Full 14 days. Starts two days before Christmas (Fri 25 Dec). No scriptures.",
        },
        {
          kind: "term",
          name: "Semester 2",
          start: "2027-01-06",
          end: "2027-04-16",
          dates: "Wed 6 Jan 2027 → Fri 16 Apr 2027",
          note: "Long semester begins mid-week. 73 scripture days.",
        },
        {
          kind: "break",
          name: "Mid-term",
          start: "2027-04-19",
          end: "2027-04-23",
          dates: "Mon 19 Apr 2027 → Fri 23 Apr 2027",
          note: "One week in the long semester. No scriptures.",
        },
        {
          kind: "term",
          name: "Semester 2 continues",
          start: "2027-04-26",
          end: "2027-07-30",
          dates: "Mon 26 Apr 2027 → Fri 30 Jul 2027",
          note: "70 scripture days. Class runs through May, June, and July.",
        },
        {
          kind: "long",
          name: "Long holiday",
          start: "2027-07-31",
          end: "2027-10-03",
          dates: "31 Jul 2027 → 3 Oct 2027",
          note: "August and September only. The only long holiday in the two years.",
        },
      ],
    },
    {
      label: "Year 2",
      range: "October 2027 – July 2028",
      blocks: [
        {
          kind: "term",
          name: "Semester 3",
          start: "2027-10-04",
          end: "2027-12-22",
          dates: "Mon 4 Oct 2027 → Wed 22 Dec 2027",
          note: "12 weeks of class (week 12 is Mon–Wed). 58 scripture days. No mid-term.",
        },
        {
          kind: "break",
          name: "Christmas",
          start: "2027-12-23",
          end: "2028-01-05",
          dates: "Thu 23 Dec 2027 → Wed 5 Jan 2028",
          note: "Full 14 days. Christmas is Sat 25 Dec. No scriptures.",
        },
        {
          kind: "term",
          name: "Semester 4",
          start: "2028-01-06",
          end: "2028-04-14",
          dates: "Thu 6 Jan 2028 → Fri 14 Apr 2028",
          note: "Long semester begins Thursday. 72 scripture days.",
        },
        {
          kind: "break",
          name: "Mid-term",
          start: "2028-04-17",
          end: "2028-04-21",
          dates: "Mon 17 Apr 2028 → Fri 21 Apr 2028",
          note: "One week (Easter week 2028). No scriptures.",
        },
        {
          kind: "term",
          name: "Semester 4 continues",
          start: "2028-04-24",
          end: "2028-07-28",
          dates: "Mon 24 Apr 2028 → Fri 28 Jul 2028",
          note: "70 scripture days.",
        },
        {
          kind: "done",
          name: "Complete",
          start: "2028-07-29",
          end: "9999-12-31",
          dates: "After 28 Jul 2028",
          note: "Two-year program finished.",
        },
      ],
    },
  ];

  var SEMESTERS = [
    { n: 1, label: "Semester 1", range: "Oct – Dec 2026" },
    { n: 2, label: "Semester 2", range: "Jan – Jul 2027" },
    { n: 3, label: "Semester 3", range: "Oct – Dec 2027" },
    { n: 4, label: "Semester 4", range: "Jan – Jul 2028" },
  ];

  function todayYMD() {
    var n = new Date();
    return (
      n.getFullYear() +
      "-" +
      String(n.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(n.getDate()).padStart(2, "0")
    );
  }

  function blockFor(ymd) {
    for (var y = 0; y < YEARS.length; y++) {
      var blocks = YEARS[y].blocks;
      for (var b = 0; b < blocks.length; b++) {
        if (ymd >= blocks[b].start && ymd <= blocks[b].end) {
          return { year: YEARS[y], block: blocks[b] };
        }
      }
    }
    return null;
  }

  function currentBlock() {
    return blockFor(todayYMD());
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;");
  }

  function renderInto(root) {
    if (!root) return;
    var today = todayYMD();
    var html = "";
    YEARS.forEach(function (y) {
      html +=
        '<div class="cal-year"><div class="cal-year-head"><p class="kicker">' +
        esc(y.label) +
        "</p><h3>" +
        esc(y.range) +
        '</h3></div><div class="table-scroll"><table class="cal-table"><thead><tr><th>Block</th><th>Dates</th><th>What happens</th></tr></thead><tbody>';
      y.blocks.forEach(function (b) {
        var cls = b.kind === "term" ? "" : b.kind;
        var isNow = today >= b.start && today <= b.end;
        if (isNow) cls += " is-now";
        html +=
          '<tr class="' +
          cls.trim() +
          '"><td><strong>' +
          esc(b.name) +
          "</strong>" +
          (isNow ? ' <span class="now-chip">Now</span>' : "") +
          '</td><td class="dates">' +
          esc(b.dates) +
          "</td><td>" +
          esc(b.note) +
          "</td></tr>";
      });
      html += "</tbody></table></div></div>";
    });
    root.innerHTML = html;
  }

  global.COD1024_CALENDAR = {
    YEARS: YEARS,
    SEMESTERS: SEMESTERS,
    blockFor: blockFor,
    currentBlock: currentBlock,
    renderInto: renderInto,
    todayYMD: todayYMD,
  };
})(typeof window !== "undefined" ? window : this);
