/**
 * Class of David 1024 — monthly themes. The theme guides that month's scriptures and classes.
 */
(function (global) {
  var THEMES = {
    "2026-10": {
      key: "victory",
      name: "Victory",
      month: "October",
      line: "We begin by standing on what God has already won.",
    },
    "2026-11": {
      key: "spirit",
      name: "Holy Spirit",
      month: "November",
      line: "We make room for the One who teaches, leads and fills.",
    },
    "2026-12": {
      key: "fire",
      name: "Fire",
      month: "December",
      line: "We end the semester ablaze — hungry, prayerful and set apart.",
    },
  };

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

  function withYm(ym) {
    var t = THEMES[ym];
    if (!t) return null;
    var out = { ym: ym };
    Object.keys(t).forEach(function (k) {
      out[k] = t[k];
    });
    return out;
  }

  function forDate(ymd) {
    return withYm(String(ymd || "").slice(0, 7));
  }

  function forMonthName(name) {
    var keys = Object.keys(THEMES);
    for (var i = 0; i < keys.length; i++) {
      if (THEMES[keys[i]].month === name) return withYm(keys[i]);
    }
    return null;
  }

  function list() {
    return Object.keys(THEMES)
      .sort()
      .map(withYm);
  }

  function current() {
    return forDate(todayYMD());
  }

  /** The theme for today, or the next one coming, or the last one if the semester has ended. */
  function nowOrNext() {
    var today = todayYMD().slice(0, 7);
    var all = list();
    for (var i = 0; i < all.length; i++) {
      if (all[i].ym >= today) return all[i];
    }
    return all[all.length - 1] || null;
  }

  global.COD1024_THEMES = {
    forDate: forDate,
    forMonthName: forMonthName,
    list: list,
    current: current,
    nowOrNext: nowOrNext,
    todayYMD: todayYMD,
  };
})(typeof window !== "undefined" ? window : this);
