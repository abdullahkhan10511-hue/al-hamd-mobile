import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCustomerById,
  updateSuperWholesaleAccountServer,
  deleteSuperWholesaleAccountServer,
  updateSuperWholesaleAccountStatusServer,
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
    isOwner: Boolean(session.isOwner || session.role === 'SUPER_ADMIN' || session.role === 'OWNER'),
    permissions: Array.isArray(session.permissions) ? session.permissions : [...ALL_PERMISSION_KEYS],
    createdAt: new Date().toISOString(),
  } as any;
}

function verifyWholesaleAccess(user: StaffUser | null): boolean {
  if (!user || user.status === 'inactive') return false;
  if (user.isOwner || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  return Array.isArray(user.permissions) && user.permissions.includes('wholesale.manage');
}

/**
 * GET /api/admin/super-wholesale/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionStaffUser(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Staff session required.' },
        { status: 401 }
      );
    }

    if (!verifyWholesaleAccess(session)) {
      return NextResponse.json(
        { success: false, error: 'Access denied: You do not have permission for Super Wholesale Account Management.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const account = await getServerCustomerById(id);

    if (!account || account.customerType !== 'SUPER_WHOLESALE') {
      return NextResponse.json(
        { success: false, error: 'Super Wholesale account not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      account: sanitizeCustomer(account),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch super wholesale account.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/super-wholesale/[id]
 * Updates super wholesale account details (status, phone, address, password, shopName).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionStaffUser(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Staff session required.' },
        { status: 401 }
      );
    }

    if (!verifyWholesaleAccess(session)) {
      return NextResponse.json(
        { success: false, error: 'Access denied: You do not have permission for Super Wholesale Account Management.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { shopName, phone, address, status, password } = body;

    const updated = await updateSuperWholesaleAccountServer(
      id,
      {
        shopName: shopName ? String(shopName).trim() : undefined,
        phone: phone !== undefined ? String(phone).trim() : undefined,
        address: address !== undefined ? String(address).trim() : undefined,
        status: status || undefined,
        password: password && String(password).trim() ? String(password).trim() : undefined,
      },
      session.email
    );

    return NextResponse.json({
      success: true,
      account: sanitizeCustomer(updated),
      message: `Super Wholesale account "${updated.shopName}" updated successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update super wholesale account.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/super-wholesale/[id]
 * Quick status update (active / inactive / deactivated).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionStaffUser(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Staff session required.' },
        { status: 401 }
      );
    }

    if (!verifyWholesaleAccess(session)) {
      return NextResponse.json(
        { success: false, error: 'Access denied: You do not have permission for Super Wholesale Account Management.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['active', 'inactive', 'deactivated'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Valid status is required.' },
        { status: 400 }
      );
    }

    const success = await updateSuperWholesaleAccountStatusServer(id, status);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Super Wholesale account not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Account status updated to ${status}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update super wholesale account status.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/super-wholesale/[id]
 * Safely removes a super wholesale account.
 * IMPORTANT: Existing historical orders are preserved intact. Orders are NOT cascade deleted.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionStaffUser(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Staff session required.' },
        { status: 401 }
      );
    }

    if (!verifyWholesaleAccess(session)) {
      return NextResponse.json(
        { success: false, error: 'Access denied: You do not have permission for Super Wholesale Account Management.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const result = await deleteSuperWholesaleAccountServer(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to delete super wholesale account.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Super Wholesale account safely removed. All historical orders remain preserved.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete super wholesale account.' },
      { status: 500 }
    );
  }
}
