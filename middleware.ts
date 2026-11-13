import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { verifySignedSessionToken, verifySignedCustomerToken } from '@/lib/db/sessionToken';
import { assertSameOrigin } from '@/lib/security/csrf';

const ADMIN_COOKIE_NAME = 'alhamd_admin_session';
const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';

function parseValidAdminSession(raw: string | undefined): boolean {
  if (!raw) return false;
  let curr = raw.trim();
  if (curr.startsWith('"') && curr.endsWith('"') && curr.length > 2) {
    curr = curr.slice(1, -1);
  }

  let payload = verifySignedSessionToken(curr);
  if (!payload && curr.includes('%')) {
    try {
      payload = verifySignedSessionToken(decodeURIComponent(curr));
    } catch { }
  }
  if (!payload) return false;

  const role = (payload.role || '').toUpperCase();
  if (role === 'CUSTOMER') return false;

  return Boolean(payload.email && payload.exp > Date.now());
}

function parseValidCustomerSession(raw: string | undefined): boolean {
  if (!raw) return false;
  let curr = raw.trim();
  if (curr.startsWith('"') && curr.endsWith('"') && curr.length > 2) {
    curr = curr.slice(1, -1);
  }
  if (curr.includes('%')) {
    try {
      curr = decodeURIComponent(curr);
    } catch { }
  }

  // Task S5.4: Strictly verify the HMAC-signed customer token (Edge-compatible)
  // Unsigned JSON cookies or forged tokens immediately return null and are rejected
  const payload = verifySignedCustomerToken(curr);
  if (!payload || payload.typ !== 'customer') {
    return false;
  }

  return Boolean(payload.sub && payload.exp > Date.now());
}

/**
 * Next.js Edge Middleware for Server-Side Route Protection, CSRF Defense & Perimeter RBAC
 *
 * Enforces:
 * 1. Global CSRF protection for all mutating requests (POST, PUT, PATCH, DELETE) across /api/* and pages.
 * 2. Admin route protection (/admin, /admin/*) - Accessible ONLY to verified authenticated Staff/Admin sessions.
 * 3. Cross-role isolation - Customer sessions are strictly barred from Admin routes.
 * 4. Customer account protection (/account, /account/*) - Requires authenticated customer session.
 * 5. Strict session cookies - Rejects arbitrary, unverified tokens or non-session cookies.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // =========================================================================
  // 1. GLOBAL CSRF DEFENSE (Task S13)
  // Evaluated for every state-changing request BEFORE skipping /api routes
  // =========================================================================
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      console.warn(`[CSRF BLOCKED] Mutating ${method} ${pathname} rejected: ${csrfCheck.reason}`);
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
  }

  // Skip static assets, API routes (after CSRF verification), and internal next requests
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // --- Validate Admin Session from Authoritative Cookie (Task S9) ---
  const adminCookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAdminAuthenticated = parseValidAdminSession(adminCookieValue);

  // --- Validate Customer Session Cookie from Signed Token (Task S5) ---
  const customerCookieValue = request.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  const isCustomerAuthenticated = parseValidCustomerSession(customerCookieValue);

  // =========================================================================
  // 2. ADMIN ROUTES (/admin, /admin/*)
  // =========================================================================
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    // 2A: On /admin/login page
    if (pathname === '/admin/login') {
      if (isAdminAuthenticated) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.next();
    }

    // 2B: If user is logged in ONLY as a Customer and attempts to access Admin Panel
    if (!isAdminAuthenticated && isCustomerAuthenticated) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('error', 'customer_unauthorized');
      return NextResponse.redirect(loginUrl);
    }

    // 2C: Unauthenticated user accessing protected Admin routes
    if (!isAdminAuthenticated) {
      const loginUrl = new URL('/admin/login', request.url);
      if (pathname !== '/admin' && pathname !== '/admin/dashboard') {
        loginUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // =========================================================================
  // 3. CUSTOMER ACCOUNT ROUTES (/account, /account/*)
  // =========================================================================
  if (pathname === '/account' || pathname.startsWith('/account/')) {
    // Whitelist public redirect helper routes
    if (pathname === '/account/login' || pathname === '/account/register') {
      return NextResponse.next();
    }

    // Must have active customer or admin session
    if (!isCustomerAuthenticated && !isAdminAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/account', '/account/:path*', '/api/:path*'],
};
