import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE_NAME = 'alhamd_admin_session';
const ADMIN_FALLBACK_COOKIE = 'admin_session';
const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';

function parseValidAdminSession(raw: string | undefined): boolean {
  if (!raw) return false;
  let curr = raw.trim();
  if (curr.startsWith('"') && curr.endsWith('"') && curr.length > 2) {
    curr = curr.slice(1, -1);
  }

  for (let i = 0; i < 4; i++) {
    try {
      const session = JSON.parse(curr);
      if (typeof session === 'string') {
        curr = session;
        continue;
      }
      if (
        session &&
        typeof session === 'object' &&
        typeof session.email === 'string' &&
        session.email.includes('@') &&
        session.status !== 'inactive'
      ) {
        const notExpired = Boolean(
          session.expiresAt &&
            typeof session.expiresAt === 'number' &&
            session.expiresAt > Date.now()
        );
        const roleNormalized = (session.role || '').toUpperCase();
        if (
          notExpired &&
          roleNormalized !== 'CUSTOMER' &&
          (session.isOwner ||
            roleNormalized === 'ADMIN' ||
            roleNormalized === 'SUPER_ADMIN' ||
            roleNormalized === 'OWNER' ||
            roleNormalized === 'STAFF' ||
            roleNormalized === 'MANAGER')
        ) {
          return true;
        }
      }
      return false;
    } catch {
      try {
        const decoded = decodeURIComponent(curr);
        if (decoded === curr) break;
        curr = decoded;
      } catch {
        break;
      }
    }
  }
  return false;
}

function parseValidCustomerSession(raw: string | undefined): boolean {
  if (!raw) return false;
  let curr = raw.trim();
  for (let i = 0; i < 3; i++) {
    try {
      const customerSession = JSON.parse(curr);
      if (
        customerSession &&
        typeof customerSession === 'object' &&
        (customerSession.email || customerSession.shopName) &&
        customerSession.status !== 'inactive'
      ) {
        const notExpired =
          !customerSession.expiresAt ||
          typeof customerSession.expiresAt !== 'number' ||
          customerSession.expiresAt > Date.now();
        if (notExpired) {
          return true;
        }
      }
      return false;
    } catch {
      try {
        const decoded = decodeURIComponent(curr);
        if (decoded === curr) break;
        curr = decoded;
      } catch {
        break;
      }
    }
  }
  return false;
}

/**
 * Next.js Edge Middleware for Server-Side Route Protection & Perimeter RBAC
 * 
 * Enforces:
 * 1. Admin route protection (/admin, /admin/*) - Accessible ONLY to verified authenticated Staff/Admin sessions.
 * 2. Cross-role isolation - Customer sessions are strictly barred from Admin routes.
 * 3. Customer account protection (/account, /account/*) - Requires authenticated customer session.
 * 4. Token validation - Rejects arbitrary, unverified Bearer tokens or non-session cookies.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, API routes, and internal next requests
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // --- Validate Admin Session (Cookies and authorized Bearer tokens) ---
  const adminCookieValue =
    request.cookies.get(ADMIN_COOKIE_NAME)?.value ||
    request.cookies.get(ADMIN_FALLBACK_COOKIE)?.value;

  let isAdminAuthenticated = parseValidAdminSession(adminCookieValue);

  const authHeader = request.headers.get('authorization');
  if (!isAdminAuthenticated && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      isAdminAuthenticated = parseValidAdminSession(token);
    }
  }

  // --- Validate Customer Session Cookie ---
  const customerCookieValue = request.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  const isCustomerAuthenticated = parseValidCustomerSession(customerCookieValue);

  // =========================================================================
  // 1. ADMIN ROUTES (/admin, /admin/*)
  // =========================================================================
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    // 1A: On /admin/login page
    if (pathname === '/admin/login') {
      if (isAdminAuthenticated) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.next();
    }

    // 1B: If user is logged in ONLY as a Customer and attempts to access Admin Panel
    if (!isAdminAuthenticated && isCustomerAuthenticated) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('error', 'customer_unauthorized');
      return NextResponse.redirect(loginUrl);
    }

    // 1C: Unauthenticated user accessing protected Admin routes
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
  // 2. CUSTOMER ACCOUNT ROUTES (/account, /account/*)
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
  matcher: ['/admin', '/admin/:path*', '/account', '/account/:path*'],
};
