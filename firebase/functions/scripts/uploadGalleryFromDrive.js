'use strict';

/**
 * Sort the photos/videos in a PUBLIC Google Drive folder into serve-day groups
 * by capture date, upload each group to Firebase Storage under gallery/<day>/,
 * and write js/gallery-<day>-manifest.js for each.
 *
 * Files already present in js/gallery-day1-manifest.js are skipped (so the
 * existing Day 1 set is never duplicated). Subfolders are scanned recursively.
 *
 * Auth uses the existing Firebase Admin service-account key, so no extra API key
 * is needed — but the Google Drive API must be enabled for the project, and the
 * folder must be shared "Anyone with the link" (Viewer) OR shared directly with
 * the service-account email (client_email in the JSON key file).
 *
 * Usage (from firebase/functions), PLAN first (no uploads):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="..\..\bible-study-dashboard-99f2d-firebase-adminsdk-fbsvc-acf38364bd.json"
 *   node scripts/uploadGalleryFromDrive.js --folder="<drive link>" --startDay=2
 *
 * Then COMMIT (download + upload + write manifests):
 *   node scripts/uploadGalleryFromDrive.js --folder="<drive link>" --startDay=2 --commit
 *
 * Flags:
 *   --folder    (required) Drive folder share link or raw folder id
 *   --startDay  (default 2) first day number to assign chronologically
 *   --titles    (optional) comma list of section titles, in day order,
 *               e.g. --titles="Day 2 — Jun 20,Day 3 — Jun 22"
 *   --commit    actually download + upload (omit for a dry-run plan)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');

const BUCKET = 'bible-study-dashboard-99f2d.firebasestorage.app';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const JS_DIR = path.join(__dirname, '../../../js');
const DAY1_MANIFEST = path.join(JS_DIR, 'gallery-day1-manifest.js');

// Never upload these: the logo, and the very large pro-camera clips (P1088*.MP4).
const SKIP_NAMES = new Set(['ddbs logo.jpg', 'ddbs logo.jpeg', 'ddbs logo.png']);
const SKIP_RE = /^p\d{5,}\.(mp4|mov)$/i;

function isSkipped(name) {
  const lower = String(name || '').trim().toLowerCase();
  if (SKIP_NAMES.has(lower)) return true;
  if (SKIP_RE.test(lower)) return true;
  return false;
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (arg.startsWith('--')) out[arg.slice(2)] = true;
  }
  return out;
}

function extractFolderId(input) {
  if (!input) return null;
  const cleaned = String(input).trim();
  const folderMatch = cleaned.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParam = cleaned.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(cleaned)) return cleaned;
  return null;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function mediaTypeFromMime(mimeType, name) {
  if (mimeType && mimeType.startsWith('image/')) return 'image';
  if (mimeType && mimeType.startsWith('video/')) return 'video';
  const lower = String(name || '').toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/.test(lower)) return 'image';
  if (/\.(mp4|mov|m4v|webm|avi)$/.test(lower)) return 'video';
  return 'other';
}

function contentType(mimeType, name) {
  if (mimeType && mimeType !== 'application/octet-stream' && mimeType !== FOLDER_MIME) return mimeType;
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.jpeg') || lower.endsWith('.jpg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}

function publicUrl(storagePath) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

function baseName(name) {
  return String(name || '').replace(/\.[^.]+$/, '').trim().toLowerCase();
}

// Pull the photo/video base names already published in Day 1 so we never dup them.
function loadDay1Names() {
  const names = new Set();
  try {
    const raw = fs.readFileSync(DAY1_MANIFEST, 'utf8');
    const re = /"name":\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(raw))) names.add(m[1].trim().toLowerCase());
  } catch (_) {
    /* no day1 manifest yet */
  }
  return names;
}

async function getAccessToken() {
  const auth = new GoogleAuth({ scopes: SCOPES });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse && tokenResponse.token;
  if (!token) throw new Error('Could not obtain an access token from the service account.');
  return token;
}

async function listChildren(folderId, token) {
  const files = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, imageMediaMetadata(time), videoMediaMetadata(durationMillis))',
      pageSize: '1000',
      orderBy: 'name_natural',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive list failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    (data.files || []).forEach((f) => files.push(f));
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return files;
}

async function listRecursive(folderId, token, depth = 0) {
  const out = [];
  const children = await listChildren(folderId, token);
  for (const child of children) {
    if (child.mimeType === FOLDER_MIME) {
      if (depth < 5) {
        const nested = await listRecursive(child.id, token, depth + 1);
        nested.forEach((n) => out.push(n));
      }
    } else {
      out.push(child);
    }
  }
  return out;
}

// Best-available capture date. Photos carry EXIF time; videos fall back to
// createdTime (when shot/added), then modifiedTime.
function captureDate(file) {
  const exif = file.imageMediaMetadata && file.imageMediaMetadata.time;
  if (exif) {
    const m = exif.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const fallback = file.createdTime || file.modifiedTime;
  if (fallback) return String(fallback).slice(0, 10);
  return 'unknown';
}

async function downloadDriveFile(fileId, token, destPath) {
  const params = new URLSearchParams({ alt: 'media', supportsAllDrives: 'true' });
  const res = await fetch(`${DRIVE_API}/files/${fileId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed (${res.status}): ${await res.text()}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
  return fs.statSync(destPath).size;
}

function fmtMB(bytes) {
  return `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const args = parseArgs(process.argv);
  const folderId = extractFolderId(args.folder);
  if (!folderId) {
    console.error('Missing or invalid --folder. Pass a Drive folder share link or id.');
    process.exit(1);
  }
  const startDay = args.startDay != null ? Number(args.startDay) : 2;
  const titleOverrides = args.titles ? String(args.titles).split(',').map((s) => s.trim()) : [];
  const commit = !!args.commit;

  if (!admin.apps.length) admin.initializeApp({ storageBucket: BUCKET });

  console.log('Authenticating to Google Drive...');
  const token = await getAccessToken();

  console.log('Scanning folder (recursive)', folderId, '...');
  const all = await listRecursive(folderId, token);
  const media = all.filter((f) => mediaTypeFromMime(f.mimeType, f.name) !== 'other');

  const day1Names = loadDay1Names();
  const notDay1 = media.filter((f) => !day1Names.has(baseName(f.name)));
  const afterSkip = notDay1.filter((f) => !isSkipped(f.name));

  // Deterministic order (by capture date, then name) so dedupe keeps the earliest copy.
  afterSkip.sort((a, b) => {
    const ca = captureDate(a);
    const cb = captureDate(b);
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  const seen = new Set();
  const fresh = [];
  for (const f of afterSkip) {
    const bn = baseName(f.name);
    if (seen.has(bn)) continue;
    seen.add(bn);
    fresh.push(f);
  }

  const alreadyDay1 = media.length - notDay1.length;
  const skippedBigOrLogo = notDay1.length - afterSkip.length;
  const dupRemoved = afterSkip.length - fresh.length;

  console.log(
    `Found ${all.length} entries, ${media.length} photos/videos.\n` +
      `  ${alreadyDay1} already in Day 1, ${skippedBigOrLogo} skipped (logo / large pro-camera), ` +
      `${dupRemoved} duplicate names removed, ${fresh.length} to upload.`
  );
  if (!fresh.length) {
    console.log('Nothing new to upload.');
    return;
  }

  // Group new files by capture date, then order dates chronologically.
  const byDate = new Map();
  for (const f of fresh) {
    const key = captureDate(f);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(f);
  }
  const dateKeys = Array.from(byDate.keys()).sort();

  // Assign each date group to a sequential day number.
  const groups = dateKeys.map((dateKey, i) => {
    const dayNum = startDay + i;
    const items = byDate.get(dateKey);
    const images = items.filter((f) => mediaTypeFromMime(f.mimeType, f.name) === 'image');
    const videos = items.filter((f) => mediaTypeFromMime(f.mimeType, f.name) === 'video');
    const bytes = items.reduce((s, f) => s + Number(f.size || 0), 0);
    return { dayNum, day: `day${dayNum}`, dateKey, items, images, videos, bytes };
  });

  // ---- Print the plan ----
  console.log('\n=== PROPOSED GROUPING ===');
  for (const g of groups) {
    const titleIdx = g.dayNum - startDay;
    const title = titleOverrides[titleIdx] || `Day ${g.dayNum} — ${g.dateKey}`;
    console.log(
      `\n${g.day}  (${title})  [capture date ${g.dateKey}]  ` +
        `${g.images.length} photos, ${g.videos.length} videos, ${fmtMB(g.bytes)}`
    );
    for (const f of g.items) {
      console.log(`   - ${f.name}  (${fmtMB(f.size)})`);
    }
  }
  const totalBytes = groups.reduce((s, g) => s + g.bytes, 0);
  console.log(`\nTOTAL new upload: ${fresh.length} files, ${fmtMB(totalBytes)} across ${groups.length} day(s).`);

  if (!commit) {
    console.log('\nDRY RUN — no files uploaded. Re-run with --commit to upload and write manifests.');
    return;
  }

  // ---- Commit: download from Drive, upload to Storage, write manifests ----
  const bucket = admin.storage().bucket();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-gallery-'));

  for (const g of groups) {
    const manifestItems = [];
    console.log(`\n--- Uploading ${g.day} (${g.items.length} files) ---`);
    for (const f of g.items) {
      const type = mediaTypeFromMime(f.mimeType, f.name);
      const localPath = path.join(tmpDir, f.name);
      process.stdout.write(`  ${f.name} ... downloading `);
      const size = await downloadDriveFile(f.id, token, localPath);
      process.stdout.write(`${fmtMB(size)}; uploading `);
      const dest = `gallery/${g.day}/${f.name}`;
      await bucket.upload(localPath, {
        destination: dest,
        metadata: {
          contentType: contentType(f.mimeType, f.name),
          cacheControl: 'public, max-age=31536000, immutable',
        },
        resumable: size > 8 * 1024 * 1024,
      });
      try {
        await bucket.file(dest).makePublic();
      } catch (_) {
        /* public read via storage.rules */
      }
      fs.unlinkSync(localPath);
      console.log('done');
      manifestItems.push({ name: f.name.replace(/\.[^.]+$/, ''), type, src: publicUrl(dest) });
    }

    manifestItems.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'image' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    const titleIdx = g.dayNum - startDay;
    const title = titleOverrides[titleIdx] || `Day ${g.dayNum} — ${g.dateKey}`;
    const dayObj = { id: g.day, title, order: g.dayNum, items: manifestItems };
    const out = path.join(JS_DIR, `gallery-${g.day}-manifest.js`);
    const js =
      `/** Auto-generated by firebase/functions/scripts/uploadGalleryFromDrive.js (folder ${folderId}) */\n` +
      '(window.PRAYER_CITY_GALLERY_DAYS = window.PRAYER_CITY_GALLERY_DAYS || []).push(' +
      JSON.stringify(dayObj, null, 2) +
      ');\n';
    fs.writeFileSync(out, js, 'utf8');
    console.log(`Wrote ${out}  (${manifestItems.length} items)`);
  }

  try {
    fs.rmdirSync(tmpDir);
  } catch (_) {
    /* harmless */
  }

  console.log('\nDONE. Remember to add a <script src="js/gallery-dayN-manifest.js"></script> tag');
  console.log('to gallery.html for each new day (before js/gallery.js), then deploy.');
}

main().catch((e) => {
  console.error('\nFAILED:', e.message || e);
  console.error('\nTroubleshooting:');
  console.error('  - Make sure the Drive folder is shared "Anyone with the link" (Viewer).');
  console.error('  - Make sure the Google Drive API is enabled for project bible-study-dashboard-99f2d.');
  console.error('  - Or share the folder directly with the service-account email (client_email in the key JSON).');
  process.exit(1);
});
