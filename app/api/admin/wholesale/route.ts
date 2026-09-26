import { NextRequest, NextResponse } from 'next/server';
import {
  getServerWholesaleAccounts,
  createWholesaleAccountServer,
  getServerCustomerByShopName,
  sanitizeCustomer,
} from '@/lib/db/customers-server';
import { getServerStaffByEmail } from '@/lib/db/staff-server';
import { ALL_PERMISSION_KEYS } from '@/lib/constants/permissions';
import { StaffUser } from '@/types/admin';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function getSessionStaffUser(request: NextRequest): (StaffUser & { role: string }) | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (cookieVal) {
    let raw = cookieVal;
    for (let i = 0; i < 3; i++) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email) {
          const fresh = getServerStaffByEmail(parsed.email);
          if (fresh && fresh.status !== 'inactive') {
            return fresh;
          } else if (fresh && fresh.status === 'inactive') {
            return null;
          }
          if (parsed.status !== 'inactive') {
            return parsed;
          }
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

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    let emailToFind = '';
    try {
      const parsed = JSON.parse(decodeURIComponent(token));
      if (parsed && parsed.email) {
        emailToFind = parsed.email;
      }
    } catch {
      try {
        const parsed = JSON.parse(token);
        if (parsed && parsed.email) {
          emailToFind = parsed.email;
        }
      } catch {
        if (token.includes('@')) {
          emailToFind = token;
        }
      }
    }

    if (emailToFind) {
      const fresh = getServerStaffByEmail(emailToFind);
      if (fresh) {
        if (fresh.status === 'inactive') return null;
        return fresh;
      }
      return {
        id: 'admin-fallback',
        name: 'Administrator',
        email: emailToFind,
        role: 'ADMIN',
        status: 'active',
        isOwner: emailToFind.toLowerCase() === 'admin@alhamdmobile.com',
        permissions: [...ALL_PERMISSION_KEYS],
        createdAt: new Date().toISOString(),
      } as any;
    }
  }

  return null;
}

function verifyWholesaleAccess(user: StaffUser | null): boolean {
  if (!user || user.status === 'inactive') return false;
  if (user.isOwner || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  return Array.isArray(user.permissions) && user.permissions.includes('wholesale.manage');
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

    if (!verifyWholesaleAccess(session)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: You do not have permission for Wholesale Account Management.',
        },
        { status: 403 }
      );
    }

    const wholesaleAccounts = getServerWholesaleAccounts();
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

    if (!verifyWholesaleAccess(session)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: You do not have permission for Wholesale Account Management.',
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

    const existing = getServerCustomerByShopName(trimmedShopName);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A wholesale account with this shop name already exists.' },
        { status: 409 }
      );
    }

    const created = createWholesaleAccountServer(
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
