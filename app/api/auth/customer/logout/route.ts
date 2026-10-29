import { NextRequest, NextResponse } from 'next/server';

const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';
const ADMIN_COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_ADMIN_COOKIE = 'admin_session';

function clearAllAuthCookies(response: NextResponse, isHttps: boolean) {
  const commonOptions = {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax' as const,
  };

  response.cookies.set(CUSTOMER_COOKIE_NAME, '', commonOptions);
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    ...commonOptions,
    httpOnly: true,
    secure: isHttps,
  });
  response.cookies.set(FALLBACK_ADMIN_COOKIE, '', {
    ...commonOptions,
    httpOnly: true,
    secure: isHttps,
  });
}

export async function POST(request: NextRequest) {
  const isHttps =
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.headers.get('x-forwarded-ssl') === 'on';

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  clearAllAuthCookies(response, isHttps);
  return response;
}

export async function GET(request: NextRequest) {
  const isHttps =
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.headers.get('x-forwarded-ssl') === 'on';

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  clearAllAuthCookies(response, isHttps);
  return response;
}
