'use strict';

/**
 * Probe the video codec of every video in the given gallery manifests via
 * ffprobe (over HTTPS, range requests) so we can drop clips that browsers
 * can't play (HEVC/H.265 etc.). Read-only — prints a report.
 *
 * Usage (from firebase/functions):
 *   node scripts/probeGalleryCodecs.js day2 day4
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const JS_DIR = path.join(__dirname, '../../../js');
// Codecs browsers (Chrome/Firefox/Edge on Windows) reliably play.
const PLAYABLE = new Set(['h264', 'avc1', 'vp8', 'vp9', 'av1']);

function parseManifest(day) {
  const file = path.join(JS_DIR, `gallery-${day}-manifest.js`);
  const raw = fs.readFileSync(file, 'utf8');
  const items = [];
  const re = /\{\s*"name":\s*"([^"]+)",\s*"type":\s*"([^"]+)",\s*"src":\s*"([^"]+)"\s*\}/g;
  let m;
  while ((m = re.exec(raw))) {
    items.push({ name: m[1], type: m[2], src: m[3] });
  }
  return items;
}

function probeCodec(url) {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name',
        '-of', 'default=nw=1:nk=1',
        url,
      ],
      { encoding: 'utf8', timeout: 120000 }
    );
    return out.trim().split(/\r?\n/)[0] || 'unknown';
  } catch (e) {
    return 'ERROR:' + (e.message || 'probe failed').slice(0, 60);
  }
}

function main() {
  const days = process.argv.slice(2);
  if (!days.length) {
    console.error('Pass day slugs, e.g. node scripts/probeGalleryCodecs.js day2 day4');
    process.exit(1);
  }
  const report = { playable: [], notPlayable: [] };

  for (const day of days) {
    const videos = parseManifest(day).filter((i) => i.type === 'video');
    console.log(`\n=== ${day} (${videos.length} videos) ===`);
    for (const v of videos) {
      const codec = probeCodec(v.src);
      const ok = PLAYABLE.has(String(codec).toLowerCase());
      console.log(`  ${ok ? 'OK ' : 'NO '} ${v.name}  codec=${codec}`);
      (ok ? report.playable : report.notPlayable).push({ day, name: v.name, codec });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Playable: ${report.playable.length}`);
  console.log(`Not playable (will be removed): ${report.notPlayable.length}`);
  report.notPlayable.forEach((r) => console.log(`   - ${r.day}/${r.name}  (${r.codec})`));
}

main();
