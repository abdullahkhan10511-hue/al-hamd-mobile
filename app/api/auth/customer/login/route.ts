import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateCustomerServer,
  sanitizeCustomer,
} from '@/lib/db/customers-server';
import { getServerStaffByEmail, verifyServerPassword } from '@/lib/db/staff-server';

const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';
const ADMIN_COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_ADMIN_COOKIE = 'admin_session';

export async function POST(request: NextRequest) {
  let identifier = '';
  try {
    const body = await request.json();
    const { email, password, shopName, identifier: reqIdentifier } = body;

    identifier = (reqIdentifier || shopName || email || '').trim();
    if (!identifier || !password) {
      const isEmail = identifier.includes('@');
      return NextResponse.json(
        {
          success: false,
          error: isEmail
            ? 'Please enter both your email address and password.'
            : 'Please enter both your shop name and password.',
        },
        { status: 400 }
      );
    }

    const normalizedIdentifier = identifier.toLowerCase();

    // 1. Check if user is an Administrator or Staff member first (only if format could be an email)
    if (normalizedIdentifier.includes('@')) {
      const staffUser = getServerStaffByEmail(normalizedIdentifier);
      if (staffUser && staffUser.status !== 'inactive' && staffUser.salt && staffUser.passwordHash) {
        const isStaffValid = verifyServerPassword(password, staffUser.salt, staffUser.passwordHash);
        if (isStaffValid) {
          const sessionPayload = {
            id: staffUser.id,
            name: staffUser.name,
            email: staffUser.email,
            role: staffUser.role || 'SUPER_ADMIN',
            isOwner: Boolean(
              staffUser.isOwner ||
              normalizedIdentifier === 'admin@alhamdmobile.com' ||
              normalizedIdentifier === 'admin@alhamd.com'
            ),
            permissions: staffUser.permissions || [],
            status: 'active',
            avatar: staffUser.avatar || '',
            lastLogin: new Date().toISOString(),
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          };

          const cookieValue = JSON.stringify(sessionPayload);
          const response = NextResponse.json({
            success: true,
            isAdmin: true,
            redirect: '/admin/dashboard',
            user: sessionPayload,
            message: 'Admin credentials recognized. Redirecting to Admin Dashboard.',
          });

          const cookieOptions = {
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
            sameSite: 'lax' as const,
            httpOnly: false,
          };

          response.cookies.set(ADMIN_COOKIE_NAME, cookieValue, cookieOptions);
          response.cookies.set(FALLBACK_ADMIN_COOKIE, cookieValue, cookieOptions);

          return response;
        }
      }
    }

    // 2. Authenticate as Customer (supports both Retail email and Wholesale shopName)
    const customer = authenticateCustomerServer(identifier, password);
    const sanitized = sanitizeCustomer(customer);

    const sessionPayload = {
      id: sanitized.id,
      email: sanitized.email || '',
      shopName: sanitized.shopName || '',
      customerType: sanitized.customerType || 'RETAIL',
      fullName:
        sanitized.fullName ||
        sanitized.shopName ||
        `${sanitized.firstName || ''} ${sanitized.lastName || ''}`.trim(),
      role: 'CUSTOMER',
      status: sanitized.status || 'active',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const cookieValue = JSON.stringify(sessionPayload);

    const response = NextResponse.json({
      success: true,
      customer: sanitized,
      message: `${sanitized.customerType === 'WHOLESALE' ? 'Wholesale customer' : 'Customer'} signed in successfully.`,
    });

    response.cookies.set(CUSTOMER_COOKIE_NAME, cookieValue, {
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  } catch (err: any) {
    const isEmail = identifier.includes('@');
    const defaultMsg = isEmail
      ? 'Invalid email address or password.'
      : 'Invalid shop name or password.';
    const isDeactivated = err?.message?.toLowerCase().includes('deactivated');
    return NextResponse.json(
      { success: false, error: err?.message || defaultMsg },
      { status: isDeactivated ? 403 : 401 }
    );
  }
}

