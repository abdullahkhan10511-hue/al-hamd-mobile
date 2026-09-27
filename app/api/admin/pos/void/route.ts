import { NextRequest, NextResponse } from 'next/server';
import { voidPosSale } from '@/lib/db/pos';
import { voidOrderInDb } from '@/lib/db/repositories/orders';
import { isDbConfigured } from '@/lib/db/mysql';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function getSessionUser(request: NextRequest): { id?: string; name?: string; email: string; role: string; permissions?: string[] } | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (cookieVal) {
    let raw = cookieVal;
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

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const parsed = JSON.parse(decodeURIComponent(token));
      if (parsed && parsed.email) return parsed;
    } catch {
      if (token.includes('@')) {
        return { email: token, role: 'ADMIN' };
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Staff session required.' }, { status: 401 });
    }

    const roleStr = (session.role || '').toLowerCase();
    const isPrivileged = roleStr.includes('admin') || roleStr.includes('owner') || roleStr === 'manager';
    const hasVoidPerm = session.permissions?.includes('pos.void_sale');

    if (!isPrivileged && !hasVoidPerm) {
      return NextResponse.json({
        success: false,
        error: 'Permission Denied: Your staff role is not authorized to void completed sales.',
      }, { status: 403 });
    }

    const body = await request.json();
    const { orderId, reason } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID is required.' }, { status: 400 });
    }

    if (isDbConfigured()) {
      try {
        const order = await voidOrderInDb(
          orderId,
          session.email,
          reason || 'Cashier void / counter cancellation'
        );
        return NextResponse.json({ success: true, order });
      } catch (voidErr: any) {
        return NextResponse.json({ success: false, error: voidErr.message || 'Failed to void order.' }, { status: 400 });
      }
    }

    const result = await voidPosSale(
      orderId,
      session.email,
      session.name || session.email.split('@')[0],
      reason || 'Cashier void / counter cancellation'
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('API /api/admin/pos/void POST Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error voiding sale.' }, { status: 500 });
  }
}
