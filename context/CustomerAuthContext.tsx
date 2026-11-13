'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  SanitizedCustomer,
  updateCustomerProfile,
  changeCustomerPassword,
} from '@/lib/db/customers';

interface CustomerAuthContextType {
  customer: SanitizedCustomer | null;
  isAuthenticated: boolean;
  isWholesale: boolean;
  isSuperWholesale: boolean;
  isLoading: boolean;
  login: (emailOrShopName: string, password: string, intendedRedirect?: string) => Promise<any>;
  register: (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }) => Promise<SanitizedCustomer>;
  logout: () => void | Promise<void>;
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    dateOfBirth?: string;
    shopName?: string;
  }) => Promise<SanitizedCustomer>;
  changePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  refreshCustomer: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<SanitizedCustomer | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Task S5.5: Restore customer session strictly via GET /api/auth/customer/me
  // (Cookie is httpOnly and verified cryptographically on the server)
  const restoreSession = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;

      const res = await fetch('/api/auth/customer/me', {
        credentials: 'same-origin',
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && data?.customer) {
          setCustomer(data.customer);
          return;
        }
      }
      setCustomer(null);
    } catch (err) {
      console.warn('Customer session recovery error:', err);
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Task W5: Defer non-critical customer session check until idle/after load
    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(() => {
        restoreSession();
      }, { timeout: 1500 });
      return () => (window as any).cancelIdleCallback(id);
    } else {
      const timer = setTimeout(() => {
        restoreSession();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [restoreSession]);

  const login = async (emailOrShopName: string, password: string, intendedRedirect?: string): Promise<any> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/customer/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: emailOrShopName, password, redirect: intendedRedirect }),
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : null;

      if (!res.ok || !data?.success) {
        const isEmail = emailOrShopName.includes('@');
        const defaultMsg = isEmail
          ? 'Invalid email address or password.'
          : 'Invalid shop name or password.';
        throw new Error(data?.error || defaultMsg);
      }

      // Check if server recognized active administrator or staff credentials
      if (data.isAdmin || data.accountType === 'ADMIN' || data.accountType === 'STAFF') {
        setCustomer(null);
        if (typeof window !== 'undefined' && data.user) {
          localStorage.setItem('alhamd_current_admin', JSON.stringify(data.user));
        }
        return {
          id: data.user?.id || 'admin',
          email: data.user?.email || emailOrShopName,
          fullName: data.user?.name || (data.accountType === 'STAFF' ? 'Staff Member' : 'Administrator'),
          customerType: 'RETAIL',
          status: 'active',
          isAdmin: true,
          accountType: data.accountType || 'ADMIN',
          role: data.role || data.user?.role || 'ADMIN',
          redirect: data.redirect || '/admin/dashboard',
        };
      }

      const sanitized: SanitizedCustomer = data.customer;
      setCustomer(sanitized);

      return {
        ...sanitized,
        isAdmin: false,
        accountType: 'CUSTOMER',
        redirect: data.redirect || '/account',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }): Promise<SanitizedCustomer> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/customer/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to create customer account. Please try again.');
      }

      const sanitized: SanitizedCustomer = resData.customer;
      setCustomer(sanitized);
      return sanitized;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(async (): Promise<void> => {
    setCustomer(null);
    try {
      await fetch('/api/auth/customer/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } catch (e) {
      console.warn('Customer logout network notice:', e);
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  const updateProfile = async (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    dateOfBirth?: string;
    shopName?: string;
  }): Promise<SanitizedCustomer> => {
    if (!customer) {
      throw new Error('You must be signed in to update your profile.');
    }
    const updated = await updateCustomerProfile(customer.id, data);
    setCustomer(updated);
    return updated;
  };

  const changePassword = async (
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!customer) {
      throw new Error('You must be signed in to change your password.');
    }
    return await changeCustomerPassword(customer.id, currentPass, newPass);
  };

  const refreshCustomer = async (): Promise<void> => {
    if (!customer) return;
    try {
      const res = await fetch('/api/auth/customer/me', {
        credentials: 'same-origin',
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && data?.customer) {
          setCustomer(data.customer);
          return;
        }
      }
      setCustomer(null);
    } catch {
      // keep current state on network flicker
    }
  };

  const contextValue = useMemo<CustomerAuthContextType>(
    () => ({
      customer,
      isAuthenticated: !!customer,
      isWholesale: customer?.customerType === 'WHOLESALE',
      isSuperWholesale: customer?.customerType === 'SUPER_WHOLESALE',
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      refreshCustomer,
    }),
    [
      customer,
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      refreshCustomer,
    ]
  );

  return (
    <CustomerAuthContext.Provider value={contextValue}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}
