import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  response.cookies.set(FALLBACK_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  response.cookies.set(FALLBACK_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return response;
}
