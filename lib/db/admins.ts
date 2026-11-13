import { StaffUser, AdminRole } from '@/types/admin';
import {
  createStaffUser,
  updateStaffUser,
} from './staff';

export {
  getStaffUsers as getAdmins,
  getStaffByEmail as getAdminByEmail,
  deleteStaffUser as deleteAdminUser,
} from './staff';

export { isSuperAdmin, isAdminOrSuper, isManager, canAccessAdminRoute } from '@/lib/permissions';

// Backwards-compatible wrapper functions
export async function createAdminUser(
  data: Omit<StaffUser, 'id' | 'createdAt'>,
  currentAdminEmail = 'system'
): Promise<{ success: boolean; admin?: StaffUser; error?: string }> {
  const res = await createStaffUser(
    {
      name: data.name,
      email: data.email,
      password: (data as any).password || 'admin123',
      role: data.role,
      phone: data.phone,
      avatar: data.avatar,
      status: data.status,
      permissions: data.permissions,
    },
    currentAdminEmail
  );

  return { success: res.success, admin: res.staff, error: res.error };
}

export async function updateAdminUser(
  id: string,
  updates: Partial<StaffUser>,
  currentAdminEmail = 'system'
): Promise<{ success: boolean; error?: string }> {
  return updateStaffUser(id, updates, currentAdminEmail);
}
