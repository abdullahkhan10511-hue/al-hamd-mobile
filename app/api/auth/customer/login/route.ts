import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  authenticateCustomerServer,
  sanitizeCustomer,
} from '@/lib/db/customers-server';
import {
  getServerStaffByEmail,
  verifyServerPassword,
  generateServerSalt,
  hashServerPassword,
} from '@/lib/db/staff-server';
import { getStaffByEmail, INITIAL_STAFF_USERS } from '@/lib/db/staff';
import { isKnownWeakHash } from '@/lib/security/knownWeakHashes';
import { verifyPassword } from '@/lib/crypto';
import { canAccessAdminRoute } from '@/lib/db/admins';
import { ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS } from '@/lib/constants/permissions';
import { createSignedSessionToken, createSignedCustomerToken } from '@/lib/db/sessionToken';
import { StaffUser } from '@/types/admin';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';

const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';
const ADMIN_COOKIE_NAME = 'alhamd_admin_session';

import { checkRateLimit, getClientIp, createRateLimitResponse, resetRateLimit } from '@/lib/rateLimit';
import { verifyUserPasswordUnified, runDummyPasswordComputation } from '@/lib/security/password';
import { logActivity } from '@/lib/db/repositories/activity';

/**
 * Resolves an authoritative, safe redirection target for authenticated staff members.
 * Strictly prevents open-redirect attacks and verifies target permissions.
 */
function resolveSafeStaffRedirect(
  staffUser: StaffUser,
  requestedRedirect?: string | null
): string {
  // 1. Validate requested redirect if provided (e.g. from query params or body)
  if (requestedRedirect && typeof requestedRedirect === 'string') {
    const clean = requestedRedirect.trim();
    const isSafeRelative =
      clean.startsWith('/') &&
      !clean.startsWith('//') &&
      !clean.startsWith('/\\') &&
      !clean.includes('://') &&
      !clean.includes('\\');

    if (isSafeRelative && clean.startsWith('/admin')) {
      if (clean !== '/admin/login' && !clean.startsWith('/admin/login?')) {
        if (canAccessAdminRoute(staffUser, clean)) {
          return clean;
        }
      }
    }
  }

  // 2. Super Admin or Owner default destination
  const isSuperOrAdmin =
    Boolean(staffUser.isOwner) ||
    staffUser.role === 'SUPER_ADMIN' ||
    staffUser.role === 'ADMIN' ||
    staffUser.role === 'OWNER';

  if (isSuperOrAdmin) {
    return '/admin/dashboard';
  }

  // 3. Module-specific primary landing page for specialized staff roles
  const perms = Array.isArray(staffUser.permissions) ? staffUser.permissions : [];
  const has = (k: string) => perms.includes('*') || perms.includes(k);

  const roleLower = (staffUser.role || '').toLowerCase();
  if (roleLower.includes('inventory') && has('inventory.view')) {
    return '/admin/inventory';
  }
  if (roleLower.includes('order') && has('orders.view')) {
    return '/admin/orders';
  }
  if (roleLower.includes('product') && has('products.view')) {
    return '/admin/products';
  }

  if (canAccessAdminRoute(staffUser, '/admin/dashboard')) {
    return '/admin/dashboard';
  }

  if (has('orders.view')) return '/admin/orders';
  if (has('inventory.view')) return '/admin/inventory';
  if (has('products.view')) return '/admin/products';
  if (has('pos.view')) return '/admin/pos';
  if (has('wholesale.manage')) return '/admin/wholesale';
  if (has('categories.view')) return '/admin/categories';
  if (has('customers.view')) return '/admin/customers';

  return '/admin/dashboard';
}

export async function POST(request: NextRequest) {
  let identifier = '';
  let enteredPassword = '';
  try {
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }

    const body = await request.json();
    const { email, password, shopName, identifier: reqIdentifier, redirect: reqRedirect } = body;
    enteredPassword = password;

    identifier = (reqIdentifier || shopName || email || '').trim();
    if (!identifier || !password) {
      const isEmail = identifier.includes('@');
      return NextResponse.json(
        {
          success: false,
          error: isEmail
            ? 'Please enter both your email address and password.'
            : 'Please enter both your shop name and password.',
        },
        { status: 400 }
      );
    }

    const normalizedIdentifier = identifier.toLowerCase();
    const ip = getClientIp(request);

    // S7 Rate Limiting: 20 per 15 mins per IP, 5 per 15 mins per identifier
    const ipRate = await checkRateLimit(`customer_login_ip_${ip}`, 20, 15 * 60 * 1000);
    if (!ipRate.allowed) {
      await logActivity({
        adminEmail: 'anonymous',
        action: 'RATE_LIMIT_EXCEEDED',
        target: 'customer_login_ip',
        details: `IP rate limit exceeded (${ip})`,
      });
      return createRateLimitResponse(ipRate.retryAfterSeconds, 'Too many login attempts from this network.');
    }

    const idRate = await checkRateLimit(`customer_login_id_${normalizedIdentifier}`, 5, 15 * 60 * 1000);
    if (!idRate.allowed) {
      await logActivity({
        adminEmail: normalizedIdentifier,
        action: 'RATE_LIMIT_EXCEEDED',
        target: 'customer_login_id',
        details: `Identifier rate limit exceeded from IP: ${ip}`,
      });
      return createRateLimitResponse(idRate.retryAfterSeconds, 'Too many failed login attempts for this account.');
    }

    // 1. Check environment variable override for server-side admin setup
    const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envAdminPassword = process.env.ADMIN_PASSWORD;

    let isAuthenticatedViaEnv = false;
    if (envAdminEmail && envAdminPassword && normalizedIdentifier === envAdminEmail) {
      const submittedBuf = Buffer.from(password);
      const envBuf = Buffer.from(envAdminPassword);
      if (submittedBuf.length === envBuf.length && crypto.timingSafeEqual(submittedBuf, envBuf)) {
        isAuthenticatedViaEnv = true;
      }
    }

    // 2. Check if user is an Administrator or Staff member first (only if format is an email)
    let staffUser: StaffUser | undefined = undefined;
    if (normalizedIdentifier.includes('@')) {
      staffUser = await getServerStaffByEmail(normalizedIdentifier);

      if (!staffUser) {
        staffUser = getStaffByEmail(normalizedIdentifier);
      }

      if (!staffUser) {
        staffUser = INITIAL_STAFF_USERS.find(
          (u) => u.email.toLowerCase() === normalizedIdentifier
        );
      }

      if (isAuthenticatedViaEnv && !staffUser) {
        const newSalt = generateServerSalt(16);
        const newHash = hashServerPassword(password, newSalt);
        staffUser = {
          id: 'admin-env-1',
          name: 'Administrator',
          email: normalizedIdentifier,
          role: 'SUPER_ADMIN',
          permissions: [...ALL_PERMISSION_KEYS],
          status: 'active',
          isOwner: true,
          salt: newSalt,
          passwordHash: newHash,
          createdAt: new Date().toISOString(),
        };
      }
    }

    if (staffUser) {
      if (staffUser.status === 'inactive') {
        return NextResponse.json(
          { success: false, error: 'This account has been deactivated. Please contact an administrator.' },
          { status: 403 }
        );
      }

      // S1.3: Reject known default/weak seed hashes
      if (staffUser.passwordHash && isKnownWeakHash(staffUser.passwordHash)) {
        console.warn(
          `[SECURITY] Denylisted legacy seed hash detected for ${normalizedIdentifier}. Run npm run setup:admin to set a strong password.`
        );
        return NextResponse.json(
          { success: false, error: 'Invalid email address or password.' },
          { status: 401 }
        );
      }

      let isStaffValid = isAuthenticatedViaEnv;
      if (!isStaffValid && staffUser.passwordHash) {
        const verifyRes = await verifyUserPasswordUnified({
          password,
          storedHash: staffUser.passwordHash,
          salt: staffUser.salt,
          userType: 'staff',
          userId: staffUser.id,
          email: staffUser.email,
        });
        isStaffValid = verifyRes.valid;
      }

      if (isStaffValid) {
        await resetRateLimit(`customer_login_id_${normalizedIdentifier}`);
        const isOwner = Boolean(
          staffUser.isOwner ||
          (envAdminEmail && normalizedIdentifier === envAdminEmail)
        );

        const role = staffUser.role || (isOwner ? 'SUPER_ADMIN' : 'ADMIN');
        const permissions = Array.isArray(staffUser.permissions)
          ? staffUser.permissions
          : (isOwner ? ['*'] : (ROLE_DEFAULT_PERMISSIONS[staffUser.role || ''] || []));

        const sessionPayload = {
          id: staffUser.id,
          name: staffUser.name,
          email: staffUser.email,
          role: role,
          isOwner: isOwner,
          permissions: permissions,
          status: 'active' as const,
          avatar: staffUser.avatar || '',
          lastLogin: new Date().toISOString(),
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        };

        const targetRedirect = resolveSafeStaffRedirect(staffUser, reqRedirect || body.redirect);
        const signedToken = createSignedSessionToken({
          id: staffUser.id,
          email: staffUser.email,
          role: role,
          permissions: permissions,
          isOwner: isOwner,
          expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours (Task X1.4)
        });

        const isSuperOrAdmin = isOwner || role === 'SUPER_ADMIN' || role === 'ADMIN';

        // Task S9.1: token field removed from response body
        const response = NextResponse.json({
          success: true,
          accountType: isSuperOrAdmin ? 'ADMIN' : 'STAFF',
          role: role,
          isAdmin: true,
          redirect: targetRedirect,
          user: sessionPayload,
          message: `${isSuperOrAdmin ? 'Admin' : 'Staff'} credentials recognized. Redirecting to dashboard.`,
        });

        const cookieOptions = {
          path: '/',
          maxAge: 12 * 60 * 60, // 12 hours
          sameSite: 'lax' as const,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
        };

        response.cookies.set(ADMIN_COOKIE_NAME, signedToken, cookieOptions);
        // Clear customer cookie if one was present in request
        if (request.cookies.has(CUSTOMER_COOKIE_NAME)) {
          response.cookies.set(CUSTOMER_COOKIE_NAME, '', { path: '/', maxAge: 0, expires: new Date(0) });
        }

        return response;
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid email address or password.' },
          { status: 401 }
        );
      }
    }

    // 3. Authenticate as Customer (supports both Retail email and Wholesale shopName)
    const customer = await authenticateCustomerServer(identifier, password);
    const sanitized = sanitizeCustomer(customer);

    // Reset rate limit on customer success
    await resetRateLimit(`customer_login_id_${normalizedIdentifier}`);

    // Task S5.1: Create cryptographically signed customer token with separated key & typ: customer
    const signedCustomerToken = createSignedCustomerToken({
      id: sanitized.id,
      email: sanitized.email || '',
      shopName: sanitized.shopName || undefined,
      customerType: sanitized.customerType || 'RETAIL',
    });

    // Handle safe customer redirect
    let customerRedirect = '/account';
    if (reqRedirect || body.redirect) {
      const cand = String(reqRedirect || body.redirect).trim();
      const isSafe =
        cand.startsWith('/') &&
        !cand.startsWith('//') &&
        !cand.startsWith('/\\') &&
        !cand.includes('://') &&
        !cand.includes('\\') &&
        !cand.startsWith('/admin');
      if (isSafe) {
        customerRedirect = cand;
      }
    }

    const response = NextResponse.json({
      success: true,
      accountType: 'CUSTOMER',
      isAdmin: false,
      redirect: customerRedirect,
      customer: sanitized,
      message: `${sanitized.customerType === 'WHOLESALE' ? 'Wholesale customer' : 'Customer'} signed in successfully.`,
    });

    // Task S5.2: Set httpOnly, secure in prod, sameSite lax, maxAge 7 days
    response.cookies.set(CUSTOMER_COOKIE_NAME, signedCustomerToken, {
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    // Clear admin cookies if present in request for cross-role isolation
    if (request.cookies.has(ADMIN_COOKIE_NAME)) {
      response.cookies.set(ADMIN_COOKIE_NAME, '', { path: '/', maxAge: 0, expires: new Date(0) });
    }
    if (request.cookies.has('admin_session')) {
      response.cookies.set('admin_session', '', { path: '/', maxAge: 0, expires: new Date(0) });
    }

    return response;
  } catch (err: any) {
    await runDummyPasswordComputation(enteredPassword || 'dummy-pass');
    const isEmail = identifier.includes('@');
    const defaultMsg = isEmail
      ? 'Invalid email address or password.'
      : 'Invalid shop name or password.';
    const isDeactivated = err?.message?.toLowerCase().includes('deactivated');
    return NextResponse.json(
      { success: false, error: err?.message || defaultMsg },
      { status: isDeactivated ? 403 : 401 }
    );
  }
}
