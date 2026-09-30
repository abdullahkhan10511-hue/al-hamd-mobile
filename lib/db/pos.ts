import { Order, OrderItem, CustomerType } from '@/types/admin';
import { Product } from '@/types';
import { persistCollection } from './storage';
import { getProducts } from './products';
import { getOrders, generateNextOrderId, generateNextInvoiceNumber } from './orders';
import { recordInventoryLog } from './inventory';
import { logActivity } from './activity';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { validatePromoCode, recordPromoUsage } from './promotions';
import { getProductEffectivePrice, getModelEffectivePrice } from '@/lib/wholesale';

export interface PosCartItem {
  productId: string;
  quantity: number;
  selectedVariant?: string;
  selectedModel?: string;
  selectedColor?: string;
  itemDiscount?: number;
}

export interface CreatePosSaleParams {
  items: PosCartItem[];
  catalogSnapshot?: Product[];
  customer?: {
    id?: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    customerType?: CustomerType;
    shopName?: string;
  };
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountReason?: string;
  promoCode?: string;
  paymentMethod: 'Cash' | 'Card' | 'Easypaisa' | 'JazzCash' | string;
  amountPaid: number;
  paymentReference?: string;
  cashierId?: string;
  cashierName: string;
  cashierEmail: string;
  notes?: string;
}

export interface PosSaleResult {
  success: boolean;
  order?: Order;
  error?: string;
}

// Memory lock to prevent rapid duplicate double-clicks
const processingTransactions = new Set<string>();

/**
 * Atomically validates cart, confirms real stock, creates Order, deducts inventory,
 * and generates audit logs.
 */
export async function createPosSale(params: CreatePosSaleParams): Promise<PosSaleResult> {
  const transactionLockKey = `${params.cashierEmail}_${params.items.map((i) => `${i.productId}:${i.quantity}`).join(',')}`;

  if (processingTransactions.has(transactionLockKey)) {
    return {
      success: false,
      error: 'A sale with identical items is currently processing. Please wait a moment.',
    };
  }

  processingTransactions.add(transactionLockKey);

  try {
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Cannot complete sale: Cart is empty.' };
    }

    // 1. Retrieve fresh product database (merging client catalog snapshot if available)
    let products: any[] = getProducts();
    if (params.catalogSnapshot && Array.isArray(params.catalogSnapshot) && params.catalogSnapshot.length > 0) {
      const existingIds = new Set(products.map((p) => p.id));
      const additions = params.catalogSnapshot.filter((p) => !existingIds.has(p.id));
      if (additions.length > 0) {
        products = [...products, ...additions];
        persistCollection('products', products).catch(() => {});
      }
    }

    const validatedItems: OrderItem[] = [];
    let calculatedSubtotal = 0;

    // 2. Validate stock and compute real prices server-side
    for (const cartItem of params.items) {
      if (!cartItem.quantity || cartItem.quantity <= 0) {
        return { success: false, error: 'Invalid quantity: All items must have at least 1 unit.' };
      }

      const product = products.find((p) => p.id === cartItem.productId);
      if (!product || product.status === 'inactive' || product.status === 'archived') {
        return {
          success: false,
          error: `Product with ID "${cartItem.productId}" was not found in catalog or is no longer available.`,
        };
      }

      // Check Available Shop Stock (including model-level shop stock if model selected)
      const modelObj =
        cartItem.selectedModel && Array.isArray(product.models)
          ? product.models.find(
              (m: any) =>
                m.name.toLowerCase() === cartItem.selectedModel?.toLowerCase() ||
                m.id === cartItem.selectedModel
            )
          : null;

      const availableStock = modelObj
        ? (modelObj.shopStock !== undefined ? modelObj.shopStock : (product.shopStock ?? 0))
        : (product.shopStock ?? 0);

      if (availableStock < cartItem.quantity) {
        return {
          success: false,
          error: `Only ${availableStock} unit(s) available in shop stock for "${product.name}${cartItem.selectedModel ? ` (${cartItem.selectedModel})` : ''}". (Requested: ${cartItem.quantity})`,
        };
      }

      // Model price or standard retail price or wholesale/super wholesale
      const customerTier = params.customer?.customerType || 'RETAIL';
      const basePrice = modelObj
        ? getModelEffectivePrice(product, modelObj, customerTier)
        : getProductEffectivePrice(product, customerTier);
      const unitPrice = basePrice;
      const lineTotal = unitPrice * cartItem.quantity;

      calculatedSubtotal += lineTotal;

      const itemImg =
        (modelObj?.images && modelObj.images.length > 0 ? modelObj.images[0] : null) ||
        (product.images && product.images.length > 0 ? product.images[0] : '/placeholder.png');

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        slug: product.slug,
        sku: modelObj?.sku || product.sku || '',
        price: unitPrice,
        originalPrice: unitPrice,
        quantity: cartItem.quantity,
        selectedModel: cartItem.selectedModel,
        selectedColor: cartItem.selectedColor,
        image: itemImg,
        total: lineTotal,
      });
    }

    // 3. Validate Manual Discount
    let manualDiscountAmount = 0;
    const discountVal = Math.max(0, Number(params.discountValue) || 0);

    if (discountVal > 0) {
      if (params.discountType === 'percentage') {
        const pct = Math.min(100, discountVal);
        manualDiscountAmount = Math.round((calculatedSubtotal * pct) / 100);
      } else {
        manualDiscountAmount = Math.min(calculatedSubtotal, Math.round(discountVal));
      }
    }

    // 3b. Validate Promo Code on Server
    let promoDiscountAmount = 0;
    let promoDetails: {
      code: string;
      discountType: 'percentage' | 'fixed';
      discountValue: number;
      discountAmount: number;
      description?: string;
    } | undefined = undefined;

    if (params.promoCode && params.promoCode.trim()) {
      const cleanPromo = params.promoCode.trim();
      const promoResult = await validatePromoCode({
        code: cleanPromo,
        subtotal: calculatedSubtotal,
        items: validatedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        channel: 'POS',
        customer: params.customer,
      });

      if (!promoResult.valid) {
        return {
          success: false,
          error: promoResult.error || 'The applied promo code is invalid for this POS sale.',
        };
      }

      promoDiscountAmount = promoResult.discountAmount || 0;
      promoDetails = {
        code: promoResult.code || cleanPromo.toUpperCase(),
        discountType: promoResult.discountType || 'percentage',
        discountValue: promoResult.discountValue || 0,
        discountAmount: promoDiscountAmount,
        description: promoResult.description,
      };
    }

    const totalDiscount = Math.min(calculatedSubtotal, manualDiscountAmount + promoDiscountAmount);

    // Ensure grand total cannot be negative
    const grandTotal = Math.max(0, calculatedSubtotal - totalDiscount);

    // 4. Validate Payment
    const normalizedMethod = (params.paymentMethod || 'Cash').trim();
    const paidAmount = Number(params.amountPaid) || 0;

    let changeGiven = 0;
    if (normalizedMethod.toLowerCase() === 'cash') {
      if (paidAmount < grandTotal) {
        return {
          success: false,
          error: `Cash received (Rs. ${paidAmount.toLocaleString('en-PK')}) is less than total amount (Rs. ${grandTotal.toLocaleString('en-PK')}).`,
        };
      }
      changeGiven = Math.max(0, paidAmount - grandTotal);
    } else {
      // Card, Easypaisa, JazzCash
      changeGiven = 0;
    }

    // 5. ATOMIC COMMIT: Update inventory and create order
    const orders = getOrders();
    const orderId = generateNextOrderId(orders);
    const invoiceNumber = generateNextInvoiceNumber(orders);
    const nowIso = new Date().toISOString();

    // Deduct shop stock and record inventory movement
    for (const item of validatedItems) {
      const prodIndex = products.findIndex((p) => p.id === item.productId);
      if (prodIndex !== -1) {
        const prod = products[prodIndex];
        const prevShopStock = prod.shopStock ?? 0;
        const newShopStock = Math.max(0, prevShopStock - item.quantity);
        prod.shopStock = newShopStock;

        // Deduct model-specific shop stock if model was chosen
        if (item.selectedModel && Array.isArray(prod.models)) {
          const mIdx = prod.models.findIndex(
            (m: any) =>
              m.name.toLowerCase() === item.selectedModel?.toLowerCase() ||
              m.id === item.selectedModel
          );
          if (mIdx !== -1) {
            const mPrev = prod.models[mIdx].shopStock !== undefined ? prod.models[mIdx].shopStock : prevShopStock;
            prod.models[mIdx].shopStock = Math.max(0, mPrev - item.quantity);
          }
        }

        await recordInventoryLog({
          productId: prod.id,
          productName: `${prod.name} [Shop Stock]`,
          sku: item.sku || prod.sku || '',
          previousStock: prevShopStock,
          changeAmount: -item.quantity,
          newStock: newShopStock,
          reason: `POS Sale #${orderId} (Invoice: ${invoiceNumber})${item.selectedModel ? ` - Model: ${item.selectedModel}` : ''}${item.selectedColor ? ` - Color: ${item.selectedColor}` : ''}`,
          adminEmail: params.cashierEmail || 'pos-counter',
        });
      }
    }

    // Save updated products collection
    await persistCollection('products', products);

    // Direct Firestore sync for products
    if (db && typeof (db as any).type === 'string') {
      try {
        for (const item of validatedItems) {
          const prod = products.find((p) => p.id === item.productId);
          if (prod) {
            const docRef = doc(db, 'products', prod.id);
            setDoc(docRef, { stock: prod.stock, models: prod.models }, { merge: true }).catch(() => {});
          }
        }
      } catch {}
    }

    // Format Customer Details
    const custFirstName = (params.customer?.firstName || '').trim() || 'Walk-in';
    const custLastName = (params.customer?.lastName || '').trim() || 'Customer';
    const custEmail = (params.customer?.email || '').trim() || 'counter@alhamd-mobile.com';
    const custPhone = (params.customer?.phone || '').trim();

    // Construct Order
    const isSuperWholesale = params.customer?.customerType === 'SUPER_WHOLESALE';
    const isWholesale = params.customer?.customerType === 'WHOLESALE';
    const isWholesaleTier = isSuperWholesale || isWholesale;

    const newOrder: Order = {
      id: orderId,
      invoiceNumber,
      orderSource: 'POS',
      orderType: isSuperWholesale ? 'super_wholesale' : isWholesale ? 'wholesale' : 'walk_in',
      customerType: isSuperWholesale ? 'SUPER_WHOLESALE' : isWholesale ? 'WHOLESALE' : 'RETAIL',
      shopName: isWholesaleTier ? (params.customer?.shopName || custFirstName) : undefined,
      wholesaleAccountId: isWholesaleTier ? params.customer?.id : undefined,
      customer: {
        id: params.customer?.id,
        firstName: custFirstName,
        lastName: custLastName,
        email: custEmail,
        phone: custPhone,
      },
      shippingAddress: {
        street: 'Counter Sale / In-Store',
        city: 'Mandi Bahauddin',
        postalCode: '50400',
        country: 'Pakistan',
      },
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discount: totalDiscount,
      shipping: 0,
      tax: 0,
      total: grandTotal,
      currency: 'PKR',
      deliveryMethod: 'counter',
      paymentMethod: normalizedMethod,
      paymentStatus: 'Paid',
      paymentReference: params.paymentReference || undefined,
      status: 'Delivered',
      notes: params.notes || undefined,
      cashierId: params.cashierId,
      cashierName: params.cashierName || 'Cashier',
      cashierEmail: params.cashierEmail,
      amountPaid: paidAmount,
      changeGiven: changeGiven,
      posDiscountType: params.discountType,
      posDiscountValue: discountVal,
      posDiscountReason: params.discountReason,
      promoCode: promoDetails?.code,
      promoDiscountType: promoDetails?.discountType,
      promoDiscountValue: promoDetails?.discountValue,
      promoDiscountAmount: promoDetails?.discountAmount,
      promoDetails: promoDetails,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedOrders = [newOrder, ...orders];
    await persistCollection('orders', updatedOrders);

    // Record promo code usage
    if (promoDetails) {
      try {
        await recordPromoUsage({
          promoCodeId: promoDetails.code,
          code: promoDetails.code,
          orderId: newOrder.id,
          invoiceNumber: newOrder.invoiceNumber,
          customerId: params.customer?.id,
          customerName: `${custFirstName} ${custLastName}`.trim(),
          customerEmail: params.customer?.email,
          customerPhone: params.customer?.phone,
          discountAmount: promoDetails.discountAmount,
          orderTotal: grandTotal,
          channel: 'POS',
          usedBy: params.cashierName || params.cashierEmail || 'Cashier',
        });
      } catch (e) {
        console.warn('POS promo usage logging notice:', e);
      }
    }

    // Direct MySQL sync via API
    if (typeof window !== 'undefined') {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      }).catch(() => {});
    }

    // Direct Firestore sync for order
    if (db && typeof (db as any).type === 'string') {
      try {
        const docRef = doc(db, 'orders', newOrder.id);
        setDoc(docRef, newOrder, { merge: true }).catch(() => {});
      } catch {}
    }

    // Trigger real-time cross-tab & component reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: 'products', value: products },
        })
      );
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: 'orders', value: updatedOrders },
        })
      );
    }

    // Log administrative activity
    await logActivity({
      adminEmail: params.cashierEmail || 'pos-counter',
      action: 'Completed POS Sale',
      target: orderId,
      details: `Invoice: ${invoiceNumber} | Total: Rs. ${grandTotal.toLocaleString('en-PK')} | Method: ${normalizedMethod} | Cashier: ${params.cashierName}`,
    });

    return { success: true, order: newOrder };
  } catch (err: any) {
    console.error('POS Sale Processing Error:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while completing the sale.',
    };
  } finally {
    processingTransactions.delete(transactionLockKey);
  }
}

/**
 * Voids a completed POS sale, restoring inventory and updating the order status to Cancelled.
 */
export async function voidPosSale(
  orderId: string,
  operatorEmail: string,
  operatorName: string,
  reason: string
): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId);

    if (orderIndex === -1) {
      return { success: false, error: 'Order not found.' };
    }

    const order = orders[orderIndex];

    if (order.orderSource !== 'POS') {
      return { success: false, error: 'Only Shop Counter / POS sales can be voided via POS controls.' };
    }

    if (order.status === 'Cancelled') {
      return { success: false, error: 'This sale has already been cancelled/voided.' };
    }

    const cleanReason = reason?.trim() || 'Counter return / cashier void';

    // 1. Restore product shop inventory
    const products = getProducts();
    for (const item of order.items) {
      const prodIndex = products.findIndex((p) => p.id === item.productId);
      if (prodIndex !== -1) {
        const prod = products[prodIndex];
        const prevShopStock = prod.shopStock ?? 0;
        const newShopStock = prevShopStock + item.quantity;
        prod.shopStock = newShopStock;

        if (item.selectedModel && Array.isArray(prod.models)) {
          const mIdx = prod.models.findIndex(
            (m: any) =>
              m.name.toLowerCase() === item.selectedModel?.toLowerCase() ||
              m.id === item.selectedModel
          );
          if (mIdx !== -1) {
            const mPrev = prod.models[mIdx].shopStock !== undefined ? prod.models[mIdx].shopStock : prevShopStock;
            prod.models[mIdx].shopStock = mPrev + item.quantity;
          }
        }

        await recordInventoryLog({
          productId: prod.id,
          productName: `${prod.name} [Shop Stock]`,
          sku: prod.sku || '',
          previousStock: prevShopStock,
          changeAmount: item.quantity,
          newStock: newShopStock,
          reason: `Void POS Sale #${order.id} (Invoice: ${order.invoiceNumber}) - Reason: ${cleanReason}`,
          adminEmail: operatorEmail,
        });
      }
    }

    await persistCollection('products', products);

    // 2. Update Order status
    const updatedOrder: Order = {
      ...order,
      status: 'Cancelled',
      paymentStatus: 'Refunded',
      voidedBy: operatorEmail,
      voidedAt: new Date().toISOString(),
      voidReason: cleanReason,
      updatedAt: new Date().toISOString(),
    };

    orders[orderIndex] = updatedOrder;
    await persistCollection('orders', orders);

    if (typeof window !== 'undefined') {
      fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Cancelled', paymentStatus: 'Refunded', voidReason: cleanReason }),
      }).catch(() => {});
    }

    // Direct Firestore sync
    if (db && typeof (db as any).type === 'string') {
      try {
        const docRef = doc(db, 'orders', orderId);
        setDoc(docRef, updatedOrder, { merge: true }).catch(() => {});
      } catch {}
    }

    // Trigger reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: 'products', value: products },
        })
      );
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: 'orders', value: orders },
        })
      );
    }

    await logActivity({
      adminEmail: operatorEmail,
      action: 'Voided POS Sale',
      target: orderId,
      details: `Invoice: ${order.invoiceNumber} | Restored: ${order.items.length} items | Reason: ${cleanReason}`,
    });

    return { success: true, order: updatedOrder };
  } catch (err: any) {
    console.error('Void POS Sale Error:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while voiding the sale.',
    };
  }
}

export interface PosDailySummary {
  todaySales: number;
  todayPosOrders: number;
  todayItemsSold: number;
  todayDiscounts: number;
  cashSales: number;
  cardSales: number;
  easypaisaSales: number;
  jazzcashSales: number;
  cashierSalesCount: number;
  cashierRevenue: number;
}

/**
 * Calculates live daily summary statistics for POS sales.
 */
export function getPosDailySummary(currentCashierEmail?: string): PosDailySummary {
  const orders = getOrders();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let todaySales = 0;
  let todayPosOrders = 0;
  let todayItemsSold = 0;
  let todayDiscounts = 0;
  let cashSales = 0;
  let cardSales = 0;
  let easypaisaSales = 0;
  let jazzcashSales = 0;
  let cashierSalesCount = 0;
  let cashierRevenue = 0;

  for (const order of orders) {
    if (order.orderSource !== 'POS') continue;

    const orderDate = new Date(order.createdAt);
    if (orderDate < todayStart) continue;

    // Do not count cancelled/voided orders in revenue
    const isCancelled = order.status === 'Cancelled';

    if (!isCancelled) {
      todaySales += order.total;
      todayPosOrders += 1;
      todayDiscounts += order.discount || 0;

      const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      todayItemsSold += itemsCount;

      const method = (order.paymentMethod || '').toLowerCase();
      if (method.includes('cash') || method === 'cod') {
        cashSales += order.total;
      } else if (method.includes('card')) {
        cardSales += order.total;
      } else if (method.includes('easypaisa')) {
        easypaisaSales += order.total;
      } else if (method.includes('jazzcash')) {
        jazzcashSales += order.total;
      }

      if (
        currentCashierEmail &&
        order.cashierEmail &&
        order.cashierEmail.toLowerCase() === currentCashierEmail.toLowerCase()
      ) {
        cashierSalesCount += 1;
        cashierRevenue += order.total;
      }
    }
  }

  return {
    todaySales,
    todayPosOrders,
    todayItemsSold,
    todayDiscounts,
    cashSales,
    cardSales,
    easypaisaSales,
    jazzcashSales,
    cashierSalesCount,
    cashierRevenue,
  };
}

/**
 * Retrieves POS orders with comprehensive query filtering.
 */
export function getPosOrders(query?: string): Order[] {
  const allOrders = getOrders();
  const posOrders = allOrders.filter((o) => o.orderSource === 'POS');

  if (!query || !query.trim()) {
    return posOrders;
  }

  const q = query.toLowerCase().trim();
  return posOrders.filter(
    (o) =>
      o.invoiceNumber.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.customer.firstName.toLowerCase().includes(q) ||
      o.customer.lastName.toLowerCase().includes(q) ||
      o.customer.phone.toLowerCase().includes(q) ||
      (o.cashierName && o.cashierName.toLowerCase().includes(q)) ||
      o.items.some(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          (item.sku && item.sku.toLowerCase().includes(q))
      )
  );
}
