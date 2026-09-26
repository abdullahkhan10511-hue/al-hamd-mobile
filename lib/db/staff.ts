import { StaffUser, StaffRole, AdminRole } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';
import { generateSalt, hashPassword, verifyPassword } from '../crypto';
import {
  ALL_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSIONS,
  PREDEFINED_ROLES,
} from '../constants/permissions';

const STAFF_COLLECTION = 'admin_users';
const ROLES_COLLECTION = 'staff_roles';

export function getAdminAuthHeaders(operatorEmail?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    try {
      const stored =
        localStorage.getItem('alhamd_current_admin') ||
        localStorage.getItem('alhamd_active_admin');
      if (stored) {
        headers['Authorization'] = `Bearer ${encodeURIComponent(stored)}`;
        return headers;
      }
    } catch {}

    try {
      const match = document.cookie.match(/(?:^|;\s*)(?:alhamd_admin_session|admin_session)=([^;]*)/);
      if (match && match[1]) {
        headers['Authorization'] = `Bearer ${match[1]}`;
        return headers;
      }
    } catch {}
  }

  if (operatorEmail) {
    headers['Authorization'] = `Bearer ${operatorEmail}`;
  } else {
    headers['Authorization'] = 'Bearer admin@alhamdmobile.com';
  }

  return headers;
}

// Initial pre-hashed fallback constants for instant synchronous boot
const SEED_SALT = '1214d0aabfa8b4b1bab97d223ee04b6f';
// Salted SHA-256 Web Crypto hash for AlHamd@Admin2026!
const SEED_HASH = 'ac9337e548d76d824371bb3ea6331659d4b171adaf9ee052f38f687f8f26ad8e';
// Legacy seed hash for backward compatibility migration
const OLD_SEED_HASH = '47b3112be3f48a1ca9574cf9758ff5c276a0ec12fc221c97a2961d15db1887e3';

export const INITIAL_SYSTEM_ROLES: StaffRole[] = [
  {
    id: 'role-super-admin',
    name: 'SUPER_ADMIN',
    description: 'Full unconstrained authority over store operations, staff accounts, and financial data.',
    permissions: [...ALL_PERMISSION_KEYS],
    isSystemRole: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  ...PREDEFINED_ROLES.map((r, idx) => ({
    id: `role-system-${idx + 1}`,
    name: r.name,
    description: r.description,
    permissions: ROLE_DEFAULT_PERMISSIONS[r.name] || [],
    isSystemRole: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
];

export const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'staff-owner-1',
    name: 'Chief Administrator',
    email: 'admin@alhamdmobile.com',
    phone: '+92 300 1234567',
    role: 'ADMIN',
    permissions: [...ALL_PERMISSION_KEYS],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    status: 'active',
    isOwner: true,
    salt: SEED_SALT,
    passwordHash: SEED_HASH,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLogin: '2026-03-01T12:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// ROLES CRUD
// ---------------------------------------------------------------------------

export function getStaffRoles(): StaffRole[] {
  const roles = getStoredCollection<StaffRole>(ROLES_COLLECTION, INITIAL_SYSTEM_ROLES);
  
  // Ensure all predefined system roles are present
  let modified = false;
  const currentRoles = [...roles];

  for (const sysRole of INITIAL_SYSTEM_ROLES) {
    const existingIdx = currentRoles.findIndex(
      (r) => r.name.toLowerCase() === sysRole.name.toLowerCase()
    );
    if (existingIdx === -1) {
      currentRoles.push(sysRole);
      modified = true;
    }
  }

  if (modified) {
    persistCollection(ROLES_COLLECTION, currentRoles);
  }

  return currentRoles;
}

export async function createStaffRole(
  data: { name: string; description: string; permissions: string[] },
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; role?: StaffRole; error?: string }> {
  const roles = getStaffRoles();
  const trimmedName = data.name.trim();

  if (!trimmedName) {
    return { success: false, error: 'Role name is required.' };
  }

  if (roles.some((r) => r.name.toLowerCase() === trimmedName.toLowerCase())) {
    return { success: false, error: `Role "${trimmedName}" already exists.` };
  }

  const newRole: StaffRole = {
    id: `role-custom-${Date.now()}`,
    name: trimmedName,
    description: data.description.trim() || 'Custom staff permission role.',
    permissions: data.permissions || [],
    isSystemRole: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [...roles, newRole];
  await persistCollection(ROLES_COLLECTION, updated);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Created Custom Role',
    target: newRole.name,
    details: `${newRole.permissions.length} permissions assigned`,
  });

  return { success: true, role: newRole };
}

export async function updateStaffRole(
  id: string,
  updates: Partial<Pick<StaffRole, 'name' | 'description' | 'permissions'>>,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  const roles = getStaffRoles();
  const index = roles.findIndex((r) => r.id === id);

  if (index === -1) {
    return { success: false, error: 'Role not found.' };
  }

  const role = roles[index];
  const updatedRole: StaffRole = {
    ...role,
    ...(updates.name && !role.isSystemRole ? { name: updates.name.trim() } : {}),
    ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
    ...(updates.permissions ? { permissions: updates.permissions } : {}),
    updatedAt: new Date().toISOString(),
  };

  roles[index] = updatedRole;
  await persistCollection(ROLES_COLLECTION, roles);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Role Permissions',
    target: updatedRole.name,
    details: `${updatedRole.permissions.length} active permissions`,
  });

  return { success: true };
}

export async function deleteStaffRole(
  id: string,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  const roles = getStaffRoles();
  const targetRole = roles.find((r) => r.id === id);

  if (!targetRole) {
    return { success: false, error: 'Role not found.' };
  }

  if (targetRole.isSystemRole) {
    return { success: false, error: 'System predefined roles cannot be deleted.' };
  }

  // Check if any staff members are currently assigned to this role
  const staffUsers = getStaffUsers();
  const assignedCount = staffUsers.filter(
    (s) => s.role.toLowerCase() === targetRole.name.toLowerCase() || s.roleId === targetRole.id
  ).length;

  if (assignedCount > 0) {
    return {
      success: false,
      error: `Cannot delete "${targetRole.name}" because it is currently assigned to ${assignedCount} staff member(s). Reassign them first.`,
    };
  }

  const filtered = roles.filter((r) => r.id !== id);
  await persistCollection(ROLES_COLLECTION, filtered);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Deleted Custom Role',
    target: targetRole.name,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// STAFF USERS CRUD
// ---------------------------------------------------------------------------

export function getStaffUsers(): StaffUser[] {
  const users = getStoredCollection<StaffUser>(STAFF_COLLECTION, INITIAL_STAFF_USERS);
  let modified = false;

  const migrated = users.map((u) => {
    let userCopy = { ...u };

    // Standardize primary Admin account (migrate existing admin@alhamd.com or staff-owner-1 in place without duplicating)
    if (
      userCopy.id === 'staff-owner-1' ||
      userCopy.isOwner ||
      userCopy.email.toLowerCase() === 'admin@alhamdmobile.com' ||
      userCopy.email.toLowerCase() === 'admin@alhamd.com'
    ) {
      if (userCopy.email.toLowerCase() !== 'admin@alhamdmobile.com') {
        userCopy.email = 'admin@alhamdmobile.com';
        modified = true;
      }
      if (!userCopy.isOwner || (userCopy.role !== 'SUPER_ADMIN' && userCopy.role !== 'ADMIN')) {
        userCopy.isOwner = true;
        userCopy.role = 'ADMIN';
        userCopy.permissions = [...ALL_PERMISSION_KEYS];
        modified = true;
      }
      if (userCopy.status !== 'active') {
        userCopy.status = 'active';
        modified = true;
      }
    }

    // Ensure permissions array exists
    if (!Array.isArray(userCopy.permissions) || userCopy.permissions.length === 0) {
      userCopy.permissions =
        ROLE_DEFAULT_PERMISSIONS[userCopy.role] ||
        (userCopy.role === 'SUPER_ADMIN' ? [...ALL_PERMISSION_KEYS] : []);
      modified = true;
    }

    // Ensure salt & passwordHash exist
    if (!userCopy.passwordHash || !userCopy.salt) {
      userCopy.salt = SEED_SALT;
      userCopy.passwordHash = SEED_HASH;
      modified = true;
    }

    // Ensure status exists
    if (!userCopy.status) {
      userCopy.status = 'active';
      modified = true;
    }

    return userCopy;
  });

  // Deduplicate in case an extra admin record was created previously
  const seenEmails = new Set<string>();
  const deduplicated: StaffUser[] = [];
  for (const u of migrated) {
    const emailKey = u.email.toLowerCase();
    if (!seenEmails.has(emailKey)) {
      seenEmails.add(emailKey);
      deduplicated.push(u);
    } else {
      modified = true;
    }
  }

  if (modified) {
    persistCollection(STAFF_COLLECTION, deduplicated);
  }

  return deduplicated;
}

export function getStaffByEmail(email: string): StaffUser | undefined {
  if (!email) return undefined;
  const normalized = email.toLowerCase().trim();
  const users = getStaffUsers();
  const directMatch = users.find((s) => s.email.toLowerCase() === normalized);
  if (directMatch) return directMatch;

  if (normalized === 'admin@alhamd.com' || normalized === 'admin@alhamdmobile.com') {
    return users.find(
      (u) => u.isOwner || u.id === 'staff-owner-1' || u.email.toLowerCase() === 'admin@alhamdmobile.com'
    );
  }

  return undefined;
}

export async function createStaffUser(
  data: {
    name: string;
    email: string;
    password: string;
    role: AdminRole;
    phone?: string;
    avatar?: string;
    status?: 'active' | 'inactive';
    permissions?: string[];
  },
  operatorEmail = 'admin@alhamdmobile.com'
): Promise<{ success: boolean; staff?: StaffUser; error?: string }> {
  const users = getStaffUsers();
  const normalizedEmail = (data.email || '').trim().toLowerCase();

  if (!data.name || !data.name.trim()) {
    return { success: false, error: 'Full name is required.' };
  }

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { success: false, error: 'Valid email address is required.' };
  }

  if (!data.password || data.password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters long.' };
  }

  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  // If in browser, make network request to /api/admin/staff so backend server & database persist it
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: getAdminAuthHeaders(operatorEmail),
        credentials: 'include',
        body: JSON.stringify(data),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to create staff member.' };
      }

      if (json.staff) {
        // Also persist locally with cryptographic salt & hash for instant offline/client capability
        const salt = generateSalt();
        const passwordHash = await hashPassword(data.password, salt);
        const fullStaffUser: StaffUser = {
          ...json.staff,
          salt,
          passwordHash,
        };
        const updated = [...users.filter((u) => u.email.toLowerCase() !== normalizedEmail), fullStaffUser];
        await persistCollection(STAFF_COLLECTION, updated);
        try {
          localStorage.setItem('admin_users', JSON.stringify(updated));
        } catch {}

        await logActivity({
          adminEmail: operatorEmail,
          action: 'Created Staff Account',
          target: fullStaffUser.email,
          details: `Role: ${fullStaffUser.role}`,
        });

        return { success: true, staff: fullStaffUser };
      }
    } catch (apiErr) {
      console.warn('API /api/admin/staff call failed, falling back to local storage:', apiErr);
    }
  }

  // Determine permissions
  const assignedPermissions =
    data.permissions && data.permissions.length > 0
      ? data.permissions
      : ROLE_DEFAULT_PERMISSIONS[data.role] || (data.role === 'SUPER_ADMIN' ? [...ALL_PERMISSION_KEYS] : []);

  // Securely hash password
  const salt = generateSalt();
  const passwordHash = await hashPassword(data.password, salt);

  const newStaff: StaffUser = {
    id: `staff-${Date.now()}`,
    name: data.name.trim(),
    email: normalizedEmail,
    phone: data.phone?.trim() || '',
    role: data.role,
    permissions: assignedPermissions,
    avatar:
      data.avatar?.trim() ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    status: data.status || 'active',
    isOwner: false,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [...users, newStaff];
  await persistCollection(STAFF_COLLECTION, updated);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Created Staff Account',
    target: newStaff.email,
    details: `Role: ${newStaff.role} (${assignedPermissions.length} permissions)`,
  });

  return { success: true, staff: newStaff };
}

export async function updateStaffUser(
  id: string,
  updates: Partial<Pick<StaffUser, 'name' | 'email' | 'phone' | 'role' | 'avatar' | 'status' | 'permissions'>>,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; staff?: StaffUser; error?: string }> {
  // If in browser, make network request to /api/admin/staff so backend server & persistent database update
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: getAdminAuthHeaders(operatorEmail),
        credentials: 'include',
        body: JSON.stringify({
          id,
          name: updates.name,
          email: updates.email,
          phone: updates.phone,
          role: updates.role,
          avatar: updates.avatar,
          status: updates.status,
          permissions: updates.permissions,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to update staff account on server.' };
      }
    } catch (err: any) {
      return { success: false, error: 'Network error communicating with staff service.' };
    }
  }

  const users = getStaffUsers();
  const index = users.findIndex((u) => u.id === id || u.email.toLowerCase() === id.toLowerCase());

  if (index === -1) {
    return { success: false, error: 'Staff account not found.' };
  }

  const target = users[index];

  // Protect Owner / Main Admin
  if (target.isOwner || target.email.toLowerCase() === 'admin@alhamdmobile.com') {
    if (updates.status === 'inactive') {
      return { success: false, error: 'The primary Admin/Owner account cannot be deactivated.' };
    }
    if (updates.role && updates.role !== 'SUPER_ADMIN' && updates.role !== 'ADMIN') {
      return { success: false, error: 'The primary Admin/Owner role cannot be changed.' };
    }
  }

  // Check email uniqueness if email changed
  if (updates.email) {
    const newEmail = updates.email.trim().toLowerCase();
    if (users.some((u) => u.id !== target.id && u.email.toLowerCase() === newEmail)) {
      return { success: false, error: `Email "${newEmail}" is already in use by another account.` };
    }
  }

  const updatedStaff: StaffUser = {
    ...target,
    ...(updates.name ? { name: updates.name.trim() } : {}),
    ...(updates.email ? { email: updates.email.trim().toLowerCase() } : {}),
    ...(updates.phone !== undefined ? { phone: updates.phone.trim() } : {}),
    ...(updates.role ? { role: updates.role } : {}),
    ...(updates.avatar ? { avatar: updates.avatar } : {}),
    ...(updates.status ? { status: updates.status } : {}),
    ...(updates.permissions ? { permissions: updates.permissions } : {}),
    updatedAt: new Date().toISOString(),
  };

  users[index] = updatedStaff;
  await persistCollection(STAFF_COLLECTION, users);
  try {
    localStorage.setItem('admin_users', JSON.stringify(users));
  } catch {}

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Staff Account',
    target: updatedStaff.email,
    details: updates.role ? `Role updated to ${updatedStaff.role}` : 'Profile information updated',
  });

  return { success: true, staff: updatedStaff };
}

export async function resetStaffPassword(
  id: string,
  newPassword: string,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters.' };
  }

  // If in browser, make network request to /api/admin/staff so backend server updates password hash
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: getAdminAuthHeaders(operatorEmail),
        credentials: 'include',
        body: JSON.stringify({
          id,
          newPassword,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to reset staff password on server.' };
      }
    } catch (err: any) {
      return { success: false, error: 'Network error communicating with staff service.' };
    }
  }

  const users = getStaffUsers();
  const index = users.findIndex((u) => u.id === id || u.email.toLowerCase() === id.toLowerCase());

  if (index !== -1) {
    const target = users[index];
    const salt = generateSalt();
    const passwordHash = await hashPassword(newPassword, salt);

    users[index] = {
      ...target,
      salt,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };

    await persistCollection(STAFF_COLLECTION, users);
    try {
      localStorage.setItem('admin_users', JSON.stringify(users));
    } catch {}

    await logActivity({
      adminEmail: operatorEmail,
      action: 'Reset Staff Password',
      target: target.email,
    });
  }

  return { success: true };
}

export async function changeAdminSelfPassword(
  userIdOrEmail: string,
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  if (!currentPass) {
    return { success: false, error: 'Current password is required.' };
  }

  if (!newPass || newPass.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  if (newPass === currentPass) {
    return { success: false, error: 'New password cannot be identical to your current password.' };
  }

  // If in browser, make network request to /api/admin/password so server DB file & session update
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to change admin password on server.' };
      }
    } catch (err: any) {
      return { success: false, error: 'Network error connecting to password update service.' };
    }
  }

  const users = getStaffUsers();
  const normalized = userIdOrEmail.trim().toLowerCase();
  const index = users.findIndex(
    (u) => u.id.toLowerCase() === normalized || u.email.toLowerCase() === normalized
  );

  if (index !== -1) {
    const target = users[index];
    const newSalt = generateSalt(16);
    const newHash = await hashPassword(newPass, newSalt);

    users[index] = {
      ...target,
      salt: newSalt,
      passwordHash: newHash,
      updatedAt: new Date().toISOString(),
    };

    await persistCollection(STAFF_COLLECTION, users);

    // Update local admin storage if this is the active user
    try {
      const stored = localStorage.getItem('alhamd_active_admin');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.id === target.id || parsed.email?.toLowerCase() === target.email.toLowerCase())) {
          localStorage.setItem('alhamd_active_admin', JSON.stringify({ ...parsed, salt: newSalt, passwordHash: newHash }));
        }
      }
    } catch {}

    await logActivity({
      adminEmail: target.email,
      action: 'Changed Account Password',
      target: target.email,
      details: 'Self-service admin password update completed securely',
    });
  }

  return { success: true };
}

export async function toggleStaffStatus(
  id: string,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; newStatus?: 'active' | 'inactive'; error?: string }> {
  const users = getStaffUsers();
  const target = users.find((u) => u.id === id || u.email.toLowerCase() === id.toLowerCase());

  if (!target) {
    return { success: false, error: 'Staff account not found.' };
  }

  if (target.isOwner || target.email.toLowerCase() === 'admin@alhamdmobile.com') {
    return { success: false, error: 'The primary Admin/Owner cannot be deactivated.' };
  }

  const newStatus = target.status === 'active' ? 'inactive' : 'active';
  const res = await updateStaffUser(target.id, { status: newStatus }, operatorEmail);

  if (!res.success) {
    return { success: false, error: res.error };
  }

  return { success: true, newStatus };
}

export async function deleteStaffUser(
  id: string,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  // If in browser, make network request to DELETE /api/admin/staff?id=...
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/staff?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(operatorEmail),
        credentials: 'include',
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to delete staff account on server.' };
      }
    } catch (err: any) {
      return { success: false, error: 'Network error connecting to staff service.' };
    }
  }

  const users = getStaffUsers();
  const target = users.find((u) => u.id === id || u.email.toLowerCase() === id.toLowerCase());

  if (!target) {
    return { success: false, error: 'Staff account not found.' };
  }

  if (target.isOwner || target.email.toLowerCase() === 'admin@alhamdmobile.com') {
    return { success: false, error: 'The primary Admin/Owner account cannot be deleted.' };
  }

  // Prevent deleting the last super admin
  const superAdmins = users.filter((u) => (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN') && u.status === 'active');
  if ((target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') && superAdmins.length <= 1) {
    return { success: false, error: 'Cannot delete the last remaining active administrator account.' };
  }

  const filtered = users.filter((u) => u.id !== target.id && u.email.toLowerCase() !== target.email.toLowerCase());
  await persistCollection(STAFF_COLLECTION, filtered);
  try {
    localStorage.setItem('admin_users', JSON.stringify(filtered));
  } catch {}

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Deleted Staff Account',
    target: target.email,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// PERMISSION CHECKERS
// ---------------------------------------------------------------------------

export function hasStaffPermission(staff?: StaffUser | null, permissionKey?: string): boolean {
  if (!staff || staff.status === 'inactive') return false;
  if (!permissionKey) return true;
  if (staff.isOwner || staff.role === 'SUPER_ADMIN' || staff.role === 'ADMIN') return true;
  return Array.isArray(staff.permissions) && staff.permissions.includes(permissionKey);
}

export function hasAnyStaffPermission(staff?: StaffUser | null, permissionKeys: string[] = []): boolean {
  if (!staff || staff.status === 'inactive') return false;
  if (permissionKeys.length === 0) return true;
  if (staff.isOwner || staff.role === 'SUPER_ADMIN' || staff.role === 'ADMIN') return true;
  return permissionKeys.some((key) => hasStaffPermission(staff, key));
}
