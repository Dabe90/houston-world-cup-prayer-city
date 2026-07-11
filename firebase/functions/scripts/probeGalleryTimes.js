'use strict';

/**
 * Probe the REAL recording timestamp of every video in the given gallery
 * manifests via ffprobe (reads QuickTime/MP4 metadata over HTTPS). Google Drive
 * does not expose video capture time, but the file metadata does.
 *
 * Prefers Apple's local-time tag (com.apple.quicktime.creationdate, which has a
 * timezone offset); falls back to creation_time (UTC) converted to Houston time
 * (CDT, UTC-5 in June). Classifies each clip as day or night.
 *
 * Read-only — prints a report. Usage (from firebase/functions):
 *   node scripts/probeGalleryTimes.js day2 day4
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const JS_DIR = path.join(__dirname, '../../../js');
const HOUSTON_OFFSET_HOURS = -5; // CDT in June
const NIGHT_START_HOUR = 17; // 5:00 PM local and later = night/evening

function parseManifest(day) {
  const file = path.join(JS_DIR, `gallery-${day}-manifest.js`);
  const raw = fs.readFileSync(file, 'utf8');
  const items = [];
  const re = /\{\s*"name":\s*"([^"]+)",\s*"type":\s*"([^"]+)",\s*"src":\s*"([^"]+)"\s*\}/g;
  let m;
  while ((m = re.exec(raw))) items.push({ name: m[1], type: m[2], src: m[3] });
  return items;
}

function probeTags(url) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', url],
      { encoding: 'utf8', timeout: 120000 }
    );
    const parsed = JSON.parse(out);
    return (parsed.format && parsed.format.tags) || {};
  } catch (e) {
    return { _error: (e.message || 'probe failed').slice(0, 60) };
  }
}

// Returns { iso, localDate, localHour } in Houston local time, or null.
function resolveLocalTime(tags) {
  const apple = tags['com.apple.quicktime.creationdate'];
  if (apple) {
    // e.g. 2026-06-26T20:15:30-0500  (already local with offset)
    const m = apple.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      return { iso: apple, localDate: `${m[1]}-${m[2]}-${m[3]}`, localHour: Number(m[4]) };
    }
  }
  const utc = tags.creation_time;
  if (utc) {
    const d = new Date(utc);
    if (!isNaN(d.getTime())) {
      const local = new Date(d.getTime() + HOUSTON_OFFSET_HOURS * 3600 * 1000);
      const localDate = local.toISOString().slice(0, 10);
      return { iso: local.toISOString(), localDate, localHour: local.getUTCHours() };
    }
  }
  return null;
}

function main() {
  const days = process.argv.slice(2);
  if (!days.length) {
    console.error('Pass day slugs, e.g. node scripts/probeGalleryTimes.js day2 day4');
    process.exit(1);
  }

  const rows = [];
  for (const day of days) {
    const videos = parseManifest(day).filter((i) => i.type === 'video');
    console.log(`\n=== ${day} (${videos.length} videos) ===`);
    for (const v of videos) {
      const tags = probeTags(v.src);
      const t = resolveLocalTime(tags);
      const night = t ? t.localHour >= NIGHT_START_HOUR : false;
      const label = !t ? 'UNKNOWN' : night ? 'NIGHT' : 'day';
      const when = t ? `${t.localDate} ${String(t.localHour).padStart(2, '0')}:00 local` : '(no timestamp)';
      console.log(`  ${label.padEnd(7)} ${v.name.padEnd(16)} ${when}`);
      rows.push({ day, name: v.name, localDate: t && t.localDate, localHour: t && t.localHour, night, hasTime: !!t });
    }
  }

  const night = rows.filter((r) => r.night);
  const dayLit = rows.filter((r) => r.hasTime && !r.night);
  const unknown = rows.filter((r) => !r.hasTime);

  console.log('\n=== SUMMARY ===');
  console.log(`Night videos (-> Day 5): ${night.length}`);
  night.forEach((r) => console.log(`   - ${r.day}/${r.name}  ${r.localDate} ${String(r.localHour).padStart(2, '0')}h`));
  console.log(`Daytime videos: ${dayLit.length}`);
  console.log(`No timestamp found: ${unknown.length}`);
  unknown.forEach((r) => console.log(`   - ${r.day}/${r.name}`));

  // Distinct local dates among all timestamped videos, for sanity.
  const dates = {};
  rows.filter((r) => r.hasTime).forEach((r) => {
    dates[r.localDate] = (dates[r.localDate] || 0) + 1;
  });
  console.log('\nDistinct capture dates:', JSON.stringify(dates));
}

main();
