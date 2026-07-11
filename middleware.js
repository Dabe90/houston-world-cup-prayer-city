/**
 * Geo routing for prayercityhtx.com root:
 * - Nigeria (NG) → ddbs-nig.html
 * - US / other → index.html (default)
 * Overrides: ?stay=us | ?stay=ng | prayer_city_region cookie
 *
 * IMPORTANT: always preserve the query string when redirecting. Email sign-in
 * links land on / with ?mode=signIn&oobCode=… — dropping those params breaks login.
 */
const REGION_COOKIE = 'prayer_city_region';
const MAX_AGE = 60 * 60 * 24 * 365;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(function (part) {
    const eq = part.indexOf('=');
    if (eq < 0) return;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  });
  return out;
}

function cookieLine(value, url) {
  var secure = url.protocol === 'https:' ? '; Secure' : '';
  return REGION_COOKIE + '=' + value + '; Path=/; Max-Age=' + MAX_AGE + '; SameSite=Lax' + secure;
}

function isRootPath(pathname) {
  return pathname === '/' || pathname === '/index.html';
}

function withSameQuery(dest, sourceUrl) {
  dest.search = sourceUrl.search;
  dest.hash = sourceUrl.hash;
  return dest;
}

export default function middleware(request) {
  const url = new URL(request.url);
  if (!isRootPath(url.pathname)) {
    return;
  }

  const stay = url.searchParams.get('stay');
  const cookies = parseCookies(request.headers.get('cookie'));
  let pref = cookies[REGION_COOKIE] || '';

  if (stay === 'us') pref = 'us';
  else if (stay === 'ng') pref = 'ng';

  const country =
    request.headers.get('cf-ipcountry') ||
    (request.geo && request.geo.country) ||
    request.headers.get('x-vercel-ip-country') ||
    '';

  const goNigeria = pref === 'ng' || (pref !== 'us' && country === 'NG');

  if (goNigeria) {
    const dest = withSameQuery(new URL('/ddbs-nig.html', url.origin), url);
    const headers = new Headers({ Location: dest.href });
    if (stay === 'ng' || pref === 'ng' || country === 'NG') {
      headers.append('Set-Cookie', cookieLine('ng', url));
    }
    return new Response(null, { status: 307, headers });
  }

  if (stay === 'us') {
    const dest = withSameQuery(new URL('/', url.origin), url);
    const headers = new Headers({ Location: dest.href });
    headers.append('Set-Cookie', cookieLine('us', url));
    return new Response(null, { status: 302, headers });
  }

  return;
}

export const config = {
  matcher: ['/', '/index.html'],
};
