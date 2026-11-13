import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getStaffByEmail, INITIAL_STAFF_USERS } from '@/lib/db/staff';
import { getServerStaffByEmail, verifyServerPassword } from '@/lib/db/staff-server';
import { verifyPassword, hashPassword, generateSalt } from '@/lib/crypto';
import { StaffUser } from '@/types/admin';
import { ROLE_DEFAULT_PERMISSIONS } from '@/lib/constants/permissions';

const COOKIE_NAME = 'alhamd_admin_session';

import { checkRateLimit, getClientIp, createRateLimitResponse, resetRateLimit } from '@/lib/rateLimit';
import { createSignedSessionToken, getAdminSessionAsync, extractRawToken } from '@/lib/db/adminAuth';
import { isKnownWeakHash } from '@/lib/security/knownWeakHashes';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { verifyUserPasswordUnified, runDummyPasswordComputation } from '@/lib/security/password';
import { logActivity } from '@/lib/db/repositories/activity';

export async function POST(request: NextRequest) {
  try {
    // Defense-in-depth CSRF origin verification
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }
    const body = await request.json();
    const { email, password } = body;

    const normalizedEmail = (email || '').trim().toLowerCase();
    const ip = getClientIp(request);

    // S7 Rate Limiting: 20 per 15 mins per IP, 5 per 15 mins per email
    const ipRate = await checkRateLimit(`admin_login_ip_${ip}`, 20, 15 * 60 * 1000);
    if (!ipRate.allowed) {
      await logActivity({
        adminEmail: 'anonymous',
        action: 'RATE_LIMIT_EXCEEDED',
        target: 'admin_login_ip',
        details: `IP rate limit exceeded (${ip})`,
      });
      return createRateLimitResponse(ipRate.retryAfterSeconds, 'Too many login attempts from this network.');
    }

    if (normalizedEmail) {
      const emailRate = await checkRateLimit(`admin_login_email_${normalizedEmail}`, 5, 15 * 60 * 1000);
      if (!emailRate.allowed) {
        await logActivity({
          adminEmail: normalizedEmail,
          action: 'RATE_LIMIT_EXCEEDED',
          target: 'admin_login_email',
          details: `Email rate limit exceeded from IP: ${ip}`,
        });
        return createRateLimitResponse(emailRate.retryAfterSeconds, 'Too many failed login attempts for this account.');
      }
    }

    // Validate inputs
    if (!normalizedEmail || !normalizedEmail.includes('@') || !password || typeof password !== 'string') {
      await runDummyPasswordComputation(password || 'dummy-pass');
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
      const submittedBuf = Buffer.from(password);
      const envBuf = Buffer.from(envAdminPassword);
      if (submittedBuf.length === envBuf.length && crypto.timingSafeEqual(submittedBuf, envBuf)) {
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

    // If still no user found, return generic error (with timing equalization)
    if (!staffUser) {
      await runDummyPasswordComputation(password);
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

    // S1.3: Reject known default/weak seed hashes
    if (staffUser.passwordHash && isKnownWeakHash(staffUser.passwordHash)) {
      console.warn(
        `[SECURITY] Denylisted legacy seed hash detected for ${normalizedEmail}. Run npm run setup:admin to set a strong password.`
      );
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // 3. Cryptographic password verification (with unified scrypt/legacy verification & auto-upgrade)
    let isValid = isAuthenticatedViaEnv;
    if (!isValid && staffUser.passwordHash) {
      const verifyResult = await verifyUserPasswordUnified({
        password,
        storedHash: staffUser.passwordHash,
        salt: staffUser.salt,
        userType: 'staff',
        userId: staffUser.id,
        email: staffUser.email,
      });
      isValid = verifyResult.valid;
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // Reset email rate limit on successful credentials verification
    await resetRateLimit(`admin_login_email_${normalizedEmail}`);

    // 4. Construct secure signed session token
    const role = staffUser.role || 'SUPER_ADMIN';
    const isOwner = Boolean(
      staffUser.isOwner ||
      role === 'SUPER_ADMIN' ||
      role === 'OWNER' ||
      (envAdminEmail && normalizedEmail === envAdminEmail)
    );

    const fallbackPerms = isOwner || role === 'SUPER_ADMIN' || role === 'OWNER'
      ? ['*']
      : (ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS[role.toUpperCase()] || []);

    const userPermissions = Array.isArray(staffUser.permissions) && staffUser.permissions.length > 0
      ? staffUser.permissions
      : fallbackPerms;

    const safeUser = {
      id: staffUser.id,
      name: staffUser.name,
      email: staffUser.email,
      role: role,
      isOwner: isOwner,
      permissions: userPermissions,
      status: staffUser.status || 'active',
      avatar: staffUser.avatar || '',
      lastLogin: new Date().toISOString(),
    };

    const sessionToken = createSignedSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      role: role,
      permissions: safeUser.permissions,
      isOwner: safeUser.isOwner,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours (Task X1.4)
    });

    // Task S9.1: token field removed from JSON body. Token lives strictly in httpOnly cookie.
    const response = NextResponse.json({
      success: true,
      user: safeUser,
      role: safeUser.role,
      message: 'Admin authentication successful.',
    });

    // Set secure HttpOnly authentication cookie (Task S9.1 / S9.5)
    const cookieOptions = {
      path: '/',
      maxAge: 12 * 60 * 60, // 12 hours in seconds
      sameSite: 'lax' as const,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    };

    response.cookies.set(COOKIE_NAME, sessionToken, cookieOptions);

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

    // Task S9.1: Token field excluded from GET response
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
        isOwner: session.isOwner,
        permissions: session.permissions,
        status: session.status || 'active',
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
