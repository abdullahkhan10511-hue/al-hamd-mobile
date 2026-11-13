import fs from 'fs';

let p = fs.readFileSync('lib/permissions.ts', 'utf8');

const additional = `
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
  const cleanPath = pathname.split('?')[0].replace(/\\/$/, '') || '/admin';

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
    const roleStr = String(userOrRole).toLowerCase().replace(/[\\s_-]/g, '');
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
`;

if (!p.includes('canAccessAdminRoute')) {
  p += additional;
  fs.writeFileSync('lib/permissions.ts', p, 'utf8');
  console.log('Added route permissions to lib/permissions.ts');
}

// Update app/admin/layout.tsx
let layout = fs.readFileSync('app/admin/layout.tsx', 'utf8');
layout = layout.replace("import { canAccessAdminRoute } from '@/lib/db/admins';", "import { canAccessAdminRoute } from '@/lib/permissions';");
fs.writeFileSync('app/admin/layout.tsx', layout, 'utf8');
console.log('Updated app/admin/layout.tsx');

// Update lib/db/admins.ts to re-export from lib/permissions
let admins = fs.readFileSync('lib/db/admins.ts', 'utf8');
admins = admins.replace("export function isSuperAdmin", "export { isSuperAdmin, isAdminOrSuper, isManager, canAccessAdminRoute } from '@/lib/permissions';\n/*\nexport function isSuperAdmin");
admins = admins.replace("// Backwards-compatible wrapper functions", "*/\n// Backwards-compatible wrapper functions");
fs.writeFileSync('lib/db/admins.ts', admins, 'utf8');
console.log('Updated lib/db/admins.ts');

