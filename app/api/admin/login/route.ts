import { NextRequest, NextResponse } from 'next/server';
import { getStaffByEmail, INITIAL_STAFF_USERS } from '@/lib/db/staff';
import { getServerStaffByEmail, verifyServerPassword } from '@/lib/db/staff-server';
import { verifyPassword, hashPassword, generateSalt } from '@/lib/crypto';
import { StaffUser } from '@/types/admin';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { createSignedSessionToken, getAdminSessionAsync } from '@/lib/db/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const normalizedEmail = (email || '').trim().toLowerCase();

    // Brute-force rate limiting: 8 attempts per minute per IP + email
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`admin_login_${ip}_${normalizedEmail}`, 8, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        },
        { status: 429 }
      );
    }

    // Validate inputs
    if (!normalizedEmail || !normalizedEmail.includes('@') || !password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // 1. Check environment variable override for server-side admin setup
    const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envAdminPassword = process.env.ADMIN_PASSWORD;

    let isAuthenticatedViaEnv = false;
    if (envAdminEmail && envAdminPassword && normalizedEmail === envAdminEmail) {
      if (password === envAdminPassword) {
        isAuthenticatedViaEnv = true;
      }
    }

    // 2. Lookup staff user in database (checking server-persisted staff first)
    let staffUser: StaffUser | undefined = await getServerStaffByEmail(normalizedEmail);

    if (!staffUser) {
      staffUser = getStaffByEmail(normalizedEmail);
    }

    if (!staffUser) {
      staffUser = INITIAL_STAFF_USERS.find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
    }

    // If authenticating via environment credentials and no user in DB, construct super admin
    if (isAuthenticatedViaEnv && !staffUser) {
      const newSalt = generateSalt(16);
      const newHash = await hashPassword(password, newSalt);
      staffUser = {
        id: 'admin-env-1',
        name: 'Administrator',
        email: normalizedEmail,
        role: 'SUPER_ADMIN',
        permissions: [],
        status: 'active',
        isOwner: true,
        salt: newSalt,
        passwordHash: newHash,
        createdAt: new Date().toISOString(),
      };
    }

    // If still no user found, return generic error
    if (!staffUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // Check account status
    if (staffUser.status === 'inactive') {
      return NextResponse.json(
        { success: false, error: 'This account has been deactivated. Please contact an administrator.' },
        { status: 403 }
      );
    }

    // 3. Cryptographic password verification (unless already verified via server environment)
    let isValid = isAuthenticatedViaEnv;
    if (!isValid && staffUser.salt && staffUser.passwordHash) {
      isValid = verifyServerPassword(password, staffUser.salt, staffUser.passwordHash);
      if (!isValid) {
        isValid = await verifyPassword(password, staffUser.salt, staffUser.passwordHash);
      }
      if (!isValid && password.trim() !== password) {
        isValid = verifyServerPassword(password.trim(), staffUser.salt, staffUser.passwordHash);
        if (!isValid) {
          isValid = await verifyPassword(password.trim(), staffUser.salt, staffUser.passwordHash);
        }
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // 4. Construct secure signed session token
    const role = staffUser.role || 'SUPER_ADMIN';
    const isOwner = Boolean(
      staffUser.isOwner ||
      role === 'SUPER_ADMIN' ||
      role === 'OWNER' ||
      (envAdminEmail && normalizedEmail === envAdminEmail)
    );

    const safeUser = {
      id: staffUser.id,
      name: staffUser.name,
      email: staffUser.email,
      role: role,
      isOwner: isOwner,
      permissions: staffUser.permissions || [],
      status: staffUser.status || 'active',
      avatar: staffUser.avatar || '',
      lastLogin: new Date().toISOString(),
    };

    const sessionToken = createSignedSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      role: role,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const response = NextResponse.json({
      success: true,
      token: sessionToken,
      user: safeUser,
      role: safeUser.role,
      message: 'Admin authentication successful.',
    });

    // Set secure HttpOnly authentication cookies
    const isHttps =
      request.nextUrl.protocol === 'https:' ||
      request.headers.get('x-forwarded-proto') === 'https';

    const cookieOptions = {
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      sameSite: 'lax' as const,
      httpOnly: true,
      secure: isHttps || process.env.NODE_ENV === 'production',
    };

    response.cookies.set(COOKIE_NAME, sessionToken, cookieOptions);
    response.cookies.set(FALLBACK_COOKIE_NAME, sessionToken, cookieOptions);

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
      { status: 401 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
        isOwner: session.isOwner,
        permissions: session.permissions,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
