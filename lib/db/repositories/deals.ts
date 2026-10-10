import { query, execute, withTransaction, isDbConfigured } from '../mysql';
import { Deal, DealProductItem } from '@/types/admin';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { serverCache } from '@/lib/cache/memoryCache';

export function invalidateDealCache(): void {
  serverCache.invalidate('deals');
}

interface DealRow extends RowDataPacket {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  deal_price: number | string | null;
  original_price: number | string | null;
  discount_amount: number | string | null;
  discount_percentage: number | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'inactive';
  show_on_homepage: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface DealProductRow extends RowDataPacket {
  id: string;
  deal_id: string;
  product_id: string;
  model_id: string | null;
  product_name: string;
  model_name: string | null;
  sku: string | null;
  image: string | null;
  category: string | null;
  brand: string | null;
  price: number | string;
  shop_stock: number;
  sort_order: number;
  created_at: string;
}

function formatToMySqlDateTime(dateStr?: string | null): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function parseMySqlDateToIso(dateVal: any): string | undefined {
  if (!dateVal) return undefined;
  if (dateVal instanceof Date) return dateVal.toISOString();
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function mapRowToDealProduct(row: DealProductRow): DealProductItem {
  return {
    id: row.id,
    dealId: row.deal_id,
    productId: row.product_id,
    modelId: row.model_id || undefined,
    productName: row.product_name,
    modelName: row.model_name || undefined,
    sku: row.sku || undefined,
    image: row.image || undefined,
    category: row.category || undefined,
    brand: row.brand || undefined,
    price: Number(row.price || 0),
    shopStock: Number(row.shop_stock || 0),
    sortOrder: Number(row.sort_order || 0),
  };
}

function mapRowToDeal(row: DealRow, products: DealProductItem[] = []): Deal {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || undefined,
    image: row.image || undefined,
    dealPrice: row.deal_price !== null && row.deal_price !== undefined ? Number(row.deal_price) : undefined,
    originalPrice: row.original_price !== null && row.original_price !== undefined ? Number(row.original_price) : undefined,
    discountAmount: row.discount_amount !== null && row.discount_amount !== undefined ? Number(row.discount_amount) : undefined,
    discountPercentage: row.discount_percentage !== null && row.discount_percentage !== undefined ? Number(row.discount_percentage) : undefined,
    startDate: parseMySqlDateToIso(row.start_date),
    endDate: parseMySqlDateToIso(row.end_date),
    status: row.status,
    showOnHomepage: Boolean(row.show_on_homepage),
    displayOrder: Number(row.display_order || 1),
    products: products.sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: parseMySqlDateToIso(row.created_at) || String(row.created_at),
    updatedAt: parseMySqlDateToIso(row.updated_at) || String(row.updated_at),
  };
}

export async function getAllDealsFromDb(): Promise<Deal[]> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return serverCache.getOrSet('deals:all', async () => {
    const dealRows = await query<DealRow[]>(
      'SELECT * FROM deals ORDER BY display_order ASC, created_at DESC'
    );

    if (!dealRows || dealRows.length === 0) {
      return [];
    }

    const productRows = await query<DealProductRow[]>(
      'SELECT * FROM deal_products ORDER BY sort_order ASC'
    );

    const productMap = new Map<string, DealProductItem[]>();
    for (const pRow of productRows) {
      const list = productMap.get(pRow.deal_id) || [];
      list.push(mapRowToDealProduct(pRow));
      productMap.set(pRow.deal_id, list);
    }

    return dealRows.map((dRow) => mapRowToDeal(dRow, productMap.get(dRow.id) || []));
  }, 60000);
}

export async function getDealByIdFromDb(id: string): Promise<Deal | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return serverCache.getOrSet(`deals:id:${id}`, async () => {
    const dealRows = await query<DealRow[]>(
      'SELECT * FROM deals WHERE id = ? LIMIT 1',
      [id]
    );

    if (!dealRows || dealRows.length === 0) {
      return null;
    }

    const productRows = await query<DealProductRow[]>(
      'SELECT * FROM deal_products WHERE deal_id = ? ORDER BY sort_order ASC',
      [id]
    );

    return mapRowToDeal(dealRows[0], productRows.map(mapRowToDealProduct));
  }, 60000);
}

export async function getDealBySlugFromDb(slug: string): Promise<Deal | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return serverCache.getOrSet(`deals:slug:${slug}`, async () => {
    const dealRows = await query<DealRow[]>(
      'SELECT * FROM deals WHERE slug = ? OR id = ? LIMIT 1',
      [slug, slug]
    );

    if (!dealRows || dealRows.length === 0) {
      return null;
    }

    const productRows = await query<DealProductRow[]>(
      'SELECT * FROM deal_products WHERE deal_id = ? ORDER BY sort_order ASC',
      [dealRows[0].id]
    );

    return mapRowToDeal(dealRows[0], productRows.map(mapRowToDealProduct));
  }, 60000);
}

export async function insertDealToDb(data: Partial<Deal>): Promise<Deal> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const name = (data.name || '').trim();
  if (!name) throw new Error('Deal name is required.');

  const id = data.id || `deal-${Date.now()}`;
  const slug = data.slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}-${Date.now().toString(36)}`;
  const displayOrder = data.displayOrder ?? 1;
  const status = data.status || 'active';
  const showOnHomepage = data.showOnHomepage ?? true;

  return await withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO deals (
        id, name, slug, description, image, deal_price, original_price,
        discount_amount, discount_percentage, start_date, end_date,
        status, show_on_homepage, display_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        name,
        slug,
        data.description || null,
        data.image || null,
        data.dealPrice !== undefined ? data.dealPrice : null,
        data.originalPrice !== undefined ? data.originalPrice : null,
        data.discountAmount !== undefined ? data.discountAmount : null,
        data.discountPercentage !== undefined ? data.discountPercentage : null,
        formatToMySqlDateTime(data.startDate),
        formatToMySqlDateTime(data.endDate),
        status,
        showOnHomepage ? 1 : 0,
        displayOrder,
      ]
    );

    const insertedProducts: DealProductItem[] = [];
    if (Array.isArray(data.products) && data.products.length > 0) {
      for (let i = 0; i < data.products.length; i++) {
        const p = data.products[i];
        const pId = p.id || `dp-${Date.now()}-${i}`;
        const sortOrder = p.sortOrder !== undefined ? p.sortOrder : i + 1;

        await conn.execute(
          `INSERT INTO deal_products (
            id, deal_id, product_id, model_id, product_name, model_name,
            sku, image, category, brand, price, shop_stock, sort_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            pId,
            id,
            p.productId,
            p.modelId || null,
            p.productName,
            p.modelName || null,
            p.sku || null,
            p.image || null,
            p.category || null,
            p.brand || null,
            p.price || 0,
            p.shopStock || 0,
            sortOrder,
          ]
        );

        insertedProducts.push({
          ...p,
          id: pId,
          dealId: id,
          sortOrder,
        });
      }
    }

    invalidateDealCache();
    return {
      id,
      name,
      slug,
      description: data.description,
      image: data.image,
      dealPrice: data.dealPrice,
      originalPrice: data.originalPrice,
      discountAmount: data.discountAmount,
      discountPercentage: data.discountPercentage,
      startDate: data.startDate,
      endDate: data.endDate,
      status,
      showOnHomepage,
      displayOrder,
      products: insertedProducts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function updateDealInDb(id: string, data: Partial<Deal>): Promise<Deal> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const existing = await getDealByIdFromDb(id);
  if (!existing) {
    throw new Error(`Deal with ID "${id}" not found.`);
  }

  const name = (data.name !== undefined ? data.name : existing.name).trim();
  const slug = data.slug || existing.slug;
  const description = data.description !== undefined ? data.description : existing.description;
  const image = data.image !== undefined ? data.image : existing.image;
  const dealPrice = data.dealPrice !== undefined ? data.dealPrice : existing.dealPrice;
  const originalPrice = data.originalPrice !== undefined ? data.originalPrice : existing.originalPrice;
  const discountAmount = data.discountAmount !== undefined ? data.discountAmount : existing.discountAmount;
  const discountPercentage = data.discountPercentage !== undefined ? data.discountPercentage : existing.discountPercentage;
  const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
  const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
  const status = data.status || existing.status;
  const showOnHomepage = data.showOnHomepage !== undefined ? data.showOnHomepage : existing.showOnHomepage;
  const displayOrder = data.displayOrder !== undefined ? data.displayOrder : existing.displayOrder;

  return await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE deals SET
        name = ?, slug = ?, description = ?, image = ?,
        deal_price = ?, original_price = ?, discount_amount = ?, discount_percentage = ?,
        start_date = ?, end_date = ?, status = ?, show_on_homepage = ?, display_order = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        name,
        slug,
        description || null,
        image || null,
        dealPrice !== undefined ? dealPrice : null,
        originalPrice !== undefined ? originalPrice : null,
        discountAmount !== undefined ? discountAmount : null,
        discountPercentage !== undefined ? discountPercentage : null,
        formatToMySqlDateTime(startDate),
        formatToMySqlDateTime(endDate),
        status,
        showOnHomepage ? 1 : 0,
        displayOrder,
        id,
      ]
    );

    let updatedProducts: DealProductItem[] = [];
    if (data.products !== undefined) {
      // Replace deal products
      await conn.execute('DELETE FROM deal_products WHERE deal_id = ?', [id]);

      for (let i = 0; i < data.products.length; i++) {
        const p = data.products[i];
        const pId = p.id || `dp-${Date.now()}-${i}`;
        const sortOrder = p.sortOrder !== undefined ? p.sortOrder : i + 1;

        await conn.execute(
          `INSERT INTO deal_products (
            id, deal_id, product_id, model_id, product_name, model_name,
            sku, image, category, brand, price, shop_stock, sort_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            pId,
            id,
            p.productId,
            p.modelId || null,
            p.productName,
            p.modelName || null,
            p.sku || null,
            p.image || null,
            p.category || null,
            p.brand || null,
            p.price || 0,
            p.shopStock || 0,
            sortOrder,
          ]
        );

        updatedProducts.push({
          ...p,
          id: pId,
          dealId: id,
          sortOrder,
        });
      }
    } else {
      updatedProducts = existing.products;
    }

    invalidateDealCache();
    return {
      id,
      name,
      slug,
      description,
      image,
      dealPrice,
      originalPrice,
      discountAmount,
      discountPercentage,
      startDate,
      endDate,
      status,
      showOnHomepage,
      displayOrder,
      products: updatedProducts,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function deleteDealFromDb(id: string): Promise<boolean> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const result = await execute('DELETE FROM deals WHERE id = ?', [id]);
  invalidateDealCache();
  return result.affectedRows > 0;
}

export async function getActiveDealsFromDb(): Promise<Deal[]> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return serverCache.getOrSet('deals:active', async () => {
    const dealRows = await query<DealRow[]>(
      `SELECT * FROM deals
       WHERE status = 'active'
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date >= NOW())
       ORDER BY display_order ASC, created_at DESC`
    );

    if (!dealRows || dealRows.length === 0) {
      return [];
    }

    const dealIds = dealRows.map((d) => d.id);
    const placeholders = dealIds.map(() => '?').join(',');
    const productRows = await query<DealProductRow[]>(
      `SELECT * FROM deal_products WHERE deal_id IN (${placeholders}) ORDER BY sort_order ASC`,
      dealIds
    );

    const productMap = new Map<string, DealProductItem[]>();
    for (const pRow of productRows) {
      const list = productMap.get(pRow.deal_id) || [];
      list.push(mapRowToDealProduct(pRow));
      productMap.set(pRow.deal_id, list);
    }

    return dealRows.map((dRow) => mapRowToDeal(dRow, productMap.get(dRow.id) || []));
  }, 60000);
}
