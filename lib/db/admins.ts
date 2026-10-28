import { StaffUser, AdminRole } from '@/types/admin';
import { AdminSession } from './sessionToken';
import {
  createStaffUser,
  updateStaffUser,
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
  userOrRole: StaffUser | AdminSession | AdminRole | string | undefined | null,
  pathname: string
): boolean {
  if (!userOrRole) return false;

  // Clean path (strip query params and trailing slash)
  const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/admin';

  // Login page is accessible without admin permissions
  if (cleanPath === '/admin/login') return true;

  // Resolve staff user and effective permissions
  let permissions: string[] = [];

  if (typeof userOrRole === 'object') {
    if (userOrRole.status === 'inactive') return false;
    const isRootOwner = Boolean(
      userOrRole.isOwner ||
      userOrRole.id === 'staff-owner-1' ||
      (userOrRole.email && userOrRole.email.toLowerCase() === 'admin@alhamdmobile.com')
    );
    if (isRootOwner) {
      return true;
    }
    permissions = Array.isArray(userOrRole.permissions)
      ? userOrRole.permissions
      : (ROLE_DEFAULT_PERMISSIONS[userOrRole.role || ''] || []);
  } else {
    const roleStr = String(userOrRole).toLowerCase().replace(/[\s_-]/g, '');
    if (roleStr === 'owner') {
      return true;
    }
    permissions = ROLE_DEFAULT_PERMISSIONS[String(userOrRole)] || [];
  }

  if (permissions.includes('*')) return true;

  const has = (key: string) => {
    if (permissions.includes(key)) return true;
    if (
      (key === 'staff.add' || key === 'staff.create') &&
      (permissions.includes('staff.add') || permissions.includes('staff.create') || permissions.includes('staff.manage'))
    ) {
      return true;
    }
    if (key === 'staff.view' && permissions.includes('staff.manage')) return true;
    if (
      (key === 'brands.add' || key === 'brands.create') &&
      (permissions.includes('brands.add') || permissions.includes('brands.create') || permissions.includes('brands.manage'))
    ) {
      return true;
    }
    if (
      key === 'brands.view' &&
      (permissions.includes('brands.manage') || permissions.includes('brands.add') || permissions.includes('brands.edit'))
    ) {
      return true;
    }
    return false;
  };

  // Dashboard (/admin and /admin/dashboard) is accessible to any active staff member
  if (cleanPath === '/admin' || cleanPath === '/admin/dashboard') return true;

  // Staff Management (/admin/staff)
  if (pathname.startsWith('/admin/staff')) {
    return (
      has('staff.view') ||
      has('staff.manage') ||
      has('staff.add') ||
      has('staff.create') ||
      has('staff.edit') ||
      has('staff.change_roles')
    );
  }

  // Products
  if (pathname.startsWith('/admin/products')) {
    return has('products.view');
  }

  // Categories & Brands
  if (pathname.startsWith('/admin/categories')) {
    return has('categories.view');
  }
  // Brands — accessible with brand permissions or inherited category/product catalog permissions
  if (pathname.startsWith('/admin/brands')) {
    return (
      has('brands.view') ||
      has('brands.manage') ||
      has('brands.add') ||
      has('brands.create') ||
      has('brands.edit') ||
      has('brands.delete') ||
      has('categories.view') ||
      has('products.view')
    );
  }

  // Inventory
  if (pathname.startsWith('/admin/shop-inventory')) {
    return has('inventory.view_shop') || has('inventory.view');
  }
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
  if (pathname.startsWith('/admin/wholesale') || pathname.startsWith('/admin/super-wholesale')) {
    return has('wholesale.manage');
  }

  // Customers
  if (pathname.startsWith('/admin/customers')) {
    return has('customers.view');
  }

  // Customer Inquiries & Support Complaints
  if (pathname.startsWith('/admin/inquiries')) {
    return has('inquiries.view') || has('customers.view') || has('orders.view');
  }

  // Deals & Promotions
  if (pathname.startsWith('/admin/deals')) {
    return has('promotions.view') || has('promotions.add') || has('content.deals') || has('deals.view') || has('deals.manage');
  }
  // Promo Codes — mirrors sidebar config
  if (pathname.startsWith('/admin/promo-codes')) {
    return has('promotions.view') || has('promotions.add') || has('promotions.edit');
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
