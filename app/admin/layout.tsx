'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Tag,
  Warehouse,
  Users,
  TrendingUp,
  Sparkles,
  Image as ImageIcon,
  Menu as MenuIcon,
  FileText,
  Settings,
  ShieldAlert,
  FileCode,
  Bell,
  Search,
  LogOut,
  ExternalLink,
  ChevronRight,
  X,
  Printer,
  History,
  Flame,
  CreditCard,
  ShieldCheck,
  Lock,
  ReceiptText,
  MapPin,
  Palette,
  Store,
  TicketPercent,
  Building2,
  Video,
} from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/context/AdminAuthContext';
import { getNotifications, markNotificationAsRead } from '@/lib/db/notifications';
import { canAccessAdminRoute } from '@/lib/db/admins';

interface NavItemConfig {
  label: string;
  href: string;
  icon: any;
  permission?: string;
  permissions?: string[];
  superOnly?: boolean;
}

// Master Admin Navigation Items mapped to permissions
const allAdminNavItems: NavItemConfig[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Shop Counter / POS', href: '/admin/pos', icon: Store, permissions: ['orders.view', 'pos.view'] },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingBag, permission: 'orders.view' },
  { label: 'Invoices & Bills', href: '/admin/invoices', icon: Printer, permissions: ['orders.print_bills', 'orders.view'] },
  { label: 'Store & Bill Settings', href: '/admin/bill-settings', icon: ReceiptText, permissions: ['settings.view', 'orders.print_bills'] },
  { label: 'Payment Methods', href: '/admin/payment-methods', icon: CreditCard, permissions: ['settings.view', 'settings.edit'] },
  { label: 'Payment Verification', href: '/admin/payments', icon: ShieldCheck, permissions: ['orders.process', 'orders.view'] },
  { label: 'Products', href: '/admin/products', icon: Package, permission: 'products.view' },
  { label: 'New Arrivals', href: '/admin/new-arrivals', icon: Sparkles, permission: 'content.new_arrivals' },
  { label: 'Best Sellers', href: '/admin/best-sellers', icon: Flame, permission: 'content.best_sellers' },
  { label: 'Categories', href: '/admin/categories', icon: Layers, permission: 'categories.view' },
  { label: 'Brands', href: '/admin/brands', icon: Tag, permissions: ['categories.view', 'products.view'] },
  { label: 'Inventory', href: '/admin/inventory', icon: Warehouse, permission: 'inventory.view' },
  { label: 'Customers', href: '/admin/customers', icon: Users, permission: 'customers.view' },
  { label: 'Wholesale Accounts', href: '/admin/wholesale', icon: Building2, permission: 'wholesale.manage' },
  { label: 'Sales & Reports', href: '/admin/sales', icon: TrendingUp, permissions: ['orders.view', 'products.view'] },
  { label: 'Home Page Videos', href: '/admin/homepage-videos', icon: Video, permissions: ['content.homepage', 'content.media'] },
  { label: 'Homepage Control', href: '/admin/homepage', icon: Sparkles, permission: 'content.homepage' },
  { label: 'Promotional Banners', href: '/admin/banners', icon: ImageIcon, permissions: ['promotions.view', 'content.banners'] },
  { label: 'Promo Codes', href: '/admin/promo-codes', icon: TicketPercent, permissions: ['promotions.view', 'promotions.add', 'promotions.edit'] },
  { label: 'Navigation Menu', href: '/admin/navigation', icon: MenuIcon, permission: 'content.navigation' },
  { label: 'Media Library', href: '/admin/media', icon: ImageIcon, permissions: ['content.homepage', 'content.banners', 'products.add'] },
  { label: 'Pages & Legal', href: '/admin/pages', icon: FileCode, permissions: ['pages.view', 'content.navigation', 'settings.view'] },
  { label: 'Shop Location', href: '/admin/shop-location', icon: MapPin, permission: 'settings.view' },
  { label: 'Store Settings', href: '/admin/settings', icon: Settings, permissions: ['settings.view', 'settings.edit'] },
  { label: 'Login Appearance', href: '/admin/settings/login-appearance', icon: Palette, permissions: ['settings.view', 'settings.edit'] },
  { label: 'Staff Management', href: '/admin/staff', icon: Users, permission: 'staff.view' },
  { label: 'Activity Logs', href: '/admin/activity', icon: History, permissions: ['staff.view', 'settings.view'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}

function AccessDeniedView({ userRole, pathname }: { userRole?: string; pathname: string }) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const redirectedRef = React.useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown <= 0 && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace('/admin');
    }
  }, [countdown, router]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 border border-neutral-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
            403 Forbidden
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-950 mt-3">
            Access Denied
          </h2>
          <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
            Your staff account role (<strong className="text-neutral-900">{userRole || 'Staff Member'}</strong>) does not have authorization to access <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-900 font-mono text-[11px]">{pathname}</code>.
          </p>
          <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
            Module access is dynamically controlled by Role-Based Access Control (RBAC). Please contact the store administrator if you require additional operational permissions.
          </p>
        </div>

        <div className="pt-4 border-t border-neutral-100 flex flex-col gap-2">
          <Link
            href="/admin"
            className="w-full py-3 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <span>Return to Dashboard</span>
          </Link>
          <span className="text-[10px] text-neutral-400">
            Automatically redirecting in {countdown}s...
          </span>
        </div>
      </div>
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    admin,
    logout,
    isSuperAdmin,
    isManager,
    isAuthenticated,
    isLoading,
    authLoading,
    hasPermission,
    hasAnyPermission,
  } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Client-side route protection redirect if unauthenticated
  // All React hooks MUST be declared at the top before any conditional returns!
  useEffect(() => {
    if (!isLoading && !authLoading && (!isAuthenticated || !admin) && pathname !== '/admin/login') {
      const redirectUrl =
        pathname !== '/admin' && pathname !== '/admin/dashboard'
          ? `/admin/login?redirect=${encodeURIComponent(pathname)}`
          : '/admin/login';
      router.replace(redirectUrl);
    }
  }, [isLoading, authLoading, isAuthenticated, admin, pathname, router]);

  // If on login page, render plain without sidebar (AFTER all hooks are executed)
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Loading state while auth hydrates
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-xs text-neutral-400 font-mono tracking-wider uppercase">
          Verifying Staff Permissions...
        </p>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !admin) {
    return null;
  }

  // Check if current user is authorized for the active route
  const isAuthorized = canAccessAdminRoute(admin, pathname);

  // Dynamically filter navigation items based on current staff member's exact permissions
  const navItems = allAdminNavItems.filter((item) => {
    if (isSuperAdmin) return true;
    if (item.superOnly && !isSuperAdmin) return false;
    if (!item.permission && (!item.permissions || item.permissions.length === 0)) return true;
    if (item.permission && hasPermission(item.permission)) return true;
    if (item.permissions && hasAnyPermission(item.permissions)) return true;
    return false;
  });

  const notifications = getNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const panelBadgeLabel = isSuperAdmin
    ? 'ADMIN PANEL'
    : `${(admin.role || 'STAFF').toUpperCase()} PANEL`;

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex font-sans antialiased print:min-h-0 print:bg-white print:block">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-neutral-950 text-white border-r border-neutral-800 shrink-0 select-none print:hidden">
        {/* Brand Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg font-extrabold flex items-center justify-center text-xs tracking-wider ${
                isSuperAdmin
                  ? 'bg-white text-neutral-950'
                  : 'bg-amber-400 text-neutral-950'
              }`}
            >
              AL
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white uppercase block">
                AL·HAMD
              </span>
              <span
                className={`text-[10px] font-mono tracking-wider font-semibold uppercase ${
                  isSuperAdmin ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {panelBadgeLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Role Scope Notice for Non-Super Admin */}
        {!isSuperAdmin && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[11px] font-medium flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {admin.role} ({admin.permissions?.length || 0} permissions)
            </span>
          </div>
        )}

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-colors ${
                  isActive
                    ? 'bg-neutral-800 text-white font-semibold shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Profile Footer */}
        <div className="p-4 border-t border-neutral-800/80 bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden ${
                isSuperAdmin
                  ? 'bg-neutral-800 border border-neutral-700'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {admin?.avatar ? (
                <img src={admin.avatar} alt={admin.name} className="w-full h-full object-cover" />
              ) : (
                admin?.name?.slice(0, 2).toUpperCase() || 'ST'
              )}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{admin?.name || 'Staff'}</p>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                  isSuperAdmin ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {admin?.role || 'STAFF'}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 print:block print:w-full">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-neutral-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-xs print:hidden">
          {/* Mobile menu trigger & Live Store */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              aria-label="Open navigation drawer"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-700 transition-colors"
            >
              <span>Live Store</span>
              <ExternalLink className="w-3 h-3 text-neutral-400" />
            </Link>

            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                isSuperAdmin
                  ? 'bg-neutral-100 text-neutral-800 border border-neutral-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {panelBadgeLabel}
            </span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification Dropdown */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-full hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-neutral-200 p-4 z-50">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Notifications ({notifications.length})
                    </h4>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs text-neutral-400 hover:text-neutral-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="divide-y divide-neutral-100 max-h-80 overflow-y-auto mt-2">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationAsRead(n.id)}
                        className={`p-3 rounded-xl transition-colors cursor-pointer ${
                          n.read ? 'opacity-60' : 'bg-neutral-50 font-medium'
                        }`}
                      >
                        <p className="text-xs font-bold text-neutral-900">{n.title}</p>
                        <p className="text-xs text-neutral-600 mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-neutral-400 mt-1 block">
                          {new Date(n.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Current Staff Pill */}
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-neutral-200">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSuperAdmin ? 'bg-emerald-500' : 'bg-amber-500'
                } animate-pulse`}
              />
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-neutral-800 truncate max-w-[150px]">
                  {admin.name}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono uppercase">
                  {admin.role}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body with Route Guard Check */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto print:p-0 print:overflow-visible">
          {isAuthorized ? (
            children
          ) : (
            <AccessDeniedView userRole={admin.role} pathname={pathname} />
          )}
        </main>
      </div>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          <div className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-neutral-950 text-white z-50 flex flex-col justify-between overflow-y-auto">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-sm uppercase tracking-wider block">AL·HAMD</span>
                <span
                  className={`text-[10px] font-mono font-semibold uppercase ${
                    isSuperAdmin ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {panelBadgeLabel}
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium ${
                      isActive
                        ? 'bg-neutral-800 text-white font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-neutral-800 flex items-center justify-between">
              <div className="truncate pr-2">
                <p className="text-xs font-semibold text-white truncate">{admin.name}</p>
                <span
                  className={`text-[10px] font-mono uppercase ${
                    isSuperAdmin ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {admin.role}
                </span>
              </div>
              <button
                onClick={logout}
                className="text-rose-400 hover:text-rose-300 text-xs font-semibold shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
