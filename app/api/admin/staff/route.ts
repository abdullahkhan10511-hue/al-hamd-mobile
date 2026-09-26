import { NextRequest, NextResponse } from 'next/server';
import {
  getServerStaffUsers,
  saveServerStaffUsers,
  getServerStaffByEmail,
  generateServerSalt,
  hashServerPassword,
} from '@/lib/db/staff-server';
import { ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS } from '@/lib/constants/permissions';
import { StaffUser } from '@/types/admin';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function getSessionUser(request: NextRequest): (StaffUser & { role: string }) | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (cookieVal) {
    let raw = cookieVal;
    for (let i = 0; i < 3; i++) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email) {
          const fresh = getServerStaffByEmail(parsed.email);
          if (fresh && fresh.status !== 'inactive') {
            return fresh;
          } else if (fresh && fresh.status === 'inactive') {
            return null; // Deactivated account cannot act as admin
          }
          if (parsed.status !== 'inactive') {
            return parsed;
          }
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
    let emailToFind = '';
    try {
      const parsed = JSON.parse(decodeURIComponent(token));
      if (parsed && parsed.email) {
        emailToFind = parsed.email;
      }
    } catch {
      try {
        const parsed = JSON.parse(token);
        if (parsed && parsed.email) {
          emailToFind = parsed.email;
        }
      } catch {
        if (token.includes('@')) {
          emailToFind = token;
        }
      }
    }

    if (emailToFind) {
      const fresh = getServerStaffByEmail(emailToFind);
      if (fresh) {
        if (fresh.status === 'inactive') return null;
        return fresh;
      }
      return {
        id: 'admin-fallback',
        name: 'Administrator',
        email: emailToFind,
        role: 'ADMIN',
        status: 'active',
        isOwner: emailToFind.toLowerCase() === 'admin@alhamdmobile.com',
        permissions: [...ALL_PERMISSION_KEYS],
        createdAt: new Date().toISOString(),
      } as any;
    }
  }

  return null;
}

/**
 * GET /api/admin/staff
 * Returns list of staff accounts (passwords and hashes stripped).
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');
    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const allStaff = getServerStaffUsers();
    // Strip cryptographic salts and hashes before sending to client
    const safeStaffList = allStaff.map(({ passwordHash, salt, ...safe }) => safe);

    return NextResponse.json({
      success: true,
      staff: safeStaffList,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to retrieve staff list.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/staff
 * Creates a new staff member account.
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
    const { name, email, password, role, phone, avatar, status, permissions } = body;

    // 1. Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Full name is required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 4 characters long.' },
        { status: 400 }
      );
    }

    // 2. Check for duplicate email
    const allStaff = getServerStaffUsers();
    const existing = allStaff.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists.' },
        { status: 400 }
      );
    }

    // 3. Cryptographic password hashing
    const salt = generateServerSalt(16);
    const passwordHash = hashServerPassword(password, salt);

    // 4. Role & Permissions assignment
    const assignedRole = role || 'Manager';
    const assignedPermissions =
      Array.isArray(permissions) && permissions.length > 0
        ? permissions
        : ROLE_DEFAULT_PERMISSIONS[assignedRole] || (assignedRole === 'SUPER_ADMIN' ? [...ALL_PERMISSION_KEYS] : []);

    // 5. Construct new staff record
    const newStaff: StaffUser = {
      id: `staff-${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      phone: (phone || '').trim(),
      role: assignedRole,
      permissions: assignedPermissions,
      avatar:
        (avatar || '').trim() ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      status: status === 'inactive' ? 'inactive' : 'active',
      isOwner: false,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 6. Save to server persistent storage
    saveServerStaffUsers([...allStaff, newStaff]);

    // 7. Strip sensitive credentials before returning in API response
    const { passwordHash: _, salt: __, ...safeStaff } = newStaff;

    return NextResponse.json(
      {
        success: true,
        staff: safeStaff,
        message: 'Member created successfully.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create staff member.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/staff
 * Updates staff details, status, role, permissions, or password.
 */
export async function PATCH(request: NextRequest) {
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
    const { id, email, status, role, permissions, newPassword, name, phone, avatar } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Staff ID is required.' }, { status: 400 });
    }

    const allStaff = getServerStaffUsers();
    const index = allStaff.findIndex(
      (u) => u.id === id || (email && u.email.toLowerCase() === email.toLowerCase())
    );

    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
    }

    const target = allStaff[index];
    const isSessionAdmin =
      Boolean(session?.isOwner) ||
      session?.role === 'ADMIN' ||
      session?.role === 'SUPER_ADMIN' ||
      session?.email?.toLowerCase() === 'admin@alhamdmobile.com';

    // Prevent self-deactivation
    if (
      status === 'inactive' &&
      ((session?.id && target.id === session.id) ||
        (session?.email && target.email.toLowerCase() === session.email.toLowerCase()))
    ) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete or deactivate the currently logged-in administrator.' },
        { status: 400 }
      );
    }

    // Protect primary Admin / Owner from deactivation or role downgrading
    if (target.isOwner || target.email.toLowerCase() === 'admin@alhamdmobile.com') {
      if (status === 'inactive') {
        return NextResponse.json(
          { success: false, error: 'The primary Admin/Owner account cannot be deactivated.' },
          { status: 400 }
        );
      }
      if (role && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'The primary Admin/Owner role cannot be modified.' },
          { status: 400 }
        );
      }
    }

    // Prevent non-admins from modifying admin accounts
    const isTargetAdmin =
      target.isOwner ||
      target.role === 'ADMIN' ||
      target.role === 'SUPER_ADMIN' ||
      target.email.toLowerCase() === 'admin@alhamdmobile.com';

    if (isTargetAdmin && !isSessionAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only administrators have permission to manage administrator accounts.' },
        { status: 403 }
      );
    }

    // Check email uniqueness if email is changed
    if (email && email.trim().toLowerCase() !== target.email.toLowerCase()) {
      const newEmail = email.trim().toLowerCase();
      if (allStaff.some((u) => u.id !== target.id && u.email.toLowerCase() === newEmail)) {
        return NextResponse.json(
          { success: false, error: `Email "${newEmail}" is already in use by another account.` },
          { status: 400 }
        );
      }
    }

    const updated: StaffUser = {
      ...target,
      name: name !== undefined ? name.trim() : target.name,
      email: email !== undefined ? email.trim().toLowerCase() : target.email,
      phone: phone !== undefined ? phone.trim() : target.phone,
      avatar: avatar !== undefined ? avatar.trim() : target.avatar,
      status: status !== undefined ? status : target.status,
      role: role !== undefined ? role : target.role,
      permissions: permissions !== undefined ? permissions : target.permissions,
      updatedAt: new Date().toISOString(),
    };

    const passwordToSet = newPassword || body.resetPassword || body.password;
    if (passwordToSet && typeof passwordToSet === 'string') {
      if (passwordToSet.length < 4) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 4 characters long.' },
          { status: 400 }
        );
      }
      const newSalt = generateServerSalt(16);
      updated.salt = newSalt;
      updated.passwordHash = hashServerPassword(passwordToSet, newSalt);
    }

    allStaff[index] = updated;
    saveServerStaffUsers(allStaff);

    const { passwordHash: _, salt: __, ...safeUpdated } = updated;
    return NextResponse.json({ success: true, staff: safeUpdated, message: 'Account updated successfully.' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update staff member.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/staff
 * Permanently deletes a staff member account.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');
    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Staff ID is required.' }, { status: 400 });
    }

    const allStaff = getServerStaffUsers();
    const target = allStaff.find(
      (u) => u.id === id || u.email.toLowerCase() === id.toLowerCase()
    );

    if (!target) {
      return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
    }

    // Prevent self-deletion
    if (
      (session?.id && target.id === session.id) ||
      (session?.email && target.email.toLowerCase() === session.email.toLowerCase())
    ) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete or deactivate the currently logged-in administrator.' },
        { status: 400 }
      );
    }

    // Protect primary Admin / Owner
    if (target.isOwner || target.email.toLowerCase() === 'admin@alhamdmobile.com') {
      return NextResponse.json(
        { success: false, error: 'The primary Admin account cannot be deleted.' },
        { status: 400 }
      );
    }

    const isSessionAdmin =
      Boolean(session?.isOwner) ||
      session?.role === 'ADMIN' ||
      session?.role === 'SUPER_ADMIN' ||
      session?.email?.toLowerCase() === 'admin@alhamdmobile.com';

    // Prevent non-admins from deleting admin accounts
    const isTargetAdmin =
      target.isOwner ||
      target.role === 'ADMIN' ||
      target.role === 'SUPER_ADMIN' ||
      target.email.toLowerCase() === 'admin@alhamdmobile.com';

    if (isTargetAdmin && !isSessionAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only administrators have permission to delete administrator accounts.' },
        { status: 403 }
      );
    }

    // Prevent deleting the last super admin
    const activeSuperAdmins = allStaff.filter((u) => u.role === 'SUPER_ADMIN' && u.status === 'active');
    if (target.role === 'SUPER_ADMIN' && activeSuperAdmins.length <= 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete the last remaining active SUPER_ADMIN account.' },
        { status: 400 }
      );
    }

    const filtered = allStaff.filter(
      (u) => u.id !== target.id && u.email.toLowerCase() !== target.email.toLowerCase()
    );
    saveServerStaffUsers(filtered);

    return NextResponse.json({
      success: true,
      message: `Staff account "${target.name}" permanently deleted.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete staff member.' },
      { status: 500 }
    );
  }
}
