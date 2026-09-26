import { NextRequest, NextResponse } from 'next/server';
import { registerCustomerServer, sanitizeCustomer } from '@/lib/db/customers-server';

const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, phone, password } = body;

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Full name, email, and password are required.' },
        { status: 400 }
      );
    }

    const customer = registerCustomerServer({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: (phone || '').trim(),
      password,
    });
    const sanitized = sanitizeCustomer(customer);

    const sessionPayload = {
      id: customer.id,
      email: customer.email,
      fullName: customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
      role: 'CUSTOMER',
      status: customer.status || 'active',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const cookieValue = encodeURIComponent(JSON.stringify(sessionPayload));

    const response = NextResponse.json(
      {
        success: true,
        customer: sanitized,
        message: 'Account created successfully.',
      },
      { status: 201 }
    );

    response.cookies.set(CUSTOMER_COOKIE_NAME, cookieValue, {
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    const isDup = msg.includes('already exists') || msg.includes('already registered');
    return NextResponse.json(
      { success: false, error: err?.message || 'Registration failed.' },
      { status: isDup ? 409 : 400 }
    );
  }
}
