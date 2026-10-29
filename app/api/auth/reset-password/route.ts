import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPasswordResetToken,
  completePasswordReset,
} from '@/lib/db/repositories/passwordReset';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

/**
 * GET /api/auth/reset-password?token=...
 * Validates a reset token without consuming it.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`reset_pw_get_${ip}`, 15, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { valid: false, error: `Too many attempts. Please wait ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || '';

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Missing password reset token in request.' },
        { status: 400 }
      );
    }

    const verification = await verifyPasswordResetToken(token);
    if (!verification.valid) {
      return NextResponse.json(
        { valid: false, error: verification.error || 'Invalid or expired reset token.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: verification.maskedEmail,
      userType: verification.userType,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error verifying reset token.';
    return NextResponse.json(
      { valid: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/reset-password
 * Completes password reset with cryptographic hash update and single-use invalidation.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`reset_pw_post_${ip}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many password reset attempts. Please wait ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Password reset token is required.' },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Passwords do not match. Please verify and try again.' },
        { status: 400 }
      );
    }

    const result = await completePasswordReset(token, newPassword);

    return NextResponse.json({
      success: true,
      message: result.message,
      userType: result.userType,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reset password. Please request a new link.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
