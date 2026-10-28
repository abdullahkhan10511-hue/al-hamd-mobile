import { NextRequest, NextResponse } from 'next/server';
import { ROLE_DEFAULT_PERMISSIONS } from '../constants/permissions';
import {
  COOKIE_NAME,
  FALLBACK_COOKIE_NAME,
  SESSION_TOKEN_PREFIX,
  SESSION_TTL_MS,
  AdminSession,
  SessionTokenPayload,
  getSessionSigningSecret,
  createSignedSessionToken,
  verifySignedSessionToken,
  extractRawToken,
  extractVerifiedSessionPayload,
  verifyCsrfOrigin,
  hasAdminPermission,
} from './sessionToken';

export * from './sessionToken';

/**
 * Authoritatively authenticates an incoming NextRequest as an administrator asynchronously.
 * 1. Cryptographically verifies HMAC signature (rejects unsigned JSON / raw emails).
 * 2. Cross-references against the server-side database (MySQL when configured).
 * 3. Fails closed if administrator verification fails.
 */
export async function getAdminSessionAsync(request: NextRequest): Promise<AdminSession | null> {
  const payload = extractVerifiedSessionPayload(request);
  if (!payload) return null;

  const email = payload.email.trim().toLowerCase();

  // 1. Production MySQL Environment
  try {
    const { isDbConfigured } = require('./mysql');
    if (isDbConfigured && isDbConfigured()) {
      const { getServerStaffByEmail } = require('./staff-server');
      let dbUser: any = null;

      try {
        dbUser = await getServerStaffByEmail(email);
      } catch (dbErr) {
        console.error('Database administrator session verification failed:', dbErr);
        // Fail closed: Never silently trust an unverified session
        return null;
      }

      if (!dbUser) {
        const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        if (envAdminEmail && email === envAdminEmail) {
          return {
            id: 'admin-env-1',
            name: 'Administrator',
            email: envAdminEmail,
            role: 'SUPER_ADMIN',
            isOwner: true,
            permissions: ['*'],
            status: 'active',
            expiresAt: payload.exp,
          };
        }
        // User not in database: fail closed
        return null;
      }

      if (dbUser.status === 'inactive') {
        return null;
      }

      const role = (dbUser.role || '').toUpperCase();
      if (role === 'CUSTOMER') return null;

      const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const isOwner = Boolean(
        dbUser.isOwner ||
        dbUser.id === 'staff-owner-1' ||
        email === 'admin@alhamdmobile.com' ||
        (envAdminEmail && email === envAdminEmail)
      );
      const permissions = Array.isArray(dbUser.permissions)
        ? dbUser.permissions
        : (isOwner ? ['*'] : (ROLE_DEFAULT_PERMISSIONS[dbUser.role || ''] || []));

      // Populate authoritative session strictly from database record
      return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role || 'ADMIN',
        isOwner,
        permissions,
        status: dbUser.status || 'active',
        expiresAt: payload.exp,
      };
    }
  } catch (err) {
    console.error('Admin session resolution error:', err);
    return null;
  }

  // 2. Non-MySQL Server Environment (Fallback File / Mock Environment)
  try {
    const { getServerStaffByEmailSync } = require('./staff-server');
    let serverUser = getServerStaffByEmailSync(email);
    const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

    if (!serverUser && envAdminEmail && email === envAdminEmail) {
      serverUser = {
        id: 'admin-env-1',
        name: 'Administrator',
        email: envAdminEmail,
        role: 'SUPER_ADMIN',
        isOwner: true,
        permissions: ['*'],
        status: 'active',
      } as any;
    }

    if (!serverUser || serverUser.status === 'inactive') {
      return null;
    }

    const role = (serverUser.role || '').toUpperCase();
    if (role === 'CUSTOMER') return null;

    const isOwner = Boolean(
      serverUser.isOwner ||
      serverUser.id === 'staff-owner-1' ||
      email === 'admin@alhamdmobile.com' ||
      (envAdminEmail && email === envAdminEmail)
    );
    const permissions = Array.isArray(serverUser.permissions)
      ? serverUser.permissions
      : (isOwner ? ['*'] : (ROLE_DEFAULT_PERMISSIONS[serverUser.role || ''] || []));

    return {
      id: serverUser.id,
      name: serverUser.name,
      email: serverUser.email,
      role: serverUser.role || 'ADMIN',
      isOwner,
      permissions,
      status: serverUser.status || 'active',
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Authenticates an incoming NextRequest as an administrator synchronously.
 * Verifies cryptographic signature and checks server-side staff storage.
 */
export function getAdminSession(request: NextRequest): AdminSession | null {
  const payload = extractVerifiedSessionPayload(request);
  if (!payload) return null;

  try {
    const { isDbConfigured } = require('./mysql');
    if (isDbConfigured()) {
      const { getServerStaffUsersSync } = require('./staff-server');
      const staffList = getServerStaffUsersSync();
      const serverUser = staffList.find((u: any) => u.email?.toLowerCase() === payload.email.toLowerCase());
      if (!serverUser || serverUser.status === 'inactive') {
        return null;
      }
      const role = (serverUser.role || '').toUpperCase();
      if (role === 'CUSTOMER') return null;
      const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const isOwner = Boolean(
        serverUser.isOwner ||
        serverUser.id === 'staff-owner-1' ||
        payload.email.toLowerCase() === 'admin@alhamdmobile.com' ||
        (envAdminEmail && payload.email.toLowerCase() === envAdminEmail)
      );
      const permissions = Array.isArray(serverUser.permissions)
        ? serverUser.permissions
        : (isOwner ? ['*'] : (ROLE_DEFAULT_PERMISSIONS[serverUser.role || ''] || []));

      return {
        id: serverUser.id,
        name: serverUser.name,
        email: serverUser.email,
        role: serverUser.role || 'ADMIN',
        isOwner,
        permissions,
        status: serverUser.status || 'active',
        expiresAt: payload.exp,
      };
    }

    const { getServerStaffByEmailSync } = require('./staff-server');
    let serverUser = getServerStaffByEmailSync(payload.email);
    const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

    if (!serverUser && envAdminEmail && payload.email === envAdminEmail) {
      serverUser = {
        id: 'admin-env-1',
        name: 'Administrator',
        email: envAdminEmail,
        role: 'SUPER_ADMIN',
        isOwner: true,
        permissions: ['*'],
        status: 'active',
      } as any;
    }

    if (!serverUser || serverUser.status === 'inactive') {
      return null;
    }

    const role = (serverUser.role || '').toUpperCase();
    if (role === 'CUSTOMER') return null;

    const isOwner = Boolean(
      serverUser.isOwner ||
      serverUser.id === 'staff-owner-1' ||
      payload.email.toLowerCase() === 'admin@alhamdmobile.com' ||
      (envAdminEmail && payload.email.toLowerCase() === envAdminEmail)
    );
    const permissions = Array.isArray(serverUser.permissions)
      ? serverUser.permissions
      : (isOwner ? ['*'] : (ROLE_DEFAULT_PERMISSIONS[serverUser.role || ''] || []));

    return {
      id: serverUser.id,
      name: serverUser.name,
      email: serverUser.email,
      role: serverUser.role || 'ADMIN',
      isOwner,
      permissions,
      status: serverUser.status || 'active',
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Backward compatibility check for object shapes.
 */
export function isValidAdminSessionObject(session: any): session is AdminSession {
  if (!session || typeof session !== 'object') return false;
  if (!session.email || typeof session.email !== 'string') return false;

  const email = session.email.trim().toLowerCase();
  if (!email.includes('@') || email.length < 5) return false;
  if (session.status && session.status === 'inactive') return false;
  if (session.expiresAt && typeof session.expiresAt === 'number' && session.expiresAt <= Date.now()) {
    return false;
  }

  const role = (session.role || '').toUpperCase();
  if (role === 'CUSTOMER') return false;

  return true;
}

export function isAuthorizedForShopBill(session: AdminSession | null, writeOperation: boolean = false): boolean {
  if (!session || !session.email) return false;
  if (session.status === 'inactive') return false;

  if (session.isOwner) return true;

  const perms: string[] = Array.isArray(session.permissions) ? session.permissions : [];
  if (perms.includes('*')) return true;

  if (writeOperation) {
    return perms.includes('inventory.shop_bill');
  }
  return (
    perms.includes('inventory.shop_bill') ||
    perms.includes('inventory.view_shop') ||
    perms.includes('inventory.view')
  );
}

export function isAuthorizedForVoidBill(session: AdminSession | null): boolean {
  if (!session || !session.email) return false;
  if (session.status === 'inactive') return false;

  if (session.isOwner) return true;

  const perms: string[] = Array.isArray(session.permissions) ? session.permissions : [];
  if (perms.includes('*')) return true;
  return perms.includes('inventory.void_shop_bill') || perms.includes('inventory.shop_bill');
}

/**
 * Returns a standardized 401 Unauthorized JSON response.
 */
export function unauthorizedResponse(
  message = 'Unauthorized: Active administrator session required'
): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

/**
 * Returns a standardized 403 Forbidden JSON response.
 */
export function forbiddenResponse(
  message = 'Forbidden: Insufficient staff permissions'
): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}
