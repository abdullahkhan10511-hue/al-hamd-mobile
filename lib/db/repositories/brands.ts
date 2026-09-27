import { query, execute, isDbConfigured } from '../mysql';
import { Brand } from '@/types/admin';
import { seedBrands } from '../seed';
import { RowDataPacket } from 'mysql2/promise';

interface BrandRow extends RowDataPacket {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  status: 'active' | 'inactive';
  product_count: number;
  created_at: string;
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
 * Returns all brands from MySQL database with live product counts.
 */
export async function getAllBrandsFromDb(activeOnly = false): Promise<Brand[]> {
  if (!isDbConfigured()) {
    if (activeOnly) {
      return seedBrands.filter((b) => b.status === 'active');
    }
    return seedBrands;
  }

  const whereClause = activeOnly ? "WHERE b.status = 'active'" : '';
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

/**
 * Returns a single brand by its database ID.
 */
export async function getBrandByIdFromDb(id: string): Promise<Brand | null> {
  if (!id) return null;
  if (!isDbConfigured()) {
    return seedBrands.find((b) => b.id === id) || null;
  }

  const rows = await query<BrandRow[]>(
    `SELECT b.*,
      (SELECT COUNT(*) FROM products p WHERE (p.brand = b.name OR p.brand = b.id) AND p.status != 'archived' AND p.is_active = 1) AS product_count
     FROM brands b WHERE b.id = ? LIMIT 1`,
    [id]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToBrand(rows[0]);
}

/**
 * Returns a single brand by its URL slug (or name fallback).
 */
export async function getBrandBySlugFromDb(slug: string): Promise<Brand | null> {
  if (!slug) return null;
  const cleanSlug = slug.trim().toLowerCase();

  if (!isDbConfigured()) {
    return (
      seedBrands.find(
        (b) =>
          b.slug.toLowerCase() === cleanSlug ||
          b.id.toLowerCase() === cleanSlug ||
          b.name.toLowerCase() === cleanSlug
      ) || null
    );
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
    return (
      seedBrands.find(
        (b) =>
          b.id.toLowerCase() === clean ||
          b.slug.toLowerCase() === clean ||
          b.name.toLowerCase() === clean
      ) || null
    );
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
  const name = (brand.name || '').trim();
  const slug = (brand.slug ? brand.slug.trim() : generateBrandSlug(name)).toLowerCase();
  const id = brand.id || `brand-${Date.now()}`;

  await execute(
    `INSERT INTO brands (id, name, slug, logo, description, status, product_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      slug,
      brand.logo ? brand.logo.trim() : null,
      brand.description ? brand.description.trim() : null,
      brand.status || 'active',
      brand.productCount || 0,
    ]
  );

  return {
    id,
    name,
    slug,
    logo: brand.logo ? brand.logo.trim() : undefined,
    description: brand.description ? brand.description.trim() : undefined,
    status: brand.status || 'active',
    productCount: brand.productCount || 0,
  };
}

export async function updateBrandInDb(id: string, updates: Partial<Brand>): Promise<Brand> {
  const existing = await getBrandByIdFromDb(id);
  if (!existing) {
    throw new Error(`Brand with ID "${id}" was not found.`);
  }

  const name = updates.name !== undefined ? updates.name.trim() : existing.name;
  const slug = updates.slug !== undefined ? updates.slug.trim().toLowerCase() : (updates.name ? generateBrandSlug(updates.name) : existing.slug);
  const logo = updates.logo !== undefined ? (updates.logo ? updates.logo.trim() : null) : (existing.logo || null);
  const description = updates.description !== undefined ? (updates.description ? updates.description.trim() : null) : (existing.description || null);
  const status = updates.status !== undefined ? updates.status : existing.status;

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

  const updated = await getBrandByIdFromDb(id);
  return updated || {
    id,
    name,
    slug,
    logo: logo || undefined,
    description: description || undefined,
    status,
    productCount: existing.productCount,
  };
}

export async function deleteBrandInDb(id: string): Promise<boolean> {
  const result = await execute('DELETE FROM brands WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
