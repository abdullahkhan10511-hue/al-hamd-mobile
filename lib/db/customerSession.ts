import 'server-only';
import { NextRequest } from 'next/server';
import {
  CUSTOMER_COOKIE_NAME,
  CUSTOMER_SESSION_TTL_MS,
  CustomerTokenPayload,
  createSignedCustomerToken,
  verifySignedCustomerToken,
} from './sessionToken';
import { getServerCustomerById } from './customers-server';
import { Customer } from '@/types/admin';

export {
  CUSTOMER_COOKIE_NAME,
  CUSTOMER_SESSION_TTL_MS,
  createSignedCustomerToken,
  verifySignedCustomerToken,
};
export type { CustomerTokenPayload };

export interface CustomerSession {
  id: string;
  email: string;
  name: string;
  shopName?: string;
  customerType: 'RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE';
  status: 'active' | 'suspended';
  expiresAt: number;
}

/**
 * Extracts and cryptographically verifies the customer session from incoming NextRequest.
 * 1. Verifies HMAC signature using the derived customer key (fails closed on tamper/expiry).
 * 2. Cross-references against the server-side database/storage to verify account exists and is active.
 * 3. Never trusts client-controlled body or query parameters for identity.
 */
export async function getCustomerSession(request: NextRequest): Promise<CustomerSession | null> {
  try {
    const cookieVal = request.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
    if (!cookieVal) return null;

    let cleanToken = cookieVal.trim();
    if (cleanToken.startsWith('"') && cleanToken.endsWith('"') && cleanToken.length > 2) {
      cleanToken = cleanToken.slice(1, -1);
    }
    if (cleanToken.includes('%')) {
      try {
        cleanToken = decodeURIComponent(cleanToken);
      } catch {}
    }

    // Cryptographic signature and expiration check (Edge and Node safe)
    const payload = verifySignedCustomerToken(cleanToken);
    if (!payload || !payload.sub) {
      return null;
    }

    // Authoritative database check by customer id
    const customer = await getServerCustomerById(payload.sub);
    if (!customer) {
      return null;
    }

    if (customer.status === 'suspended' || (customer as any).status === 'inactive') {
      return null;
    }

    const customerType = (customer.customerType || 'RETAIL').toUpperCase() as
      | 'RETAIL'
      | 'WHOLESALE'
      | 'SUPER_WHOLESALE';

    return {
      id: customer.id,
      email: customer.email || payload.email,
      name: customer.fullName || customer.shopName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer',
      shopName: customer.shopName || payload.shopName,
      customerType,
      status: (customer.status as any) || 'active',
      expiresAt: payload.exp,
    };
  } catch (err) {
    console.error('Customer session verification error:', err);
    return null;
  }
}
