import { NextRequest, NextResponse } from 'next/server';
import { registerCustomerServer, sanitizeCustomer } from '@/lib/db/customers-server';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';
import { validatePasswordPolicy } from '@/lib/security/password';
import { createSignedCustomerToken, CUSTOMER_COOKIE_NAME } from '@/lib/db/sessionToken';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';

// RFC-compliant email verification pattern
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function POST(request: NextRequest) {
  try {
    // Defense-in-depth CSRF verification
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }

    // 1. IP-based rate limiting to prevent automated account creation spam (10 per minute)
    const ip = getClientIp(request);
    const rateCheck = await checkRateLimit(`customer_register_${ip}`, 5, 3600000);
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds, 'Too many registration attempts.');
    }

    const body = await request.json().catch(() => ({}));
    const { fullName, email, phone, password, dateOfBirth } = body;

    // 2. Strict server-side validation
    const rawFullName = typeof fullName === 'string' ? fullName.trim() : '';
    if (!rawFullName || rawFullName.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Full name must be at least 2 characters long.' },
        { status: 400 }
      );
    }
    if (rawFullName.length > 255) {
      return NextResponse.json(
        { success: false, error: 'Full name cannot exceed 255 characters.' },
        { status: 400 }
      );
    }

    const rawEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail) || rawEmail.length > 255) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const rawPhone = typeof phone === 'string' ? phone.trim() : '';
    if (!rawPhone || rawPhone.length < 7 || rawPhone.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid phone number (at least 7 characters).' },
        { status: 400 }
      );
    }

    const rawPassword = typeof password === 'string' ? password : '';
    const policyResult = validatePasswordPolicy(rawPassword);
    if (!policyResult.valid) {
      return NextResponse.json(
        { success: false, error: policyResult.error || 'Password does not meet complexity requirements.' },
        { status: 400 }
      );
    }

    // 3. Persist in database via server layer with hashing & duplicate email checks
    const customer = await registerCustomerServer({
      fullName: rawFullName,
      email: rawEmail,
      phone: rawPhone,
      password: rawPassword,
      dateOfBirth: typeof dateOfBirth === 'string' ? dateOfBirth.trim() : undefined,
    });

    const sanitized = sanitizeCustomer(customer);

    // Task S5.1: Create signed customer token
    const signedCustomerToken = createSignedCustomerToken({
      id: customer.id,
      email: customer.email || rawEmail,
      shopName: customer.shopName || undefined,
      customerType: customer.customerType || 'RETAIL',
    });

    const response = NextResponse.json(
      {
        success: true,
        customer: sanitized,
        message: 'Account created successfully.',
      },
      { status: 201 }
    );

    // Task S5.2: Set httpOnly, secure in prod, sameSite lax, maxAge 7 days
    response.cookies.set(CUSTOMER_COOKIE_NAME, signedCustomerToken, {
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (err: any) {
    const rawMsg = err?.message || '';
    const msg = rawMsg.toLowerCase();
    const isDup =
      msg.includes('already exists') ||
      msg.includes('already registered') ||
      msg.includes('in progress') ||
      err?.code === 'ER_DUP_ENTRY' ||
      err?.errno === 1062;

    const safeMessage = isDup
      ? 'An account with this email address already exists. Please sign in.'
      : rawMsg || 'Registration failed. Please verify your details.';

    return NextResponse.json(
      { success: false, error: safeMessage },
      { status: isDup ? 409 : 400 }
    );
  }
}
