"use strict";

const fs = require("fs");
const path = require("path");

const BOOKS = [
  ["Genesis", 50],
  ["Exodus", 40],
  ["Leviticus", 27],
  ["Numbers", 36],
  ["Deuteronomy", 34],
  ["Joshua", 24],
  ["Judges", 21],
  ["Ruth", 4],
  ["1 Samuel", 31],
  ["2 Samuel", 24],
  ["1 Kings", 22],
  ["2 Kings", 25],
  ["1 Chronicles", 29],
  ["2 Chronicles", 36],
  ["Ezra", 10],
  ["Nehemiah", 13],
  ["Esther", 10],
  ["Job", 42],
  ["Psalms", 150],
  ["Proverbs", 31],
  ["Ecclesiastes", 12],
  ["Song of Songs", 8],
  ["Isaiah", 66],
  ["Jeremiah", 52],
  ["Lamentations", 5],
  ["Ezekiel", 48],
  ["Daniel", 12],
  ["Hosea", 14],
  ["Joel", 3],
  ["Amos", 9],
  ["Obadiah", 1],
  ["Jonah", 4],
  ["Micah", 7],
  ["Nahum", 3],
  ["Habakkuk", 3],
  ["Zephaniah", 3],
  ["Haggai", 2],
  ["Zechariah", 14],
  ["Malachi", 4],
  ["Matthew", 28],
  ["Mark", 16],
  ["Luke", 24],
  ["John", 21],
  ["Acts", 28],
  ["Romans", 16],
  ["1 Corinthians", 16],
  ["2 Corinthians", 13],
  ["Galatians", 6],
  ["Ephesians", 6],
  ["Philippians", 4],
  ["Colossians", 4],
  ["1 Thessalonians", 5],
  ["2 Thessalonians", 3],
  ["1 Timothy", 6],
  ["2 Timothy", 4],
  ["Titus", 3],
  ["Philemon", 1],
  ["Hebrews", 13],
  ["James", 5],
  ["1 Peter", 5],
  ["2 Peter", 3],
  ["1 John", 5],
  ["2 John", 1],
  ["3 John", 1],
  ["Jude", 1],
  ["Revelation", 22],
];

const TERMS = [
  { id: "s1", label: "Semester 1", start: "2026-10-05", end: "2026-12-22" },
  { id: "s2a", label: "Semester 2", start: "2027-01-06", end: "2027-04-16" },
  { id: "s2b", label: "Semester 2 continues", start: "2027-04-26", end: "2027-07-30" },
  { id: "s3", label: "Semester 3", start: "2027-10-04", end: "2027-12-22" },
  { id: "s4a", label: "Semester 4", start: "2028-01-06", end: "2028-04-14" },
  { id: "s4b", label: "Semester 4 continues", start: "2028-04-24", end: "2028-07-28" },
];

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

function weekday(ms) {
  return new Date(ms).getUTCDay();
}

function chapters() {
  const out = [];
  BOOKS.forEach(([book, n]) => {
    for (let i = 1; i <= n; i++) out.push(book + " " + i);
  });
  return out;
}

function loadForWeekday(dow, weekIndex) {
  if (dow === 1) return 1;
  if (dow === 2) return 2;
  if (dow === 3) return 1;
  if (dow === 4) return weekIndex % 2 === 0 ? 2 : 3;
  if (dow === 5) return 1;
  return 0;
}

function build() {
  const pool = chapters();
  let cursor = 0;
  const days = [];
  let weekIndex = 0;
  TERMS.forEach((term) => {
    const start = ymdToUTC(term.start);
    const end = ymdToUTC(term.end);
    for (let t = start; t <= end; t += 86400000) {
      const dow = weekday(t);
      if (dow === 0 || dow === 6) continue;
      if (dow === 1) weekIndex += 1;
      const n = loadForWeekday(dow, weekIndex);
      const refs = [];
      for (let i = 0; i < n; i++) {
        refs.push(pool[cursor % pool.length]);
        cursor += 1;
      }
      days.push({
        date: formatYMD(t),
        day: DAYS[dow],
        term: term.id,
        termLabel: term.label,
        refs: refs,
      });
    }
  });
  return { days, passageCount: cursor, uniqueChapters: pool.length };
}

const built = build();
if (built.days.length !== 400) {
  console.error("Expected 400 weekdays, got", built.days.length);
  process.exit(1);
}

const dest = path.join(__dirname, "..", "..", "..", "js", "cod-1024-scriptures.js");
const payload = {
  prayer: "Tuesday night prayer · 10:00 PM WAT",
  rhythm: "Mon 1 · Tue 2 · Wed 1 · Thu 2 or 3 · Fri 1",
  days: built.days,
};
const src =
  "window.COD1024_SCRIPTURES = " +
  JSON.stringify(payload) +
  ";\n";
fs.writeFileSync(dest, src);
console.log(
  "Wrote",
  dest,
  "days",
  built.days.length,
  "passages",
  built.passageCount
);
