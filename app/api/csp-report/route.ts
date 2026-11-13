import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/security/csrf';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';

const MAX_BODY_BYTES = 10 * 1024; // 10 KB

export async function POST(request: NextRequest) {
  try {
    // 1. Same-Origin Check (Task S12b)
    const originCheck = assertSameOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json({ success: false, error: 'Forbidden: cross-origin CSP reports rejected' }, { status: 403 });
    }

    // 2. IP Rate Limit (30 reports per hour per IP)
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(`csp_report_${clientIp}`, 30, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.retryAfterSeconds);
    }

    // 3. Body Size Cap (10 KB max)
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'Payload Too Large' }, { status: 413 });
    }

    const rawText = await request.text();
    if (rawText.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'Payload Too Large' }, { status: 413 });
    }

    // 4. Safe Diagnostic Logging (Blocked URI and Violated Directive only)
    if (rawText.trim()) {
      try {
        const body = JSON.parse(rawText);
        const report = body['csp-report'] || body;
        const blockedUri = String(report['blocked-uri'] || report.blockedURI || report.blockedUri || '').slice(0, 500);
        const violatedDirective = String(report['violated-directive'] || report.violatedDirective || '').slice(0, 200);

        if (blockedUri || violatedDirective) {
          console.warn(`[CSP VIOLATION] Blocked URI: "${blockedUri || 'unknown'}", Violated Directive: "${violatedDirective || 'unknown'}"`);
        }
      } catch {
        // Non-JSON or malformed payload, ignore parsing
      }
    }

    // 5. Always returns 204 No Content for valid submissions
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('CSP report processing error:', err);
    return new NextResponse(null, { status: 204 });
  }
}

