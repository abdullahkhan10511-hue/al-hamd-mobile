'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { StaffUser, AdminRole } from '@/types/admin';
import { getStaffByEmail, getStaffUsers, hasStaffPermission, hasAnyStaffPermission, changeAdminSelfPassword } from '@/lib/db/staff';
import { persistCollection, invalidateClientCache } from '@/lib/db/storage';
import { resetSettingsSyncTimestamp } from '@/lib/db/settings';
import { resetProductsSyncTimestamp } from '@/lib/db/products';
import { resetNavigationSyncTimestamp } from '@/lib/db/navigation';
import { logActivity } from '@/lib/db/activity';
import { verifyPassword } from '@/lib/crypto';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

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
const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function setSessionCookies(token?: string) {
  if (typeof document === 'undefined' || !token || !token.startsWith('v1.')) return;
  const maxAge = 60 * 60 * 24 * 7;
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secureSuffix = isHttps ? '; Secure' : '';
  document.cookie = `${FALLBACK_COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; SameSite=Lax${secureSuffix}`;
}

function clearSessionCookies() {
  if (typeof document === 'undefined') return;
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secureSuffix = isHttps ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${secureSuffix}`;
  document.cookie = `${FALLBACK_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${secureSuffix}`;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Sync state with freshest record in database and server API
  const refreshAdmin = useCallback(async () => {
    try {
      // 1. Fetch live authoritative session from server API
      try {
        const res = await fetch('/api/admin/login', {
          credentials: 'include',
          headers: { 'Cache-Control': 'no-cache' },
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.authenticated && data?.user) {
            if (data.user.status === 'inactive') {
              localStorage.removeItem(ADMIN_STORAGE_KEY);
              clearSessionCookies();
              setAdmin(null);
              return;
            }
            setAdmin(data.user);
            localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data.user));
            if (data.token) {
              try {
                localStorage.setItem('alhamd_admin_token', data.token);
                sessionStorage.setItem('alhamd_admin_token', data.token);
              } catch {}
            }
            return;
          }
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem(ADMIN_STORAGE_KEY);
          clearSessionCookies();
          setAdmin(null);
          return;
        }
      } catch (networkErr) {
        // Fallback to local storage on network disconnect
      }

      // 2. Synchronize with freshest local storage records
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        const parsed: StaffUser = JSON.parse(saved);
        const fresh = getStaffByEmail(parsed.email);

        if (fresh && fresh.status !== 'inactive') {
          const expiresAt = (parsed as any).expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000);
          const fullFresh = { ...fresh, expiresAt };
          setAdmin((prev) => {
            const prevPerms = (prev?.permissions || []).slice().sort().join(',');
            const freshPerms = (fullFresh.permissions || []).slice().sort().join(',');
            if (
              prev &&
              prev.id === fresh.id &&
              prev.role === fresh.role &&
              prev.status === fresh.status &&
              prev.email === fresh.email &&
              prevPerms === freshPerms
            ) {
              return prev;
            }
            return fullFresh;
          });
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(fullFresh));
        } else if (fresh && fresh.status === 'inactive') {
          // Account was deactivated
          localStorage.removeItem(ADMIN_STORAGE_KEY);
          clearSessionCookies();
          setAdmin(null);
        }
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
            localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data.user));
            if (data.token) {
              try {
                localStorage.setItem('alhamd_admin_token', data.token);
                sessionStorage.setItem('alhamd_admin_token', data.token);
              } catch {}
            }
            setIsLoading(false);
            return;
          }
        } else if (res.status === 401 || res.status === 403) {
          // Explicitly unauthenticated or logged out on server
          localStorage.removeItem(ADMIN_STORAGE_KEY);
          localStorage.removeItem('alhamd_admin_token');
          sessionStorage.removeItem('alhamd_admin_token');
          clearSessionCookies();
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
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      localStorage.removeItem('alhamd_admin_token');
      sessionStorage.removeItem('alhamd_admin_token');
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

      // 1. Delegate authentication to server-side API endpoint
      try {
        const apiRes = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            if (data.token) {
              sessionStorage.setItem('alhamd_admin_token', data.token);
              localStorage.setItem('alhamd_admin_token', data.token);
              setSessionCookies(data.token);
            }
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
        // Fallback to local cryptographic verification if server is unreachable
      }

      // 2. Offline / Local fallback cryptographic verification
      const existingStaff = getStaffByEmail(normalizedEmail);

      if (!existingStaff) {
        setAuthLoading(false);
        return { success: false, error: 'Invalid email or password.' };
      }

      if (existingStaff.status === 'inactive') {
        setAuthLoading(false);
        return { success: false, error: 'This account has been deactivated.' };
      }

      let passwordValid = false;
      if (existingStaff.salt && existingStaff.passwordHash) {
        passwordValid = await verifyPassword(password, existingStaff.salt, existingStaff.passwordHash);
        if (!passwordValid && password.trim() !== password) {
          passwordValid = await verifyPassword(password.trim(), existingStaff.salt, existingStaff.passwordHash);
        }
      }

      if (!passwordValid) {
        setAuthLoading(false);
        return { success: false, error: 'Invalid email or password.' };
      }

      // Optional Firebase Auth sync
      if (auth && auth.app) {
        try {
          await signInWithEmailAndPassword(auth, normalizedEmail, password);
        } catch (firebaseErr: any) {
          // Fallback to internal cryptographically validated credentials
          console.debug('Firebase Auth background notice:', firebaseErr?.message);
        }
      }

      // Establish authenticated session
      const sessionUser: StaffUser = {
        ...existingStaff,
        lastLogin: new Date().toISOString(),
      };

      // Persist lastLogin to database collection
      const allStaff = getStaffUsers();
      const sIndex = allStaff.findIndex((s) => s.id === sessionUser.id);
      if (sIndex !== -1) {
        allStaff[sIndex] = sessionUser;
        await persistCollection('admin_users', allStaff);
      }

      try {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(sessionUser));
      } catch (e) {
        console.warn('Could not persist staff session to storage', e);
      }

      // Also notify server API endpoint
      try {
        fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password }),
        }).catch(() => {});
      } catch {}

      setAdmin(sessionUser);
      setIsLoading(false);
      setAuthLoading(false);

      await logActivity({
        adminEmail: sessionUser.email,
        action: `${sessionUser.role} Logged In`,
        target: 'Control Center',
        details: `Staff: ${sessionUser.name}`,
      });

      return { success: true, role: sessionUser.role };
    },
    []
  );

  const logout = useCallback(async () => {
    if (admin) {
      logActivity({
        adminEmail: admin.email,
        action: `${admin.role} Logged Out`,
        target: 'Staff Session',
        details: `Staff: ${admin.name}`,
      }).catch(() => {});
    }
    setAdmin(null);
    try {
      invalidateClientCache();
      resetSettingsSyncTimestamp();
      resetNavigationSyncTimestamp();
      resetProductsSyncTimestamp();
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      localStorage.removeItem('alhamd_admin_token');
      sessionStorage.removeItem('alhamd_admin_token');
      clearSessionCookies();
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
  }, [admin]);

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
      const res = await changeAdminSelfPassword(admin.id, currentPass, newPass);
      if (res.success) {
        refreshAdmin();
      }
      return res;
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
          Boolean(admin?.isOwner) ||
          admin?.id === 'staff-owner-1' ||
          (Boolean(admin?.email) && (
            admin!.email.toLowerCase() === 'admin@alhamdmobile.com' ||
            admin!.email.toLowerCase() === 'admin@alhamd.com'
          )),
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
