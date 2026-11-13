import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminSessionAsync,
  unauthorizedResponse,
  forbiddenResponse,
  hasAdminPermission,
} from '@/lib/db/adminAuth';
import { getCustomerSession } from '@/lib/db/customerSession';
import { isDbConfigured } from '@/lib/db/mysql';
import { getOrderByIdFromDb, updateOrderStatusInDb, updatePaymentStatusInDb } from '@/lib/db/repositories/orders';
import { OrderStatus, PaymentStatus } from '@/types/admin';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const admin = await getAdminSessionAsync(request);
    const customer = await getCustomerSession(request);

    if (!admin && !customer) {
      return unauthorizedResponse();
    }

    if (admin && !hasAdminPermission(admin, ['orders.view', 'orders.manage'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view order details.');
    }

    let order = null;
    if (isDbConfigured()) {
      order = await getOrderByIdFromDb(id);
    } else {
      const { getOrders } = await import('@/lib/db/orders');
      order = getOrders().find((o) => o.id.toLowerCase() === id.trim().toLowerCase()) || null;
    }

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    // Task S5.6: Strict ownership check strictly matching verified customer.id (removes IDOR matching by email or shopName)
    if (!admin && customer) {
      const custId = customer.id.toLowerCase();
      const orderCustId = ((order.customer?.id || (order as any).customerId) || '').toLowerCase();

      const isOwner = Boolean(custId && orderCustId && custId === orderCustId);

      if (!isOwner) {
        return forbiddenResponse('Forbidden: You do not have permission to view this order.');
      }
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
    // 1. CSRF Verification for state-changing requests (Task S13)
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
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
      return NextResponse.json({ success: true, message: 'Order status updated in offline storage.' });
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
