import { query, execute, withTransaction, isDbConfigured } from '../mysql';
import { Order, OrderItem, OrderStatus, PaymentStatus, OrderType, CustomerType } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';
import { logActivity } from '@/lib/db/repositories/activity';
import { recordPromoUsageInDb } from '@/lib/db/repositories/promotions';

interface OrderRow extends RowDataPacket {
  id: string;
  invoice_number: string;
  order_type: OrderType;
  customer_type: CustomerType;
  shop_name: string | null;
  wholesale_account_id: string | null;
  customer_id: string | null;
  customer_first_name: string;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string;
  shipping_street: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  subtotal: number | string;
  discount: number | string;
  shipping: number | string;
  tax: number | string;
  total: number | string;
  currency: string;
  delivery_method: string;
  payment_method: string;
  payment_method_id: string | null;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  payment_verification: any;
  status: OrderStatus;
  notes: string | null;
  order_source: 'ONLINE' | 'POS';
  cashier_id: string | null;
  cashier_name: string | null;
  cashier_email: string | null;
  amount_paid: number | string | null;
  change_given: number | string | null;
  pos_discount_type: string | null;
  pos_discount_value: number | string | null;
  pos_discount_reason: string | null;
  promo_code: string | null;
  promo_discount_type: string | null;
  promo_discount_value: number | string | null;
  promo_discount_amount: number | string | null;
  promo_details: any;
  has_backorder?: number | boolean | null;
  stock_status?: string | null;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow extends RowDataPacket {
  id: number;
  order_id: string;
  product_id: string;
  product_name: string;
  slug: string | null;
  sku: string;
  price: number | string;
  original_price: number | string | null;
  discount_percentage: number | null;
  quantity: number;
  selected_size: string | null;
  selected_color: string | null;
  selected_model: string | null;
  image: string | null;
  total: number | string;
  item_type?: 'PRODUCT' | 'DEAL' | null;
  deal_id?: string | null;
  deal_details?: any;
  fulfilled_quantity?: number | string | null;
  backordered_quantity?: number | string | null;
}

let orderItemsSchemaChecked = false;
async function ensureOrderItemsDealSchema(conn: any) {
  if (orderItemsSchemaChecked) return;
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'order_items' AND COLUMN_NAME IN ('item_type', 'deal_id', 'deal_details', 'fulfilled_quantity', 'backordered_quantity')`
    );
    const existing = new Set(((cols as any[]) || []).map((c: any) => c.COLUMN_NAME));
    if (!existing.has('item_type')) {
      await conn.query(`ALTER TABLE order_items ADD COLUMN item_type VARCHAR(20) DEFAULT 'PRODUCT'`);
    }
    if (!existing.has('deal_id')) {
      await conn.query(`ALTER TABLE order_items ADD COLUMN deal_id VARCHAR(100) NULL`);
    }
    if (!existing.has('deal_details')) {
      await conn.query(`ALTER TABLE order_items ADD COLUMN deal_details LONGTEXT NULL`);
    }
    if (!existing.has('fulfilled_quantity')) {
      await conn.query(`ALTER TABLE order_items ADD COLUMN fulfilled_quantity INT NULL`);
    }
    if (!existing.has('backordered_quantity')) {
      await conn.query(`ALTER TABLE order_items ADD COLUMN backordered_quantity INT NULL`);
    }

    const [orderCols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME IN ('has_backorder', 'stock_status')`
    );
    const existingOrderCols = new Set(((orderCols as any[]) || []).map((c: any) => c.COLUMN_NAME));
    if (!existingOrderCols.has('has_backorder')) {
      await conn.query(`ALTER TABLE orders ADD COLUMN has_backorder TINYINT(1) DEFAULT 0`);
    }
    if (!existingOrderCols.has('stock_status')) {
      await conn.query(`ALTER TABLE orders ADD COLUMN stock_status VARCHAR(50) DEFAULT 'IN_STOCK'`);
    }

    orderItemsSchemaChecked = true;
  } catch (err) {
    console.warn('[orders.repo] ensureOrderItemsDealSchema notice:', err);
  }
}

function parseJsonField<T>(field: any, fallback: T): T {
  if (!field) return fallback;
  if (typeof field === 'object') return field as T;
  try {
    return JSON.parse(field) as T;
  } catch {
    return fallback;
  }
}

function mapRowsToOrder(orderRow: OrderRow, itemRows: OrderItemRow[]): Order {
  const items: OrderItem[] = itemRows.map((it) => {
    const details = it.deal_details ? parseJsonField<any>(it.deal_details, {}) : {};
    const isDeal = it.item_type === 'DEAL' || !!it.deal_id || !!details.dealId;

    return {
      productId: it.product_id,
      productName: it.product_name,
      slug: it.slug || '',
      sku: it.sku,
      price: Number(it.price),
      originalPrice: it.original_price !== null ? Number(it.original_price) : undefined,
      discountPercentage: it.discount_percentage !== null ? Number(it.discount_percentage) : undefined,
      quantity: Number(it.quantity),
      selectedSize: it.selected_size || undefined,
      selectedColor: it.selected_color || undefined,
      selectedModel: it.selected_model || undefined,
      image: it.image || 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=300&auto=format&fit=crop',
      total: Number(it.total),
      itemType: isDeal ? 'DEAL' : 'PRODUCT',
      dealId: it.deal_id || details.dealId || undefined,
      dealName: details.dealName || (isDeal ? it.product_name : undefined),
      dealPrice: details.dealPrice !== undefined ? Number(details.dealPrice) : (isDeal ? Number(it.price) : undefined),
      dealProducts: details.dealProducts || undefined,
      fulfilledQuantity: it.fulfilled_quantity !== null && it.fulfilled_quantity !== undefined ? Number(it.fulfilled_quantity) : undefined,
      backorderedQuantity: it.backordered_quantity !== null && it.backordered_quantity !== undefined ? Number(it.backordered_quantity) : undefined,
    };
  });

  return {
    id: orderRow.id,
    invoiceNumber: orderRow.invoice_number,
    orderType: orderRow.order_type,
    customerType: orderRow.customer_type,
    shopName: orderRow.shop_name || undefined,
    wholesaleAccountId: orderRow.wholesale_account_id || undefined,
    customer: {
      id: orderRow.customer_id || undefined,
      firstName: orderRow.customer_first_name,
      lastName: orderRow.customer_last_name || '',
      email: orderRow.customer_email || undefined,
      phone: orderRow.customer_phone,
    },
    shippingAddress: {
      street: orderRow.shipping_street || '',
      city: orderRow.shipping_city || 'Islamabad',
      postalCode: orderRow.shipping_postal_code || '54000',
      country: orderRow.shipping_country || 'Pakistan',
    },
    items,
    subtotal: Number(orderRow.subtotal),
    discount: Number(orderRow.discount),
    shipping: Number(orderRow.shipping),
    tax: Number(orderRow.tax),
    total: Number(orderRow.total),
    currency: orderRow.currency,
    deliveryMethod: orderRow.delivery_method as any,
    paymentMethod: orderRow.payment_method,
    paymentMethodId: orderRow.payment_method_id || undefined,
    paymentStatus: orderRow.payment_status,
    paymentReference: orderRow.payment_reference || undefined,
    paymentVerification: parseJsonField<any>(orderRow.payment_verification, undefined),
    status: orderRow.status,
    notes: orderRow.notes || undefined,
    orderSource: orderRow.order_source,
    cashierId: orderRow.cashier_id || undefined,
    cashierName: orderRow.cashier_name || undefined,
    cashierEmail: orderRow.cashier_email || undefined,
    amountPaid: orderRow.amount_paid !== null ? Number(orderRow.amount_paid) : undefined,
    changeGiven: orderRow.change_given !== null ? Number(orderRow.change_given) : undefined,
    posDiscountType: (orderRow.pos_discount_type as any) || undefined,
    posDiscountValue: orderRow.pos_discount_value !== null ? Number(orderRow.pos_discount_value) : undefined,
    posDiscountReason: orderRow.pos_discount_reason || undefined,
    promoCode: orderRow.promo_code || undefined,
    promoDiscountType: (orderRow.promo_discount_type as any) || undefined,
    promoDiscountValue: orderRow.promo_discount_value !== null ? Number(orderRow.promo_discount_value) : undefined,
    promoDiscountAmount: orderRow.promo_discount_amount !== null ? Number(orderRow.promo_discount_amount) : undefined,
    promoDetails: parseJsonField<any>(orderRow.promo_details, undefined),
    hasBackorder: Boolean(orderRow.has_backorder),
    stockStatus: (orderRow.stock_status as any) || (Boolean(orderRow.has_backorder) ? 'BACKORDER' : 'IN_STOCK'),
    voidedBy: orderRow.voided_by || undefined,
    voidedAt: orderRow.voided_at || undefined,
    voidReason: orderRow.void_reason || undefined,
    createdAt: orderRow.created_at,
    updatedAt: orderRow.updated_at,
  };
}

export async function getAllOrdersFromDb(options?: {
  orderSource?: 'ONLINE' | 'POS';
  status?: string;
  customerId?: string;
  limit?: number;
}): Promise<Order[]> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params: any[] = [];

  if (options?.orderSource) {
    sql += ' AND order_source = ?';
    params.push(options.orderSource);
  }
  if (options?.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }
  if (options?.customerId) {
    sql += ' AND (customer_id = ? OR wholesale_account_id = ?)';
    params.push(options.customerId, options.customerId);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit && options.limit > 0) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const orderRows = await query<OrderRow[]>(sql, params);
  if (!orderRows || orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);
  const placeholders = orderIds.map(() => '?').join(',');

  const itemRows = await query<OrderItemRow[]>(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders})`,
    orderIds
  );

  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const it of itemRows) {
    const list = itemsByOrder.get(it.order_id) || [];
    list.push(it);
    itemsByOrder.set(it.order_id, list);
  }

  return orderRows.map((row) => mapRowsToOrder(row, itemsByOrder.get(row.id) || []));
}

export async function getOrderByIdFromDb(id: string): Promise<Order | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<OrderRow[]>(
    'SELECT * FROM orders WHERE id = ? OR invoice_number = ? LIMIT 1',
    [id, id]
  );

  if (!rows || rows.length === 0) return null;

  const itemRows = await query<OrderItemRow[]>(
    'SELECT * FROM order_items WHERE order_id = ?',
    [rows[0].id]
  );

  return mapRowsToOrder(rows[0], itemRows);
}

export async function generateNextOrderIdInDb(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await query<RowDataPacket[]>(
    'SELECT id FROM orders WHERE id LIKE ? ORDER BY id DESC LIMIT 50',
    [`ORD-${year}-%`]
  );

  let maxSeq = 0;
  for (const r of rows) {
    const parts = r.id.split('-');
    const num = parseInt(parts[2], 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
  return `ORD-${year}-${nextSeq}`;
}

export async function generateNextInvoiceNumberInDb(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await query<RowDataPacket[]>(
    'SELECT invoice_number FROM orders WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 50',
    [`INV-${year}-%`]
  );

  let maxSeq = 0;
  for (const r of rows) {
    const parts = r.invoice_number.split('-');
    const num = parseInt(parts[2], 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
  return `INV-${year}-${nextSeq}`;
}

export async function createOrderInDb(
  orderData: Omit<Order, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    invoiceNumber?: string;
  }
): Promise<Order> {
  return withTransaction(async (conn) => {
    // 0. Ensure schema supports deals
    await ensureOrderItemsDealSchema(conn);

    // 1. Generate IDs if not provided
    const orderId = orderData.id || (await generateNextOrderIdInDb());
    const invoiceNumber = orderData.invoiceNumber || (await generateNextInvoiceNumberInDb());

    // 2. Validate and adjust stock for each item in the order according to authoritative rules:
    // - DEAL BUNDLE ITEMS deduct from SHOP STOCK ONLY (products.shop_stock / product_models.shop_stock) for all bundled products.
    // - ONLINE WEBSITE ORDERS deduct from WAREHOUSE STOCK (products.stock / product_models.stock) ONLY. Shop stock is UNCHANGED.
    // - POS / WALK-IN ORDERS deduct from SHOP STOCK (products.shop_stock / product_models.shop_stock) ONLY. Warehouse stock is UNCHANGED.
    const isPosOrder = orderData.orderSource === 'POS' || orderData.orderType === 'walk_in';

    for (const item of orderData.items) {
      if (item.itemType === 'DEAL') {
        // DEAL ITEM: Bundle backed specifically by Shop Inventory
        // Must validate and atomically deduct required Shop Inventory for all bundled products
        const dealProducts = item.dealProducts && item.dealProducts.length > 0
          ? item.dealProducts
          : [{ productId: item.productId, productName: item.productName, quantity: 1, modelId: item.selectedModel, modelName: item.selectedModel }];

        for (const dp of dealProducts) {
          const neededQty = (dp.quantity || 1) * item.quantity;
          const [pRows] = await conn.query<RowDataPacket[]>(
            'SELECT id, name, sku, stock, shop_stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE',
            [dp.productId]
          );

          if (!pRows || pRows.length === 0) {
            throw new Error(`Deal product "${dp.productName}" (ID: ${dp.productId}) was not found.`);
          }

          const product = pRows[0];
          let availableShopStock = Number(product.shop_stock || 0);

          if (dp.modelId || dp.modelName) {
            const mId = String(dp.modelId || dp.modelName);
            const [mRows] = await conn.query<RowDataPacket[]>(
              'SELECT id, stock, shop_stock, name FROM product_models WHERE product_id = ? AND (name = ? OR id = ?) LIMIT 1 FOR UPDATE',
              [dp.productId, mId, mId] as any[]
            );
            if (mRows && mRows.length > 0) {
              availableShopStock = Number(mRows[0].shop_stock || 0);
              if (availableShopStock < neededQty) {
                throw new Error(
                  `Deal "${item.dealName || item.productName}" cannot be purchased: Insufficient shop stock for "${dp.productName} (${mRows[0].name || mId})". Available: ${availableShopStock}, required: ${neededQty}.`
                );
              }
              const newModelShopStock = availableShopStock - neededQty;
              await conn.execute(
                'UPDATE product_models SET shop_stock = ? WHERE id = ?',
                [newModelShopStock, mRows[0].id]
              );
              // Recalculate parent product shop_stock
              const [parentShop] = await conn.query<RowDataPacket[]>(
                'SELECT SUM(shop_stock) as total_shop FROM product_models WHERE product_id = ?',
                [dp.productId]
              );
              const newParentShopStock = parentShop && parentShop.length > 0 ? Number(parentShop[0].total_shop) || 0 : 0;
              await conn.execute(
                'UPDATE products SET shop_stock = ? WHERE id = ?',
                [newParentShopStock, dp.productId]
              );

              await conn.execute(
                `INSERT INTO inventory_logs (
                  id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
                ) VALUES (?, ?, ?, ?, 'DEAL_DEDUCT', ?, ?, ?, ?, 'system', NOW())`,
                [
                  `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  dp.productId,
                  `${product.name} (${mRows[0].name || mId}) [Shop Stock]`,
                  product.sku,
                  -neededQty,
                  availableShopStock,
                  newModelShopStock,
                  `Deal Order #${orderId}: Shop stock deducted for Deal "${item.dealName || item.productName}"`,
                ]
              );
              continue;
            }
          }

          // Product-level shop stock deduction
          if (availableShopStock < neededQty) {
            throw new Error(
              `Deal "${item.dealName || item.productName}" cannot be purchased: Insufficient shop stock for "${dp.productName}". Available: ${availableShopStock}, required: ${neededQty}.`
            );
          }

          const newShopStock = availableShopStock - neededQty;
          await conn.execute(
            'UPDATE products SET shop_stock = ? WHERE id = ?',
            [newShopStock, dp.productId]
          );

          await conn.execute(
            `INSERT INTO inventory_logs (
              id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
            ) VALUES (?, ?, ?, ?, 'DEAL_DEDUCT', ?, ?, ?, ?, 'system', NOW())`,
            [
              `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              dp.productId,
              `${product.name} [Shop Stock]`,
              product.sku,
              -neededQty,
              availableShopStock,
              newShopStock,
              `Deal Order #${orderId}: Shop stock deducted for Deal "${item.dealName || item.productName}"`,
            ]
          );
        }
        (item as any).fulfilledQuantity = item.quantity;
        (item as any).backorderedQuantity = 0;
        continue;
      }

      const [pRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, name, sku, stock, shop_stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE',
        [item.productId]
      );

      if (!pRows || pRows.length === 0) {
        throw new Error(`Product "${item.productName}" (ID: ${item.productId}) was not found.`);
      }

      const product = pRows[0];

      if (isPosOrder) {
        // POS SALE -> Deduct from SHOP STOCK ONLY
        let availableShopStock = Number(product.shop_stock || 0);

        if (item.selectedModel) {
          const [mRows] = await conn.query<RowDataPacket[]>(
            'SELECT id, stock, shop_stock FROM product_models WHERE product_id = ? AND (name = ? OR id = ?) LIMIT 1 FOR UPDATE',
            [item.productId, item.selectedModel, item.selectedModel]
          );
          if (mRows && mRows.length > 0) {
            availableShopStock = Number(mRows[0].shop_stock || 0);
            if (availableShopStock < item.quantity) {
              throw new Error(
                `Insufficient shop stock for "${product.name} (${item.selectedModel})". Available: ${availableShopStock}, requested: ${item.quantity}.`
              );
            }
            const newModelShopStock = availableShopStock - item.quantity;
            await conn.execute(
              'UPDATE product_models SET shop_stock = ? WHERE id = ?',
              [newModelShopStock, mRows[0].id]
            );
            // Recalculate parent product shop_stock from model totals
            const [parentShop] = await conn.query<RowDataPacket[]>(
              'SELECT SUM(shop_stock) as total_shop FROM product_models WHERE product_id = ?',
              [item.productId]
            );
            const newParentShopStock = parentShop && parentShop.length > 0 ? Number(parentShop[0].total_shop) || 0 : 0;
            await conn.execute(
              'UPDATE products SET shop_stock = ? WHERE id = ?',
              [newParentShopStock, item.productId]
            );

            // Inventory log for POS deduction
            await conn.execute(
              `INSERT INTO inventory_logs (
                id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
              ) VALUES (?, ?, ?, ?, 'POS_DEDUCT', ?, ?, ?, ?, ?, NOW())`,
              [
                `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                item.productId,
                `${product.name} (${item.selectedModel}) [Shop Stock]`,
                item.sku || product.sku,
                -item.quantity,
                availableShopStock,
                newModelShopStock,
                `POS Sale #${orderId}: Shop stock deducted (${item.selectedModel})`,
                orderData.cashierEmail || 'pos-counter',
              ]
            );
            (item as any).fulfilledQuantity = item.quantity;
            (item as any).backorderedQuantity = 0;
            continue;
          }
        }

        // Product-level POS deduction
        if (availableShopStock < item.quantity) {
          throw new Error(
            `Insufficient shop stock for "${product.name}". Available: ${availableShopStock}, requested: ${item.quantity}.`
          );
        }

        const newShopStock = availableShopStock - item.quantity;
        await conn.execute(
          'UPDATE products SET shop_stock = ? WHERE id = ?',
          [newShopStock, item.productId]
        );

        await conn.execute(
          `INSERT INTO inventory_logs (
            id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
          ) VALUES (?, ?, ?, ?, 'POS_DEDUCT', ?, ?, ?, ?, ?, NOW())`,
          [
            `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            item.productId,
            `${product.name} [Shop Stock]`,
            item.sku || product.sku,
            -item.quantity,
            availableShopStock,
            newShopStock,
            `POS Sale #${orderId}: Shop stock deducted`,
            orderData.cashierEmail || 'pos-counter',
          ]
        );
        (item as any).fulfilledQuantity = item.quantity;
        (item as any).backorderedQuantity = 0;
      } else {
        // ONLINE ORDER -> Deduct from WAREHOUSE STOCK ONLY
        let availableWarehouseStock = Number(product.stock || 0);

        if (item.selectedModel) {
          const [mRows] = await conn.query<RowDataPacket[]>(
            'SELECT id, stock, shop_stock FROM product_models WHERE product_id = ? AND (name = ? OR id = ?) LIMIT 1 FOR UPDATE',
            [item.productId, item.selectedModel, item.selectedModel]
          );
          if (mRows && mRows.length > 0) {
            availableWarehouseStock = Number(mRows[0].stock || 0);
            const safeAvailable = Math.max(0, availableWarehouseStock);
            const fulfilledQty = Math.min(item.quantity, safeAvailable);
            const backorderedQty = Math.max(0, item.quantity - fulfilledQty);
            (item as any).fulfilledQuantity = fulfilledQty;
            (item as any).backorderedQuantity = backorderedQty;

            const newModelStock = Math.max(0, availableWarehouseStock - fulfilledQty);
            await conn.execute(
              'UPDATE product_models SET stock = ? WHERE id = ?',
              [newModelStock, mRows[0].id]
            );
            // Recalculate parent product warehouse stock from model totals
            const [parentStock] = await conn.query<RowDataPacket[]>(
              'SELECT SUM(stock) as total_stock FROM product_models WHERE product_id = ?',
              [item.productId]
            );
            const newParentStock = parentStock && parentStock.length > 0 ? Number(parentStock[0].total_stock) || 0 : 0;
            await conn.execute(
              'UPDATE products SET stock = ? WHERE id = ?',
              [newParentStock, item.productId]
            );

            // Inventory log for Online order warehouse deduction
            if (fulfilledQty > 0) {
              await conn.execute(
                `INSERT INTO inventory_logs (
                  id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
                ) VALUES (?, ?, ?, ?, 'ORDER_DEDUCT', ?, ?, ?, ?, 'system', NOW())`,
                [
                  `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  item.productId,
                  `${product.name} (${item.selectedModel}) [Warehouse Stock]`,
                  item.sku || product.sku,
                  -fulfilledQty,
                  availableWarehouseStock,
                  newModelStock,
                  `Online Order #${orderId}: Warehouse stock deducted (${item.selectedModel})${backorderedQty > 0 ? ` (Fulfilled: ${fulfilledQty}/${item.quantity}, Backordered: ${backorderedQty})` : ''}`,
                ]
              );
            }
            continue;
          }
        }

        // Product-level Online warehouse deduction
        const safeAvailable = Math.max(0, availableWarehouseStock);
        const fulfilledQty = Math.min(item.quantity, safeAvailable);
        const backorderedQty = Math.max(0, item.quantity - fulfilledQty);
        (item as any).fulfilledQuantity = fulfilledQty;
        (item as any).backorderedQuantity = backorderedQty;

        const newWarehouseStock = Math.max(0, availableWarehouseStock - fulfilledQty);
        await conn.execute(
          'UPDATE products SET stock = ? WHERE id = ?',
          [newWarehouseStock, item.productId]
        );

        if (fulfilledQty > 0) {
          await conn.execute(
            `INSERT INTO inventory_logs (
              id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
            ) VALUES (?, ?, ?, ?, 'ORDER_DEDUCT', ?, ?, ?, ?, 'system', NOW())`,
            [
              `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              item.productId,
              `${product.name} [Warehouse Stock]`,
              item.sku || product.sku,
              -fulfilledQty,
              availableWarehouseStock,
              newWarehouseStock,
              `Online Order #${orderId}: Warehouse stock deducted${backorderedQty > 0 ? ` (Fulfilled: ${fulfilledQty}/${item.quantity}, Backordered: ${backorderedQty})` : ''}`,
            ]
          );
        }
      }
    }

    const hasBackorder = orderData.items.some((it) => (it.backorderedQuantity ?? 0) > 0);
    const allBackordered = orderData.items.every((it) => (it.fulfilledQuantity ?? 0) === 0);
    const stockStatus = hasBackorder
      ? (allBackordered ? 'BACKORDER' : 'PARTIAL_STOCK')
      : 'IN_STOCK';

    // 3. Insert order record
    await conn.execute(
      `INSERT INTO orders (
        id, invoice_number, order_type, customer_type, shop_name, wholesale_account_id,
        customer_id, customer_first_name, customer_last_name, customer_email, customer_phone,
        shipping_street, shipping_city, shipping_postal_code, shipping_country,
        subtotal, discount, shipping, tax, total, currency, delivery_method,
        payment_method, payment_method_id, payment_status, payment_reference, payment_verification,
        status, notes, order_source, cashier_id, cashier_name, cashier_email,
        amount_paid, change_given, pos_discount_type, pos_discount_value, pos_discount_reason,
        promo_code, promo_discount_type, promo_discount_value, promo_discount_amount, promo_details,
        has_backorder, stock_status,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        NOW(), NOW()
      )`,
      [
        orderId,
        invoiceNumber,
        orderData.orderType || 'online',
        orderData.customerType || 'RETAIL',
        orderData.shopName || null,
        orderData.wholesaleAccountId || null,
        orderData.customer?.id || null,
        orderData.customer?.firstName || 'Customer',
        orderData.customer?.lastName || null,
        orderData.customer?.email || null,
        orderData.customer?.phone || '',
        orderData.shippingAddress?.street || null,
        orderData.shippingAddress?.city || 'Islamabad',
        orderData.shippingAddress?.postalCode || '54000',
        orderData.shippingAddress?.country || 'Pakistan',
        orderData.subtotal,
        orderData.discount || 0,
        orderData.shipping || 0,
        orderData.tax || 0,
        orderData.total,
        orderData.currency || 'PKR',
        orderData.deliveryMethod || 'standard',
        orderData.paymentMethod || 'Cash on Delivery',
        orderData.paymentMethodId || null,
        orderData.paymentStatus || 'Pending',
        orderData.paymentReference || null,
        orderData.paymentVerification ? JSON.stringify(orderData.paymentVerification) : null,
        orderData.status || 'Confirmed',
        orderData.notes || null,
        orderData.orderSource || 'ONLINE',
        orderData.cashierId || null,
        orderData.cashierName || null,
        orderData.cashierEmail || null,
        orderData.amountPaid !== undefined ? orderData.amountPaid : null,
        orderData.changeGiven !== undefined ? orderData.changeGiven : null,
        orderData.posDiscountType || null,
        orderData.posDiscountValue !== undefined ? orderData.posDiscountValue : null,
        orderData.posDiscountReason || null,
        orderData.promoCode || null,
        orderData.promoDiscountType || null,
        orderData.promoDiscountValue !== undefined ? orderData.promoDiscountValue : null,
        orderData.promoDiscountAmount !== undefined ? orderData.promoDiscountAmount : null,
        orderData.promoDetails ? JSON.stringify(orderData.promoDetails) : null,
        hasBackorder ? 1 : 0,
        stockStatus,
      ]
    );

    // 4. Insert order items
    for (const item of orderData.items) {
      const isDeal = item.itemType === 'DEAL';
      const dealDetailsJson = isDeal
        ? JSON.stringify({
            dealId: item.dealId,
            dealName: item.dealName,
            dealPrice: item.dealPrice,
            dealProducts: item.dealProducts,
          })
        : null;

      await conn.execute(
        `INSERT INTO order_items (
          order_id, product_id, product_name, slug, sku,
          price, original_price, discount_percentage, quantity,
          selected_size, selected_color, selected_model, image, total,
          item_type, deal_id, deal_details, fulfilled_quantity, backordered_quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.productId,
          item.productName,
          item.slug || null,
          item.sku || `SKU-${item.productId}`,
          item.price,
          item.originalPrice !== undefined ? item.originalPrice : null,
          item.discountPercentage !== undefined ? item.discountPercentage : null,
          item.quantity,
          item.selectedSize || null,
          item.selectedColor || null,
          item.selectedModel || null,
          item.image || null,
          item.total,
          isDeal ? 'DEAL' : 'PRODUCT',
          item.dealId || null,
          dealDetailsJson,
          item.fulfilledQuantity !== undefined ? item.fulfilledQuantity : item.quantity,
          item.backorderedQuantity !== undefined ? item.backorderedQuantity : 0,
        ]
      );
    }

    // 5. Update customer stats if customerId or email exists
    if (orderData.customer?.id) {
      await conn.execute(
        `UPDATE customers SET
          total_orders = total_orders + 1,
          total_spent = total_spent + ?
         WHERE id = ?`,
        [orderData.total, orderData.customer.id]
      );
    }

    // 6. Record promo code usage
    if (orderData.promoDetails) {
      await recordPromoUsageInDb({
        id: `usage-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        promoCodeId: orderData.promoDetails.code,
        code: orderData.promoDetails.code,
        orderId,
        invoiceNumber,
        customerId: orderData.customer?.id,
        customerName: `${orderData.customer?.firstName || ''} ${orderData.customer?.lastName || ''}`.trim() || 'Customer',
        customerEmail: orderData.customer?.email,
        customerPhone: orderData.customer?.phone,
        discountAmount: orderData.promoDetails.discountAmount,
        orderTotal: orderData.total,
        channel: (orderData.orderSource as 'ONLINE' | 'POS') || 'ONLINE',
        usedBy: orderData.cashierEmail || orderData.customer?.email || 'Customer',
        createdAt: new Date().toISOString(),
      });
    }

    // 7. Audit log
    await conn.execute(
      `INSERT INTO activity_logs (id, admin_email, action, target, details, timestamp)
       VALUES (?, ?, 'New Order Placed', ?, ?, NOW())`,
      [
        `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderData.cashierEmail || orderData.customer?.email || 'customer-checkout',
        orderId,
        `${orderData.customer?.firstName || 'Customer'} placed order for Rs. ${orderData.total} via ${orderData.paymentMethod}`,
      ]
    );

    const [createdRows] = await conn.query<OrderRow[]>(
      'SELECT * FROM orders WHERE id = ? LIMIT 1',
      [orderId]
    );
    const [createdItemRows] = await conn.query<OrderItemRow[]>(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    );

    return mapRowsToOrder(createdRows[0], createdItemRows);
  });
}

export async function updateOrderStatusInDb(
  id: string,
  status: OrderStatus,
  adminEmail = 'admin@alhamd.com'
): Promise<Order> {
  const existing = await getOrderByIdFromDb(id);
  if (!existing) {
    throw new Error(`Order #${id} not found.`);
  }

  await execute(
    'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, id]
  );

  await logActivity({
    adminEmail,
    action: 'Updated Order Status',
    target: id,
    details: `Status changed from "${existing.status}" to "${status}"`,
  });

  return (await getOrderByIdFromDb(id))!;
}

export async function updatePaymentStatusInDb(
  id: string,
  paymentStatus: PaymentStatus,
  note?: string,
  verifiedBy = 'admin@alhamd.com'
): Promise<Order> {
  const verification = {
    verifiedBy,
    verifiedAt: new Date().toISOString(),
    note,
    status: paymentStatus === 'Paid' ? 'verified' : 'rejected',
  };

  await execute(
    'UPDATE orders SET payment_status = ?, payment_verification = ?, updated_at = NOW() WHERE id = ?',
    [paymentStatus, JSON.stringify(verification), id]
  );

  await logActivity({
    adminEmail: verifiedBy,
    action: 'Payment Status Updated',
    target: id,
    details: `Payment status set to "${paymentStatus}"`,
  });

  return (await getOrderByIdFromDb(id))!;
}

export async function voidOrderInDb(
  id: string,
  voidedBy: string,
  reason: string
): Promise<Order> {
  return withTransaction(async (conn) => {
    const existing = await getOrderByIdFromDb(id);
    if (!existing) {
      throw new Error(`Order #${id} not found.`);
    }

    if (existing.status === 'Cancelled') {
      throw new Error(`Order #${id} has already been cancelled / voided.`);
    }

    await conn.execute(
      `UPDATE orders SET
        status = 'Cancelled',
        payment_status = 'Cancelled',
        voided_by = ?,
        voided_at = NOW(),
        void_reason = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [voidedBy, reason, id]
    );

    // Restock items safely to their original fulfillment inventory:
    // - DEAL BUNDLE items restore SHOP STOCK ONLY for all bundled items
    // - POS orders restore SHOP STOCK ONLY (Warehouse stock is untouched)
    // - ONLINE orders restore WAREHOUSE STOCK ONLY (Shop stock is untouched)
    const isPosOrder = existing.orderSource === 'POS' || existing.orderType === 'walk_in';

    for (const item of existing.items) {
      if (item.itemType === 'DEAL') {
        const dealProducts = item.dealProducts && item.dealProducts.length > 0
          ? item.dealProducts
          : [{ productId: item.productId, productName: item.productName, quantity: 1, modelId: item.selectedModel, modelName: item.selectedModel }];

        for (const dp of dealProducts) {
          const restoreQty = (dp.quantity || 1) * item.quantity;
          await conn.execute(
            'UPDATE products SET shop_stock = shop_stock + ? WHERE id = ?',
            [restoreQty, dp.productId]
          );
          if (dp.modelId || dp.modelName) {
            const mId = String(dp.modelId || dp.modelName);
            await conn.execute(
              'UPDATE product_models SET shop_stock = shop_stock + ? WHERE product_id = ? AND (name = ? OR id = ?)',
              [restoreQty, dp.productId, mId, mId] as any[]
            );
            const [parentShop] = await conn.query<RowDataPacket[]>(
              'SELECT SUM(shop_stock) as total_shop FROM product_models WHERE product_id = ?',
              [dp.productId]
            );
            const newParentShopStock = parentShop && parentShop.length > 0 ? Number(parentShop[0].total_shop) || 0 : 0;
            await conn.execute(
              'UPDATE products SET shop_stock = ? WHERE id = ?',
              [newParentShopStock, dp.productId]
            );
          }

          await conn.execute(
            `INSERT INTO inventory_logs (
              id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
            ) VALUES (?, ?, ?, ?, 'DEAL_RESTOCK', ?, 0, 0, ?, ?, NOW())`,
            [
              `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              dp.productId,
              `${dp.productName} [Shop Stock]`,
              `SKU-${dp.productId}`,
              restoreQty,
              `Void Order #${id}: Restored ${restoreQty} unit(s) to shop stock for Deal "${item.dealName || item.productName}". Reason: ${reason}`,
              voidedBy,
            ]
          );
        }
        continue;
      }

      if (isPosOrder) {
        // Restore Shop Stock
        await conn.execute(
          'UPDATE products SET shop_stock = shop_stock + ? WHERE id = ?',
          [item.quantity, item.productId]
        );
        if (item.selectedModel) {
          await conn.execute(
            'UPDATE product_models SET shop_stock = shop_stock + ? WHERE product_id = ? AND (name = ? OR id = ?)',
            [item.quantity, item.productId, item.selectedModel, item.selectedModel]
          );
          const [parentShop] = await conn.query<RowDataPacket[]>(
            'SELECT SUM(shop_stock) as total_shop FROM product_models WHERE product_id = ?',
            [item.productId]
          );
          const newParentShopStock = parentShop && parentShop.length > 0 ? Number(parentShop[0].total_shop) || 0 : 0;
          await conn.execute(
            'UPDATE products SET shop_stock = ? WHERE id = ?',
            [newParentShopStock, item.productId]
          );
        }

        await conn.execute(
          `INSERT INTO inventory_logs (
            id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
          ) VALUES (?, ?, ?, ?, 'POS_RESTOCK', ?, 0, 0, ?, ?, NOW())`,
          [
            `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            item.productId,
            `${item.productName}${item.selectedModel ? ` (${item.selectedModel})` : ''} [Shop Stock]`,
            item.sku,
            item.quantity,
            `Void POS Sale #${id}: Restored ${item.quantity} unit(s) to shop stock. Reason: ${reason}`,
            voidedBy,
          ]
        );
      } else {
        // Restore Warehouse Stock ONLY up to what was actually fulfilled/deducted
        const restoreQty = item.fulfilledQuantity !== undefined && item.fulfilledQuantity !== null
          ? Number(item.fulfilledQuantity)
          : Number(item.quantity);

        if (restoreQty > 0) {
          await conn.execute(
            'UPDATE products SET stock = stock + ? WHERE id = ?',
            [restoreQty, item.productId]
          );
          if (item.selectedModel) {
            await conn.execute(
              'UPDATE product_models SET stock = stock + ? WHERE product_id = ? AND (name = ? OR id = ?)',
              [restoreQty, item.productId, item.selectedModel, item.selectedModel]
            );
            const [parentStock] = await conn.query<RowDataPacket[]>(
              'SELECT SUM(stock) as total_stock FROM product_models WHERE product_id = ?',
              [item.productId]
            );
            const newParentStock = parentStock && parentStock.length > 0 ? Number(parentStock[0].total_stock) || 0 : 0;
            await conn.execute(
              'UPDATE products SET stock = ? WHERE id = ?',
              [newParentStock, item.productId]
            );
          }

          await conn.execute(
            `INSERT INTO inventory_logs (
              id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
            ) VALUES (?, ?, ?, ?, 'RESTOCK', ?, 0, 0, ?, ?, NOW())`,
            [
              `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              item.productId,
              `${item.productName}${item.selectedModel ? ` (${item.selectedModel})` : ''} [Warehouse Stock]`,
              item.sku,
              restoreQty,
              `Void Online Order #${id}: Restored ${restoreQty} unit(s) to warehouse stock. Reason: ${reason}`,
              voidedBy,
            ]
          );
        }
      }
    }

    await conn.execute(
      `INSERT INTO activity_logs (id, admin_email, action, target, details, timestamp)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        voidedBy,
        isPosOrder ? 'Voided POS Sale' : 'Voided Online Order',
        id,
        `Void Reason: ${reason}. Restocked ${existing.items.length} line items to ${isPosOrder ? 'Shop' : 'Warehouse'} inventory.`,
      ]
    );

    const [rows] = await conn.query<OrderRow[]>('SELECT * FROM orders WHERE id = ?', [id]);
    const [items] = await conn.query<OrderItemRow[]>('SELECT * FROM order_items WHERE order_id = ?', [id]);
    return mapRowsToOrder(rows[0], items);
  });
}
