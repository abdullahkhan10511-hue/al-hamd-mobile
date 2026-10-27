import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

export async function POST(request: NextRequest) {
  const isHttps = request.headers.get('x-forwarded-proto') === 'https' ||
    request.url.startsWith('https:') ||
    process.env.NODE_ENV === 'production';

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  response.cookies.set(FALLBACK_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
