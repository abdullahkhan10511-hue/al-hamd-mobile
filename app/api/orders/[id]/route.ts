import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminSessionAsync,
  unauthorizedResponse,
  forbiddenResponse,
  hasAdminPermission,
  verifyCsrfOrigin,
} from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { getOrderByIdFromDb, updateOrderStatusInDb, updatePaymentStatusInDb } from '@/lib/db/repositories/orders';
import { OrderStatus, PaymentStatus } from '@/types/admin';

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Refunded',
];

const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
  'Pending',
  'Paid',
  'Failed',
  'Refunded',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      return NextResponse.json({ success: false, error: 'Invalid order ID.' }, { status: 400 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const order = await getOrderByIdFromDb(id);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to retrieve order details.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. CSRF Verification for state-changing requests
    if (!verifyCsrfOrigin(request)) {
      return forbiddenResponse('Forbidden: Invalid request origin.');
    }

    // 2. Authoritative server-side cryptographic authentication
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      return NextResponse.json({ success: false, error: 'Invalid order ID.' }, { status: 400 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const { status, paymentStatus, note } = body;

    // 3. Strict RBAC Enforcement: orders.view is strictly read-only and NEVER authorizes modifications
    if (status) {
      if (!VALID_ORDER_STATUSES.includes(status)) {
        return NextResponse.json({ success: false, error: 'Invalid order status transition value.' }, { status: 400 });
      }
      if (!hasAdminPermission(session, ['orders.update_status', 'orders.manage'])) {
        return forbiddenResponse('Forbidden: Insufficient permissions to modify order status.');
      }
    }

    if (paymentStatus) {
      if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
        return NextResponse.json({ success: false, error: 'Invalid payment status value.' }, { status: 400 });
      }
      if (!hasAdminPermission(session, ['orders.process', 'orders.manage'])) {
        return forbiddenResponse('Forbidden: Insufficient permissions to modify payment status.');
      }
    }

    if (!status && !paymentStatus) {
      return NextResponse.json({ success: false, error: 'No order updates provided.' }, { status: 400 });
    }

    if (note && (typeof note !== 'string' || note.length > 500)) {
      return NextResponse.json({ success: false, error: 'Note exceeds maximum length of 500 characters.' }, { status: 400 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    let updatedOrder = null;

    if (status) {
      updatedOrder = await updateOrderStatusInDb(id, status, session.email);
    }

    if (paymentStatus) {
      updatedOrder = await updatePaymentStatusInDb(
        id,
        paymentStatus,
        note ? String(note).trim() : undefined,
        session.email
      );
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update order status.' }, { status: 500 });
  }
}
