import { query, execute, isDbConfigured } from '../mysql';
import { PromoCode, PromoCodeUsage } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';

interface PromoRow extends RowDataPacket {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number | string;
  maximum_discount: number | string | null;
  minimum_order_amount: number | string;
  start_date: string | null;
  expiry_date: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  is_active: number;
  applicable_type: 'all' | 'products' | 'categories';
  applicable_products: any;
  applicable_categories: any;
  customer_restrictions: 'all' | 'specific' | 'new' | 'existing';
  specific_customer_emails: any;
  pos_allowed: number;
  online_allowed: number;
  used_count: number;
  created_at: string;
  updated_at: string;
}

interface PromoUsageRow extends RowDataPacket {
  id: string;
  promo_code_id: string;
  code: string;
  order_id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  discount_amount: number | string;
  order_total: number | string;
  channel: 'ONLINE' | 'POS';
  used_by: string | null;
  created_at: string;
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

function mapRowToPromo(row: PromoRow): PromoCode {
  return {
    id: row.id,
    code: row.code,
    description: row.description || undefined,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    maximumDiscount: row.maximum_discount !== null ? Number(row.maximum_discount) : null,
    minimumOrderAmount: Number(row.minimum_order_amount),
    startDate: row.start_date || undefined,
    expiryDate: row.expiry_date || undefined,
    usageLimit: row.usage_limit,
    perCustomerLimit: row.per_customer_limit,
    isActive: Boolean(row.is_active),
    applicableType: row.applicable_type,
    applicableProducts: parseJsonField<string[]>(row.applicable_products, []),
    applicableCategories: parseJsonField<string[]>(row.applicable_categories, []),
    customerRestrictions: row.customer_restrictions,
    specificCustomerEmails: parseJsonField<string[]>(row.specific_customer_emails, []),
    posAllowed: Boolean(row.pos_allowed),
    onlineAllowed: Boolean(row.online_allowed),
    usedCount: Number(row.used_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllPromoCodesFromDb(): Promise<PromoCode[]> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<PromoRow[]>(
    'SELECT * FROM promotions ORDER BY created_at DESC'
  );

  return rows.map(mapRowToPromo);
}

export async function getPromoCodeByCodeFromDb(code: string): Promise<PromoCode | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<PromoRow[]>(
    'SELECT * FROM promotions WHERE LOWER(code) = LOWER(?) LIMIT 1',
    [code.trim()]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToPromo(rows[0]);
}

export async function insertPromoCodeToDb(data: Partial<PromoCode>): Promise<PromoCode> {
  const code = (data.code || '').trim().toUpperCase();
  if (!code) throw new Error('Promo code is required.');

  const id = data.id || `promo-${Date.now()}`;
  await execute(
    `INSERT INTO promotions (
      id, code, description, discount_type, discount_value, maximum_discount,
      minimum_order_amount, start_date, expiry_date, usage_limit, per_customer_limit,
      is_active, applicable_type, applicable_products, applicable_categories,
      customer_restrictions, specific_customer_emails, pos_allowed, online_allowed, used_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      code,
      data.description || null,
      data.discountType || 'percentage',
      data.discountValue || 0,
      data.maximumDiscount || null,
      data.minimumOrderAmount || 0,
      data.startDate || null,
      data.expiryDate || null,
      data.usageLimit || null,
      data.perCustomerLimit || null,
      data.isActive !== false ? 1 : 0,
      data.applicableType || 'all',
      data.applicableProducts ? JSON.stringify(data.applicableProducts) : null,
      data.applicableCategories ? JSON.stringify(data.applicableCategories) : null,
      data.customerRestrictions || 'all',
      data.specificCustomerEmails ? JSON.stringify(data.specificCustomerEmails) : null,
      data.posAllowed !== false ? 1 : 0,
      data.onlineAllowed !== false ? 1 : 0,
    ]
  );

  return (await getPromoCodeByCodeFromDb(code))!;
}

export async function updatePromoCodeInDb(
  id: string,
  updates: Partial<PromoCode>
): Promise<PromoCode> {
  const rows = await query<PromoRow[]>('SELECT * FROM promotions WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) {
    throw new Error('Promo code not found.');
  }

  const current = rows[0];
  const code = updates.code !== undefined ? updates.code.trim().toUpperCase() : current.code;

  await execute(
    `UPDATE promotions SET
      code = ?, description = ?, discount_type = ?, discount_value = ?,
      maximum_discount = ?, minimum_order_amount = ?, start_date = ?, expiry_date = ?,
      usage_limit = ?, per_customer_limit = ?, is_active = ?, applicable_type = ?,
      applicable_products = ?, applicable_categories = ?, customer_restrictions = ?,
      specific_customer_emails = ?, pos_allowed = ?, online_allowed = ?
     WHERE id = ?`,
    [
      code,
      updates.description !== undefined ? updates.description : current.description,
      updates.discountType !== undefined ? updates.discountType : current.discount_type,
      updates.discountValue !== undefined ? updates.discountValue : current.discount_value,
      updates.maximumDiscount !== undefined ? updates.maximumDiscount : current.maximum_discount,
      updates.minimumOrderAmount !== undefined ? updates.minimumOrderAmount : current.minimum_order_amount,
      updates.startDate !== undefined ? updates.startDate : current.start_date,
      updates.expiryDate !== undefined ? updates.expiryDate : current.expiry_date,
      updates.usageLimit !== undefined ? updates.usageLimit : current.usage_limit,
      updates.perCustomerLimit !== undefined ? updates.perCustomerLimit : current.per_customer_limit,
      updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : current.is_active,
      updates.applicableType !== undefined ? updates.applicableType : current.applicable_type,
      updates.applicableProducts !== undefined ? JSON.stringify(updates.applicableProducts) : current.applicable_products,
      updates.applicableCategories !== undefined ? JSON.stringify(updates.applicableCategories) : current.applicable_categories,
      updates.customerRestrictions !== undefined ? updates.customerRestrictions : current.customer_restrictions,
      updates.specificCustomerEmails !== undefined ? JSON.stringify(updates.specificCustomerEmails) : current.specific_customer_emails,
      updates.posAllowed !== undefined ? (updates.posAllowed ? 1 : 0) : current.pos_allowed,
      updates.onlineAllowed !== undefined ? (updates.onlineAllowed ? 1 : 0) : current.online_allowed,
      id,
    ]
  );

  return (await getPromoCodeByCodeFromDb(code))!;
}

export async function deletePromoCodeInDb(id: string): Promise<boolean> {
  const result = await execute('DELETE FROM promotions WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function recordPromoUsageInDb(usage: PromoCodeUsage): Promise<void> {
  if (!isDbConfigured()) return;

  const id = usage.id || `usage-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  await execute(
    `INSERT INTO promo_code_usages (
      id, promo_code_id, code, order_id, invoice_number, customer_id,
      customer_name, customer_email, customer_phone, discount_amount,
      order_total, channel, used_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      usage.promoCodeId,
      usage.code,
      usage.orderId,
      usage.invoiceNumber,
      usage.customerId || null,
      usage.customerName || 'Customer',
      usage.customerEmail || null,
      usage.customerPhone || null,
      usage.discountAmount,
      usage.orderTotal,
      usage.channel || 'ONLINE',
      usage.usedBy || null,
    ]
  );

  // Increment used_count on the promo code
  await execute(
    'UPDATE promotions SET used_count = used_count + 1 WHERE LOWER(code) = LOWER(?)',
    [usage.code]
  );
}

export async function getPromoUsagesFromDb(code?: string): Promise<PromoCodeUsage[]> {
  if (!isDbConfigured()) return [];

  let sql = 'SELECT * FROM promo_code_usages';
  const params: any[] = [];
  if (code) {
    sql += ' WHERE LOWER(code) = LOWER(?)';
    params.push(code.trim());
  }
  sql += ' ORDER BY created_at DESC';

  const rows = await query<PromoUsageRow[]>(sql, params);
  return rows.map((r) => ({
    id: r.id,
    promoCodeId: r.promo_code_id,
    code: r.code,
    orderId: r.order_id,
    invoiceNumber: r.invoice_number,
    customerId: r.customer_id || undefined,
    customerName: r.customer_name || 'Customer',
    customerEmail: r.customer_email || undefined,
    customerPhone: r.customer_phone || undefined,
    discountAmount: Number(r.discount_amount),
    orderTotal: Number(r.order_total),
    channel: r.channel,
    usedBy: r.used_by || undefined,
    createdAt: r.created_at,
  }));
}
