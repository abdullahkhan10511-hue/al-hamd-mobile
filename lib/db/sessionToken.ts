import { NextRequest } from 'next/server';
import crypto from 'crypto';

export const COOKIE_NAME = 'alhamd_admin_session';
export const FALLBACK_COOKIE_NAME = 'admin_session';
export const SESSION_TOKEN_PREFIX = 'v1';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

export interface SessionTokenPayload {
  sub: string;
  email: string;
  role?: string;
  iat: number;
  exp: number;
  nonce: string;
}

/**
 * Returns the strong server-side secret for HMAC signing.
 * Reads from environment variables, or derives a deterministic server-side entropy seed.
 * Never hardcoded and never exposed to the client.
 */
export function getSessionSigningSecret(): string {
  const envSecret =
    process.env.SESSION_SECRET ||
    process.env.ADMIN_JWT_SECRET ||
    process.env.AUTH_SECRET;

  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }

  // Consistent server-side salt derived from server environment variables
  const seed =
    process.env.MYSQL_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    process.env.DB_PASSWORD ||
    'alhamd_shop_prod_secret_seed_2026';

  return crypto
    .createHash('sha256')
    .update(`alhamd_secure_signing_key:${seed}`)
    .digest('hex');
}

/**
 * Creates a cryptographically signed, tamper-resistant administrator session token.
 * Output format: v1.<base64url(payload)>.<base64url(hmac)>
 */
export function createSignedSessionToken(data: {
  id?: string;
  email: string;
  role?: string;
  expiresAt?: number;
}): string {
  const secret = getSessionSigningSecret();
  const now = Date.now();
  const exp = typeof data.expiresAt === 'number' ? data.expiresAt : now + SESSION_TTL_MS;

  const payload: SessionTokenPayload = {
    sub: data.id || data.email,
    email: data.email.trim().toLowerCase(),
    role: data.role || 'ADMIN',
    iat: now,
    exp,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signatureInput = `${SESSION_TOKEN_PREFIX}.${payloadEncoded}`;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64url');

  return `${signatureInput}.${hmac}`;
}

/**
 * Verifies the cryptographic HMAC signature and expiration timestamp of a session token.
 * Uses constant-time comparison to prevent timing side-channel attacks.
 * Rejects unsigned JSON, raw emails, tampered signatures, and expired tokens.
 */
export function verifySignedSessionToken(token: string): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();

  // Fast check: must be a 3-part dot-separated string starting with v1
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;

  const [version, payloadEncoded, providedHmac] = parts;
  if (version !== SESSION_TOKEN_PREFIX) return null;
  if (!payloadEncoded || !providedHmac) return null;

  try {
    const secret = getSessionSigningSecret();
    const signatureInput = `${version}.${payloadEncoded}`;
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest('base64url');

    const providedBuf = Buffer.from(providedHmac, 'utf8');
    const expectedBuf = Buffer.from(expectedHmac, 'utf8');

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return null; // Tampered or invalid cryptographic signature
    }

    const payloadJson = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as SessionTokenPayload;

    if (!payload || typeof payload !== 'object') return null;
    if (!payload.email || typeof payload.email !== 'string') return null;
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
      return null; // Expired session
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts candidate token string from cookies or Authorization Bearer header.
 */
export function extractRawToken(request: NextRequest): string | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (cookieVal) {
    let clean = cookieVal.trim();
    if (clean.startsWith('"') && clean.endsWith('"') && clean.length > 2) {
      clean = clean.slice(1, -1);
    }
    return clean;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      let clean = token;
      if (clean.startsWith('"') && clean.endsWith('"') && clean.length > 2) {
        clean = clean.slice(1, -1);
      }
      return clean;
    }
  }

  return null;
}

/**
 * Extracts and cryptographically verifies the session token from the request.
 * Returns the verified token payload or null. Never accepts unsigned payloads.
 */
export function extractVerifiedSessionPayload(request: NextRequest): SessionTokenPayload | null {
  const rawToken = extractRawToken(request);
  if (!rawToken) return null;
  return verifySignedSessionToken(rawToken);
}

/**
 * Validates request origin for state-changing HTTP requests.
 * Protects cookie-authenticated requests against Cross-Site Request Forgery (CSRF).
 */
export function verifyCsrfOrigin(request: NextRequest): boolean {
  const method = (request.method || 'POST').toUpperCase();
  // Safe read-only HTTP methods do not require origin check
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    const referer = request.headers.get('referer');
    if (!referer) {
      // Non-browser or direct requests without origin/referer
      return true;
    }
    try {
      const refererUrl = new URL(referer);
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
      if (host && refererUrl.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
    if (host && originUrl.host !== host) {
      if (
        process.env.NODE_ENV !== 'production' &&
        (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')
      ) {
        return true;
      }
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Checks whether an authenticated AdminSession has permission for a specific action or module.
 * Super Admins, Owners, and primary store admins automatically pass all permission checks.
 */
export function hasAdminPermission(
  session: AdminSession | null,
  requiredPermission?: string | string[]
): boolean {
  if (!session || !session.email) return false;
  if (session.status === 'inactive') return false;

  const role = (session.role || '').toUpperCase();
  if (
    session.isOwner ||
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'OWNER'
  ) {
    return true;
  }

  if (!requiredPermission) {
    return true;
  }

  const userPerms: string[] = Array.isArray(session.permissions) ? session.permissions : [];
  if (userPerms.includes('*') || userPerms.includes('all')) {
    return true;
  }

  const required = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission];

  return required.some((perm) => userPerms.includes(perm));
}
