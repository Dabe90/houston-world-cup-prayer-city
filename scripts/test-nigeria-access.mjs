/**
 * Unsigned-visitor first paint: page must show words even if Google/Firebase/CDN are blocked.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const BLOCK = /google|gstatic|googleapis|cloudfunctions|firebaseio|tailwindcss\.com|cdnjs|unsplash|facebook|instagram|tiktok/i;

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/ng' || urlPath === '/ng/') urlPath = '/ng-open.html';
      if (urlPath === '/ng-hub' || urlPath === '/ng-hub/') urlPath = '/ddbs-nig.html';
      if (urlPath === '/') urlPath = '/index.html';
      const file = path.normalize(path.join(root, urlPath.replace(/^\/+/, '')));
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': contentType(file) });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
    server.on('error', reject);
  });
}

async function loadPuppeteer() {
  const require = createRequire(import.meta.url);
  try {
    return require(path.join(root, 'node_modules', 'puppeteer-core'));
  } catch (e) {
    throw new Error('puppeteer-core missing');
  }
}

async function openPage(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.startsWith('http://127.0.0.1') || u.startsWith('http://localhost')) {
      req.continue();
      return;
    }
    if (BLOCK.test(u)) {
      req.abort();
      return;
    }
    req.continue();
  });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1200));
  const info = await page.evaluate(() => {
    const body = document.body;
    const text = (body && body.innerText) || '';
    const landing = document.getElementById('ng-public-landing');
    const dash = document.getElementById('dash-shell');
    const auth = document.getElementById('auth-panel');
    const bar = text.indexOf('Dear Daughter Nigeria') >= 0;
    const headline = text.indexOf('undiluted Word') >= 0;
    const started = text.indexOf("Here's how to get started") >= 0 || text.indexOf('how to get started') >= 0;
    const nigeriaBanner = text.indexOf('Joining from Nigeria') >= 0;
    const march = text.indexOf('Jesus March Houston') >= 0;
    return {
      textLen: text.replace(/\s+/g, ' ').trim().length,
      bar,
      headline,
      started,
      nigeriaBanner,
      march,
      landingHidden: !!(landing && landing.classList.contains('hidden')),
      dashHidden: !dash || dash.classList.contains('hidden'),
      authHidden: !auth || auth.classList.contains('hidden'),
      bootDash: document.documentElement.classList.contains('ddbs-hub-boot-dash'),
      sample: text.replace(/\s+/g, ' ').trim().slice(0, 180),
    };
  });
  await page.close();
  return { info, errors };
}

function assert(ok, msg, failures) {
  if (!ok) failures.push(msg);
}

async function main() {
  const puppeteer = await loadPuppeteer();
  const { server, port } = await startServer();
  const base = 'http://127.0.0.1:' + port;
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const failures = [];
  try {
    const ng = await openPage(browser, base + '/ng');
    assert(ng.info.textLen > 200, 'Nigeria /ng has almost no text (' + ng.info.textLen + '): ' + ng.info.sample, failures);
    assert(ng.info.bar, 'Nigeria bar missing', failures);
    assert(ng.info.sample.indexOf('You are on the Nigeria page') >= 0, 'Lite homepage copy missing', failures);

    const clickPage = await browser.newPage();
    await clickPage.setViewport({ width: 390, height: 844, isMobile: true });
    await clickPage.setRequestInterception(true);
    clickPage.on('request', (req) => {
      const u = req.url();
      if (u.startsWith('http://127.0.0.1')) req.continue();
      else if (BLOCK.test(u)) req.abort();
      else req.continue();
    });
    await clickPage.goto(base + '/ng', { waitUntil: 'domcontentloaded', timeout: 20000 });
    const afterClick = await clickPage.evaluate(() => {
      const text = (document.body.innerText || '').replace(/\s+/g, ' ');
      return {
        textLen: text.trim().length,
        stillNigeria: text.indexOf('Dear Daughter Nigeria') >= 0,
        signIn: !!document.getElementById('btn-in'),
      };
    });
    await clickPage.close();
    assert(afterClick.stillNigeria && afterClick.textLen > 200 && afterClick.signIn, 'Lite page blanked', failures);

    const htmlOnly = await browser.newPage();
    await htmlOnly.setViewport({ width: 390, height: 844, isMobile: true });
    await htmlOnly.setRequestInterception(true);
    htmlOnly.on('request', (req) => {
      const u = req.url();
      if (u === base + '/ng' || u === base + '/ng/') req.continue();
      else req.abort();
    });
    await htmlOnly.goto(base + '/ng', { waitUntil: 'domcontentloaded', timeout: 20000 });
    const htmlOnlyInfo = await htmlOnly.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim());
    await htmlOnly.close();
    assert(
      htmlOnlyInfo.indexOf('You are on the Nigeria page') >= 0,
      'HTML-only /ng was blank: ' + htmlOnlyInfo.slice(0, 160),
      failures
    );

    const slash = await openPage(browser, base + '/ng/');
    assert(slash.info.headline || slash.info.bar, '/ng/ did not show the Nigeria page', failures);

    const home = await openPage(browser, base + '/');
    assert(home.info.textLen > 200, 'US home has almost no text (' + home.info.textLen + '): ' + home.info.sample, failures);
    assert(home.info.nigeriaBanner, 'US home missing Nigeria banner', failures);
    assert(home.info.march, 'US home missing Jesus March Houston', failures);

    console.log(JSON.stringify({ ng: ng.info, slash: slash.info, home: home.info, ngErrors: ng.errors, homeErrors: home.errors }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS unsigned visitor can read /ng, /ng/, and / with Google blocked');
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err));
  process.exit(1);
});
