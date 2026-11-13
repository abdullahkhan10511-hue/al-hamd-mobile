'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { StaffUser, AdminRole } from '@/types/admin';
import { hasStaffPermission, hasAnyStaffPermission } from '@/lib/permissions';
import { invalidateClientCache } from '@/lib/db/storage';
import { resetSettingsSyncTimestamp } from '@/lib/db/settings';
import { resetProductsSyncTimestamp } from '@/lib/db/products';
import { resetNavigationSyncTimestamp } from '@/lib/db/navigation';

interface AdminAuthContextType {
  admin: StaffUser | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  hasPermission: (permissionKey: string) => boolean;
  hasAnyPermission: (permissionKeys: string[]) => boolean;
  refreshAdmin: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: AdminRole }>;
  logout: () => void | Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  authLoading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const ADMIN_STORAGE_KEY = 'alhamd_current_admin';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Sync state with freshest record from server API
  const refreshAdmin = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/session', {
        credentials: 'same-origin',
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.authenticated && data?.user) {
          if (data.user.status === 'inactive') {
            try {
              localStorage.removeItem(ADMIN_STORAGE_KEY);
            } catch {}
            setAdmin(null);
            return;
          }
          setAdmin(data.user);
          try {
            localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data.user));
          } catch {}
          return;
        }
      } else if (res.status === 401 || res.status === 403) {
        try {
          localStorage.removeItem(ADMIN_STORAGE_KEY);
        } catch {}
        setAdmin(null);
      }
    } catch (e) {
      console.warn('Could not refresh admin session', e);
    }
  }, []);

  // Restore authenticated session from server & cookies on mount
  useEffect(() => {
    let isMounted = true;

    async function checkServerSession() {
      try {
        const res = await fetch('/api/admin/login', {
          credentials: 'include',
          headers: { 'Cache-Control': 'no-cache' },
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.authenticated && data?.user && isMounted) {
            setAdmin(data.user);
            try {
              localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data.user));
            } catch {}
            setIsLoading(false);
            return;
          }
        } else if (res.status === 401 || res.status === 403) {
          try {
            localStorage.removeItem(ADMIN_STORAGE_KEY);
          } catch {}
          if (isMounted) {
            setAdmin(null);
            setIsLoading(false);
          }
          return;
        }
      } catch (err) {
        // Fallback or network error
      }

      if (!isMounted) return;

      // Fail closed: never restore unauthenticated admin sessions from localStorage
      try {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      } catch {}
      setAdmin(null);
      setIsLoading(false);
    }

    checkServerSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const key = customEvent?.detail?.key;
      // Only refresh admin session when staff or auth-related storage changes
      if (key && !['admin_users', 'staff_roles', ADMIN_STORAGE_KEY, 'alhamd_active_admin'].includes(key)) {
        return;
      }
      refreshAdmin();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [refreshAdmin]);

  // Protected route guard
  useEffect(() => {
    if (isLoading || authLoading) return;

    if (pathname?.startsWith('/admin')) {
      if (pathname === '/admin/login') {
        if (admin) {
          router.replace('/admin');
        }
      } else {
        if (!admin) {
          router.replace('/admin/login');
        }
      }
    }
  }, [admin, isLoading, authLoading, pathname, router]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string; role?: AdminRole }> => {
      setAuthLoading(true);

      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        setAuthLoading(false);
        return { success: false, error: 'Please enter a valid staff email address.' };
      }

      if (!password || password.length < 4) {
        setAuthLoading(false);
        return { success: false, error: 'Password must be at least 4 characters long.' };
      }

      // Delegate authentication authoritatively to server-side API endpoint
      try {
        const apiRes = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: normalizedEmail, password }),
        });

        const contentType = apiRes.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
          ? await apiRes.json().catch(() => null)
          : null;

        if (apiRes.ok && data?.success && data?.user) {
          const sessionUser: StaffUser = data.user;
          try {
            localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(sessionUser));
          } catch (e) {}

          setAdmin(sessionUser);
          invalidateClientCache();
          resetSettingsSyncTimestamp();
          resetNavigationSyncTimestamp();
          resetProductsSyncTimestamp();
          setIsLoading(false);
          setAuthLoading(false);

          return { success: true, role: sessionUser.role };
        } else if (apiRes.status === 401 || apiRes.status === 403) {
          setAuthLoading(false);
          return { success: false, error: data?.error || 'Invalid email or password.' };
        } else if (!apiRes.ok && data?.error) {
          setAuthLoading(false);
          return { success: false, error: data.error };
        }
      } catch (err) {
        setAuthLoading(false);
        return { success: false, error: 'Network error communicating with authentication service.' };
      }

      setAuthLoading(false);
      return { success: false, error: 'Login failed. Please verify credentials.' };
    },
    []
  );

  const logout = useCallback(async () => {
    setAdmin(null);
    try {
      invalidateClientCache();
      resetSettingsSyncTimestamp();
      resetNavigationSyncTimestamp();
      resetProductsSyncTimestamp();
      try {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      } catch {}
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
    } catch (e) {
      console.warn('Admin logout notice:', e);
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
  }, []);

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      return hasStaffPermission(admin, permissionKey);
    },
    [admin]
  );

  const hasAnyPermission = useCallback(
    (permissionKeys: string[]): boolean => {
      return hasAnyStaffPermission(admin, permissionKeys);
    },
    [admin]
  );

  const changePassword = useCallback(
    async (currentPass: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
      if (!admin) {
        return { success: false, error: 'You must be logged in as an administrator.' };
      }
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
        refreshAdmin();
        return { success: true };
      } catch {
        return { success: false, error: 'Network error connecting to password update service.' };
      }
    },
    [admin, refreshAdmin]
  );

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isSuperAdmin:
          admin?.role === 'SUPER_ADMIN' ||
          admin?.role === 'ADMIN' ||
          admin?.role === 'OWNER' ||
          Boolean(admin?.isOwner),
        isManager: admin?.role === 'Manager' || admin?.role === 'MANAGER',
        hasPermission,
        hasAnyPermission,
        refreshAdmin,
        login,
        logout,
        changePassword,
        isLoading,
        authLoading,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
