/**
 * Public API Caching Helper (Task C1 & Step 17)
 *
 * Unauthenticated GET requests receive:
 *   Cache-Control: public, max-age=15, s-maxage=30, stale-while-revalidate=60
 *
 * Authenticated requests (admin or wholesale/customer session cookie or Authorization header)
 * or cache-busting requests receive:
 *   Cache-Control: no-cache, no-store, must-revalidate, max-age=0
 *
 * Also sets Vary: Accept-Encoding, Cookie, Authorization so caching proxies and CDNs
 * never serve cached public responses to authenticated sessions.
 */
export function getPublicCacheHeaders(request?: Request): Record<string, string> {
  const noStoreHeaders = {
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Vary': 'Accept-Encoding, Cookie, Authorization',
  };

  if (!request) {
    return {
      'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=30',
      'Vary': 'Accept-Encoding, Cookie, Authorization',
    };
  }

  // 1. Check for Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    return noStoreHeaders;
  }

  // 2. Check for authenticated session cookies
  const cookieHeader = request.headers.get('cookie') || '';
  if (
    cookieHeader.includes('alhamd_admin_session') ||
    cookieHeader.includes('admin_session') ||
    cookieHeader.includes('alhamd_customer_session') ||
    cookieHeader.includes('wholesale_session')
  ) {
    return noStoreHeaders;
  }

  // 3. Check for explicit cache-busting parameters
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('fresh') === 'true' || url.searchParams.has('t')) {
      return noStoreHeaders;
    }
  } catch {}

  // 4. Return public CDN/browser caching headers
  return {
    'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=30',
    'Vary': 'Accept-Encoding, Cookie, Authorization',
  };
}

