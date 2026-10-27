import { NextRequest, NextResponse } from 'next/server';
import {
  getServerStaffUsers,
  saveServerStaffUsers,
  getServerStaffByEmail,
  generateServerSalt,
  hashServerPassword,
  createStaffInDb,
  updateStaffInDb,
  deleteStaffInDb,
} from '@/lib/db/staff-server';
import { isDbConfigured } from '@/lib/db/mysql';
import { allowDevMockFallback } from '@/lib/env';
import { ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS } from '@/lib/constants/permissions';
import { StaffUser } from '@/types/admin';
import {
  getAdminSession,
  hasAdminPermission,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/db/adminAuth';

async function getAuthenticatedStaff(request: NextRequest): Promise<(StaffUser & { role: string }) | null> {
  const session = getAdminSession(request);
  if (!session || !session.email) return null;

  const fresh = await getServerStaffByEmail(session.email);
  if (fresh) {
    if (fresh.status === 'inactive') return null;
    return fresh;
  }

  return {
    id: session.id || 'admin-root',
    name: session.name || 'Administrator',
    email: session.email,
    role: session.role || 'ADMIN',
    status: 'active',
    isOwner: Boolean(session.isOwner || session.role === 'SUPER_ADMIN' || session.role === 'OWNER'),
    permissions: Array.isArray(session.permissions) ? session.permissions : [...ALL_PERMISSION_KEYS],
    createdAt: new Date().toISOString(),
  } as any;
}

/**
 * GET /api/admin/staff
 * Returns list of staff accounts (passwords and hashes stripped).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedStaff(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'staff.view')) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view staff accounts.');
    }

    const allStaff = await getServerStaffUsers();
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
    const session = await getAuthenticatedStaff(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'staff.add')) {
      return forbiddenResponse('Forbidden: Insufficient permissions to create staff accounts.');
    }

    const body = await request.json();
    const { name, email, password, role, phone, avatar, status, permissions } = body;

    // 1. Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Full name is required (minimum 2 characters).' },
        { status: 400 }
      );
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
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
    const allStaff = await getServerStaffUsers();
    const existing = allStaff.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists.' },
        { status: 400 }
      );
    }

    // 3. RBAC & Privilege Escalation Prevention
    const isSessionSuperAdmin = Boolean(
      session.isOwner || session.role === 'SUPER_ADMIN' || session.role === 'OWNER'
    );
    const isSessionAdmin = isSessionSuperAdmin || session.role === 'ADMIN';

    const assignedRole = role || 'Manager';

    if (
      (assignedRole === 'SUPER_ADMIN' || assignedRole === 'OWNER' || Boolean(body.isOwner)) &&
      !isSessionSuperAdmin
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only Super Admins can assign Super Admin or Owner privileges.' },
        { status: 403 }
      );
    }

    if (assignedRole === 'ADMIN' && !isSessionAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only Administrators can create Administrator accounts.' },
        { status: 403 }
      );
    }

    // Prevent non-superadmins from granting permissions they do not possess
    if (!isSessionSuperAdmin && Array.isArray(permissions)) {
      const sessionPerms = new Set(session.permissions || []);
      if (permissions.includes('*') || permissions.some((p: string) => !sessionPerms.has(p))) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You cannot grant permissions higher than your own.' },
          { status: 403 }
        );
      }
    }

    // 4. Cryptographic password hashing
    const salt = generateServerSalt(16);
    const passwordHash = hashServerPassword(password, salt);

    // 5. Role & Permissions assignment
    const assignedPermissions =
      Array.isArray(permissions) && permissions.length > 0
        ? permissions
        : ROLE_DEFAULT_PERMISSIONS[assignedRole] ||
          (assignedRole === 'SUPER_ADMIN' ? [...ALL_PERMISSION_KEYS] : []);

    // 6. Construct new staff record
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
      isOwner: (Boolean(body.isOwner) || assignedRole === 'OWNER') && isSessionSuperAdmin,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 7. Save to MySQL or server storage
    let createdStaffUser: StaffUser | null = null;
    if (isDbConfigured()) {
      createdStaffUser = await createStaffInDb({
        name: newStaff.name,
        email: newStaff.email,
        password,
        role: newStaff.role,
        phone: newStaff.phone,
        avatar: newStaff.avatar,
        status: newStaff.status,
        permissions: newStaff.permissions,
      });
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      saveServerStaffUsers([...allStaff, newStaff]);
      createdStaffUser = newStaff;
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    // 8. Strip sensitive credentials before returning in API response
    const { passwordHash: _, salt: __, ...safeStaff } = createdStaffUser || newStaff;

    return NextResponse.json(
      {
        success: true,
        staff: safeStaff,
        message: 'Staff member created successfully.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error creating staff member:', err);
    const isConflict =
      err?.message?.includes('already exists') ||
      err?.code === 'ER_DUP_ENTRY';
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create staff member.' },
      { status: isConflict ? 409 : 500 }
    );
  }
}

/**
 * PATCH /api/admin/staff
 * Updates staff details, status, role, permissions, or password.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthenticatedStaff(request);
    if (!session) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { id, email, status, role, permissions, newPassword, name, phone, avatar } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Staff ID is required.' }, { status: 400 });
    }

    // Role-specific permission enforcement
    const isPasswordResetOnly = Boolean(
      (newPassword || body.resetPassword || body.password) &&
      name === undefined &&
      phone === undefined &&
      avatar === undefined &&
      status === undefined &&
      role === undefined &&
      permissions === undefined
    );

    if (isPasswordResetOnly) {
      if (!hasAdminPermission(session, 'staff.reset_passwords') && !hasAdminPermission(session, 'staff.edit')) {
        return forbiddenResponse('Forbidden: Insufficient permissions to reset staff passwords.');
      }
    } else if (role !== undefined || permissions !== undefined) {
      if (!hasAdminPermission(session, 'staff.change_roles') && !hasAdminPermission(session, 'staff.edit')) {
        return forbiddenResponse('Forbidden: Insufficient permissions to change staff roles or permissions.');
      }
    } else {
      if (!hasAdminPermission(session, 'staff.edit')) {
        return forbiddenResponse('Forbidden: Insufficient permissions to edit staff accounts.');
      }
    }

    const allStaff = await getServerStaffUsers();
    const index = allStaff.findIndex(
      (u) => u.id === id || (email && u.email.toLowerCase() === email.toLowerCase())
    );

    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
    }

    const target = allStaff[index];
    const isSessionSuperAdmin = Boolean(
      session?.isOwner || session?.role === 'SUPER_ADMIN' || session?.role === 'OWNER'
    );
    const isSessionAdmin = isSessionSuperAdmin || session?.role === 'ADMIN';

    const isSelf = Boolean(
      (session?.id && target.id === session.id) ||
      (session?.email && target.email.toLowerCase() === session.email.toLowerCase())
    );

    // 1. Prevent self-deactivation
    if (status === 'inactive' && isSelf) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete or deactivate the currently logged-in administrator.' },
        { status: 400 }
      );
    }

    // 2. Prevent self-role elevation and self-permission modifications
    if (isSelf && role !== undefined && role !== target.role) {
      return NextResponse.json(
        { success: false, error: 'You cannot modify your own role or elevate your privileges.' },
        { status: 403 }
      );
    }
    if (isSelf && permissions !== undefined) {
      return NextResponse.json(
        { success: false, error: 'You cannot modify your own permissions.' },
        { status: 403 }
      );
    }
    if (isSelf && body.isOwner !== undefined && Boolean(body.isOwner) !== Boolean(target.isOwner)) {
      return NextResponse.json(
        { success: false, error: 'You cannot change your own ownership status.' },
        { status: 403 }
      );
    }

    // 3. Target Admin & Super Admin protections
    const isTargetOwner =
      Boolean(target.isOwner) || target.role === 'OWNER' || target.id === 'staff-owner-1';
    const isTargetSuperAdmin = isTargetOwner || target.role === 'SUPER_ADMIN';
    const isTargetAdmin = isTargetSuperAdmin || target.role === 'ADMIN';

    if (isTargetSuperAdmin && !isSessionSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only Super Admins have permission to manage Super Admin accounts.' },
        { status: 403 }
      );
    }

    if (isTargetAdmin && !isSessionAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only administrators have permission to manage administrator accounts.' },
        { status: 403 }
      );
    }

    // 4. Role privilege escalation prevention
    if (
      (role === 'SUPER_ADMIN' || role === 'OWNER' || Boolean(body.isOwner)) &&
      !isSessionSuperAdmin
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only Super Admins can assign Super Admin or Owner privileges.' },
        { status: 403 }
      );
    }

    if (role === 'ADMIN' && !isSessionAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only Administrators can assign Administrator roles.' },
        { status: 403 }
      );
    }

    if (!isSessionSuperAdmin && Array.isArray(permissions)) {
      const sessionPerms = new Set(session.permissions || []);
      if (permissions.includes('*') || permissions.some((p: string) => !sessionPerms.has(p))) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You cannot grant permissions higher than your own.' },
          { status: 403 }
        );
      }
    }

    // 5. Protect last active administrator from deactivation or role downgrading
    if (isTargetAdmin) {
      const activeAdmins = allStaff.filter(
        (u) =>
          u.status === 'active' &&
          (Boolean(u.isOwner) || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'OWNER')
      );

      if (activeAdmins.length <= 1) {
        if (status === 'inactive') {
          return NextResponse.json(
            { success: false, error: 'Cannot deactivate the last remaining active administrator account.' },
            { status: 400 }
          );
        }
        if (
          role &&
          role !== 'SUPER_ADMIN' &&
          role !== 'ADMIN' &&
          role !== 'OWNER'
        ) {
          return NextResponse.json(
            { success: false, error: 'Cannot change the role of the last remaining active administrator.' },
            { status: 400 }
          );
        }
      }
    }

    // 6. Protect last active super admin
    if (isTargetSuperAdmin) {
      const activeSuperAdmins = allStaff.filter(
        (u) =>
          u.status === 'active' &&
          (Boolean(u.isOwner) || u.role === 'SUPER_ADMIN' || u.role === 'OWNER')
      );

      if (activeSuperAdmins.length <= 1) {
        if (status === 'inactive') {
          return NextResponse.json(
            { success: false, error: 'Cannot deactivate the last remaining active Super Admin account.' },
            { status: 400 }
          );
        }
        if (role && role !== 'SUPER_ADMIN' && role !== 'OWNER') {
          return NextResponse.json(
            { success: false, error: 'Cannot downgrade the role of the last remaining active Super Admin.' },
            { status: 400 }
          );
        }
      }
    }

    // 7. Input validation
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return NextResponse.json(
        { success: false, error: 'Full name must be at least 2 characters.' },
        { status: 400 }
      );
    }

    if (email !== undefined) {
      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
        return NextResponse.json(
          { success: false, error: 'A valid email address is required.' },
          { status: 400 }
        );
      }
      if (trimmedEmail !== target.email.toLowerCase()) {
        const emailExists = allStaff.some(
          (u) => u.id !== target.id && u.email.toLowerCase() === trimmedEmail
        );
        if (emailExists) {
          return NextResponse.json(
            { success: false, error: `Email "${trimmedEmail}" is already in use by another account.` },
            { status: 400 }
          );
        }
      }
    }

    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      return NextResponse.json(
        { success: false, error: 'Status must be either active or inactive.' },
        { status: 400 }
      );
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

    // Update in MySQL if configured
    let safeUpdatedStaff: any = null;
    if (isDbConfigured()) {
      const updatedFromDb = await updateStaffInDb(target.id, {
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        avatar: updated.avatar,
        status: updated.status,
        role: updated.role,
        permissions: updated.permissions,
        newPassword: passwordToSet,
      });
      const { passwordHash: _, salt: __, ...safe } = updatedFromDb;
      safeUpdatedStaff = safe;
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      allStaff[index] = updated;
      saveServerStaffUsers(allStaff);
      const { passwordHash: _, salt: __, ...safe } = updated;
      safeUpdatedStaff = safe;
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      staff: safeUpdatedStaff,
      message: 'Account updated successfully.',
    });
  } catch (err: any) {
    console.error('Error updating staff member:', err);
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
    const session = await getAuthenticatedStaff(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'staff.delete')) {
      return forbiddenResponse('Forbidden: Insufficient permissions to delete staff accounts.');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Staff ID is required.' }, { status: 400 });
    }

    const allStaff = await getServerStaffUsers();
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

    const isSessionSuperAdmin =
      Boolean(session?.isOwner) || session?.role === 'SUPER_ADMIN';

    const isSessionAdmin =
      isSessionSuperAdmin || session?.role === 'ADMIN' || session?.role === 'OWNER';

    const isTargetOwner =
      Boolean(target.isOwner) || target.role === 'OWNER' || target.id === 'staff-owner-1';

    const isTargetSuperAdmin =
      isTargetOwner || target.role === 'SUPER_ADMIN';

    const isTargetAdmin =
      isTargetSuperAdmin || target.role === 'ADMIN';

    // 1. Strict Owner Account Protection: Only an authenticated Super Admin may delete the Owner account
    if (isTargetSuperAdmin && !isSessionSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only a Super Admin has permission to delete the Owner account.' },
        { status: 403 }
      );
    }

    // 2. Only administrators have permission to delete administrator accounts
    if (isTargetAdmin && !isSessionAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only administrators have permission to delete administrator accounts.' },
        { status: 403 }
      );
    }

    // 3. Prevent deleting the last remaining active administrator
    if (isTargetAdmin) {
      const activeAdmins = allStaff.filter(
        (u) =>
          u.status === 'active' &&
          (Boolean(u.isOwner) || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'OWNER')
      );
      if (activeAdmins.length <= 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete the last remaining active administrator account.' },
          { status: 400 }
        );
      }
    }

    // 4. Never leave the system without a usable Super Admin account
    if (isTargetOwner || target.role === 'SUPER_ADMIN') {
      const remainingSuperAdmins = allStaff.filter(
        (u) =>
          u.id !== target.id &&
          u.email.toLowerCase() !== target.email.toLowerCase() &&
          u.status === 'active' &&
          (Boolean(u.isOwner) || u.role === 'SUPER_ADMIN')
      );
      if (remainingSuperAdmins.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete the last remaining active Super Admin account.' },
          { status: 400 }
        );
      }
    }

    if (isDbConfigured()) {
      await deleteStaffInDb(target.id);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const filtered = allStaff.filter(
        (u) => u.id !== target.id && u.email.toLowerCase() !== target.email.toLowerCase()
      );
      saveServerStaffUsers(filtered);
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Staff account "${target.name}" permanently deleted.`,
    });
  } catch (err: any) {
    console.error('Error deleting staff member:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete staff member.' },
      { status: 500 }
    );
  }
}
