import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, isAuthorizedForShopBill, isAuthorizedForVoidBill } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { getShopBillByIdFromDb, finalizeShopBillInDb, voidShopBillInDb } from '@/lib/db/repositories/shopBills';
import { allowDevMockFallback } from '@/lib/env';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAuthorizedForShopBill(session, false)) {
      return NextResponse.json({ success: false, error: 'Access denied: Inventory permission required.' }, { status: 403 });
    }

    let shopBill: any = null;
    if (isDbConfigured()) {
      shopBill = await getShopBillByIdFromDb(id);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevShopBillById } = await import('@/lib/db/serverDevStorage');
      shopBill = getDevShopBillById(id);
    } else {
      return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
    }

    if (!shopBill) {
      return NextResponse.json({ success: false, error: 'Shop Bill not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, shopBill });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as string;

    if (action === 'finalize') {
      if (!isAuthorizedForShopBill(session, true)) {
        return NextResponse.json({ success: false, error: 'Access denied: Shop Bill permission required.' }, { status: 403 });
      }

      let shopBill: any = null;
      if (isDbConfigured()) {
        shopBill = await finalizeShopBillInDb(id, session.email);
      } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
        const { finalizeDevShopBill } = await import('@/lib/db/serverDevStorage');
        shopBill = await finalizeDevShopBill(id, session.email);
      } else {
        return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
      }

      return NextResponse.json({ success: true, shopBill });
    }

    if (action === 'void') {
      if (!isAuthorizedForVoidBill(session)) {
        return NextResponse.json({ success: false, error: 'Access denied: Void Shop Bill permission required.' }, { status: 403 });
      }

      const voidReason = (body.voidReason || '').trim();
      if (!voidReason) {
        return NextResponse.json({ success: false, error: 'A void reason is required.' }, { status: 400 });
      }

      let shopBill: any = null;
      if (isDbConfigured()) {
        shopBill = await voidShopBillInDb(id, session.email, voidReason);
      } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
        const { voidDevShopBill } = await import('@/lib/db/serverDevStorage');
        shopBill = await voidDevShopBill(id, session.email, voidReason);
      } else {
        return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
      }

      return NextResponse.json({ success: true, shopBill });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Use "finalize" or "void".' }, { status: 400 });
  } catch (err: any) {
    console.error('Shop Bill PATCH error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Operation failed.' }, { status: 500 });
  }
}
