import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getStaffByEmail, INITIAL_STAFF_USERS } from '@/lib/db/staff';
import { getServerStaffByEmail, isStaff2faColumnAvailable, updateStaffLastLogin } from '@/lib/db/staff-server';
import { hashPassword, generateSalt } from '@/lib/crypto';
import { StaffUser } from '@/types/admin';
import { ROLE_DEFAULT_PERMISSIONS } from '@/lib/constants/permissions';

const COOKIE_NAME = 'alhamd_admin_session';

import { checkRateLimit, getClientIp, createRateLimitResponse, resetRateLimit } from '@/lib/rateLimit';
import {
  createSignedSessionToken,
  getAdminSessionAsync,
  createPending2faToken,
  PENDING_2FA_COOKIE_NAME,
} from '@/lib/db/adminAuth';
import { isKnownWeakHash } from '@/lib/security/knownWeakHashes';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { verifyUserPasswordUnified, runDummyPasswordComputation } from '@/lib/security/password';
import { logActivity } from '@/lib/db/repositories/activity';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [user, domain] = email.split('@');
  const maskedUser = user.length <= 2 ? user[0] + '*' : user[0] + '*'.repeat(user.length - 2) + user[user.length - 1];
  return `${maskedUser}@${domain}`;
}

function maskIp(ip: string): string {
  if (!ip) return '***';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  }
  return ip.slice(0, 4) + '***';
}

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

    // Optional IP allowlist check (env ADMIN_IP_ALLOWLIST)
    const ipAllowlistEnv = process.env.ADMIN_IP_ALLOWLIST?.trim();
    if (ipAllowlistEnv) {
      const allowedIps = ipAllowlistEnv.split(',').map((s) => s.trim()).filter(Boolean);
      if (allowedIps.length > 0 && !allowedIps.includes(ip) && !allowedIps.includes('127.0.0.1') && !allowedIps.includes('::1')) {
        await logActivity({
          adminEmail: maskEmail(normalizedEmail),
          action: 'IP_NOT_ALLOWED',
          target: 'admin_login',
          details: `Login blocked by IP allowlist (${maskIp(ip)}) at ${new Date().toISOString()}`,
        });
        return NextResponse.json(
          { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
          { status: 401 }
        );
      }
    }

    // Rate Limiting: 20 per 15 mins per IP, 5 per 15 mins per email
    const ipRate = await checkRateLimit(`admin_login_ip_${ip}`, 20, 15 * 60 * 1000);
    if (!ipRate.allowed) {
      await logActivity({
        adminEmail: 'anonymous',
        action: 'RATE_LIMIT_EXCEEDED',
        target: 'admin_login_ip',
        details: `IP rate limit exceeded (${maskIp(ip)}) at ${new Date().toISOString()}`,
      });
      return createRateLimitResponse(ipRate.retryAfterSeconds, 'Too many login attempts from this network.');
    }

    if (normalizedEmail) {
      const emailRate = await checkRateLimit(`admin_login_email_${normalizedEmail}`, 5, 15 * 60 * 1000);
      if (!emailRate.allowed) {
        await logActivity({
          adminEmail: maskEmail(normalizedEmail),
          action: 'FAILED_LOGIN_LOCKOUT',
          target: 'admin_login_email',
          details: `Failed login lockout (5 attempts) from IP: ${maskIp(ip)} at ${new Date().toISOString()}`,
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

    // Step 14 Phase 1: Env-based admin login is DISABLED in production unless ALLOW_ENV_ADMIN_LOGIN=true
    const allowEnvLogin = process.env.NODE_ENV !== 'production' || process.env.ALLOW_ENV_ADMIN_LOGIN === 'true';

    let isAuthenticatedViaEnv = false;
    if (allowEnvLogin && envAdminEmail && envAdminPassword && normalizedEmail === envAdminEmail) {
      const submittedBuf = Buffer.from(password);
      const envBuf = Buffer.from(envAdminPassword);
      if (submittedBuf.length === envBuf.length && crypto.timingSafeEqual(submittedBuf, envBuf)) {
        isAuthenticatedViaEnv = true;
      }
    }

    // 2. Lookup staff user in database
    let staffUser: StaffUser | undefined = await getServerStaffByEmail(normalizedEmail);

    if (!staffUser && !isAuthenticatedViaEnv) {
      staffUser = getStaffByEmail(normalizedEmail);
    }

    if (!staffUser && !isAuthenticatedViaEnv) {
      staffUser = INITIAL_STAFF_USERS.find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
    }

    // If authenticating via allowed env credentials and no user in DB, construct super admin
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
        sessionVersion: 1,
        salt: newSalt,
        passwordHash: newHash,
        createdAt: new Date().toISOString(),
      };
    }

    // If still no user found, return generic error
    if (!staffUser) {
      await runDummyPasswordComputation(password);
      await logActivity({
        adminEmail: maskEmail(normalizedEmail),
        action: 'FAILED_LOGIN',
        target: 'admin_login',
        details: `Failed admin login attempt from IP: ${maskIp(ip)} at ${new Date().toISOString()}`,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // Check account status
    if (staffUser.status === 'inactive') {
      await logActivity({
        adminEmail: maskEmail(normalizedEmail),
        action: 'INACTIVE_ACCOUNT_LOGIN',
        target: 'admin_login',
        details: `Inactive staff login attempt from IP: ${maskIp(ip)} at ${new Date().toISOString()}`,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // Reject known default/weak seed hashes
    if (staffUser.passwordHash && isKnownWeakHash(staffUser.passwordHash)) {
      console.warn(
        `[SECURITY] Denylisted legacy seed hash detected for ${normalizedEmail}. Run npm run setup:admin to set a strong password.`
      );
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // 3. Cryptographic password verification
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
      await logActivity({
        adminEmail: maskEmail(normalizedEmail),
        action: 'FAILED_LOGIN',
        target: 'admin_login',
        details: `Failed password attempt from IP: ${maskIp(ip)} at ${new Date().toISOString()}`,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // Reset email rate limit on successful credentials verification
    await resetRateLimit(`admin_login_email_${normalizedEmail}`);

    const role = staffUser.role || 'SUPER_ADMIN';
    const isOwner = Boolean(
      staffUser.isOwner ||
      role === 'SUPER_ADMIN' ||
      role === 'OWNER' ||
      (envAdminEmail && normalizedEmail === envAdminEmail)
    );

    // 4. Two-Factor Authentication Check (TOTP Step)
    const is2faAvailable = await isStaff2faColumnAvailable();
    const is2faEnabled = Boolean(staffUser.totpEnabled && staffUser.totpSecretEnc);

    // If 2FA is enabled for this account, issue short-lived pending 2FA token
    if (is2faAvailable && is2faEnabled) {
      const pendingToken = createPending2faToken({
        id: staffUser.id,
        email: staffUser.email,
        role: role,
        isOwner: isOwner,
        sessionVersion: staffUser.sessionVersion || 1,
      });

      const response = NextResponse.json({
        success: true,
        requires2fa: true,
        message: 'Two-factor authentication code required.',
      });

      response.cookies.set(PENDING_2FA_COOKIE_NAME, pendingToken, {
        path: '/',
        maxAge: 5 * 60, // 5 minutes
        sameSite: 'strict',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      });

      return response;
    }

    // 5. Standard Full Session (when 2FA not enabled or not yet enrolled)
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
      requiresTotpEnrollment: Boolean(is2faAvailable && (isOwner || role === 'SUPER_ADMIN') && !is2faEnabled),
      lastLogin: new Date().toISOString(),
    };

    const sessionToken = createSignedSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      role: role,
      permissions: safeUser.permissions,
      isOwner: safeUser.isOwner,
      sessionVersion: staffUser.sessionVersion || 1,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours absolute maximum
    });

    // Update last_login timestamp in staff_users table
    if (staffUser.id && staffUser.id !== 'admin-env-1') {
      await updateStaffLastLogin(staffUser.id);
    }

    const response = NextResponse.json({
      success: true,
      user: safeUser,
      role: safeUser.role,
      requiresTotpEnrollment: safeUser.requiresTotpEnrollment,
      message: 'Admin authentication successful.',
    });

    const isProduction = process.env.NODE_ENV === 'production';

    // Admin cookie SameSite=Lax and httpOnly
    response.cookies.set(COOKIE_NAME, sessionToken, {
      path: '/',
      maxAge: 12 * 60 * 60,
      sameSite: 'lax',
      httpOnly: true,
      secure: isProduction,
    });

    // Explicitly clear legacy cookie name and leftover pending 2fa cookie
    const clearOptions = {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      sameSite: 'lax' as const,
      httpOnly: true,
      secure: isProduction,
    };
    response.cookies.set('admin_session', '', clearOptions);
    response.cookies.set(PENDING_2FA_COOKIE_NAME, '', clearOptions);

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
      const response = NextResponse.json({ authenticated: false }, { status: 401 });
      const isSecure = process.env.NODE_ENV === 'production';
      const commonOptions = {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        sameSite: 'lax' as const,
        httpOnly: true,
        secure: isSecure,
      };
      response.cookies.set(COOKIE_NAME, '', commonOptions);
      response.cookies.set('admin_session', '', commonOptions);
      response.cookies.set(PENDING_2FA_COOKIE_NAME, '', commonOptions);
      return response;
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
        status: session.status || 'active',
      },
    });
  } catch {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    const isSecure = process.env.NODE_ENV === 'production';
    const commonOptions = {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      sameSite: 'lax' as const,
      httpOnly: true,
      secure: isSecure,
    };
    response.cookies.set(COOKIE_NAME, '', commonOptions);
    response.cookies.set('admin_session', '', commonOptions);
    response.cookies.set(PENDING_2FA_COOKIE_NAME, '', commonOptions);
    return response;
  }
}
