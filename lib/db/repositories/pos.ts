import { Order, OrderItem } from '@/types/admin';
import { Product } from '@/types';
import { getProductByIdFromDb, getAllProductsFromDb } from '@/lib/db/repositories/products';
import { createOrderInDb, getAllOrdersFromDb, voidOrderInDb } from '@/lib/db/repositories/orders';
import { isDbConfigured, query } from '../mysql';
import { RowDataPacket } from 'mysql2/promise';

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

export async function createPosSaleInDb(params: CreatePosSaleParams): Promise<PosSaleResult> {
  if (!params.items || params.items.length === 0) {
    return { success: false, error: 'Cannot complete sale: Cart is empty.' };
  }

  const validatedItems: OrderItem[] = [];
  let calculatedSubtotal = 0;

  for (const cartItem of params.items) {
    if (!cartItem.quantity || cartItem.quantity <= 0) {
      return { success: false, error: 'Invalid quantity: All items must have at least 1 unit.' };
    }

    const product = await getProductByIdFromDb(cartItem.productId);
    if (!product || product.status === 'inactive' || product.status === 'archived') {
      return {
        success: false,
        error: `Product with ID "${cartItem.productId}" was not found or is no longer available.`,
      };
    }

    let unitPrice = product.price;
    let selectedModelSku = product.sku || `SKU-${product.id}`;
    let itemAvailableStock = product.stock;

    if (cartItem.selectedModel && Array.isArray(product.models)) {
      const modelObj = product.models.find(
        (m) =>
          m.name.toLowerCase() === cartItem.selectedModel?.toLowerCase() ||
          m.id === cartItem.selectedModel
      );
      if (modelObj) {
        unitPrice = modelObj.price;
        if (modelObj.sku) selectedModelSku = modelObj.sku;
        if (modelObj.stock !== undefined) itemAvailableStock = modelObj.stock;
      }
    }

    if (itemAvailableStock < cartItem.quantity) {
      return {
        success: false,
        error: `Insufficient stock for "${product.name}${cartItem.selectedModel ? ` (${cartItem.selectedModel})` : ''}". Available: ${itemAvailableStock}, requested: ${cartItem.quantity}.`,
      };
    }

    const rawLineTotal = unitPrice * cartItem.quantity;
    const itemDiscount = Math.min(rawLineTotal, Math.max(0, cartItem.itemDiscount || 0));
    const lineTotal = Math.max(0, rawLineTotal - itemDiscount);

    calculatedSubtotal += lineTotal;

    const firstImage = product.images?.[0] || 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=300&auto=format&fit=crop';

    validatedItems.push({
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      sku: selectedModelSku,
      price: unitPrice,
      originalPrice: unitPrice,
      quantity: cartItem.quantity,
      selectedModel: cartItem.selectedModel,
      selectedColor: cartItem.selectedColor,
      image: firstImage,
      total: lineTotal,
    });
  }

  // Calculate order-level discount
  let overallDiscount = 0;
  if (params.discountValue && params.discountValue > 0) {
    if (params.discountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, params.discountValue));
      overallDiscount = Math.round((calculatedSubtotal * pct) / 100);
    } else {
      overallDiscount = Math.min(calculatedSubtotal, Math.max(0, params.discountValue));
    }
  }

  const grandTotal = Math.max(0, calculatedSubtotal - overallDiscount);
  const amountPaid = params.amountPaid || grandTotal;
  const changeGiven = Math.max(0, amountPaid - grandTotal);

  try {
    const order = await createOrderInDb({
      orderType: 'walk_in',
      customerType: 'RETAIL',
      orderSource: 'POS',
      customer: {
        id: params.customer?.id,
        firstName: params.customer?.firstName || 'Walk-in Customer',
        lastName: params.customer?.lastName || '',
        email: params.customer?.email,
        phone: params.customer?.phone || '+92 300 0000000',
      },
      shippingAddress: {
        street: 'Store Counter Checkout',
        city: 'Mandi Bahauddin',
        postalCode: '50400',
        country: 'Pakistan',
      },
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discount: overallDiscount,
      shipping: 0,
      tax: 0,
      total: grandTotal,
      currency: 'PKR',
      deliveryMethod: 'counter' as any,
      paymentMethod: params.paymentMethod || 'Cash',
      paymentStatus: 'Paid',
      paymentReference: params.paymentReference,
      status: 'Delivered',
      cashierId: params.cashierId,
      cashierName: params.cashierName,
      cashierEmail: params.cashierEmail,
      amountPaid,
      changeGiven,
      posDiscountType: params.discountType,
      posDiscountValue: params.discountValue,
      posDiscountReason: params.discountReason,
      notes: params.notes,
    });

    return { success: true, order };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to process POS sale.' };
  }
}

export async function getPosDailySummaryFromDb(cashierEmail?: string): Promise<{
  totalSales: number;
  totalOrders: number;
  cashTotal: number;
  cardTotal: number;
  walletTotal: number;
  voidedCount: number;
  averageBasket: number;
}> {
  if (!isDbConfigured()) {
    return {
      totalSales: 0,
      totalOrders: 0,
      cashTotal: 0,
      cardTotal: 0,
      walletTotal: 0,
      voidedCount: 0,
      averageBasket: 0,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  let sql = 'SELECT * FROM orders WHERE order_source = "POS" AND DATE(created_at) = ?';
  const params: any[] = [today];

  if (cashierEmail) {
    sql += ' AND cashier_email = ?';
    params.push(cashierEmail);
  }

  const rows = await query<RowDataPacket[]>(sql, params);

  let totalSales = 0;
  let totalOrders = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let walletTotal = 0;
  let voidedCount = 0;

  for (const o of rows) {
    if (o.status === 'Cancelled' || o.voided_at) {
      voidedCount++;
      continue;
    }

    const t = Number(o.total) || 0;
    totalSales += t;
    totalOrders++;

    const pm = (o.payment_method || '').toLowerCase();
    if (pm.includes('cash')) {
      cashTotal += t;
    } else if (pm.includes('card')) {
      cardTotal += t;
    } else {
      walletTotal += t;
    }
  }

  const averageBasket = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

  return {
    totalSales,
    totalOrders,
    cashTotal,
    cardTotal,
    walletTotal,
    voidedCount,
    averageBasket,
  };
}
