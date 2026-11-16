"use strict";

const fs = require("fs");
const path = require("path");

const WEEK = {
  1: ["Psalm 46"],
  2: ["Psalm 124", "Psalm 125"],
  3: ["Psalm 121"],
  4: ["Psalm 1", "Psalm 2"],
  5: ["Psalm 3"],
};

const START = "2026-10-05";
const END = "2026-12-22";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymdToUTC(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatYMD(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthName(ymd) {
  return ["October", "November", "December"][Number(ymd.slice(5, 7)) - 10];
}

function build() {
  const days = [];
  const start = ymdToUTC(START);
  const end = ymdToUTC(END);
  for (let t = start; t <= end; t += 86400000) {
    const dow = new Date(t).getUTCDay();
    if (!WEEK[dow]) continue;
    const date = formatYMD(t);
    days.push({
      date: date,
      day: DAYS[dow],
      month: monthName(date),
      term: "s1",
      termLabel: "Semester 1",
      refs: WEEK[dow].slice(),
    });
  }
  return days;
}

const days = build();
const dest = path.join(__dirname, "..", "..", "..", "js", "cod-1024-scriptures.js");
const payload = {
  prayer: "Tuesday night prayer · 10:00 PM WAT",
  rhythm: "Mon Psalm 46 · Tue Psalm 124, 125 · Wed Psalm 121 · Thu Psalm 1, 2 · Fri Psalm 3",
  days: days,
};
fs.writeFileSync(dest, "window.COD1024_SCRIPTURES = " + JSON.stringify(payload) + ";\n");
console.log("Wrote", dest, "days", days.length);
