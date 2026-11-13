import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';

const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';
const ADMIN_COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_ADMIN_COOKIE = 'admin_session';

function clearAllAuthCookies(response: NextResponse) {
  const isSecure = process.env.NODE_ENV === 'production';
  const commonOptions = {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: isSecure,
  };

  response.cookies.set(CUSTOMER_COOKIE_NAME, '', commonOptions);
  response.cookies.set(ADMIN_COOKIE_NAME, '', commonOptions);
  response.cookies.set(FALLBACK_ADMIN_COOKIE, '', commonOptions);
}

export async function POST(request: NextRequest) {
  const csrfCheck = assertSameOrigin(request);
  if (!csrfCheck.ok) {
    return createCsrfForbiddenResponse(csrfCheck.reason);
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  clearAllAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  clearAllAuthCookies(response);
  return response;
}
