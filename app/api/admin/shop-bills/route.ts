import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, isAuthorizedForShopBill } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllShopBillsFromDb, createShopBillInDb } from '@/lib/db/repositories/shopBills';
import { allowDevMockFallback } from '@/lib/env';

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAuthorizedForShopBill(session, false)) {
      return NextResponse.json({ success: false, error: 'Access denied: Inventory permission required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let shopBills: any[] = [];
    if (isDbConfigured()) {
      shopBills = await getAllShopBillsFromDb(limit);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevShopBills } = await import('@/lib/db/serverDevStorage');
      shopBills = getDevShopBills(limit);
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, count: shopBills.length, shopBills });
  } catch (err: any) {
    console.error('Shop Bills GET error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAuthorizedForShopBill(session, true)) {
      return NextResponse.json({ success: false, error: 'Access denied: Shop Bill permission required.' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shop Bill must have at least one product.' },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.productId || !item.productName) {
        return NextResponse.json(
          { success: false, error: 'Each item must have a productId and productName.' },
          { status: 400 }
        );
      }
      if (!item.transferQuantity || Number(item.transferQuantity) <= 0) {
        return NextResponse.json(
          { success: false, error: `Transfer quantity for "${item.productName}" must be greater than 0.` },
          { status: 400 }
        );
      }
    }

    let shopBill: any = null;
    if (isDbConfigured()) {
      shopBill = await createShopBillInDb({
        items: body.items,
        notes: body.notes,
        createdBy: session.email,
      });
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { createDevShopBill } = await import('@/lib/db/serverDevStorage');
      shopBill = await createDevShopBill({
        items: body.items,
        notes: body.notes,
        createdBy: session.email,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, shopBill }, { status: 201 });
  } catch (err: any) {
    console.error('Shop Bill POST error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to create shop bill.' }, { status: 500 });
  }
}
