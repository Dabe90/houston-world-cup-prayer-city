'use strict';

/**
 * One-off: print the EXIF capture time of image files in the Drive folder.
 * Read-only. Usage (from firebase/functions):
 *   node scripts/drivePhotoTimes.js --folder="<drive link>"
 */

const { GoogleAuth } = require('google-auth-library');

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function extractFolderId(input) {
  const m = String(input || '').match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  const id = String(input || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return id ? id[1] : String(input || '').trim();
}

async function token() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  const c = await auth.getClient();
  const t = await c.getAccessToken();
  return typeof t === 'string' ? t : t.token;
}

async function listChildren(folderId, tok) {
  const files = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, imageMediaMetadata(time))',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const data = await res.json();
    (data.files || []).forEach((f) => files.push(f));
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return files;
}

async function recurse(folderId, tok, depth = 0) {
  const out = [];
  for (const c of await listChildren(folderId, tok)) {
    if (c.mimeType === FOLDER_MIME) {
      if (depth < 5) (await recurse(c.id, tok, depth + 1)).forEach((x) => out.push(x));
    } else out.push(c);
  }
  return out;
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--folder='));
  const folderId = extractFolderId(arg ? arg.split('=')[1] : '');
  const tok = await token();
  const all = await recurse(folderId, tok);
  const images = all.filter((f) => (f.mimeType || '').startsWith('image/') || /\.(jpe?g|png|heic)$/i.test(f.name));
  images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const f of images) {
    const time = f.imageMediaMetadata && f.imageMediaMetadata.time;
    console.log(`${f.name.padEnd(24)} ${time || '(no EXIF time)'}`);
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message || e);
  process.exit(1);
});
