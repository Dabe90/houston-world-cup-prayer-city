/**
 * Records a page visit. Country comes from the request Cloudflare or Vercel
 * already tagged. The IP address is not stored.
 */
const FIRESTORE_URL =
  'https://firestore.googleapis.com/v1/projects/bible-study-dashboard-99f2d/databases/(default)/documents/site_visits?key=AIzaSyADAXaFx5trtfF9MaaceJ7FMKqvrVFN0JI';

const PATHS = { '/': 1, '/ng': 1, '/index.html': 1, '/ddbs-nig.html': 1 };
const NETS = { '': 1, 'slow-2g': 1, '2g': 1, '3g': 1, '4g': 1 };

function countryFrom(req) {
  var raw = String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : '';
}

function clampMs(value) {
  var n = Math.round(Number(value) || 0);
  if (n < 0) return 0;
  if (n > 120000) return 120000;
  return n;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('POST only');
    return;
  }
  var body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).end('Bad visit');
    return;
  }
  var path = String(body.path || '');
  var phase = body.phase === 'readable' ? 'readable' : body.phase === 'arrived' ? 'arrived' : '';
  var session = String(body.session || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  var screen = body.screen === 'phone' ? 'phone' : 'wide';
  var net = NETS[String(body.net || '')] ? String(body.net || '') : '';
  if (!PATHS[path] || !phase || !session) {
    res.status(400).end('Bad visit');
    return;
  }

  var fields = {
    path: { stringValue: path },
    phase: { stringValue: phase },
    country: { stringValue: countryFrom(req) },
    createdAt: { timestampValue: new Date().toISOString() },
    session: { stringValue: session },
    screen: { stringValue: screen },
    net: { stringValue: net },
    dcl: { integerValue: String(clampMs(body.dcl)) },
    resp: { integerValue: String(clampMs(body.resp)) },
  };

  try {
    var response = await fetch(FIRESTORE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: fields }),
    });
    if (!response.ok) {
      res.status(502).end('Not saved');
      return;
    }
  } catch (e) {
    res.status(502).end('Not saved');
    return;
  }
  res.status(204).end();
};
