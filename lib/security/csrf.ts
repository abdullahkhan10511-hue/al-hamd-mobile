import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface CsrfCheckResult {
  ok: boolean;
  reason?: string;
}

function normalizeHost(hostStr: string | null | undefined): string | null {
  if (!hostStr) return null;
  const trimmed = hostStr.trim().toLowerCase();
  // Strip protocol if present
  const withoutProto = trimmed.replace(/^https?:\/\//, '');
  // Strip trailing slashes or path
  return withoutProto.split('/')[0] || null;
}

/**
 * Validates that mutating requests originate from the same site/origin.
 * Protects against Cross-Site Request Forgery (CSRF) across all state-changing endpoints.
 * Edge-runtime and Node.js compatible.
 */
export function assertSameOrigin(request: NextRequest): CsrfCheckResult {
  const method = request.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) {
    return { ok: true };
  }

  // Collect authorized host candidates
  const validHosts = new Set<string>();

  const reqHost = normalizeHost(request.headers.get('host'));
  if (reqHost) {
    validHosts.add(reqHost);
    validHosts.add(reqHost.split(':')[0]); // also match without port
  }

  const forwardedHost = normalizeHost(request.headers.get('x-forwarded-host'));
  if (forwardedHost) {
    validHosts.add(forwardedHost);
    validHosts.add(forwardedHost.split(':')[0]);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const u = new URL(appUrl);
      const h = normalizeHost(u.host);
      if (h) {
        validHosts.add(h);
        validHosts.add(h.split(':')[0]);
      }
    } catch {}
  }

  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  if (allowedOriginsEnv) {
    allowedOriginsEnv.split(',').forEach((entry) => {
      const h = normalizeHost(entry);
      if (h) {
        validHosts.add(h);
        validHosts.add(h.split(':')[0]);
      }
    });
  }

  // In development, also accept localhost and 127.0.0.1
  if (process.env.NODE_ENV !== 'production') {
    validHosts.add('localhost');
    validHosts.add('127.0.0.1');
    validHosts.add('localhost:3000');
    validHosts.add('localhost:3001');
    validHosts.add('127.0.0.1:3000');
  }

  // 1. Check Origin header
  const originHeader = request.headers.get('origin');
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      const originHost = normalizeHost(originUrl.host);
      const originHostNoPort = originHost ? originHost.split(':')[0] : null;

      if (
        (originHost && validHosts.has(originHost)) ||
        (originHostNoPort && validHosts.has(originHostNoPort))
      ) {
        return { ok: true };
      }
      return { ok: false, reason: `Origin host mismatch: ${originHeader}` };
    } catch {
      return { ok: false, reason: `Malformed Origin header: ${originHeader}` };
    }
  }

  // 2. Check Sec-Fetch-Site header when Origin is absent
  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (secFetchSite) {
    if (secFetchSite === 'same-origin' || secFetchSite === 'none' || secFetchSite === 'same-site') {
      return { ok: true };
    }
    return { ok: false, reason: `Sec-Fetch-Site rejected: ${secFetchSite}` };
  }

  // 3. Neither Origin nor Sec-Fetch-Site is present (e.g. non-browser clients, cURL, scripts)
  // If request carries authenticated session cookies, it must be rejected to prevent ambient cookie CSRF
  const hasAdminCookie = Boolean(request.cookies.get('alhamd_admin_session')?.value);
  const hasCustomerCookie = Boolean(request.cookies.get('alhamd_customer_session')?.value);

  if (hasAdminCookie || hasCustomerCookie) {
    return {
      ok: false,
      reason: 'Authenticated mutating request missing Origin and Sec-Fetch-Site headers',
    };
  }

  // Unauthenticated non-browser client without session cookies is allowed (e.g. initial contact forms or webhooks)
  return { ok: true };
}

export function createCsrfForbiddenResponse(reason?: string) {
  if (reason) {
    console.warn(`[CSRF BLOCKED] Request rejected: ${reason}`);
  }
  return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
}

