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

    // 3. Server-side authoritative price and total recomputation
    // Never trust client-submitted line prices, line totals, subtotal, discount, or order total
    let computedSubtotal = 0;
    if (isDbConfigured()) {
      const { query: dbQuery } = await import('@/lib/db/mysql');

      for (const item of body.items) {
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        let authoritativeUnitPrice = Number(item.price) || 0;

        if (item.itemType === 'DEAL' || item.dealId) {
          const dealId = item.dealId || item.productId;
          try {
            const dealRows: any = await dbQuery(
              'SELECT id, name, deal_price FROM deals WHERE id = ? OR slug = ? LIMIT 1',
              [dealId, dealId]
            );
            if (dealRows && dealRows.length > 0 && Number(dealRows[0].deal_price) > 0) {
              authoritativeUnitPrice = Number(dealRows[0].deal_price);
              item.productName = dealRows[0].name;
            }
          } catch {}
        } else if (item.productId) {
          try {
            const prodRows: any = await dbQuery(
              'SELECT id, name, sku, price, sale_price, wholesale_price, super_wholesale_price FROM products WHERE id = ? LIMIT 1',
              [item.productId]
            );
            if (prodRows && prodRows.length > 0) {
              const p = prodRows[0];
              const retailP = Number(p.price) || 0;
              const saleP = Number(p.sale_price) || 0;
              const wholesaleP = Number(p.wholesale_price) || 0;
              const superWholesaleP = Number(p.super_wholesale_price) || 0;

              if (customerType === 'SUPER_WHOLESALE') {
                authoritativeUnitPrice = superWholesaleP > 0 ? superWholesaleP : (wholesaleP > 0 ? wholesaleP : (saleP > 0 ? saleP : retailP));
              } else if (customerType === 'WHOLESALE') {
                authoritativeUnitPrice = wholesaleP > 0 ? wholesaleP : (saleP > 0 ? saleP : retailP);
              } else {
                authoritativeUnitPrice = (saleP > 0 && saleP < retailP) ? saleP : retailP;
              }
              item.productName = p.name;
              item.sku = p.sku;
            }
          } catch {}
        }

        item.price = authoritativeUnitPrice;
        item.total = authoritativeUnitPrice * qty;
        item.quantity = qty;
        computedSubtotal += item.total;
      }
    } else {
      computedSubtotal = body.items.reduce((sum: number, it: any) => {
        const p = Number(it.price) || 0;
        const q = Math.max(1, Math.floor(Number(it.quantity) || 1));
        it.total = p * q;
        return sum + it.total;
      }, 0);
    }

    body.subtotal = computedSubtotal;

    // Validate and recompute discounts server-side
    let computedDiscount = 0;
    if (body.promoCode && isDbConfigured()) {
      try {
        const { getPromoCodeByCodeFromDb } = await import('@/lib/db/repositories/promotions');
        const promo = await getPromoCodeByCodeFromDb(body.promoCode);
        if (promo && promo.isActive) {
          if (promo.discountType === 'percentage') {
            computedDiscount = Math.round((computedSubtotal * Number(promo.discountValue)) / 100);
          } else {
            computedDiscount = Number(promo.discountValue) || 0;
          }
          if (promo.maximumDiscount && computedDiscount > Number(promo.maximumDiscount)) {
            computedDiscount = Number(promo.maximumDiscount);
          }
          body.promoDiscountAmount = computedDiscount;
        } else {
          delete body.promoCode;
          delete body.promoDiscountAmount;
        }
      } catch {
        computedDiscount = 0;
      }
    } else if (body.orderSource === 'POS' && body.posDiscountValue) {
      const posVal = Number(body.posDiscountValue) || 0;
      if (body.posDiscountType === 'percentage') {
        computedDiscount = Math.round((computedSubtotal * posVal) / 100);
      } else {
        computedDiscount = posVal;
      }
    }

    body.discount = computedDiscount;
    const computedShipping = Number(body.shipping) > 0 ? Number(body.shipping) : 0;
    body.shipping = computedShipping;
    const computedTax = Number(body.tax) > 0 ? Number(body.tax) : 0;
    body.tax = computedTax;
    body.total = Math.max(0, computedSubtotal - computedDiscount + computedShipping + computedTax);

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
