import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllOrdersFromDb, createOrderInDb } from '@/lib/db/repositories/orders';
import { getAdminSessionAsync, hasAdminPermission } from '@/lib/db/adminAuth';

const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';

function getCustomerSession(request: NextRequest): { id?: string; email?: string; shopName?: string } | null {
  const cookieVal = request.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  if (!cookieVal) return null;
  let curr = cookieVal.trim();
  if (curr.startsWith('"') && curr.endsWith('"') && curr.length > 2) {
    curr = curr.slice(1, -1);
  }
  for (let i = 0; i < 4; i++) {
    try {
      const parsed = JSON.parse(curr);
      if (typeof parsed === 'string') {
        curr = parsed;
        continue;
      }
      if (parsed && typeof parsed === 'object' && (parsed.id || parsed.email || parsed.shopName)) {
        return parsed;
      }
      return null;
    } catch {
      if (curr.includes('\\"')) {
        curr = curr.replace(/\\"/g, '"');
        continue;
      }
      try {
        const decoded = decodeURIComponent(curr);
        if (decoded === curr) break;
        curr = decoded;
      } catch {
        break;
      }
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSessionAsync(request);
    const customer = getCustomerSession(request);

    if (admin) {
      if (!hasAdminPermission(admin, ['orders.view', 'orders.manage'])) {
        return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions to view orders.' }, { status: 403 });
      }
    } else if (!customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: true, count: 0, orders: [] });
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
      // Non-admins only see their own orders
      orders = orders.filter(
        (o) =>
          o.customer?.id === customer.id ||
          (customer.email && o.customer?.email?.toLowerCase() === customer.email.toLowerCase()) ||
          (customer.shopName && o.shopName?.toLowerCase() === customer.shopName.toLowerCase())
      );
    }

    return NextResponse.json({ success: true, count: orders.length, orders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`order_submit_${ip}`, 15, 300000); // 15 attempts per 5 mins
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many order attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before submitting again.`,
        },
        { status: 429 }
      );
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
