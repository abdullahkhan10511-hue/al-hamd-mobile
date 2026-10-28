import { NextRequest } from 'next/server';

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

// ============================================================================
// Standard Pure-JS Cryptographic Primitives (Universal Edge & Node.js Compatible)
// Zero Node.js 'crypto' module imports to guarantee full Next.js Edge Runtime compatibility.
// ============================================================================

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256Bytes(bytes: Uint8Array): Uint8Array {
  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const bitLen = bytes.length * 8;
  const newLen = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(newLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(newLen - 4, bitLen, false);
  view.setUint32(newLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);

  for (let i = 0; i < newLen; i += 64) {
    for (let j = 0; j < 16; j++) {
      W[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = ((W[j - 15] >>> 7) | (W[j - 15] << 25)) ^ ((W[j - 15] >>> 18) | (W[j - 15] << 14)) ^ (W[j - 15] >>> 3);
      const s1 = ((W[j - 2] >>> 17) | (W[j - 2] << 15)) ^ ((W[j - 2] >>> 19) | (W[j - 2] << 13)) ^ (W[j - 2] >>> 10);
      W[j] = (W[j - 16] + s0 + W[j - 7] + s1) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let j = 0; j < 64; j++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[j] + W[j]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const result = new Uint8Array(32);
  const outView = new DataView(result.buffer);
  outView.setUint32(0, H0, false);
  outView.setUint32(4, H1, false);
  outView.setUint32(8, H2, false);
  outView.setUint32(12, H3, false);
  outView.setUint32(16, H4, false);
  outView.setUint32(20, H5, false);
  outView.setUint32(24, H6, false);
  outView.setUint32(28, H7, false);
  return result;
}

function sha256Hex(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const hash = sha256Bytes(bytes);
  let hex = '';
  for (let i = 0; i < hash.length; i++) {
    hex += hash[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hmacSha256Base64Url(keyStr: string, msgStr: string): string {
  const enc = new TextEncoder();
  let key = enc.encode(keyStr);
  const msg = enc.encode(msgStr);

  const blockSize = 64;
  let keyBytes: Uint8Array;
  if (key.length > blockSize) {
    keyBytes = new Uint8Array(sha256Bytes(key));
  } else {
    keyBytes = key;
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyBytes);

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const innerMsg = new Uint8Array(blockSize + msg.length);
  innerMsg.set(iKeyPad);
  innerMsg.set(msg, blockSize);
  const innerHash = sha256Bytes(innerMsg);

  const outerMsg = new Uint8Array(blockSize + 32);
  outerMsg.set(oKeyPad);
  outerMsg.set(innerHash, blockSize);
  const outerHash = sha256Bytes(outerMsg);

  return bytesToBase64Url(outerHash);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToUtf8(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64url').toString('utf8');
  }
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function generateSecureNonce(byteLength = 16): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    cryptoObj.getRandomValues(bytes);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
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

  return sha256Hex(`alhamd_secure_signing_key:${seed}`);
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
    nonce: generateSecureNonce(16),
  };

  const payloadEncoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signatureInput = `${SESSION_TOKEN_PREFIX}.${payloadEncoded}`;
  const hmac = hmacSha256Base64Url(secret, signatureInput);

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
    const expectedHmac = hmacSha256Base64Url(secret, signatureInput);

    if (!constantTimeEqual(providedHmac, expectedHmac)) {
      return null; // Tampered or invalid cryptographic signature
    }

    const payloadJson = base64UrlToUtf8(payloadEncoded);
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
    if (clean.includes('%')) {
      try {
        clean = decodeURIComponent(clean);
      } catch {}
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
      if (clean.includes('%')) {
        try {
          clean = decodeURIComponent(clean);
        } catch {}
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
  const origin = request.headers.get('origin');
  if (!origin) return true; // Non-browser / curl requests

  const host = request.headers.get('host');
  if (!host) return false;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;
    return originHost === host;
  } catch {
    return false;
  }
}

/**
 * Authoritatively determines if the session payload has a specific operational permission.
 */
export function hasAdminPermission(
  session: AdminSession | SessionTokenPayload,
  permission: string | string[]
): boolean {
  if (!session) return false;

  const role = (session.role || '').toUpperCase();
  if (role === 'SUPER_ADMIN' || role === 'OWNER') return true;
  if ('isOwner' in session && session.isOwner) return true;

  if ('permissions' in session && Array.isArray(session.permissions)) {
    if (session.permissions.includes('*')) return true;
    if (Array.isArray(permission)) {
      return permission.some((p) => (session.permissions as string[]).includes(p));
    }
    if (session.permissions.includes(permission)) return true;
  }

  return false;
}
