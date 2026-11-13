import { StaffUser, AdminRole } from '@/types/admin';
import {
  ALL_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSIONS,
  PREDEFINED_ROLES,
  ALL_PERMISSIONS,
  PERMISSION_MODULES,
  PERMISSION_PRESETS,
} from '@/lib/constants/permissions';

export {
  ALL_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSIONS,
  PREDEFINED_ROLES,
  ALL_PERMISSIONS,
  PERMISSION_MODULES,
  PERMISSION_PRESETS,
};

export function getAdminAuthHeaders(operatorEmail?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
  };
}

export function hasStaffPermission(staff?: StaffUser | null, permissionKey?: string): boolean {
  if (!staff || staff.status === 'inactive') return false;
  if (!permissionKey) return true;
  const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const isRoot = Boolean(
    staff.isOwner ||
    staff.role === 'SUPER_ADMIN' ||
    staff.role === 'OWNER' ||
    (envAdminEmail && staff.email && staff.email.toLowerCase() === envAdminEmail)
  );
  if (isRoot) return true;

  const staffPerms = Array.isArray(staff.permissions) && staff.permissions.length > 0
    ? staff.permissions
    : (ROLE_DEFAULT_PERMISSIONS[staff.role] || []);

  if (staffPerms && staffPerms.length > 0) {
    if (staffPerms.includes('*')) return true;
    if (staffPerms.includes(permissionKey)) return true;

    // PRICING PERMISSIONS ARE STRICT - DO NOT AUTO-GRANT FROM OTHER DOMAINS!
    if (permissionKey.startsWith('pricing.')) {
      if (staffPerms.includes('pricing.*') || staffPerms.includes('*')) return true;
      return false;
    }

    // Semantic aliases: staff management
    if (
      (permissionKey === 'staff.add' || permissionKey === 'staff.create') &&
      (staffPerms.includes('staff.add') || staffPerms.includes('staff.create') || staffPerms.includes('staff.manage'))
    ) {
      return true;
    }
    if (permissionKey === 'staff.view' && (staffPerms.includes('staff.manage') || staffPerms.includes('staff.view'))) return true;
    if (permissionKey === 'staff.edit' && (staffPerms.includes('staff.manage') || staffPerms.includes('staff.edit'))) return true;
    if (permissionKey === 'staff.delete' && (staffPerms.includes('staff.manage') || staffPerms.includes('staff.delete'))) return true;
    if (permissionKey === 'staff.change_roles' && (staffPerms.includes('staff.manage') || staffPerms.includes('staff.change_roles') || staffPerms.includes('staff.edit'))) return true;
    if (permissionKey === 'staff.reset_passwords' && (staffPerms.includes('staff.manage') || staffPerms.includes('staff.reset_passwords') || staffPerms.includes('staff.edit'))) return true;

    // Semantic aliases: brands
    if (
      (permissionKey === 'brands.add' || permissionKey === 'brands.create') &&
      (staffPerms.includes('brands.add') || staffPerms.includes('brands.create') || staffPerms.includes('brands.manage'))
    ) {
      return true;
    }
    if (
      permissionKey === 'brands.view' &&
      (staffPerms.includes('brands.manage') || staffPerms.includes('brands.add') || staffPerms.includes('brands.edit') || staffPerms.includes('brands.view'))
    ) {
      return true;
    }
    if (permissionKey === 'brands.edit' && staffPerms.includes('brands.manage')) return true;
    if (permissionKey === 'brands.delete' && staffPerms.includes('brands.manage')) return true;

    // Semantic aliases: categories
    if (
      (permissionKey === 'categories.add' || permissionKey === 'categories.create') &&
      (staffPerms.includes('categories.add') || staffPerms.includes('categories.create') || staffPerms.includes('categories.manage'))
    ) {
      return true;
    }
    if (
      permissionKey === 'categories.view' &&
      (staffPerms.includes('categories.manage') || staffPerms.includes('categories.add') || staffPerms.includes('categories.edit') || staffPerms.includes('categories.view'))
    ) {
      return true;
    }
    if (permissionKey === 'categories.edit' && (staffPerms.includes('categories.manage') || staffPerms.includes('categories.edit'))) return true;
    if (permissionKey === 'categories.delete' && (staffPerms.includes('categories.manage') || staffPerms.includes('categories.delete'))) return true;

    // Semantic aliases: products (strictly isolated from inventory stock adjust!)
    if (
      (permissionKey === 'products.add' || permissionKey === 'products.create') &&
      (staffPerms.includes('products.add') || staffPerms.includes('products.create') || staffPerms.includes('products.manage'))
    ) {
      return true;
    }
    if (
      permissionKey === 'products.view' &&
      (staffPerms.includes('products.view') || staffPerms.includes('products.manage'))
    ) {
      return true;
    }
    if (
      permissionKey === 'products.edit' &&
      (staffPerms.includes('products.edit') || staffPerms.includes('products.manage'))
    ) {
      return true;
    }
    if (permissionKey === 'products.delete' && (staffPerms.includes('products.delete') || staffPerms.includes('products.manage'))) return true;

    // Semantic aliases: inventory
    if (
      permissionKey === 'inventory.view' &&
      (staffPerms.includes('inventory.view') || staffPerms.includes('inventory.manage'))
    ) {
      return true;
    }
    if (
      (permissionKey === 'inventory.adjust_stock' || permissionKey === 'inventory.stock.edit' || permissionKey === 'inventory.stock') &&
      (staffPerms.includes('inventory.adjust_stock') || staffPerms.includes('inventory.stock.edit') || staffPerms.includes('inventory.stock') || staffPerms.includes('inventory.manage'))
    ) {
      return true;
    }
    if (
      permissionKey === 'inventory.edit_warning' &&
      (staffPerms.includes('inventory.edit_warning') || staffPerms.includes('inventory.manage'))
    ) {
      return true;
    }
    if (
      permissionKey === 'inventory.shop_bill' &&
      (staffPerms.includes('inventory.shop_bill') || staffPerms.includes('inventory.manage'))
    ) {
      return true;
    }

    // Semantic aliases: orders
    if (
      permissionKey === 'orders.view' &&
      (staffPerms.includes('orders.view') || staffPerms.includes('orders.manage'))
    ) {
      return true;
    }
    if (
      permissionKey === 'orders.update_status' &&
      (staffPerms.includes('orders.update_status') || staffPerms.includes('orders.manage'))
    ) {
      return true;
    }
    if (
      permissionKey === 'orders.process' &&
      (staffPerms.includes('orders.process') || staffPerms.includes('orders.manage'))
    ) {
      return true;
    }
  }
  return false;
}

export function hasAnyStaffPermission(staff?: StaffUser | null, permissionKeys: string[] = []): boolean {
  if (!staff || staff.status === 'inactive') return false;
  if (permissionKeys.length === 0) return true;
  const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const isRoot = Boolean(
    staff.isOwner ||
    staff.role === 'SUPER_ADMIN' ||
    staff.role === 'OWNER' ||
    (envAdminEmail && staff.email && staff.email.toLowerCase() === envAdminEmail)
  );
  if (isRoot) return true;
  return permissionKeys.some((key) => hasStaffPermission(staff, key));
}


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
  userOrRole: StaffUser | { role?: string; isOwner?: boolean; permissions?: string[]; status?: string; email?: string } | AdminRole | string | undefined | null,
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
    const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const isRootOwner = Boolean(
      userOrRole.isOwner ||
      userOrRole.role === 'SUPER_ADMIN' ||
      userOrRole.role === 'OWNER' ||
      (envAdminEmail && userOrRole.email && userOrRole.email.toLowerCase() === envAdminEmail)
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
      (key === 'brands.view') &&
      (permissions.includes('brands.manage') || permissions.includes('brands.add') || permissions.includes('brands.edit'))
    ) {
      return true;
    }
    if (
      (key === 'products.add' || key === 'products.create') &&
      (permissions.includes('products.add') || permissions.includes('products.create') || permissions.includes('products.manage'))
    ) {
      return true;
    }
    if (key === 'products.view' && (permissions.includes('products.view') || permissions.includes('products.manage'))) {
      return true;
    }
    if (key === 'products.edit' && (permissions.includes('products.edit') || permissions.includes('products.manage'))) {
      return true;
    }
    if (key === 'inventory.view' && permissions.includes('inventory.manage')) {
      return true;
    }
    return false;
  };

  // Dashboard (/admin and /admin/dashboard) strictly requires dashboard.view permission
  if (cleanPath === '/admin' || cleanPath === '/admin/dashboard') {
    return has('dashboard.view');
  }

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
  if (pathname.startsWith('/admin/products/new')) {
    return has('products.create') || has('products.add') || has('products.view');
  }
  if (pathname.startsWith('/admin/products')) {
    return has('products.view') || has('products.create') || has('products.add') || has('products.edit');
  }

  // Categories & Brands
  if (pathname.startsWith('/admin/categories')) {
    return has('categories.view');
  }
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
  if (pathname.startsWith('/admin/shop-bills')) {
    return has('inventory.shop_bill') || has('inventory.view_shop') || has('inventory.view');
  }
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
    return has('wholesale.view') || has('wholesale.manage');
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
    return has('finance.view') || has('orders.view') || has('products.view');
  }

  // Default fallback for unspecified admin routes
  return false;
}
