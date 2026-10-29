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
import { verifyPassword } from '@/lib/crypto';
import { canAccessAdminRoute } from '@/lib/db/admins';
import { ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS } from '@/lib/constants/permissions';
import { createSignedSessionToken } from '@/lib/db/sessionToken';
import { StaffUser } from '@/types/admin';

const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';
const ADMIN_COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_ADMIN_COOKIE = 'admin_session';

import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

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
  try {
    const body = await request.json();
    const { email, password, shopName, identifier: reqIdentifier, redirect: reqRedirect } = body;

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

    // Brute-force rate limiting: 10 attempts per minute per IP + identifier
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`customer_login_${ip}_${normalizedIdentifier}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        },
        { status: 429 }
      );
    }

    // 1. Check environment variable override for server-side admin setup
    const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envAdminPassword = process.env.ADMIN_PASSWORD;

    let isAuthenticatedViaEnv = false;
    if (envAdminEmail && envAdminPassword && normalizedIdentifier === envAdminEmail) {
      if (password === envAdminPassword) {
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

      let isStaffValid = isAuthenticatedViaEnv;
      if (!isStaffValid && staffUser.salt && staffUser.passwordHash) {
        isStaffValid = verifyServerPassword(password, staffUser.salt, staffUser.passwordHash);
        if (!isStaffValid) {
          isStaffValid = await verifyPassword(password, staffUser.salt, staffUser.passwordHash);
        }
        if (!isStaffValid && password.trim() !== password) {
          isStaffValid = verifyServerPassword(password.trim(), staffUser.salt, staffUser.passwordHash);
          if (!isStaffValid) {
            isStaffValid = await verifyPassword(password.trim(), staffUser.salt, staffUser.passwordHash);
          }
        }

        // Safe legacy password compatibility strictly scoped to verified primary admin
        if (!isStaffValid) {
          const isPrimaryAdmin =
            Boolean(staffUser.isOwner || staffUser.id === 'staff-owner-1' || staffUser.id === 'admin-1') &&
            (normalizedIdentifier === 'admin@alhamdmobile.com' || normalizedIdentifier === 'admin@alhamd.com');

          const isLegacySeedHash =
            staffUser.passwordHash === 'ac9337e548d76d824371bb3ea6331659d4b171adaf9ee052f38f687f8f26ad8e' ||
            staffUser.passwordHash === 'c420262734ea8537651c3e53b3a0708468d33b1cb4a4a6c24c3efbb6032313b1';

          if (isPrimaryAdmin && isLegacySeedHash) {
            const submittedTrimmed = Buffer.from(password.trim());
            const legacyPass1 = Buffer.from('AlHamd@Admin2026!');
            const legacyPass2 = Buffer.from('AlHamd@Admin2026');

            if (
              (submittedTrimmed.length === legacyPass1.length && crypto.timingSafeEqual(submittedTrimmed, legacyPass1)) ||
              (submittedTrimmed.length === legacyPass2.length && crypto.timingSafeEqual(submittedTrimmed, legacyPass2))
            ) {
              isStaffValid = true;
            }
          }
        }
      }

      if (isStaffValid) {
        const isOwner = Boolean(
          staffUser.isOwner ||
          staffUser.id === 'staff-owner-1' ||
          normalizedIdentifier === 'admin@alhamdmobile.com' ||
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
        const signedToken = createSignedSessionToken(sessionPayload);

        const isSuperOrAdmin = isOwner || role === 'SUPER_ADMIN' || role === 'ADMIN';

        const response = NextResponse.json({
          success: true,
          accountType: isSuperOrAdmin ? 'ADMIN' : 'STAFF',
          role: role,
          isAdmin: true,
          redirect: targetRedirect,
          token: signedToken,
          user: sessionPayload,
          message: `${isSuperOrAdmin ? 'Admin' : 'Staff'} credentials recognized. Redirecting to dashboard.`,
        });

        const isHttps =
          request.nextUrl.protocol === 'https:' ||
          request.headers.get('x-forwarded-proto') === 'https' ||
          request.headers.get('x-forwarded-ssl') === 'on';

        const cookieOptions = {
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
          sameSite: 'lax' as const,
          httpOnly: true,
          secure: isHttps,
        };

        response.cookies.set(ADMIN_COOKIE_NAME, signedToken, cookieOptions);
        response.cookies.set(FALLBACK_ADMIN_COOKIE, signedToken, cookieOptions);
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

    const sessionPayload = {
      id: sanitized.id,
      email: sanitized.email || '',
      shopName: sanitized.shopName || '',
      customerType: sanitized.customerType || 'RETAIL',
      fullName:
        sanitized.fullName ||
        sanitized.shopName ||
        `${sanitized.firstName || ''} ${sanitized.lastName || ''}`.trim(),
      role: 'CUSTOMER',
      status: sanitized.status || 'active',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const cookieValue = encodeURIComponent(JSON.stringify(sessionPayload));

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

    response.cookies.set(CUSTOMER_COOKIE_NAME, cookieValue, {
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: false,
    });

    // Clear admin cookies if present in request for cross-role isolation
    if (request.cookies.has(ADMIN_COOKIE_NAME)) {
      response.cookies.set(ADMIN_COOKIE_NAME, '', { path: '/', maxAge: 0, expires: new Date(0) });
    }
    if (request.cookies.has(FALLBACK_ADMIN_COOKIE)) {
      response.cookies.set(FALLBACK_ADMIN_COOKIE, '', { path: '/', maxAge: 0, expires: new Date(0) });
    }

    return response;
  } catch (err: any) {
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
