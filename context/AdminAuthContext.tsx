'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { StaffUser, AdminUser, AdminRole } from '@/types/admin';
import { getStaffByEmail, getStaffUsers, hasStaffPermission, hasAnyStaffPermission, changeAdminSelfPassword } from '@/lib/db/staff';
import { persistCollection } from '@/lib/db/storage';
import { logActivity } from '@/lib/db/activity';
import { verifyPassword } from '@/lib/crypto';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AdminAuthContextType {
  admin: StaffUser | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  hasPermission: (permissionKey: string) => boolean;
  hasAnyPermission: (permissionKeys: string[]) => boolean;
  refreshAdmin: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: AdminRole }>;
  logout: () => void;
  changePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  authLoading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const ADMIN_STORAGE_KEY = 'alhamd_current_admin';
const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function setSessionCookies(user: StaffUser) {
  if (typeof document === 'undefined') return;
  const sessionPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isOwner: Boolean(user.isOwner),
    permissions: user.permissions || [],
    status: user.status || 'active',
    avatar: user.avatar || '',
    lastLogin: user.lastLogin || new Date().toISOString(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const val = encodeURIComponent(JSON.stringify(sessionPayload));
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${COOKIE_NAME}=${val}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${FALLBACK_COOKIE_NAME}=${val}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearSessionCookies() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  document.cookie = `${FALLBACK_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function getSessionFromCookie(): StaffUser | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + COOKIE_NAME + '|' + FALLBACK_COOKIE_NAME + ')=([^;]*)'));
  if (match && match[3]) {
    let raw = match[3];
    for (let i = 0; i < 3; i++) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email && parsed.status !== 'inactive') {
          return parsed;
        }
      } catch {
        try {
          raw = decodeURIComponent(raw);
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Sync state with freshest record in database
  const refreshAdmin = useCallback(() => {
    try {
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        const parsed: StaffUser = JSON.parse(saved);
        const fresh = getStaffByEmail(parsed.email);

        if (fresh && fresh.status !== 'inactive') {
          setAdmin(fresh);
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(fresh));
          setSessionCookies(fresh);
        } else if (fresh && fresh.status === 'inactive') {
          // Account was deactivated in real-time
          localStorage.removeItem(ADMIN_STORAGE_KEY);
          clearSessionCookies();
          setAdmin(null);
        } else if (fresh) {
          setAdmin(fresh);
          setSessionCookies(fresh);
        }
      }
    } catch (e) {
      console.warn('Could not refresh admin session', e);
    }
  }, []);

  // Restore authenticated session from storage & cookies on mount
  useEffect(() => {
    try {
      let activeUser: StaffUser | null = null;
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        const parsed: StaffUser = JSON.parse(saved);
        const fresh = getStaffByEmail(parsed.email);
        activeUser = fresh && fresh.status !== 'inactive' ? fresh : parsed;
      }

      // If no localStorage session found, check cookie
      if (!activeUser) {
        const cookieUser = getSessionFromCookie();
        if (cookieUser) {
          const fresh = getStaffByEmail(cookieUser.email);
          activeUser = fresh && fresh.status !== 'inactive' ? fresh : cookieUser;
        }
      }

      if (activeUser && activeUser.status !== 'inactive') {
        setAdmin(activeUser);
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(activeUser));
        setSessionCookies(activeUser);
      } else {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        clearSessionCookies();
        setAdmin(null);
      }
    } catch (e) {
      console.warn('Could not restore staff session', e);
    } finally {
      setIsLoading(false);
    }

    const handleUpdate = () => refreshAdmin();
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
        const data = await apiRes.json();
        if (apiRes.ok && data.success && data.user) {
          const sessionUser: StaffUser = data.user;
          try {
            localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(sessionUser));
            setSessionCookies(sessionUser);
          } catch (e) {}

          setAdmin(sessionUser);
          setIsLoading(false);
          setAuthLoading(false);

          return { success: true, role: sessionUser.role };
        } else if (apiRes.status === 401 || apiRes.status === 403) {
          setAuthLoading(false);
          return { success: false, error: data.error || 'Invalid email or password.' };
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
        setSessionCookies(sessionUser);
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

  const logout = useCallback(() => {
    if (admin) {
      logActivity({
        adminEmail: admin.email,
        action: `${admin.role} Logged Out`,
        target: 'Staff Session',
        details: `Staff: ${admin.name}`,
      });
    }
    setAdmin(null);
    try {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      clearSessionCookies();
      fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    } catch (e) {}
    router.push('/admin/login');
  }, [admin, router]);

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
        isSuperAdmin: admin?.role === 'SUPER_ADMIN' || admin?.role === 'ADMIN' || Boolean(admin?.isOwner),
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
