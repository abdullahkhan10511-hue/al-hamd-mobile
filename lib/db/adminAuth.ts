import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { ROLE_DEFAULT_PERMISSIONS } from '../constants/permissions';
import {
  COOKIE_NAME,
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
 * 2. Cross-references against the server-side database (MySQL with async query when configured).
 *    Never reads data/staff-users.json when MySQL is configured.
 * 3. The JSON file may be used only when MySQL is NOT configured and NODE_ENV !== 'production'.
 * 4. Fails closed if administrator verification fails.
 */
export async function getAdminSessionAsync(request: NextRequest): Promise<AdminSession | null> {
  const payload = extractVerifiedSessionPayload(request);
  if (!payload) return null;

  const email = payload.email.trim().toLowerCase();
  const userId = payload.sub;

  // 1. Production MySQL Environment
  try {
    const { isDbConfigured } = require('./mysql');
    if (isDbConfigured && isDbConfigured()) {
      const { getServerStaffByEmail, getServerStaffById } = require('./staff-server');
      let dbUser: any = null;

      try {
        if (userId) {
          dbUser = await getServerStaffById(userId);
        }
        if (!dbUser && email) {
          dbUser = await getServerStaffByEmail(email);
        }
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
        role === 'SUPER_ADMIN' ||
        role === 'OWNER' ||
        (envAdminEmail && email === envAdminEmail)
      );
      const permissions = Array.isArray(dbUser.permissions) && dbUser.permissions.length > 0
        ? dbUser.permissions
        : (isOwner ? ['*'] : (ROLE_DEFAULT_PERMISSIONS[dbUser.role || ''] || ROLE_DEFAULT_PERMISSIONS[role] || []));

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
  // Strict rule: The JSON file may be used only when MySQL is NOT configured and NODE_ENV !== 'production'
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  try {
    const { getServerStaffByEmail, getServerStaffById } = require('./staff-server');
    let serverUser: any = null;

    if (userId) {
      serverUser = await getServerStaffById(userId);
    }
    if (!serverUser && email) {
      serverUser = await getServerStaffByEmail(email);
    }

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
      role === 'SUPER_ADMIN' ||
      role === 'OWNER' ||
      (envAdminEmail && email === envAdminEmail)
    );
    const permissions = Array.isArray(serverUser.permissions) && serverUser.permissions.length > 0
      ? serverUser.permissions
      : (isOwner ? ['*'] : (ROLE_DEFAULT_PERMISSIONS[serverUser.role || ''] || ROLE_DEFAULT_PERMISSIONS[role] || []));

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
    return perms.includes('shop_bills.manage') || perms.includes('pos.manage');
  }

  return perms.includes('shop_bills.view') || perms.includes('pos.view') || perms.includes('shop_bills.manage');
}

export function isAuthorizedForVoidBill(session: AdminSession | null): boolean {
  if (!session || !session.email) return false;
  if (session.status === 'inactive') return false;

  if (session.isOwner) return true;

  const perms: string[] = Array.isArray(session.permissions) ? session.permissions : [];
  if (perms.includes('*')) return true;
  return (
    perms.includes('inventory.void_shop_bill') ||
    perms.includes('inventory.shop_bill') ||
    perms.includes('shop_bills.manage') ||
    perms.includes('pos.manage')
  );
}

export function unauthorizedResponse(message: string = 'Unauthorized: Admin session required') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

export function forbiddenResponse(message: string = 'Forbidden: Insufficient permissions') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}
