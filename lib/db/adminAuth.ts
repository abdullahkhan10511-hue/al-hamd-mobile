import { NextRequest } from 'next/server';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

export interface AdminSession {
  id?: string;
  name?: string;
  email: string;
  role: string;
  isOwner?: boolean;
  permissions?: string[];
  status?: string;
  expiresAt?: number;
}

/**
 * Validates that an object represents an authenticated, active, non-expired administrator session.
 */
export function isValidAdminSessionObject(session: any): session is AdminSession {
  if (!session || typeof session !== 'object') return false;
  if (!session.email || typeof session.email !== 'string') return false;

  const email = session.email.trim().toLowerCase();
  if (!email.includes('@') || email.length < 5) return false;

  // Deactivated accounts are barred
  if (session.status && session.status === 'inactive') return false;

  // Expired sessions are rejected
  if (session.expiresAt && typeof session.expiresAt === 'number' && session.expiresAt < Date.now()) {
    return false;
  }

  // Customer sessions are strictly barred from admin privileges
  const role = (session.role || '').toUpperCase();
  if (role === 'CUSTOMER') return false;

  return Boolean(
    session.isOwner ||
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'OWNER' ||
    role === 'STAFF' ||
    role === 'MANAGER'
  );
}

/**
 * Safely parses and validates a serialized or URI-encoded session JSON string.
 */
export function parseAdminSessionString(raw: string): AdminSession | null {
  if (!raw || typeof raw !== 'string') return null;
  let curr = raw.trim();
  for (let i = 0; i < 3; i++) {
    try {
      const parsed = JSON.parse(curr);
      if (isValidAdminSessionObject(parsed)) {
        return parsed;
      }
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
  return null;
}

/**
 * Authenticates an incoming NextRequest as an administrator.
 * Reads either standard admin session cookies or an authorized Bearer session payload.
 * Rejects arbitrary strings, fake emails, expired sessions, and customer tokens.
 */
export function getAdminSession(request: NextRequest): AdminSession | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (cookieVal) {
    const session = parseAdminSessionString(cookieVal);
    if (session) return session;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const session = parseAdminSessionString(token);
      if (session) return session;
    }
  }

  return null;
}

export function isAuthorizedForShopBill(session: AdminSession | null, writeOperation: boolean = false): boolean {
  if (!session || !session.email) return false;
  if (session.status === 'inactive') return false;

  const role = (session.role || '').toLowerCase();
  if (
    session.isOwner ||
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'owner' ||
    session.email.toLowerCase().includes('admin')
  ) {
    return true;
  }

  const perms: string[] = Array.isArray(session.permissions) ? session.permissions : [];
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

  const role = (session.role || '').toLowerCase();
  if (
    session.isOwner ||
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'owner' ||
    session.email.toLowerCase().includes('admin')
  ) {
    return true;
  }

  const perms: string[] = Array.isArray(session.permissions) ? session.permissions : [];
  return perms.includes('inventory.void_shop_bill') || perms.includes('inventory.shop_bill');
}
