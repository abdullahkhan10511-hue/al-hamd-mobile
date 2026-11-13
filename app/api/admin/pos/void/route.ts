import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { NextRequest, NextResponse } from 'next/server';
import { voidPosSale } from '@/lib/db/pos';
import { voidOrderInDb } from '@/lib/db/repositories/orders';
import { isDbConfigured } from '@/lib/db/mysql';
import { requireAdmin } from '@/lib/db/requireAdmin';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'pos.void_sale');
    if (!auth.ok) return auth.response;
    const session = auth.session;

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
