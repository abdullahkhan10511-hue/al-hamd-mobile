import { NextRequest, NextResponse } from 'next/server';
import { getServerStaffById, updateStaffLastLogin } from '@/lib/db/staff-server';
import { updateStaffInDb } from '@/lib/db/repositories/staff';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';
import {
  verifyPending2faToken,
  createSignedSessionToken,
  PENDING_2FA_COOKIE_NAME,
  COOKIE_NAME,
} from '@/lib/db/sessionToken';
import {
  verifyTotpCode,
  decryptTotpSecret,
  verifyRecoveryCode,
} from '@/lib/security/totp';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { logActivity } from '@/lib/db/repositories/activity';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [user, domain] = email.split('@');
  const maskedUser = user.length <= 2 ? user[0] + '*' : user[0] + '*'.repeat(user.length - 2) + user[user.length - 1];
  return `${maskedUser}@${domain}`;
}

export async function POST(request: NextRequest) {
  try {
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }

    const pendingToken = request.cookies.get(PENDING_2FA_COOKIE_NAME)?.value;
    const payload = verifyPending2faToken(pendingToken);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: '2FA session expired. Please log in again.' },
        { status: 401 }
      );
    }

    const ip = getClientIp(request);
    const body = await request.json();
    const { code, isRecoveryCode } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Authentication code is required.' },
        { status: 400 }
      );
    }

    // Rate limiting: 5 attempts per 15 minutes per account
    const rateCheck = await checkRateLimit(`totp_verify_${payload.sub}`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      await logActivity({
        adminEmail: maskEmail(payload.email),
        action: 'TOTP_LOCKOUT',
        target: '2fa_verify',
        details: `5 failed 2FA attempts. Account locked for 15 minutes from IP: ${ip}`,
      });
      return createRateLimitResponse(rateCheck.retryAfterSeconds, 'Too many incorrect 2FA attempts. Please try again later.');
    }

    const staffUser = await getServerStaffById(payload.sub);
    if (!staffUser || staffUser.status === 'inactive' || !staffUser.totpSecretEnc) {
      return NextResponse.json(
        { success: false, error: 'Staff account inactive or 2FA not configured.' },
        { status: 403 }
      );
    }

    let isSuccess = false;
    let usedRecoveryHash: string | null = null;

    if (isRecoveryCode) {
      // Recovery code path: check against stored hashes
      usedRecoveryHash = verifyRecoveryCode(code, staffUser.totpRecoveryHashes || []);
      if (usedRecoveryHash) {
        isSuccess = true;
        // Remove used recovery hash so it can only be used ONCE
        const remainingHashes = (staffUser.totpRecoveryHashes || []).filter((h) => h !== usedRecoveryHash);
        await updateStaffInDb(staffUser.id, {
          totpRecoveryHashes: remainingHashes,
        });

        await logActivity({
          adminEmail: maskEmail(staffUser.email),
          action: 'TOTP_RECOVERY_CODE_USED',
          target: '2fa_verify',
          details: `One-time recovery code used for login. Remaining: ${remainingHashes.length}`,
        });
      }
    } else {
      // Standard TOTP code path
      const decryptedSecret = decryptTotpSecret(staffUser.totpSecretEnc);
      if (decryptedSecret && verifyTotpCode(code.trim(), decryptedSecret)) {
        isSuccess = true;
      }
    }

    if (!isSuccess) {
      await logActivity({
        adminEmail: maskEmail(staffUser.email),
        action: 'TOTP_FAILED_CODE',
        target: '2fa_verify',
        details: `Incorrect 2FA code attempt from IP: ${ip}`,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid 2FA code. Please check your authenticator app.' },
        { status: 401 }
      );
    }

    // Success: create full session token
    const sessionToken = createSignedSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      permissions: staffUser.permissions,
      isOwner: staffUser.isOwner,
      sessionVersion: staffUser.sessionVersion || 1,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Two-factor authentication verified successfully.',
      user: {
        id: staffUser.id,
        name: staffUser.name,
        email: staffUser.email,
        role: staffUser.role,
        isOwner: staffUser.isOwner,
        permissions: staffUser.permissions,
      },
    });

    if (staffUser.id && staffUser.id !== 'admin-env-1') {
      await updateStaffLastLogin(staffUser.id);
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // Set full admin session cookie (SameSite=Lax)
    response.cookies.set(COOKIE_NAME, sessionToken, {
      path: '/',
      maxAge: 12 * 60 * 60,
      sameSite: 'lax',
      httpOnly: true,
      secure: isProduction,
    });

    // Clear legacy cookie name and pending 2FA cookie
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

    await logActivity({
      adminEmail: maskEmail(staffUser.email),
      action: 'LOGIN_2FA_SUCCESS',
      target: 'admin_login',
      details: `Successful 2FA login from IP: ${ip}`,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'An error occurred during 2FA verification.' },
      { status: 500 }
    );
  }
}

