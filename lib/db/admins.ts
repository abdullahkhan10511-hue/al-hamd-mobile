import { StaffUser, AdminUser, AdminRole } from '@/types/admin';
import {
  getStaffUsers,
  getStaffByEmail,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
  hasStaffPermission,
} from './staff';
import { ROLE_DEFAULT_PERMISSIONS } from '../constants/permissions';

export {
  getStaffUsers as getAdmins,
  getStaffByEmail as getAdminByEmail,
  deleteStaffUser as deleteAdminUser,
} from './staff';

export function isSuperAdmin(user?: StaffUser | null): boolean {
  return user?.role === 'SUPER_ADMIN' || Boolean(user?.isOwner);
}

export function isAdminOrSuper(user?: StaffUser | null): boolean {
  return user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || Boolean(user?.isOwner);
}

export function isManager(user?: StaffUser | null): boolean {
  return user?.role === 'Manager' || user?.role === 'MANAGER';
}

/**
 * Checks if a staff user (or role string) is permitted to access a given admin route.
 * Evaluates fine-grained permissions against path requirements.
 */
export function canAccessAdminRoute(
  userOrRole: StaffUser | AdminRole | undefined | null,
  pathname: string
): boolean {
  if (!userOrRole) return false;

  // Clean path (strip query params and trailing slash)
  const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/admin';

  // Login page is accessible without admin permissions
  if (cleanPath === '/admin/login') return true;

  // Resolve staff user and effective permissions
  let permissions: string[] = [];
  let isSuper = false;

  if (typeof userOrRole === 'object') {
    if (userOrRole.status === 'inactive') return false;
    const roleNormalized = (userOrRole.role || '').toLowerCase().replace(/[\s_-]/g, '');
    const isMainAdmin =
      userOrRole.email?.toLowerCase() === 'admin@alhamdmobile.com' ||
      userOrRole.email?.toLowerCase() === 'admin@alhamd.com' ||
      Boolean(userOrRole.isOwner) ||
      roleNormalized === 'superadmin' ||
      roleNormalized === 'admin' ||
      roleNormalized === 'owner' ||
      roleNormalized === 'administrator';

    if (isMainAdmin) {
      return true;
    }
    permissions = userOrRole.permissions || [];
    isSuper = Boolean(userOrRole.isOwner || roleNormalized === 'superadmin');
  } else {
    const roleStr = String(userOrRole).toLowerCase().replace(/[\s_-]/g, '');
    if (
      roleStr === 'superadmin' ||
      roleStr === 'admin' ||
      roleStr === 'owner' ||
      roleStr === 'administrator'
    ) {
      return true;
    }
    permissions = ROLE_DEFAULT_PERMISSIONS[String(userOrRole)] || [];
    isSuper = roleStr === 'superadmin';
  }

  if (isSuper) return true;

  const has = (key: string) => permissions.includes(key);

  // Dashboard (/admin and /admin/dashboard) is accessible to any active staff member
  if (cleanPath === '/admin' || cleanPath === '/admin/dashboard') return true;

  // Staff Management (Legacy /admin/admins and new /admin/staff)
  if (pathname.startsWith('/admin/staff') || pathname.startsWith('/admin/admins')) {
    return has('staff.view');
  }

  // Products
  if (pathname.startsWith('/admin/products')) {
    return has('products.view');
  }

  // Categories & Brands
  if (pathname.startsWith('/admin/categories') || pathname.startsWith('/admin/brands')) {
    return has('categories.view');
  }

  // Inventory
  if (pathname.startsWith('/admin/inventory')) {
    return has('inventory.view');
  }

  // Orders & Invoices & POS
  if (pathname.startsWith('/admin/pos')) {
    return has('pos.view') || has('orders.view');
  }
  if (pathname.startsWith('/admin/orders')) {
    return has('orders.view');
  }
  if (pathname.startsWith('/admin/invoices')) {
    return has('orders.print_bills') || has('orders.view');
  }

  // Payments
  if (pathname.startsWith('/admin/payments')) {
    return has('orders.process') || has('orders.view');
  }
  if (pathname.startsWith('/admin/payment-methods')) {
    return has('settings.view') || has('settings.edit');
  }

  // Wholesale Account Management
  if (pathname.startsWith('/admin/wholesale')) {
    return has('wholesale.manage');
  }

  // Customers
  if (pathname.startsWith('/admin/customers')) {
    return has('customers.view');
  }

  // Promotions & Banners
  if (pathname.startsWith('/admin/banners')) {
    return has('promotions.view') || has('content.banners');
  }

  // Website Content
  if (pathname.startsWith('/admin/homepage-videos')) {
    return has('content.homepage') || has('content.media');
  }
  if (pathname.startsWith('/admin/homepage')) {
    return has('content.homepage');
  }
  if (pathname.startsWith('/admin/new-arrivals')) {
    return has('content.new_arrivals');
  }
  if (pathname.startsWith('/admin/best-sellers')) {
    return has('content.best_sellers');
  }
  if (pathname.startsWith('/admin/navigation')) {
    return has('content.navigation');
  }
  if (pathname.startsWith('/admin/media')) {
    return has('content.homepage') || has('content.banners') || has('products.add');
  }
  if (pathname.startsWith('/admin/pages')) {
    return has('pages.view') || has('content.navigation') || has('settings.view');
  }
  if (pathname.startsWith('/admin/blog')) {
    return has('content.navigation') || has('settings.view');
  }

  // Settings & Bills
  if (pathname.startsWith('/admin/bill-settings')) {
    return has('settings.view') || has('orders.print_bills');
  }
  if (pathname.startsWith('/admin/shop-location') || pathname.startsWith('/admin/settings')) {
    return has('settings.view');
  }

  // Login Page Management
  if (pathname.startsWith('/admin/login-page')) {
    return has('settings.view') || has('content.homepage') || has('settings.edit');
  }

  // Activity & Sales
  if (pathname.startsWith('/admin/activity')) {
    return has('staff.view') || has('settings.view');
  }
  if (pathname.startsWith('/admin/sales')) {
    return has('orders.view') || has('products.view');
  }

  // Default fallback for unspecified admin routes
  return false;
}

// Backwards-compatible wrapper functions
export async function createAdminUser(
  data: Omit<StaffUser, 'id' | 'createdAt'>,
  currentAdminEmail = 'admin@alhamd.com'
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
  currentAdminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  return updateStaffUser(id, updates, currentAdminEmail);
}
