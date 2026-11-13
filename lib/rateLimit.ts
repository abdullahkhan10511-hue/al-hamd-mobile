import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { isDbConfigured, execute, query } from './db/mysql';
import { RowDataPacket } from 'mysql2/promise';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
let lastLocalCleanup = Date.now();
let hasWarnedRateLimitDbFailure = false;

function cleanupLocalExpired() {
  const now = Date.now();
  if (now - lastLocalCleanup < 60000 && rateLimitMap.size < 2000) return;
  lastLocalCleanup = now;

  for (const [key, record] of rateLimitMap.entries()) {
    if (record.resetAt <= now) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Computes a SHA-256 hash of the rate limit key to ensure no cleartext emails or IPs
 * are stored in the persistent database table.
 */
function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim().toLowerCase()).digest('hex');
}

/**
 * Extracts the real client IP safely:
 * - Trusts headers (X-Forwarded-For, CF-Connecting-IP, X-Real-IP) ONLY when TRUST_PROXY is 'true'.
 * - When trusted, picks the IP using TRUSTED_PROXY_HOPS (default 1) counted from the RIGHT side of X-Forwarded-For.
 * - Otherwise falls back strictly to the socket address or 'unknown'. Never blindly trusts client-supplied headers.
 */
export function getClientIp(request: NextRequest): string {
  const trustProxy = (process.env.TRUST_PROXY || '').toLowerCase().trim() === 'true';

  if (trustProxy) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      const parts = forwardedFor
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        const hops = Math.max(1, parseInt(process.env.TRUSTED_PROXY_HOPS || '1', 10));
        const index = Math.max(0, parts.length - hops);
        return parts[index];
      }
    }

    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp && cfIp.trim()) {
      return cfIp.trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp && realIp.trim()) {
      return realIp.trim();
    }
  }

  // NextRequest / standard node socket fallback
  const socketIp =
    (request as any).ip ||
    (request as any).socket?.remoteAddress ||
    'unknown';

  return socketIp;
}

interface RateLimitRow extends RowDataPacket {
  count: number;
  reset_at: number;
}

/**
 * Atomic persistent rate-limiting check against MySQL (with fallback to memory).
 * Prevents race conditions using atomic INSERT ... ON DUPLICATE KEY UPDATE.
 * Task X4.2: If the MySQL query fails or table does not exist, fails open to the in-memory
 * limiter and issues a console.warn once per process. A limiter error must NEVER cause a 500.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number = 10,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const now = Date.now();
  const resetAt = now + windowMs;

  if (isDbConfigured()) {
    const keyHash = hashKey(key);
    try {
      // Opportunistic cleanup of expired rows (roughly 5% probability)
      if (Math.random() < 0.05) {
        execute('DELETE FROM rate_limits WHERE reset_at < ? LIMIT 200', [now]).catch(() => {});
      }

      // Atomic insert or update
      await execute(
        `INSERT INTO rate_limits (key_hash, count, reset_at, updated_at)
         VALUES (?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           count = IF(reset_at <= VALUES(updated_at), 1, count + 1),
           reset_at = IF(reset_at <= VALUES(updated_at), VALUES(reset_at), reset_at),
           updated_at = VALUES(updated_at)`,
        [keyHash, resetAt, now]
      );

      const rows = await query<RateLimitRow[]>(
        'SELECT count, reset_at FROM rate_limits WHERE key_hash = ? LIMIT 1',
        [keyHash]
      );

      if (rows && rows.length > 0) {
        const currentCount = Number(rows[0].count);
        const currentResetAt = Number(rows[0].reset_at);

        if (currentCount > maxAttempts) {
          const retryAfterSeconds = Math.max(1, Math.ceil((currentResetAt - now) / 1000));
          return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds,
          };
        }

        return {
          allowed: true,
          remaining: Math.max(0, maxAttempts - currentCount),
          retryAfterSeconds: 0,
        };
      }
    } catch (dbErr: any) {
      if (!hasWarnedRateLimitDbFailure) {
        hasWarnedRateLimitDbFailure = true;
        console.warn(
          '[SECURITY WARNING] MySQL rate_limits query failed or table missing, failing open to in-memory rate limiter:',
          dbErr?.message || dbErr
        );
      }
    }
  }

  // Local development / fallback in-memory rate limiter
  cleanupLocalExpired();
  const record = rateLimitMap.get(key);

  if (!record || record.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      retryAfterSeconds: 0,
    };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - record.count),
    retryAfterSeconds: 0,
  };
}

/**
 * Resets a rate limit counter (e.g. after a successful login).
 */
export async function resetRateLimit(key: string): Promise<void> {
  const keyHash = hashKey(key);
  if (isDbConfigured()) {
    try {
      await execute('DELETE FROM rate_limits WHERE key_hash = ?', [keyHash]);
    } catch (dbErr: any) {
      if (!hasWarnedRateLimitDbFailure) {
        hasWarnedRateLimitDbFailure = true;
        console.warn(
          '[SECURITY WARNING] MySQL rate_limits query failed or table missing, failing open to in-memory storage:',
          dbErr?.message || dbErr
        );
      }
    }
  }
  rateLimitMap.delete(key);
}

/**
 * Returns an HTTP 429 Too Many Requests response with standard Retry-After header.
 */
export function createRateLimitResponse(
  retryAfterSeconds: number,
  message = 'Too many requests. Please try again later.'
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: `${message} Please try again in ${retryAfterSeconds} seconds.`,
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
