/**
 * Root-only helpers for prayercityhtx.com:
 * - No geo auto-routing (everyone lands on the US hub at /)
 * - Explicit ?stay=ng → /ng (Nigeria hub)
 * - Explicit ?stay=us → stay on / and remember US preference
 *
 * IMPORTANT: always preserve the query string when redirecting. Email sign-in
 * links land on / with ?mode=signIn&oobCode=… — dropping those params breaks login.
 */
const REGION_COOKIE = 'prayer_city_region';
const MAX_AGE = 60 * 60 * 24 * 365;

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

  // Explicit choice only — never redirect by IP / country.
  if (stay === 'ng') {
    const dest = withSameQuery(new URL('/ng', url.origin), url);
    dest.searchParams.delete('stay');
    const headers = new Headers({ Location: dest.href });
    headers.append('Set-Cookie', cookieLine('ng', url));
    return new Response(null, { status: 302, headers });
  }

  // Keep ?stay=us on the page so client JS can remember US and not bounce
  // signed-in Nigeria volunteers back to /ng.
  if (stay === 'us') {
    return;
  }

  return;
}

export const config = {
  matcher: ['/', '/index.html'],
};
