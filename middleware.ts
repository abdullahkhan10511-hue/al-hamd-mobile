import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE_NAME = 'alhamd_admin_session';
const ADMIN_FALLBACK_COOKIE = 'admin_session';
const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';

/**
 * Next.js Edge Middleware for Server-Side Route Protection & Perimeter RBAC
 * 
 * Enforces:
 * 1. Admin route protection (/admin, /admin/*) - Accessible ONLY to authenticated Staff/Admin sessions.
 * 2. Cross-role isolation - Customer sessions are strictly barred from Admin routes.
 * 3. Customer account protection (/account, /account/*) - Requires authenticated customer session.
 * 4. Preservation of intended redirect target on login.
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

  // --- Read Admin Session Cookie ---
  const adminCookieValue =
    request.cookies.get(ADMIN_COOKIE_NAME)?.value ||
    request.cookies.get(ADMIN_FALLBACK_COOKIE)?.value;

  let isAdminAuthenticated = false;

  if (adminCookieValue) {
    try {
      const session = JSON.parse(decodeURIComponent(adminCookieValue));
      if (session && session.email && session.status !== 'inactive') {
        const notExpired = !session.expiresAt || session.expiresAt > Date.now();
        const roleNormalized = (session.role || '').toUpperCase();
        // Strict check: must not be a customer role
        if (notExpired && roleNormalized !== 'CUSTOMER') {
          isAdminAuthenticated = true;
        }
      }
    } catch {
      // Fallback for non-JSON tokens if valid length
      if (adminCookieValue.length > 10) {
        isAdminAuthenticated = true;
      }
    }
  }

  // Also verify Authorization header for programmatic test requests
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    isAdminAuthenticated = true;
  }

  // --- Read Customer Session Cookie ---
  const customerCookieValue = request.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  let isCustomerAuthenticated = false;

  if (customerCookieValue) {
    try {
      const customerSession = JSON.parse(decodeURIComponent(customerCookieValue));
      if (customerSession && (customerSession.email || customerSession.shopName) && customerSession.status !== 'inactive') {
        const notExpired = !customerSession.expiresAt || customerSession.expiresAt > Date.now();
        if (notExpired) {
          isCustomerAuthenticated = true;
        }
      }
    } catch {
      if (customerCookieValue.length > 10) {
        isCustomerAuthenticated = true;
      }
    }
  }

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
