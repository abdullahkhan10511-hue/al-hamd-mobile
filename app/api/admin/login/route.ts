import { NextRequest, NextResponse } from 'next/server';
import { getStaffUsers, getStaffByEmail, INITIAL_STAFF_USERS } from '@/lib/db/staff';
import { getServerStaffByEmail, verifyServerPassword } from '@/lib/db/staff-server';
import { verifyPassword, hashPassword, generateSalt } from '@/lib/crypto';
import { StaffUser } from '@/types/admin';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const normalizedEmail = (email || '').trim().toLowerCase();

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

    // 4. Construct secure session payload
    const role = staffUser.role || 'SUPER_ADMIN';
    const isOwner = Boolean(
      staffUser.isOwner ||
      normalizedEmail === 'admin@alhamdmobile.com' ||
      normalizedEmail === 'admin@alhamd.com' ||
      (envAdminEmail && normalizedEmail === envAdminEmail)
    );

    const sessionPayload = {
      id: staffUser.id,
      name: staffUser.name,
      email: staffUser.email,
      role: role,
      isOwner: isOwner,
      permissions: staffUser.permissions || [],
      status: staffUser.status || 'active',
      avatar: staffUser.avatar || '',
      lastLogin: new Date().toISOString(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const cookieValue = encodeURIComponent(JSON.stringify(sessionPayload));

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
      role: sessionPayload.role,
      message: 'Admin authentication successful.',
    });

    // Set secure authentication cookies
    const cookieOptions = {
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      sameSite: 'lax' as const,
      httpOnly: false,
    };

    response.cookies.set(COOKIE_NAME, cookieValue, cookieOptions);
    response.cookies.set(FALLBACK_COOKIE_NAME, cookieValue, cookieOptions);

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Invalid email or password. Please verify your credentials and try again.' },
      { status: 401 }
    );
  }
}

export async function GET(request: NextRequest) {
  const cookie =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (!cookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const session = JSON.parse(decodeURIComponent(cookie));
    if (session && session.email && session.status !== 'inactive') {
      const notExpired = !session.expiresAt || session.expiresAt > Date.now();
      if (notExpired) {
        return NextResponse.json({ authenticated: true, user: session });
      }
    }
  } catch {}

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
