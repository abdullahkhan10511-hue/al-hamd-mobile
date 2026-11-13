import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionAsync, unauthorizedResponse, forbiddenResponse } from '@/lib/db/adminAuth';
import { getServerStaffById } from '@/lib/db/staff-server';
import { updateStaffInDb } from '@/lib/db/repositories/staff';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { logActivity } from '@/lib/db/repositories/activity';
import { COOKIE_NAME } from '@/lib/db/sessionToken';

export async function POST(request: NextRequest) {
  try {
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }

    const session = await getAdminSessionAsync(request);
    if (!session || !session.id) {
      return unauthorizedResponse();
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = body.userId || session.id;

    // Only owner can log out all devices of other staff; anyone can log out all devices of self
    if (targetUserId !== session.id && !session.isOwner) {
      return forbiddenResponse('Only the store owner can log out all devices for other staff members.');
    }

    const targetUser = await getServerStaffById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Increment session version -> instantly invalidates all existing JWT/session tokens
    const nextVersion = (targetUser.sessionVersion || 1) + 1;
    await updateStaffInDb(targetUser.id, {
      sessionVersion: nextVersion,
    });

    await logActivity({
      adminEmail: session.email,
      action: 'LOGOUT_ALL_DEVICES',
      target: targetUser.email,
      details: `All active sessions invalidated (session version bumped to ${nextVersion})`,
    });

    const response = NextResponse.json({
      success: true,
      message: 'All active sessions for this account have been logged out.',
    });

    // If logging out self, clear current session cookie as well
    if (targetUserId === session.id) {
      response.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

