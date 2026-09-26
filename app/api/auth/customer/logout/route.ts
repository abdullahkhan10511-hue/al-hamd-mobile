import { NextRequest, NextResponse } from 'next/server';

const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.set(CUSTOMER_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.set(CUSTOMER_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return response;
}
