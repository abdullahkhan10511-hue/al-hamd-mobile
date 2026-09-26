import { NextRequest, NextResponse } from 'next/server';
import { createPosSale, getPosDailySummary, getPosOrders } from '@/lib/db/pos';
import { getServerStaffByEmail } from '@/lib/db/staff-server';

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

    const body = await request.json();
    const {
      items,
      customer,
      discountType,
      discountValue,
      discountReason,
      promoCode,
      paymentMethod,
      amountPaid,
      paymentReference,
      notes,
      catalogSnapshot,
    } = body;

    // Check discount permission if a manual discount is specified
    if (discountValue && Number(discountValue) > 0) {
      const roleStr = (session.role || '').toLowerCase();
      const isPrivileged = roleStr.includes('admin') || roleStr.includes('owner') || roleStr === 'manager';
      const hasDiscountPerm = session.permissions?.includes('pos.apply_discount');

      if (!isPrivileged && !hasDiscountPerm) {
        return NextResponse.json({
          success: false,
          error: 'Permission Denied: Your staff role is not authorized to grant manual discounts.',
        }, { status: 403 });
      }
    }

    const result = await createPosSale({
      items,
      catalogSnapshot: Array.isArray(catalogSnapshot) ? catalogSnapshot : Array.isArray(body.products) ? body.products : undefined,
      customer,
      discountType,
      discountValue,
      discountReason,
      promoCode: typeof promoCode === 'string' ? promoCode.trim() : undefined,
      paymentMethod: paymentMethod || 'Cash',
      amountPaid: Number(amountPaid) || 0,
      paymentReference,
      cashierId: session.id,
      cashierName: session.name || session.email.split('@')[0],
      cashierEmail: session.email,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('API /api/admin/pos POST Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error processing sale.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Staff session required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    if (view === 'summary') {
      const summary = getPosDailySummary(session.email);
      return NextResponse.json({ success: true, summary });
    }

    const query = searchParams.get('query') || '';
    const orders = getPosOrders(query);
    return NextResponse.json({ success: true, orders });
  } catch (err: any) {
    console.error('API /api/admin/pos GET Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error loading POS data.' }, { status: 500 });
  }
}
