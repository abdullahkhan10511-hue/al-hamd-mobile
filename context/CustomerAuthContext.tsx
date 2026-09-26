'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  SanitizedCustomer,
  authenticateCustomer,
  registerCustomer,
  updateCustomerProfile,
  changeCustomerPassword,
  getCustomerById,
  sanitizeCustomer,
} from '@/lib/db/customers';

interface CustomerAuthContextType {
  customer: SanitizedCustomer | null;
  isAuthenticated: boolean;
  isWholesale: boolean;
  isLoading: boolean;
  login: (emailOrShopName: string, password: string) => Promise<SanitizedCustomer>;
  register: (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }) => Promise<SanitizedCustomer>;
  logout: () => void;
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

const CUSTOMER_SESSION_KEY = 'alhamd_customer_session';
const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';

function setCustomerCookie(customer: SanitizedCustomer) {
  if (typeof document === 'undefined') return;
  const payload = {
    id: customer.id,
    email: customer.email,
    shopName: customer.shopName || '',
    customerType: customer.customerType || 'RETAIL',
    fullName:
      customer.fullName ||
      customer.shopName ||
      `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
    role: 'CUSTOMER',
    status: customer.status || 'active',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const val = encodeURIComponent(JSON.stringify(payload));
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${CUSTOMER_COOKIE_NAME}=${val}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearCustomerCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${CUSTOMER_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function getCustomerFromCookie(): SanitizedCustomer | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + CUSTOMER_COOKIE_NAME + '=([^;]*)'));
  if (match && match[2]) {
    try {
      return JSON.parse(decodeURIComponent(match[2]));
    } catch {}
  }
  return null;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<SanitizedCustomer | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore customer session on mount
  const restoreSession = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      let sessionData: any = null;
      const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
      if (raw) {
        try {
          sessionData = JSON.parse(raw);
        } catch {}
      }

      if (!sessionData) {
        sessionData = getCustomerFromCookie();
      }

      if (!sessionData || !sessionData.id) {
        localStorage.removeItem(CUSTOMER_SESSION_KEY);
        clearCustomerCookie();
        setCustomer(null);
        setIsLoading(false);
        return;
      }

      // Re-verify against database
      let live = await getCustomerById(sessionData.id);
      if (!live && sessionData && sessionData.id && sessionData.status === 'active') {
        // Fallback to active valid session payload
        live = sessionData as any;
        try {
          const rawCust = localStorage.getItem('alhamd_store_customers');
          const list: any[] = rawCust ? JSON.parse(rawCust) : [];
          if (!list.some((c: any) => c.id === sessionData.id)) {
            list.unshift(sessionData);
            localStorage.setItem('alhamd_store_customers', JSON.stringify(list));
          }
        } catch {}
      }

      if (!live || live.status !== 'active') {
        localStorage.removeItem(CUSTOMER_SESSION_KEY);
        clearCustomerCookie();
        setCustomer(null);
      } else {
        const sanitized = sanitizeCustomer(live);
        setCustomer(sanitized);
        // Keep session storage & cookies in sync
        localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(sanitized));
        setCustomerCookie(sanitized);
      }
    } catch (err) {
      console.warn('Customer session recovery error:', err);
      try {
        localStorage.removeItem(CUSTOMER_SESSION_KEY);
        clearCustomerCookie();
      } catch (_) {}
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (emailOrShopName: string, password: string): Promise<SanitizedCustomer> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: emailOrShopName, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const isEmail = emailOrShopName.includes('@');
        const defaultMsg = isEmail
          ? 'Invalid email address or password.'
          : 'Invalid shop name or password.';
        throw new Error(data.error || defaultMsg);
      }
      const sanitized: SanitizedCustomer = data.customer;
      setCustomer(sanitized);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(sanitized));
        setCustomerCookie(sanitized);
        try {
          const rawCust = localStorage.getItem('alhamd_store_customers');
          const list: any[] = rawCust ? JSON.parse(rawCust) : [];
          if (!list.some((c: any) => c.id === sanitized.id)) {
            list.unshift(sanitized);
            localStorage.setItem('alhamd_store_customers', JSON.stringify(list));
          }
        } catch {}
      }
      return sanitized;
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
      const sanitized = await registerCustomer(data);
      setCustomer(sanitized);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(sanitized));
        setCustomerCookie(sanitized);
      }
      try {
        fetch('/api/auth/customer/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).catch(() => {});
      } catch {}
      return sanitized;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setCustomer(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CUSTOMER_SESSION_KEY);
      clearCustomerCookie();
    }
    try {
      fetch('/api/auth/customer/logout', { method: 'POST' }).catch(() => {});
    } catch {}
  };

  const updateProfile = async (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    dateOfBirth?: string;
  }): Promise<SanitizedCustomer> => {
    if (!customer) {
      throw new Error('You must be signed in to update your profile.');
    }
    const updated = await updateCustomerProfile(customer.id, data);
    setCustomer(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(updated));
    }
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
    const live = await getCustomerById(customer.id);
    if (live && live.status === 'active') {
      const sanitized = sanitizeCustomer(live);
      setCustomer(sanitized);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(sanitized));
      }
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        isAuthenticated: !!customer,
        isWholesale: customer?.customerType === 'WHOLESALE',
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        refreshCustomer,
      }}
    >
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
