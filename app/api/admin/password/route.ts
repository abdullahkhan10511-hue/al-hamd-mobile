import { NextRequest, NextResponse } from 'next/server';
import {
  getServerStaffUsers,
  saveServerStaffUsers,
  verifyServerPassword,
  generateServerSalt,
  hashServerPassword,
  updateStaffInDb,
} from '@/lib/db/staff-server';
import { isDbConfigured } from '@/lib/db/mysql';
import { StaffUser } from '@/types/admin';
import { getAdminSessionAsync, unauthorizedResponse } from '@/lib/db/adminAuth';
import { createSignedSessionToken, COOKIE_NAME } from '@/lib/db/sessionToken';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';
import { verifyUserPasswordUnified, hashPasswordSecure, validatePasswordPolicy } from '@/lib/security/password';

/**
 * POST /api/admin/password
 * Changes the authenticated administrator's password.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. CSRF Verification (Task S13)
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }

    // 2. Authoritative server-side async authentication (Task X1)
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return unauthorizedResponse('Unauthorized. Active admin session required to change password.');
    }

    // S7: Rate limit admin password changes: 5 attempts per 15 minutes per user
    const rateCheck = await checkRateLimit(`admin_pw_change_${session.id}`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds, 'Too many password change attempts.');
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validate inputs
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Current password is required.' },
        { status: 400 }
      );
    }

    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      return NextResponse.json(
        { success: false, error: policy.error || 'Password does not meet complexity requirements.' },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, error: 'New password cannot be identical to your current password.' },
        { status: 400 }
      );
    }

    // Locate the current administrator in database
    const allStaff = await getServerStaffUsers();
    const targetEmail = session.email?.toLowerCase();
    const targetId = session.id;

    const index = allStaff.findIndex(
      (u) =>
        (targetId && u.id === targetId) ||
        (targetEmail && u.email.toLowerCase() === targetEmail)
    );

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: 'Admin account record not found in database.' },
        { status: 404 }
      );
    }

    const targetUser = allStaff[index];

    // Cryptographically verify current password with unified scrypt/legacy handler
    const currentVerify = await verifyUserPasswordUnified({
      password: currentPassword,
      storedHash: targetUser.passwordHash,
      salt: targetUser.salt,
      userType: 'staff',
      userId: targetUser.id,
      email: targetUser.email,
    });

    if (!currentVerify.valid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect.' },
        { status: 400 }
      );
    }

    // Generate modern scrypt hash
    const newSalt = generateServerSalt(16);
    const newPasswordHash = await hashPasswordSecure(newPassword);

    const updatedUser: StaffUser = {
      ...targetUser,
      salt: newSalt,
      passwordHash: newPasswordHash,
      updatedAt: new Date().toISOString(),
    };

    if (isDbConfigured()) {
      try {
        await updateStaffInDb(targetUser.id, { newPassword });
      } catch (err: any) {
        console.warn('MySQL update password notice:', err.message);
      }
    }

    allStaff[index] = updatedUser;
    await saveServerStaffUsers(allStaff);

    // Construct fresh signed session token (Task S9)
    const sessionToken = createSignedSessionToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      permissions: updatedUser.permissions || [],
      isOwner: Boolean(updatedUser.isOwner),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
    });

    const response = NextResponse.json({
      success: true,
      message: 'Password changed successfully.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });

    response.cookies.set(COOKIE_NAME, sessionToken, {
      path: '/',
      maxAge: 12 * 60 * 60,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (err: any) {
    console.error('Admin password change error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to change administrator password.' },
      { status: 500 }
    );
  }
}
