import { NextRequest, NextResponse } from 'next/server';
import {
  getServerWholesaleAccounts,
  createWholesaleAccountServer,
  getServerCustomerByShopName,
  sanitizeCustomer,
} from '@/lib/db/customers-server';
import { getServerStaffByEmailSync } from '@/lib/db/staff-server';
import { ALL_PERMISSION_KEYS } from '@/lib/constants/permissions';
import { StaffUser } from '@/types/admin';

import { getAdminSession } from '@/lib/db/adminAuth';

function getSessionStaffUser(request: NextRequest): (StaffUser & { role: string }) | null {
  const session = getAdminSession(request);
  if (!session || !session.email) return null;

  const fresh = getServerStaffByEmailSync(session.email);
  if (fresh) {
    if (fresh.status === 'inactive') return null;
    return fresh;
  }

  return {
    id: session.id || 'admin-root',
    name: session.name || 'Administrator',
    email: session.email,
    role: session.role || 'ADMIN',
    status: 'active',
    isOwner: Boolean(session.isOwner),
    permissions: Array.isArray(session.permissions) ? session.permissions : [],
    createdAt: new Date().toISOString(),
  } as any;
}

function verifyWholesaleReadAccess(user: StaffUser | null): boolean {
  if (!user || user.status === 'inactive') return false;
  if (user.isOwner) return true;
  const p = Array.isArray(user.permissions) ? user.permissions : [];
  return p.includes('*') || p.includes('wholesale.view') || p.includes('wholesale.manage') || p.includes('wholesale.create') || p.includes('wholesale.approve');
}

function verifyWholesaleWriteAccess(user: StaffUser | null): boolean {
  if (!user || user.status === 'inactive') return false;
  if (user.isOwner) return true;
  const p = Array.isArray(user.permissions) ? user.permissions : [];
  return p.includes('*') || p.includes('wholesale.manage') || p.includes('wholesale.create');
}

/**
 * GET /api/admin/wholesale
 * Lists wholesale accounts (requires wholesale.manage permission).
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionStaffUser(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Staff session required.' },
        { status: 401 }
      );
    }

    if (!verifyWholesaleReadAccess(session)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: You do not have permission to view Wholesale Accounts.',
        },
        { status: 403 }
      );
    }

    const wholesaleAccounts = await getServerWholesaleAccounts();
    const safeList = wholesaleAccounts.map(sanitizeCustomer);

    return NextResponse.json({
      success: true,
      accounts: safeList,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load wholesale accounts.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/wholesale
 * Creates a new wholesale account (requires wholesale.manage permission).
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionStaffUser(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Staff session required.' },
        { status: 401 }
      );
    }

    if (!verifyWholesaleWriteAccess(session)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: You do not have permission to create Wholesale Accounts.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { shopName, password, phone, address } = body;

    const trimmedShopName = (shopName || '').trim();
    if (!trimmedShopName) {
      return NextResponse.json(
        { success: false, error: 'Shop Name is required.' },
        { status: 400 }
      );
    }

    const trimmedPassword = (password || '').trim();
    if (!trimmedPassword) {
      return NextResponse.json(
        { success: false, error: 'Password is required.' },
        { status: 400 }
      );
    }

    if (trimmedPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 4 characters long.' },
        { status: 400 }
      );
    }

    const existing = await getServerCustomerByShopName(trimmedShopName);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A wholesale account with this shop name already exists.' },
        { status: 409 }
      );
    }

    const created = await createWholesaleAccountServer(
      {
        shopName: trimmedShopName,
        password: trimmedPassword,
        phone: phone ? String(phone).trim() : undefined,
        address: address ? String(address).trim() : undefined,
      },
      session.email
    );

    return NextResponse.json(
      {
        success: true,
        account: sanitizeCustomer(created),
        message: `Wholesale account "${created.shopName}" created successfully.`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create wholesale account.' },
      { status: 500 }
    );
  }
}
