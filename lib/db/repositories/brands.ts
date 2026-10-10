import { query, execute, isDbConfigured } from '../mysql';
import { Brand } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';
import { ensureSafeMediaUrl } from '../serverMedia';
import { serverCache } from '@/lib/cache/memoryCache';

export function invalidateBrandCache(): void {
  serverCache.invalidate('brands');
}

interface BrandRow extends RowDataPacket {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  status: 'active' | 'inactive';
  product_count: number;
  sort_order?: number;
  is_featured?: number;
  created_at: string;
}

let hasCheckedBrandOrderSchema = false;

/**
 * Idempotently ensures sort_order and is_featured columns exist on the MySQL brands table.
 * Does not drop or recreate anything. Safe to run repeatedly.
 */
export async function ensureBrandOrderSchema(): Promise<void> {
  if (hasCheckedBrandOrderSchema || !isDbConfigured()) return;
  try {
    const cols = await query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'brands'
         AND COLUMN_NAME = 'sort_order'`
    );
    if (!cols || cols.length === 0) {
      await execute('ALTER TABLE `brands` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0');
    }

    const featCols = await query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'brands'
         AND COLUMN_NAME = 'is_featured'`
    );
    if (!featCols || featCols.length === 0) {
      await execute('ALTER TABLE `brands` ADD COLUMN `is_featured` TINYINT(1) NOT NULL DEFAULT 0');
    }
    hasCheckedBrandOrderSchema = true;
  } catch (err: any) {
    console.warn('[Brands] Schema check notice:', err?.message);
  }
}

function mapRowToBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo: row.logo || undefined,
    description: row.description || undefined,
    status: row.status,
    productCount: Number(row.product_count || 0),
    sortOrder: (row as any).sort_order !== undefined && (row as any).sort_order !== null ? Number((row as any).sort_order) : 0,
    isFeatured: Boolean((row as any).is_featured),
  };
}

export function generateBrandSlug(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns all brands from MySQL database with live product counts, ordered by sort_order ASC, then name ASC.
 */
export async function getAllBrandsFromDb(activeOnly = false): Promise<Brand[]> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return serverCache.getOrSet(`brands:all:${activeOnly}`, async () => {
    await ensureBrandOrderSchema().catch(() => {});

    const whereClause = activeOnly ? "WHERE b.status = 'active'" : '';
    try {
      const rows = await query<BrandRow[]>(
        `SELECT b.*,
          (SELECT COUNT(*) FROM products p WHERE (p.brand = b.name OR p.brand = b.id) AND p.status != 'archived' AND p.is_active = 1) AS product_count
         FROM brands b
         ${whereClause}
         ORDER BY b.sort_order ASC, b.name ASC`
      );

      if (!rows || rows.length === 0) {
        return [];
      }

      return rows.map(mapRowToBrand);
    } catch {
      // Fallback if sort_order column does not exist yet
      const rows = await query<BrandRow[]>(
        `SELECT b.*,
          (SELECT COUNT(*) FROM products p WHERE (p.brand = b.name OR p.brand = b.id) AND p.status != 'archived' AND p.is_active = 1) AS product_count
         FROM brands b
         ${whereClause}
         ORDER BY b.name ASC`
      );

      if (!rows || rows.length === 0) {
        return [];
      }

      return rows.map(mapRowToBrand);
    }
  }, 60000);
}

/**
 * Returns a single brand by its database ID.
 */
export async function getBrandByIdFromDb(id: string): Promise<Brand | null> {
  if (!id) return null;
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return serverCache.getOrSet(`brands:id:${id}`, async () => {
    const rows = await query<BrandRow[]>(
      `SELECT b.*,
        (SELECT COUNT(*) FROM products p WHERE (p.brand = b.name OR p.brand = b.id) AND p.status != 'archived' AND p.is_active = 1) AS product_count
       FROM brands b WHERE b.id = ? LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) return null;
    return mapRowToBrand(rows[0]);
  }, 60000);
}

/**
 * Returns a single brand by its URL slug (or name fallback).
 */
export async function getBrandBySlugFromDb(slug: string): Promise<Brand | null> {
  if (!slug) return null;
  const cleanSlug = slug.trim().toLowerCase();

  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<BrandRow[]>(
    `SELECT b.*,
      (SELECT COUNT(*) FROM products p WHERE (p.brand = b.name OR p.brand = b.id) AND p.status != 'archived' AND p.is_active = 1) AS product_count
     FROM brands b WHERE b.slug = ? OR b.id = ? OR LOWER(b.name) = ? LIMIT 1`,
    [cleanSlug, cleanSlug, cleanSlug]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToBrand(rows[0]);
}

/**
 * Returns a single brand by ID or slug.
 */
export async function getBrandByIdOrSlugFromDb(identifier: string): Promise<Brand | null> {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();

  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<BrandRow[]>(
    `SELECT b.*,
      (SELECT COUNT(*) FROM products p WHERE (p.brand = b.name OR p.brand = b.id) AND p.status != 'archived' AND p.is_active = 1) AS product_count
     FROM brands b WHERE b.id = ? OR b.slug = ? OR LOWER(b.name) = ? LIMIT 1`,
    [identifier.trim(), clean, clean]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToBrand(rows[0]);
}

export async function insertBrandToDb(brand: Partial<Brand>): Promise<Brand> {
  await ensureBrandOrderSchema().catch(() => {});
  const name = (brand.name || '').trim();
  const slug = (brand.slug ? brand.slug.trim() : generateBrandSlug(name)).toLowerCase();
  const id = brand.id || `brand-${Date.now()}`;
  const rawLogo = brand.logo ? brand.logo.trim() : null;
  const safeLogo = await ensureSafeMediaUrl(rawLogo, 'brands');
  const sortOrder = brand.sortOrder !== undefined ? Number(brand.sortOrder) : 0;
  const isFeatured = brand.isFeatured ? 1 : 0;

  try {
    await execute(
      `INSERT INTO brands (id, name, slug, logo, description, status, product_count, sort_order, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        slug,
        safeLogo,
        brand.description ? brand.description.trim() : null,
        brand.status || 'active',
        brand.productCount || 0,
        sortOrder,
        isFeatured,
      ]
    );
  } catch {
    // Fallback if columns not yet added
    await execute(
      `INSERT INTO brands (id, name, slug, logo, description, status, product_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        slug,
        safeLogo,
        brand.description ? brand.description.trim() : null,
        brand.status || 'active',
        brand.productCount || 0,
      ]
    );
  }

  invalidateBrandCache();
  return {
    id,
    name,
    slug,
    logo: safeLogo || undefined,
    description: brand.description ? brand.description.trim() : undefined,
    status: brand.status || 'active',
    productCount: brand.productCount || 0,
    sortOrder,
    isFeatured: Boolean(isFeatured),
  };
}

export async function updateBrandInDb(id: string, updates: Partial<Brand>): Promise<Brand> {
  await ensureBrandOrderSchema().catch(() => {});
  const existing = await getBrandByIdFromDb(id);
  if (!existing) {
    throw new Error(`Brand with ID "${id}" was not found.`);
  }

  const name = updates.name !== undefined ? updates.name.trim() : existing.name;
  const slug = updates.slug !== undefined ? updates.slug.trim().toLowerCase() : (updates.name ? generateBrandSlug(updates.name) : existing.slug);
  const rawLogo = updates.logo !== undefined ? (updates.logo ? updates.logo.trim() : null) : (existing.logo || null);
  const logo = await ensureSafeMediaUrl(rawLogo, 'brands');
  const description = updates.description !== undefined ? (updates.description ? updates.description.trim() : null) : (existing.description || null);
  const status = updates.status !== undefined ? updates.status : existing.status;
  const sortOrder = updates.sortOrder !== undefined ? Number(updates.sortOrder) : (existing.sortOrder ?? 0);
  const isFeatured = updates.isFeatured !== undefined ? (updates.isFeatured ? 1 : 0) : (existing.isFeatured ? 1 : 0);

  try {
    await execute(
      `UPDATE brands SET
        name = ?,
        slug = ?,
        logo = ?,
        description = ?,
        status = ?,
        sort_order = ?,
        is_featured = ?
       WHERE id = ?`,
      [name, slug, logo, description, status, sortOrder, isFeatured, id]
    );
  } catch {
    // Fallback if sort_order / is_featured column not present
    await execute(
      `UPDATE brands SET
        name = ?,
        slug = ?,
        logo = ?,
        description = ?,
        status = ?
       WHERE id = ?`,
      [name, slug, logo, description, status, id]
    );
  }

  invalidateBrandCache();
  const updated = await getBrandByIdFromDb(id);
  return updated || {
    id,
    name,
    slug,
    logo: logo || undefined,
    description: description || undefined,
    status,
    productCount: existing.productCount,
    sortOrder,
    isFeatured: Boolean(isFeatured),
  };
}

export async function reorderBrandsInDb(orderedIds: string[]): Promise<boolean> {
  if (!isDbConfigured() || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return false;
  }

  await ensureBrandOrderSchema().catch(() => {});

  for (let i = 0; i < orderedIds.length; i++) {
    const brandId = orderedIds[i];
    try {
      await execute('UPDATE brands SET sort_order = ? WHERE id = ? OR slug = ?', [i, brandId, brandId]);
    } catch (err: any) {
      console.warn('[Brands] Error updating sort_order for', brandId, err?.message);
    }
  }

  invalidateBrandCache();
  return true;
}

export async function deleteBrandInDb(id: string): Promise<boolean> {
  const result = await execute('DELETE FROM brands WHERE id = ?', [id]);
  invalidateBrandCache();
  return result.affectedRows > 0;
}
