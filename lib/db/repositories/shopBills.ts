import { query, execute, withTransaction, isDbConfigured } from '../mysql';
import { ShopBill, ShopBillItem, ShopBillStatus } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';
import { logActivity } from '@/lib/db/repositories/activity';

interface ShopBillRow extends RowDataPacket {
  id: string;
  bill_number: string;
  status: ShopBillStatus;
  notes: string | null;
  created_by: string;
  finalized_by: string | null;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface ShopBillItemRow extends RowDataPacket {
  id: number;
  shop_bill_id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  model_id: string | null;
  model_name: string | null;
  transfer_quantity: number;
  warehouse_stock_before: number;
  warehouse_stock_after: number;
  shop_stock_before: number;
  shop_stock_after: number;
}

function mapRowToShopBill(row: ShopBillRow, items: ShopBillItem[]): ShopBill {
  return {
    id: row.id,
    billNumber: row.bill_number,
    status: row.status,
    notes: row.notes || undefined,
    items,
    createdBy: row.created_by,
    finalizedBy: row.finalized_by || undefined,
    voidedBy: row.voided_by || undefined,
    voidedAt: row.voided_at || undefined,
    voidReason: row.void_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRow(row: ShopBillItemRow): ShopBillItem {
  return {
    id: row.id,
    shopBillId: row.shop_bill_id,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku || undefined,
    modelId: row.model_id || undefined,
    modelName: row.model_name || undefined,
    transferQuantity: Number(row.transfer_quantity),
    warehouseStockBefore: Number(row.warehouse_stock_before),
    warehouseStockAfter: Number(row.warehouse_stock_after),
    shopStockBefore: Number(row.shop_stock_before),
    shopStockAfter: Number(row.shop_stock_after),
  };
}

export async function generateNextShopBillNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await query<RowDataPacket[]>(
    `SELECT bill_number FROM shop_bills WHERE bill_number LIKE ? ORDER BY bill_number DESC LIMIT 50`,
    [`SB-${year}-%`]
  );
  let maxSeq = 0;
  for (const r of rows) {
    const parts = (r.bill_number as string).split('-');
    const num = parseInt(parts[2], 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  }
  const nextSeq = (maxSeq + 1).toString().padStart(5, '0');
  return `SB-${year}-${nextSeq}`;
}

export async function getAllShopBillsFromDb(limit = 100): Promise<ShopBill[]> {
  if (!isDbConfigured()) return [];

  const billRows = await query<ShopBillRow[]>(
    'SELECT * FROM shop_bills ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  if (!billRows || billRows.length === 0) return [];

  const billIds = billRows.map((b) => b.id);
  const placeholders = billIds.map(() => '?').join(',');
  const itemRows = await query<ShopBillItemRow[]>(
    `SELECT * FROM shop_bill_items WHERE shop_bill_id IN (${placeholders}) ORDER BY id ASC`,
    billIds
  );

  const itemsByBill = new Map<string, ShopBillItem[]>();
  for (const it of itemRows) {
    const list = itemsByBill.get(it.shop_bill_id) || [];
    list.push(mapItemRow(it));
    itemsByBill.set(it.shop_bill_id, list);
  }

  return billRows.map((row) => mapRowToShopBill(row, itemsByBill.get(row.id) || []));
}

export async function getShopBillByIdFromDb(id: string): Promise<ShopBill | null> {
  if (!isDbConfigured()) return null;

  const rows = await query<ShopBillRow[]>(
    'SELECT * FROM shop_bills WHERE id = ? OR bill_number = ? LIMIT 1',
    [id, id]
  );
  if (!rows || rows.length === 0) return null;

  const itemRows = await query<ShopBillItemRow[]>(
    'SELECT * FROM shop_bill_items WHERE shop_bill_id = ? ORDER BY id ASC',
    [rows[0].id]
  );

  return mapRowToShopBill(rows[0], itemRows.map(mapItemRow));
}

export async function createShopBillInDb(params: {
  items: Array<{
    productId: string;
    productName: string;
    sku?: string;
    modelId?: string;
    modelName?: string;
    transferQuantity: number;
  }>;
  notes?: string;
  createdBy: string;
}): Promise<ShopBill> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const billId = `sb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const billNumber = await generateNextShopBillNumber();

  await execute(
    `INSERT INTO shop_bills (id, bill_number, status, notes, created_by, created_at, updated_at)
     VALUES (?, ?, 'draft', ?, ?, NOW(), NOW())`,
    [billId, billNumber, params.notes || null, params.createdBy]
  );

  for (const item of params.items) {
    await execute(
      `INSERT INTO shop_bill_items (
        shop_bill_id, product_id, product_name, sku, model_id, model_name,
        transfer_quantity, warehouse_stock_before, warehouse_stock_after,
        shop_stock_before, shop_stock_after
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0)`,
      [
        billId,
        item.productId,
        item.productName,
        item.sku || null,
        item.modelId || null,
        item.modelName || null,
        item.transferQuantity,
      ]
    );
  }

  await logActivity({
    adminEmail: params.createdBy,
    action: 'Created Shop Bill',
    target: billNumber,
    details: `Draft Shop Bill with ${params.items.length} product(s). Bill ID: ${billId}`,
  });

  const bill = await getShopBillByIdFromDb(billId);
  if (!bill) throw new Error('Failed to retrieve created shop bill.');
  return bill;
}

export async function finalizeShopBillInDb(
  billId: string,
  finalizedBy: string
): Promise<ShopBill> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return withTransaction(async (conn) => {
    // Lock the bill row
    const [billRows] = await conn.query<ShopBillRow[]>(
      'SELECT * FROM shop_bills WHERE id = ? FOR UPDATE',
      [billId]
    );
    if (!billRows || billRows.length === 0) {
      throw new Error('Shop Bill not found.');
    }
    const bill = billRows[0];

    if (bill.status !== 'draft') {
      throw new Error(`Shop Bill is already ${bill.status}. Only draft bills can be finalized.`);
    }

    // Get line items
    const [itemRows] = await conn.query<ShopBillItemRow[]>(
      'SELECT * FROM shop_bill_items WHERE shop_bill_id = ? ORDER BY id ASC',
      [billId]
    );

    if (!itemRows || itemRows.length === 0) {
      throw new Error('Shop Bill has no items. Add products before finalizing.');
    }

    // PASS 1: Pre-validate available warehouse stock for ALL items before making any modifications.
    // If ANY item has insufficient stock, the entire transaction immediately fails and rolls back.
    for (const item of itemRows) {
      const qty = Number(item.transfer_quantity);
      if (qty <= 0) {
        throw new Error(`Invalid transfer quantity for "${item.product_name}".`);
      }
      if (!item.model_id) {
        const [pRows] = await conn.query<RowDataPacket[]>(
          'SELECT id, name, stock, shop_stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE',
          [item.product_id]
        );
        if (!pRows || pRows.length === 0) {
          throw new Error(`Product "${item.product_name}" (ID: ${item.product_id}) was not found.`);
        }
        const warehouseStock = Number(pRows[0].stock);
        if (warehouseStock < qty) {
          throw new Error(
            `Insufficient warehouse stock for "${item.product_name}". Warehouse: ${warehouseStock}, Requested transfer: ${qty}.`
          );
        }
      } else {
        const [mRows] = await conn.query<RowDataPacket[]>(
          'SELECT id, stock, shop_stock FROM product_models WHERE id = ? LIMIT 1 FOR UPDATE',
          [item.model_id]
        );
        if (!mRows || mRows.length === 0) {
          throw new Error(`Model "${item.model_name}" for "${item.product_name}" was not found.`);
        }
        const warehouseStock = Number(mRows[0].stock);
        if (warehouseStock < qty) {
          throw new Error(
            `Insufficient warehouse stock for "${item.product_name} (${item.model_name})". Warehouse: ${warehouseStock}, Requested transfer: ${qty}.`
          );
        }
      }
    }

    // PASS 2: Apply atomic stock transfer for each item
    for (const item of itemRows) {
      if (!item.model_id) {
        // Product-level transfer
        const [pRows] = await conn.query<RowDataPacket[]>(
          'SELECT id, name, stock, shop_stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE',
          [item.product_id]
        );
        if (!pRows || pRows.length === 0) {
          throw new Error(`Product "${item.product_name}" (ID: ${item.product_id}) was not found.`);
        }
        const prod = pRows[0];
        const warehouseStock = Number(prod.stock);
        const shopStock = Number(prod.shop_stock || 0);
        const qty = Number(item.transfer_quantity);

        if (warehouseStock < qty) {
          throw new Error(
            `Insufficient warehouse stock for "${item.product_name}". ` +
            `Warehouse: ${warehouseStock}, Requested transfer: ${qty}.`
          );
        }

        const newWarehouseStock = warehouseStock - qty;
        const newShopStock = shopStock + qty;

        await conn.execute(
          'UPDATE products SET stock = ?, shop_stock = ? WHERE id = ?',
          [newWarehouseStock, newShopStock, item.product_id]
        );

        await conn.execute(
          `UPDATE shop_bill_items SET
            warehouse_stock_before = ?, warehouse_stock_after = ?,
            shop_stock_before = ?, shop_stock_after = ?
          WHERE id = ?`,
          [warehouseStock, newWarehouseStock, shopStock, newShopStock, item.id]
        );

        // Inventory log for warehouse deduction
        await conn.execute(
          `INSERT INTO inventory_logs (
            id, product_id, product_name, sku, type, change_amount,
            previous_stock, new_stock, reason, admin_email, timestamp
          ) VALUES (?, ?, ?, ?, 'SHOP_TRANSFER', ?, ?, ?, ?, ?, NOW())`,
          [
            `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            item.product_id,
            item.product_name,
            item.sku || null,
            -qty,
            warehouseStock,
            newWarehouseStock,
            `Shop Bill ${bill.bill_number}: Warehouse → Shop transfer of ${qty} unit(s)`,
            finalizedBy,
          ]
        );
      } else {
        // Model-level transfer
        const [mRows] = await conn.query<RowDataPacket[]>(
          'SELECT id, stock, shop_stock FROM product_models WHERE id = ? LIMIT 1 FOR UPDATE',
          [item.model_id]
        );
        if (!mRows || mRows.length === 0) {
          throw new Error(`Model "${item.model_name}" for "${item.product_name}" was not found.`);
        }
        const model = mRows[0];
        const warehouseStock = Number(model.stock);
        const shopStock = Number(model.shop_stock || 0);
        const qty = Number(item.transfer_quantity);

        if (warehouseStock < qty) {
          throw new Error(
            `Insufficient warehouse stock for "${item.product_name} (${item.model_name})". ` +
            `Warehouse: ${warehouseStock}, Requested transfer: ${qty}.`
          );
        }

        const newWarehouseStock = warehouseStock - qty;
        const newShopStock = shopStock + qty;

        await conn.execute(
          'UPDATE product_models SET stock = ?, shop_stock = ? WHERE id = ?',
          [newWarehouseStock, newShopStock, item.model_id]
        );

        // Also update parent product totals
        const [parentStocks] = await conn.query<RowDataPacket[]>(
          'SELECT SUM(stock) as total_warehouse, SUM(shop_stock) as total_shop FROM product_models WHERE product_id = ?',
          [item.product_id]
        );
        if (parentStocks && parentStocks.length > 0) {
          await conn.execute(
            'UPDATE products SET stock = ?, shop_stock = ? WHERE id = ?',
            [
              Number(parentStocks[0].total_warehouse) || 0,
              Number(parentStocks[0].total_shop) || 0,
              item.product_id,
            ]
          );
        }

        await conn.execute(
          `UPDATE shop_bill_items SET
            warehouse_stock_before = ?, warehouse_stock_after = ?,
            shop_stock_before = ?, shop_stock_after = ?
          WHERE id = ?`,
          [warehouseStock, newWarehouseStock, shopStock, newShopStock, item.id]
        );

        await conn.execute(
          `INSERT INTO inventory_logs (
            id, product_id, product_name, sku, type, change_amount,
            previous_stock, new_stock, reason, admin_email, timestamp
          ) VALUES (?, ?, ?, ?, 'SHOP_TRANSFER', ?, ?, ?, ?, ?, NOW())`,
          [
            `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            item.product_id,
            `${item.product_name} (${item.model_name})`,
            item.sku || null,
            -qty,
            warehouseStock,
            newWarehouseStock,
            `Shop Bill ${bill.bill_number}: Warehouse → Shop transfer of ${qty} unit(s)`,
            finalizedBy,
          ]
        );
      }
    }

    // Mark bill as finalized
    await conn.execute(
      `UPDATE shop_bills SET status = 'finalized', finalized_by = ?, updated_at = NOW() WHERE id = ?`,
      [finalizedBy, billId]
    );

    await logActivity({
      adminEmail: finalizedBy,
      action: 'Finalized Shop Bill',
      target: bill.bill_number,
      details: `Shop Bill finalized: ${itemRows.length} product(s) transferred from warehouse to shop.`,
    });

    const result = await getShopBillByIdFromDb(billId);
    if (!result) throw new Error('Failed to retrieve finalized shop bill.');
    return result;
  });
}

export async function voidShopBillInDb(
  billId: string,
  voidedBy: string,
  voidReason: string
): Promise<ShopBill> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return withTransaction(async (conn) => {
    const [billRows] = await conn.query<ShopBillRow[]>(
      'SELECT * FROM shop_bills WHERE id = ? FOR UPDATE',
      [billId]
    );
    if (!billRows || billRows.length === 0) {
      throw new Error('Shop Bill not found.');
    }
    const bill = billRows[0];

    if (bill.status !== 'finalized') {
      throw new Error('Only finalized shop bills can be voided.');
    }

    const [itemRows] = await conn.query<ShopBillItemRow[]>(
      'SELECT * FROM shop_bill_items WHERE shop_bill_id = ? ORDER BY id ASC',
      [billId]
    );

    // Reverse the stock transfer for each item
    for (const item of itemRows) {
      const qty = Number(item.transfer_quantity);

      if (!item.model_id) {
        const [pRows] = await conn.query<RowDataPacket[]>(
          'SELECT id, stock, shop_stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE',
          [item.product_id]
        );
        if (!pRows || pRows.length === 0) continue;

        const currentWarehouse = Number(pRows[0].stock);
        const currentShop = Number(pRows[0].shop_stock || 0);

        if (currentShop < qty) {
          throw new Error(
            `Cannot void Shop Bill: "${item.product_name}" only has ${currentShop} unit(s) in shop stock (cannot reverse ${qty} units). Some units have already been sold.`
          );
        }

        // Reversal: add back to warehouse, deduct from shop (never negative)
        const restoredWarehouse = currentWarehouse + qty;
        const restoredShop = currentShop - qty;

        await conn.execute(
          'UPDATE products SET stock = ?, shop_stock = ? WHERE id = ?',
          [restoredWarehouse, restoredShop, item.product_id]
        );

        await conn.execute(
          `INSERT INTO inventory_logs (
            id, product_id, product_name, sku, type, change_amount,
            previous_stock, new_stock, reason, admin_email, timestamp
          ) VALUES (?, ?, ?, ?, 'SHOP_TRANSFER_VOID', ?, ?, ?, ?, ?, NOW())`,
          [
            `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            item.product_id,
            item.product_name,
            item.sku || null,
            qty,
            currentWarehouse,
            restoredWarehouse,
            `Void Shop Bill ${bill.bill_number}: Reversing transfer of ${qty} unit(s). Reason: ${voidReason}`,
            voidedBy,
          ]
        );
      } else {
        const [mRows] = await conn.query<RowDataPacket[]>(
          'SELECT id, stock, shop_stock FROM product_models WHERE id = ? LIMIT 1 FOR UPDATE',
          [item.model_id]
        );
        if (!mRows || mRows.length === 0) continue;

        const currentWarehouse = Number(mRows[0].stock);
        const currentShop = Number(mRows[0].shop_stock || 0);

        if (currentShop < qty) {
          throw new Error(
            `Cannot void Shop Bill: "${item.product_name} (${item.model_name})" only has ${currentShop} unit(s) in shop stock (cannot reverse ${qty} units). Some units have already been sold.`
          );
        }

        const restoredWarehouse = currentWarehouse + qty;
        const restoredShop = currentShop - qty;

        await conn.execute(
          'UPDATE product_models SET stock = ?, shop_stock = ? WHERE id = ?',
          [restoredWarehouse, restoredShop, item.model_id]
        );

        const [parentStocks] = await conn.query<RowDataPacket[]>(
          'SELECT SUM(stock) as total_warehouse, SUM(shop_stock) as total_shop FROM product_models WHERE product_id = ?',
          [item.product_id]
        );
        if (parentStocks && parentStocks.length > 0) {
          await conn.execute(
            'UPDATE products SET stock = ?, shop_stock = ? WHERE id = ?',
            [
              Number(parentStocks[0].total_warehouse) || 0,
              Number(parentStocks[0].total_shop) || 0,
              item.product_id,
            ]
          );
        }

        await conn.execute(
          `INSERT INTO inventory_logs (
            id, product_id, product_name, sku, type, change_amount,
            previous_stock, new_stock, reason, admin_email, timestamp
          ) VALUES (?, ?, ?, ?, 'SHOP_TRANSFER_VOID', ?, ?, ?, ?, ?, NOW())`,
          [
            `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            item.product_id,
            `${item.product_name} (${item.model_name})`,
            item.sku || null,
            qty,
            currentWarehouse,
            restoredWarehouse,
            `Void Shop Bill ${bill.bill_number}: Reversing transfer of ${qty} unit(s). Reason: ${voidReason}`,
            voidedBy,
          ]
        );
      }
    }

    await conn.execute(
      `UPDATE shop_bills SET status = 'voided', voided_by = ?, voided_at = NOW(), void_reason = ?, updated_at = NOW() WHERE id = ?`,
      [voidedBy, voidReason, billId]
    );

    await logActivity({
      adminEmail: voidedBy,
      action: 'Voided Shop Bill',
      target: bill.bill_number,
      details: `Shop Bill voided. ${itemRows.length} transfer(s) reversed. Reason: ${voidReason}`,
    });

    const result = await getShopBillByIdFromDb(billId);
    if (!result) throw new Error('Failed to retrieve voided shop bill.');
    return result;
  });
}
