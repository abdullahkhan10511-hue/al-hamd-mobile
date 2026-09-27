import { query, execute, isDbConfigured } from '../mysql';
import { InventoryLog } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';

interface InventoryRow extends RowDataPacket {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  type: string | null;
  change_amount: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  admin_email: string;
  timestamp: string;
}

export async function recordInventoryLog(entry: {
  productId: string;
  productName: string;
  sku: string;
  type?: string;
  changeAmount: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  adminEmail: string;
}): Promise<InventoryLog> {
  const log: InventoryLog = {
    id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productId: entry.productId,
    productName: entry.productName,
    sku: entry.sku,
    type: (entry.type as any) || (entry.changeAmount >= 0 ? 'RESTOCK' : 'ORDER_DEDUCT'),
    changeAmount: entry.changeAmount,
    previousStock: entry.previousStock,
    newStock: entry.newStock,
    reason: entry.reason,
    adminEmail: entry.adminEmail,
    timestamp: new Date().toISOString(),
  };

  if (!isDbConfigured()) {
    return log;
  }

  try {
    await execute(
      `INSERT INTO inventory_logs (
        id, product_id, product_name, sku, type, change_amount, previous_stock, new_stock, reason, admin_email, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.productId,
        log.productName,
        log.sku,
        log.type || null,
        log.changeAmount,
        log.previousStock,
        log.newStock,
        log.reason || null,
        log.adminEmail,
        log.timestamp,
      ]
    );
  } catch (err) {
    console.warn('Failed to insert inventory log into MySQL:', err);
  }

  return log;
}

export async function getInventoryLogs(limit = 100): Promise<InventoryLog[]> {
  if (!isDbConfigured()) {
    return [];
  }

  const rows = await query<InventoryRow[]>(
    'SELECT * FROM inventory_logs ORDER BY timestamp DESC LIMIT ?',
    [limit]
  );

  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    sku: r.sku,
    type: r.type as any,
    changeAmount: Number(r.change_amount),
    previousStock: Number(r.previous_stock),
    newStock: Number(r.new_stock),
    reason: r.reason || undefined,
    adminEmail: r.admin_email,
    timestamp: r.timestamp,
  }));
}
