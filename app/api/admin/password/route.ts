import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  getServerStaffUsers,
  saveServerStaffUsers,
  getServerStaffByEmail,
  verifyServerPassword,
  generateServerSalt,
  hashServerPassword,
  updateStaffInDb,
} from '@/lib/db/staff-server';
import { isDbConfigured } from '@/lib/db/mysql';
import { StaffUser } from '@/types/admin';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function getSessionUser(request: NextRequest): { id?: string; email: string; role: string } | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (cookieVal) {
    let raw = cookieVal;
    for (let i = 0; i < 3; i++) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email && parsed.status !== 'inactive') {
          return parsed;
        }
      } catch {
        try {
          raw = decodeURIComponent(raw);
        } catch {
          break;
        }
      }
    }
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const parsed = JSON.parse(decodeURIComponent(token));
      if (parsed && parsed.email) return parsed;
    } catch {
      if (token.includes('@')) {
        return { email: token, role: 'SUPER_ADMIN' };
      }
    }
  }

  return null;
}

/**
 * Updates seed constant files on disk when primary administrator changes their password
 * so that cold reboots always boot with the active password.
 */
function syncSeedFiles(email: string, salt: string, passwordHash: string) {
  try {
    const staffTsPath = path.join(process.cwd(), 'lib', 'db', 'staff.ts');
    if (fs.existsSync(staffTsPath)) {
      let content = fs.readFileSync(staffTsPath, 'utf8');
      content = content.replace(
        /const SEED_SALT\s*=\s*['"][^'"]*['"];/,
        `const SEED_SALT = '${salt}';`
      );
      content = content.replace(
        /const SEED_HASH\s*=\s*['"][^'"]*['"];/,
        `const SEED_HASH = '${passwordHash}';`
      );
      fs.writeFileSync(staffTsPath, content, 'utf8');
    }

    const seedTsPath = path.join(process.cwd(), 'lib', 'db', 'seed.ts');
    if (fs.existsSync(seedTsPath)) {
      let content = fs.readFileSync(seedTsPath, 'utf8');
      content = content.replace(
        /salt:\s*['"][^'"]*['"],\s*passwordHash:\s*['"][^'"]*['"]/,
        `salt: '${salt}',\n    passwordHash: '${passwordHash}'`
      );
      fs.writeFileSync(seedTsPath, content, 'utf8');
    }
  } catch (err) {
    console.warn('Could not sync seed constants:', err);
  }
}

/**
 * POST /api/admin/password
 * Changes the authenticated administrator's password.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');

    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
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

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters long.' },
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
    const targetEmail = session?.email?.toLowerCase();
    const targetId = session?.id;

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

    // Cryptographically verify current password against actual stored salt & hash
    const isCurrentValid = verifyServerPassword(
      currentPassword,
      targetUser.salt || '',
      targetUser.passwordHash || ''
    );

    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect.' },
        { status: 400 }
      );
    }

    // Generate new cryptographic salt and salted SHA-256 hash
    const newSalt = generateServerSalt(16);
    const newPasswordHash = hashServerPassword(newPassword, newSalt);

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

    // If primary owner, sync in-code seed fallback files only in offline/local mode
    if (
      !isDbConfigured() &&
      (updatedUser.isOwner ||
        updatedUser.id === 'staff-owner-1' ||
        updatedUser.email.toLowerCase() === 'admin@alhamdmobile.com')
    ) {
      syncSeedFiles(updatedUser.email, newSalt, newPasswordHash);
    }

    // Construct fresh session cookie
    const sessionPayload = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isOwner: Boolean(updatedUser.isOwner),
      permissions: updatedUser.permissions || [],
      status: updatedUser.status || 'active',
      avatar: updatedUser.avatar || '',
      lastLogin: updatedUser.lastLogin || new Date().toISOString(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const cookieValue = encodeURIComponent(JSON.stringify(sessionPayload));
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

    const cookieOptions = {
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'lax' as const,
      httpOnly: false,
    };

    response.cookies.set(COOKIE_NAME, cookieValue, cookieOptions);
    response.cookies.set(FALLBACK_COOKIE_NAME, cookieValue, cookieOptions);

    return response;
  } catch (err: any) {
    console.error('Admin password change error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to change administrator password.' },
      { status: 500 }
    );
  }
}
