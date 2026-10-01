import { Customer, Order, OrderStatus, PaymentStatus } from '@/types/admin';
import { seedOrders } from './seed';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';
import { adjustStock, getProductById, getProductBySlug } from './products';
import { addNotification } from './notifications';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { validatePromoCode, recordPromoUsage } from './promotions';
import { getProductEffectivePrice, getModelEffectivePrice } from '@/lib/wholesale';
import { allowDevMockFallback } from '../env';

const COLLECTION_KEY = 'orders';

export function getOrders(): Order[] {
  const fallback = allowDevMockFallback() ? seedOrders : [];
  return getStoredCollection(COLLECTION_KEY, fallback);
}

export function getOrderById(id: string): Order | undefined {
  return getOrders().find((o) => o.id === id);
}

export function getOrderByInvoice(invoiceNumber: string): Order | undefined {
  return getOrders().find((o) => o.invoiceNumber === invoiceNumber);
}

export function generateNextOrderId(existingOrders: Order[]): string {
  const year = new Date().getFullYear();
  let maxSeq = 0;

  existingOrders.forEach((o) => {
    if (o.id && o.id.startsWith(`ORD-${year}-`)) {
      const parts = o.id.split('-');
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
  return `ORD-${year}-${nextSeq}`;
}

export function generateNextInvoiceNumber(existingOrders: Order[]): string {
  const year = new Date().getFullYear();
  let maxSeq = 0;

  existingOrders.forEach((o) => {
    if (o.invoiceNumber && o.invoiceNumber.startsWith(`INV-${year}-`)) {
      const parts = o.invoiceNumber.split('-');
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
  return `INV-${year}-${nextSeq}`;
}

function getVerifiedWholesaleCustomer(customerId?: string, shopName?: string): Customer | null {
  try {
    let customers: Customer[] = [];
    if (typeof window === 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.cwd(), 'data', 'customers.json');
        if (fs.existsSync(filePath)) {
          customers = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
      } catch {}
    }
    if (!customers || customers.length === 0) {
      customers = getStoredCollection<Customer>('customers', []);
    }
    if (customerId) {
      const match = customers.find(
        (c) =>
          c.id === customerId &&
          (c.customerType === 'WHOLESALE' || c.customerType === 'SUPER_WHOLESALE') &&
          c.status === 'active'
      );
      if (match) return match;
    }
    if (shopName) {
      const normalized = shopName.trim().toLowerCase();
      const match = customers.find(
        (c) =>
          (c.customerType === 'WHOLESALE' || c.customerType === 'SUPER_WHOLESALE') &&
          c.shopName &&
          c.shopName.trim().toLowerCase() === normalized &&
          c.status === 'active'
      );
      if (match) return match;
    }
  } catch (err) {
    console.warn('Error verifying wholesale customer:', err);
  }
  return null;
}

export async function createOrder(
  orderData: Omit<Order, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>
): Promise<Order> {
  // 1. Server-side validation of customerType and wholesale status
  const isReqSuperWholesale =
    orderData.customerType === 'SUPER_WHOLESALE' || orderData.orderType === 'super_wholesale';
  const isReqWholesale =
    orderData.customerType === 'WHOLESALE' || orderData.orderType === 'wholesale';

  const verifiedCustomer =
    isReqSuperWholesale || isReqWholesale || orderData.shopName
      ? getVerifiedWholesaleCustomer(orderData.customer?.id, orderData.shopName)
      : null;

  const isSuperWholesaleOrder =
    (verifiedCustomer && verifiedCustomer.customerType === 'SUPER_WHOLESALE') ||
    orderData.customerType === 'SUPER_WHOLESALE' ||
    orderData.orderType === 'super_wholesale';

  const isWholesaleOrder =
    !isSuperWholesaleOrder &&
    (Boolean(verifiedCustomer) ||
      orderData.customerType === 'WHOLESALE' ||
      orderData.orderType === 'wholesale');

  const resolvedTier = isSuperWholesaleOrder
    ? 'SUPER_WHOLESALE'
    : isWholesaleOrder
    ? 'WHOLESALE'
    : 'RETAIL';

  // 2. Validate stock and securely recalculate items against verified database prices
  let calculatedSubtotal = 0;
  const validatedItems = orderData.items.map((item) => {
    const product = getProductById(item.productId) || (item.slug ? getProductBySlug(item.slug) : undefined);
    const modelObj =
      item.selectedModel && product?.models
        ? product.models.find(
            (m) =>
              m.name.toLowerCase() === item.selectedModel?.toLowerCase() ||
              m.id === item.selectedModel
          )
        : null;

    const availableStock = modelObj
      ? (modelObj.stock !== undefined ? modelObj.stock : (product?.stock ?? 0))
      : (product?.stock ?? 0);

    if (product && availableStock <= 0) {
      throw new Error(
        `Product "${item.productName || 'Item'}${item.selectedModel ? ` (${item.selectedModel})` : ''}" is currently out of stock.`
      );
    }

    // Determine authorized base price
    let basePrice: number;
    if (modelObj) {
      if (resolvedTier === 'SUPER_WHOLESALE' || resolvedTier === 'WHOLESALE') {
        basePrice = getModelEffectivePrice(product!, modelObj, resolvedTier);
      } else {
        basePrice = Number(modelObj.price) || (product ? product.price : item.price);
      }
    } else {
      basePrice = product ? getProductEffectivePrice(product, resolvedTier) : item.price;
    }

    const lineTotal = basePrice * item.quantity;
    calculatedSubtotal += lineTotal;

    return {
      ...item,
      sku: modelObj?.sku || item.sku || (product as any)?.sku || `SKU-${item.productId}`,
      price: basePrice,
      originalPrice: basePrice,
      discountPercentage: undefined,
      total: lineTotal,
    };
  });

  // Re-validate Promo Code on Server
  let validatedPromoDiscount = 0;
  let promoDetails = orderData.promoDetails;

  if (orderData.promoCode) {
    const promoResult = await validatePromoCode({
      code: orderData.promoCode,
      subtotal: calculatedSubtotal,
      items: validatedItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        price: i.price,
      })),
      channel: (orderData.orderSource as 'ONLINE' | 'POS') || 'ONLINE',
      customer: orderData.customer,
    });

    if (promoResult.valid && promoResult.discountAmount !== undefined) {
      validatedPromoDiscount = promoResult.discountAmount;
      promoDetails = {
        code: promoResult.code || orderData.promoCode.toUpperCase(),
        discountType: promoResult.discountType || 'percentage',
        discountValue: promoResult.discountValue || 0,
        discountAmount: promoResult.discountAmount,
        description: promoResult.description,
      };
    } else {
      throw new Error(promoResult.error || 'Applied promo code is invalid or no longer available.');
    }
  }

  const orders = getOrders();
  const orderId = generateNextOrderId(orders);
  const invoiceNumber = generateNextInvoiceNumber(orders);

  const subtotal = calculatedSubtotal;
  // If orderData.discount had a manual discount, separate from promo
  const manualDiscount = Math.max(0, (orderData.discount || 0) - (orderData.promoDiscountAmount || 0));
  const totalDiscount = manualDiscount + validatedPromoDiscount;
  const shipping = orderData.shipping || 0;
  const grandTotal = Math.max(0, subtotal - totalDiscount + shipping);

  const newOrder: Order = {
    ...orderData,
    orderType:
      orderData.orderType ||
      (isSuperWholesaleOrder
        ? 'super_wholesale'
        : isWholesaleOrder
        ? 'wholesale'
        : orderData.orderSource === 'POS'
        ? 'walk_in'
        : 'online'),
    customerType: isSuperWholesaleOrder
      ? 'SUPER_WHOLESALE'
      : isWholesaleOrder
      ? 'WHOLESALE'
      : orderData.customerType || 'RETAIL',
    shopName:
      isSuperWholesaleOrder || isWholesaleOrder
        ? verifiedCustomer?.shopName || orderData.shopName
        : undefined,
    wholesaleAccountId:
      isSuperWholesaleOrder || isWholesaleOrder
        ? verifiedCustomer?.id || orderData.customer?.id
        : undefined,
    items: validatedItems,
    subtotal,
    discount: totalDiscount,
    total: grandTotal,
    status: orderData.status || 'Confirmed',
    promoCode: promoDetails?.code,
    promoDiscountType: promoDetails?.discountType,
    promoDiscountValue: promoDetails?.discountValue,
    promoDiscountAmount: promoDetails?.discountAmount,
    promoDetails: promoDetails,
    id: orderId,
    invoiceNumber,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [newOrder, ...orders];
  await persistCollection(COLLECTION_KEY, updated);

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      });
      const data = await res.json();
      if (res.ok && data.success && data.order) {
        const currentOrders = getOrders().filter((o) => o.id !== data.order.id);
        const next = [data.order, ...currentOrders];
        await persistCollection(COLLECTION_KEY, next);
        return data.order;
      }
    } catch (e) {
      console.warn('API /api/orders notice:', e);
    }
  }

  // Record promo usage in persistent log
  if (promoDetails) {
    try {
      await recordPromoUsage({
        promoCodeId: promoDetails.code,
        code: promoDetails.code,
        orderId: newOrder.id,
        invoiceNumber: newOrder.invoiceNumber,
        customerId: newOrder.customer?.id,
        customerName: `${newOrder.customer?.firstName || ''} ${newOrder.customer?.lastName || ''}`.trim() || 'Customer',
        customerEmail: newOrder.customer?.email,
        customerPhone: newOrder.customer?.phone,
        discountAmount: promoDetails.discountAmount,
        orderTotal: newOrder.total,
        channel: (newOrder.orderSource as 'ONLINE' | 'POS') || 'ONLINE',
        usedBy: newOrder.cashierEmail || newOrder.customer?.email || 'Customer',
      });
    } catch (e) {
      console.warn('Promo usage logging notice:', e);
    }
  }

  // Automatically deduct stock for ordered products
  for (const item of newOrder.items) {
    try {
      await adjustStock(item.productId, -item.quantity, `Order placed #${newOrder.id}`, 'system', item.selectedModel);
    } catch (e) {
      console.warn('Stock adjustment warning:', e);
    }
  }

  // Record audit log and notify admin
  try {
    await logActivity({
      adminEmail: 'customer-checkout',
      action: 'New Order Placed',
      target: newOrder.id,
      details: `${newOrder.customer.firstName} ${newOrder.customer.lastName} ordered ${newOrder.items.length} items for Rs. ${newOrder.total.toLocaleString('en-PK')} via ${newOrder.paymentMethod}${newOrder.paymentReference ? ` (Ref: ${newOrder.paymentReference})` : ''}`,
    });
  } catch (e) {
    console.warn('Audit log warning:', e);
  }

  try {
    await addNotification({
      title: `New Order #${newOrder.id}`,
      message: `${newOrder.customer.firstName} ${newOrder.customer.lastName} placed an order for Rs. ${newOrder.total.toLocaleString('en-PK')} (${newOrder.paymentMethod})`,
      type: 'order',
      link: `/admin/orders/${newOrder.id}`,
    });
  } catch (e) {
    console.warn('Notification warning:', e);
  }

  // Direct Firestore doc sync
  if (db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'orders', newOrder.id);
      const cleanData = JSON.parse(JSON.stringify(newOrder));
      await setDoc(docRef, cleanData, { merge: true });
    } catch (err) {
      console.warn('Firestore create order notice:', err);
    }
  }

  return newOrder;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  paymentStatus?: PaymentStatus,
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const orders = getOrders();
  const index = orders.findIndex((o) => o.id === orderId);
  if (index === -1) return false;

  const current = orders[index];
  const prevPaymentStatus = current.paymentStatus;
  const prevStatus = current.status;

  orders[index] = {
    ...current,
    status,
    ...(paymentStatus ? { paymentStatus } : {}),
    updatedAt: new Date().toISOString(),
  };

  await persistCollection(COLLECTION_KEY, orders);

  if (typeof window !== 'undefined') {
    fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, paymentStatus }),
    }).catch(() => {});
  }

  // Direct Firestore doc sync
  if (db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'orders', orderId);
      await setDoc(docRef, orders[index], { merge: true });
    } catch (err) {
      console.warn('Firestore update order notice:', err);
    }
  }

  await logActivity({
    adminEmail,
    action: 'Updated Order Status',
    target: orderId,
    details: `Status: ${prevStatus} → ${status}${paymentStatus ? ` | Payment: ${prevPaymentStatus} → ${paymentStatus}` : ''}`,
  });

  return true;
}

export async function verifyPayment(
  orderId: string,
  adminEmail = 'admin@alhamd.com',
  note?: string
): Promise<boolean> {
  const orders = getOrders();
  const index = orders.findIndex((o) => o.id === orderId);
  if (index === -1) return false;

  const prev = orders[index];
  const prevStatus = prev.paymentStatus;
  const newPaymentStatus: PaymentStatus = 'Paid';

  orders[index] = {
    ...prev,
    paymentStatus: newPaymentStatus,
    paymentVerification: {
      verifiedBy: adminEmail,
      verifiedAt: new Date().toISOString(),
      note: note?.trim() || 'Payment verified via account transaction reference lookup',
      status: 'verified',
    },
    status: prev.status === 'Pending' ? 'Confirmed' : prev.status,
    updatedAt: new Date().toISOString(),
  };

  await persistCollection(COLLECTION_KEY, orders);

  if (typeof window !== 'undefined') {
    fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: newPaymentStatus, note }),
    }).catch(() => {});
  }

  // Requirement 23: Payment Audit Log
  await logActivity({
    adminEmail,
    action: 'Payment Verified',
    target: orderId,
    details: `Payment verified | Order: ${orderId} | Prev Status: ${prevStatus} → New Status: ${newPaymentStatus} | Method: ${prev.paymentMethod} | TID: ${prev.paymentReference || 'N/A'}${note ? ` | Note: ${note}` : ''}`,
  });

  await addNotification({
    title: `Payment Verified #${orderId}`,
    message: `Payment of Rs. ${prev.total.toLocaleString('en-PK')} (${prev.paymentMethod}) verified by ${adminEmail}`,
    type: 'order',
    link: `/admin/orders/${orderId}`,
  });

  return true;
}

export async function rejectPayment(
  orderId: string,
  adminEmail = 'admin@alhamd.com',
  note?: string
): Promise<boolean> {
  const orders = getOrders();
  const index = orders.findIndex((o) => o.id === orderId);
  if (index === -1) return false;

  const prev = orders[index];
  const prevStatus = prev.paymentStatus;
  const newPaymentStatus: PaymentStatus = 'Failed';

  orders[index] = {
    ...prev,
    paymentStatus: newPaymentStatus,
    paymentVerification: {
      verifiedBy: adminEmail,
      verifiedAt: new Date().toISOString(),
      note: note?.trim() || 'Transaction reference could not be verified in bank records',
      status: 'rejected',
    },
    updatedAt: new Date().toISOString(),
  };

  await persistCollection(COLLECTION_KEY, orders);

  // Requirement 23: Payment Audit Log
  await logActivity({
    adminEmail,
    action: 'Payment Rejected',
    target: orderId,
    details: `Payment rejected | Order: ${orderId} | Prev Status: ${prevStatus} → New Status: ${newPaymentStatus} | Method: ${prev.paymentMethod} | TID: ${prev.paymentReference || 'N/A'}${note ? ` | Reason: ${note}` : ''}`,
  });

  await addNotification({
    title: `Payment Rejected #${orderId}`,
    message: `Payment for order ${orderId} rejected by ${adminEmail}: ${note || 'Invalid transaction reference'}`,
    type: 'order',
    link: `/admin/orders/${orderId}`,
  });

  return true;
}

export function filterAndSortOrders(
  orders: Order[],
  options: {
    query?: string;
    status?: string;
    paymentStatus?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: 'newest' | 'oldest' | 'highest' | 'lowest';
  }
): Order[] {
  let result = [...orders];

  // Text search (ID, customer name, phone, email, SKU, Cashier)
  if (options.query && options.query.trim()) {
    const q = options.query.toLowerCase().trim();
    result = result.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.invoiceNumber.toLowerCase().includes(q) ||
        (o.shopName && o.shopName.toLowerCase().includes(q)) ||
        (o.customer.firstName && o.customer.firstName.toLowerCase().includes(q)) ||
        (o.customer.lastName && o.customer.lastName.toLowerCase().includes(q)) ||
        (o.customer.email && o.customer.email.toLowerCase().includes(q)) ||
        (o.customer.phone && o.customer.phone.toLowerCase().includes(q)) ||
        (o.cashierName && o.cashierName.toLowerCase().includes(q)) ||
        o.items.some((item) => item.sku.toLowerCase().includes(q) || item.productName.toLowerCase().includes(q))
    );
  }

  // Order Source / Type Filter (all, online, pos, wholesale)
  if (options.source && options.source !== 'all') {
    const src = options.source.toLowerCase();
    result = result.filter((o) => {
      const isSuperWs = o.orderType === 'super_wholesale' || o.customerType === 'SUPER_WHOLESALE';
      const isWs = !isSuperWs && (o.orderType === 'wholesale' || o.customerType === 'WHOLESALE' || Boolean(o.shopName));
      const isPos = o.orderType === 'walk_in' || o.orderSource === 'POS';
      if (src === 'super_wholesale') return isSuperWs;
      if (src === 'wholesale') return isWs;
      if (src === 'pos' || src === 'walk_in') return isPos && !isWs && !isSuperWs;
      if (src === 'online') return !isPos && !isWs && !isSuperWs;
      return true;
    });
  }

  // Status filters
  if (options.status && options.status !== 'all') {
    result = result.filter((o) => o.status.toLowerCase() === options.status!.toLowerCase());
  }

  if (options.paymentStatus && options.paymentStatus !== 'all') {
    result = result.filter((o) => o.paymentStatus.toLowerCase() === options.paymentStatus!.toLowerCase());
  }

  // Date filters
  if (options.startDate) {
    result = result.filter((o) => new Date(o.createdAt) >= new Date(options.startDate!));
  }
  if (options.endDate) {
    result = result.filter((o) => new Date(o.createdAt) <= new Date(options.endDate!));
  }

  // Sorting
  switch (options.sortBy) {
    case 'oldest':
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'highest':
      result.sort((a, b) => b.total - a.total);
      break;
    case 'lowest':
      result.sort((a, b) => a.total - b.total);
      break;
    case 'newest':
    default:
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
  }

  return result;
}
