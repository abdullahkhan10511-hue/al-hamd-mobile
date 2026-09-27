import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { getOrderByIdFromDb, updateOrderStatusInDb, updatePaymentStatusInDb } from '@/lib/db/repositories/orders';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const order = await getOrderByIdFromDb(id);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const { id } = await params;
    const body = await request.json();

    let updatedOrder = null;

    if (body.status) {
      updatedOrder = await updateOrderStatusInDb(id, body.status, session.email);
    }

    if (body.paymentStatus) {
      updatedOrder = await updatePaymentStatusInDb(
        id,
        body.paymentStatus,
        body.note,
        session.email
      );
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
