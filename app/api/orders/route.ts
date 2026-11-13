import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllOrdersFromDb, createOrderInDb } from '@/lib/db/repositories/orders';
import { getAdminSessionAsync, hasAdminPermission } from '@/lib/db/adminAuth';
import { getCustomerSession } from '@/lib/db/customerSession';
import { getServerCustomerById } from '@/lib/db/customers-server';
import { readPersistentPaymentConfig, computeAllowedCustomerTypes } from '@/lib/db/paymentMethodsStorage';
import { seedOrders } from '@/lib/db/seed';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSessionAsync(request);
    const customer = await getCustomerSession(request);

    if (admin) {
      if (!hasAdminPermission(admin, ['orders.view', 'orders.manage'])) {
        return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions to view orders.' }, { status: 403 });
      }
    } else if (!customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: true, count: seedOrders.length, orders: seedOrders });
    }

    const { searchParams } = new URL(request.url);
    const orderSource = searchParams.get('orderSource') as 'ONLINE' | 'POS' | null;
    const status = searchParams.get('status') || undefined;

    let orders = await getAllOrdersFromDb({
      orderSource: orderSource || undefined,
      status,
      customerId: admin ? undefined : customer?.id,
    });

    if (!admin && customer) {
      // Task S5.6: Non-admins strictly only see orders matching verified customer.id (removes IDOR email/shop matching)
      orders = orders.filter(
        (o) => o.customer?.id === customer.id || (o as any).customerId === customer.id
      );
    }

    return NextResponse.json({ success: true, count: orders.length, orders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }

    const ip = getClientIp(request);
    const rateCheck = await checkRateLimit(`order_submit_${ip}`, 10, 3600000); // 10 orders/hr per IP
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds, 'Too many order submissions.');
    }

    const body = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot place order: Cart is empty.' },
        { status: 400 }
      );
    }

    if (body.items.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Cannot place order: Cart contains too many items (maximum 200 items per order).' },
        { status: 400 }
      );
    }

    // Validate each cart item strictly
    for (const item of body.items) {
      if (!item || typeof item !== 'object') {
        return NextResponse.json(
          { success: false, error: 'Invalid cart item payload.' },
          { status: 400 }
        );
      }
      if (!item.productId && !item.dealId) {
        return NextResponse.json(
          { success: false, error: 'Every cart item must specify a valid product or deal ID.' },
          { status: 400 }
        );
      }
      const qty = Number(item.quantity);
      if (isNaN(qty) || !Number.isInteger(qty) || qty <= 0 || qty > 100000) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid quantity for "${item.productName || 'Product'}". Must be a positive integer (1-100,000).`,
          },
          { status: 400 }
        );
      }
    }

    if (!body.customer || (!body.customer.firstName && !body.customer.phone && !body.shopName)) {
      return NextResponse.json(
        { success: false, error: 'Customer contact information is required.' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database is not configured. Please define DB_HOST, DB_USER, DB_NAME in .env.' },
        { status: 503 }
      );
    }

    // 1. Determine customer tier strictly from verified session and DB record
    const verifiedSession = await getCustomerSession(request);
    let customerType: 'RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE' = 'RETAIL';
    let fullCustomer = null;

    if (verifiedSession) {
      fullCustomer = await getServerCustomerById(verifiedSession.id);
      if (
        fullCustomer &&
        fullCustomer.status !== 'suspended' &&
        (fullCustomer as any).status !== 'inactive'
      ) {
        const ct = fullCustomer.customerType?.toUpperCase();
        if (ct === 'WHOLESALE' || ct === 'SUPER_WHOLESALE') {
          customerType = ct;
        }
      }
    }

    // Ignore client-sent properties to prevent spoofing
    body.customerType = customerType;
    body.orderType = customerType === 'RETAIL' ? 'online' : (customerType === 'SUPER_WHOLESALE' ? 'super_wholesale' : 'wholesale');
    body.wholesaleAccountId = fullCustomer?.id ? (customerType !== 'RETAIL' ? fullCustomer.id : null) : null;

    if (fullCustomer) {
      body.customer = {
        ...body.customer,
        id: fullCustomer.id,
      };
      body.customerId = fullCustomer.id;
    } else {
      if (body.customer) delete body.customer.id;
      delete body.customerId;
    }

    // 2. Validate payment method: must exist, be enabled, and be allowed for that tier
    const paymentMethodId = String(body.paymentMethodId || '').trim();
    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: 'Payment method is required.' },
        { status: 400 }
      );
    }

    const paymentConfig = readPersistentPaymentConfig();
    const targetMethod = paymentConfig.methods.find((m) => m.id === paymentMethodId);

    if (!targetMethod || !targetMethod.enabled) {
      return NextResponse.json(
        { success: false, error: 'Invalid or disabled payment method.' },
        { status: 400 }
      );
    }

    const allowedTiers = computeAllowedCustomerTypes(targetMethod);
    if (!allowedTiers.includes(customerType)) {
      return NextResponse.json(
        { success: false, error: 'This payment method is not available for your account type' },
        { status: 400 }
      );
    }

    // Store payment method NAME strictly from server config, never from browser
    body.paymentMethod = targetMethod.name;
    body.paymentMethodId = targetMethod.id;

    const order = await createOrderInDb(body);
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating order in MySQL:', err?.message || err);
    return NextResponse.json(
      { success: false, error: 'Failed to place order. Please try again later.' },
      { status: 500 }
    );
  }
}
