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
    productCount: Number(row.product_count),
  };
}

export async function getAllBrandsFromDb(): Promise<Brand[]> {
  if (!isDbConfigured()) {
    return seedBrands;
  }

  const rows = await query<BrandRow[]>('SELECT * FROM brands ORDER BY name ASC');
  if (!rows || rows.length === 0) return seedBrands;
  return rows.map(mapRowToBrand);
}

export async function insertBrandToDb(brand: Partial<Brand>): Promise<Brand> {
  const id = brand.id || `brand-${Date.now()}`;
  const name = (brand.name || '').trim();
  const slug = (brand.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).trim();

  await execute(
    `INSERT INTO brands (id, name, slug, logo, description, status, product_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      slug,
      brand.logo || null,
      brand.description || null,
      brand.status || 'active',
      brand.productCount || 0,
    ]
  );

  return {
    id,
    name,
    slug,
    logo: brand.logo,
    description: brand.description,
    status: brand.status || 'active',
    productCount: brand.productCount || 0,
  };
}

export async function updateBrandInDb(id: string, updates: Partial<Brand>): Promise<Brand> {
  await execute(
    `UPDATE brands SET
      name = COALESCE(?, name),
      slug = COALESCE(?, slug),
      logo = COALESCE(?, logo),
      description = COALESCE(?, description),
      status = COALESCE(?, status)
     WHERE id = ?`,
    [
      updates.name || null,
      updates.slug || null,
      updates.logo || null,
      updates.description || null,
      updates.status || null,
      id,
    ]
  );

  const rows = await query<BrandRow[]>('SELECT * FROM brands WHERE id = ? LIMIT 1', [id]);
  return mapRowToBrand(rows[0]);
}

export async function deleteBrandInDb(id: string): Promise<boolean> {
  const result = await execute('DELETE FROM brands WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
