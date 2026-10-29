import { NextRequest, NextResponse } from 'next/server';
import { createPosSale, getPosDailySummary, getPosOrders } from '@/lib/db/pos';
import { createPosSaleInDb, getPosDailySummaryFromDb } from '@/lib/db/repositories/pos';
import { getAllOrdersFromDb } from '@/lib/db/repositories/orders';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAdminSession, unauthorizedResponse, forbiddenResponse, hasAdminPermission } from '@/lib/db/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse('Unauthorized: Staff session required.');
    }

    if (!hasAdminPermission(session, ['pos.create_sale', 'pos.view'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to process POS sales.');
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

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Sale must have at least one item.' }, { status: 400 });
    }
    if (items.length > 200) {
      return NextResponse.json({ success: false, error: 'Sale cannot contain more than 200 items.' }, { status: 400 });
    }

    // Check discount permission if a manual discount is specified
    if (discountValue && Number(discountValue) > 0) {
      if (!hasAdminPermission(session, ['pos.apply_discount'])) {
        return NextResponse.json({
          success: false,
          error: 'Permission Denied: Your staff account is not authorized to grant manual discounts.',
        }, { status: 403 });
      }
    }

    const saleParams = {
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
    };

    let result;
    if (isDbConfigured()) {
      result = await createPosSaleInDb(saleParams);
    } else {
      result = await createPosSale(saleParams);
    }

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
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse('Unauthorized: Staff session required.');
    }

    if (!hasAdminPermission(session, ['pos.view', 'pos.create_sale', 'pos.view_history', 'pos.close_register'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to access POS data.');
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    if (view === 'summary') {
      const summary = isDbConfigured()
        ? await getPosDailySummaryFromDb(session.email)
        : getPosDailySummary(session.email);
      return NextResponse.json({ success: true, summary });
    }

    const query = searchParams.get('query') || '';
    if (isDbConfigured()) {
      let orders = await getAllOrdersFromDb({ orderSource: 'POS' });
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        orders = orders.filter(
          (o) =>
            o.id.toLowerCase().includes(q) ||
            o.customer?.firstName?.toLowerCase().includes(q) ||
            o.customer?.phone?.includes(q) ||
            o.customer?.email?.toLowerCase().includes(q)
        );
      }
      return NextResponse.json({ success: true, orders });
    } else {
      const orders = getPosOrders(query);
      return NextResponse.json({ success: true, orders });
    }
  } catch (err: any) {
    console.error('API /api/admin/pos GET Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error loading POS data.' }, { status: 500 });
  }
}
