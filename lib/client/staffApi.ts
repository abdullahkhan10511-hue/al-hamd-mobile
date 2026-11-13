import { StaffUser, StaffRole, AdminRole } from '@/types/admin';
import {
  ALL_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSIONS,
  PREDEFINED_ROLES,
  getAdminAuthHeaders,
} from '@/lib/permissions';

const ROLES_STORAGE_KEY = 'alhamd_store_staff_roles';

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

export async function fetchStaffUsersApi(): Promise<StaffUser[]> {
  try {
    const res = await fetch('/api/admin/staff', {
      headers: getAdminAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success && Array.isArray(data.staff)) {
        return data.staff;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch staff list:', err);
  }
  return [];
}

export async function createStaffUserApi(
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
  _operatorEmail?: string
): Promise<{ success: boolean; staff?: StaffUser; error?: string }> {
  try {
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Failed to create staff member.' };
    }
    return { success: true, staff: json.staff };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error creating staff member.' };
  }
}

export async function updateStaffUserApi(
  id: string,
  updates: Partial<Pick<StaffUser, 'name' | 'email' | 'phone' | 'avatar' | 'status' | 'role' | 'permissions'>> & {
    newPassword?: string;
  },
  _operatorEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ id, ...updates }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Failed to update staff member.' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating staff member.' };
  }
}

export async function deleteStaffUserApi(
  id: string,
  _operatorEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/staff?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders(),
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Failed to delete staff member.' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error deleting staff member.' };
  }
}

export async function resetStaffPasswordApi(
  id: string,
  newPassword: string,
  operatorEmail?: string
): Promise<{ success: boolean; error?: string }> {
  return updateStaffUserApi(id, { newPassword }, operatorEmail);
}

// ---------------------------------------------------------------------------
// Client Role Management (stored locally in browser storage)
// ---------------------------------------------------------------------------

export function getStaffRolesLocal(): StaffRole[] {
  if (typeof window === 'undefined') return INITIAL_SYSTEM_ROLES;
  try {
    const saved = localStorage.getItem(ROLES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge in any missing system roles
        const merged = [...parsed];
        for (const sys of INITIAL_SYSTEM_ROLES) {
          if (!merged.some((r) => r.name.toLowerCase() === sys.name.toLowerCase())) {
            merged.push(sys);
          }
        }
        return merged;
      }
    }
  } catch {}
  return INITIAL_SYSTEM_ROLES;
}

export async function createStaffRoleLocal(
  data: { name: string; description: string; permissions: string[] },
  _operatorEmail?: string
): Promise<{ success: boolean; role?: StaffRole; error?: string }> {
  const current = getStaffRolesLocal();
  const trimmedName = data.name.trim();
  if (!trimmedName) return { success: false, error: 'Role name is required.' };
  if (current.some((r) => r.name.toLowerCase() === trimmedName.toLowerCase())) {
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

  const updated = [...current, newRole];
  try {
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return { success: true, role: newRole };
}

export async function updateStaffRoleLocal(
  id: string,
  updates: Partial<Pick<StaffRole, 'name' | 'description' | 'permissions'>>,
  _operatorEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const current = getStaffRolesLocal();
  const idx = current.findIndex((r) => r.id === id);
  if (idx === -1) return { success: false, error: 'Role not found.' };

  const target = current[idx];
  const updatedRole: StaffRole = {
    ...target,
    ...(updates.name && !target.isSystemRole ? { name: updates.name.trim() } : {}),
    ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
    ...(updates.permissions ? { permissions: updates.permissions } : {}),
    updatedAt: new Date().toISOString(),
  };

  current[idx] = updatedRole;
  try {
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(current));
  } catch {}
  return { success: true };
}

export async function deleteStaffRoleLocal(
  id: string,
  _operatorEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const current = getStaffRolesLocal();
  const target = current.find((r) => r.id === id);
  if (!target) return { success: false, error: 'Role not found.' };
  if (target.isSystemRole) return { success: false, error: 'System roles cannot be deleted.' };

  const filtered = current.filter((r) => r.id !== id);
  try {
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
  return { success: true };
}

