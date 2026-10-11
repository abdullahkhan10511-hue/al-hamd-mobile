import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllOrdersFromDb, createOrderInDb, getOrderByIdFromDb } from '@/lib/db/repositories/orders';
import { getAdminSession } from '@/lib/db/adminAuth';

const CUSTOMER_COOKIE_NAME = 'alhamd_customer_session';

function getCustomerSession(request: NextRequest): { id?: string; email?: string; shopName?: string } | null {
  const cookieVal = request.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  if (!cookieVal) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieVal));
    if (parsed && (parsed.id || parsed.email || parsed.shopName)) return parsed;
  } catch {
    try {
      const parsed = JSON.parse(cookieVal);
      if (parsed && (parsed.id || parsed.email || parsed.shopName)) return parsed;
    } catch {}
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = getAdminSession(request);
    const customer = getCustomerSession(request);

    if (!admin && !customer) {
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
      if (isNaN(qty) || !Number.isInteger(qty) || qty <= 0 || qty > 1000) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid quantity for "${item.productName || 'Product'}". Must be a positive integer (1-1000).`,
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
    console.error('Error creating order in MySQL:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to place order.' },
      { status: 500 }
    );
  }
}
