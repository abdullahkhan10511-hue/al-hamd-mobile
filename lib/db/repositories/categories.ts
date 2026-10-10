import { query, execute, isDbConfigured } from '../mysql';
import { Category } from '@/types';
import { RowDataPacket } from 'mysql2/promise';
import { logActivity } from '@/lib/db/repositories/activity';
import { deduplicateCategoriesById } from '@/lib/utils';
import { ensureSafeMediaUrl } from '../serverMedia';
import { serverCache } from '@/lib/cache/memoryCache';

export function invalidateCategoryCache(): void {
  serverCache.invalidate('categories');
}

interface CategoryRow extends RowDataPacket {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string | null;
  product_count: number;
  status: 'active' | 'inactive' | 'archived';
  is_active: number;
  featured: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    image: row.image,
    description: row.description || '',
    productCount: Number(row.product_count),
    status: row.status,
    isActive: Boolean(row.is_active),
    featured: Boolean(row.featured),
  };
}

export async function getAllCategoriesFromDb(): Promise<Category[]> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return serverCache.getOrSet('categories:all', async () => {
    const rows = await query<CategoryRow[]>(
      'SELECT * FROM categories ORDER BY sort_order ASC, name ASC'
    );
    return deduplicateCategoriesById(rows.map(mapRowToCategory));
  }, 60000);
}

export async function getCategoryByIdFromDb(id: string): Promise<Category | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return serverCache.getOrSet(`categories:id:${id}`, async () => {
    const rows = await query<CategoryRow[]>(
      'SELECT * FROM categories WHERE id = ? LIMIT 1',
      [id]
    );

    if (!rows || rows.length === 0) return null;
    return mapRowToCategory(rows[0]);
  }, 60000);
}

export async function getCategoryBySlugFromDb(slug: string): Promise<Category | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const cleanSlug = slug.trim().toLowerCase();
  return serverCache.getOrSet(`categories:slug:${cleanSlug}`, async () => {
    const rows = await query<CategoryRow[]>(
      'SELECT * FROM categories WHERE slug = ? LIMIT 1',
      [cleanSlug]
    );

    if (!rows || rows.length === 0) return null;
    return mapRowToCategory(rows[0]);
  }, 60000);
}

export async function insertCategoryToDb(
  data: Partial<Category>,
  adminEmail = 'admin@alhamd.com'
): Promise<Category> {
  const id = data.id || `cat-${Date.now()}`;
  const name = (data.name || '').trim();
  const slug = (data.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).trim();
  const safeImage =
    (await ensureSafeMediaUrl(data.image, 'categories')) ||
    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=600&auto=format&fit=crop';
  const description = data.description || '';
  const status = data.status || 'active';
  const isActive = (data as any).isActive !== false ? 1 : 0;
  const featured = data.featured ? 1 : 0;

  await execute(
    `INSERT INTO categories (id, name, slug, image, description, product_count, status, is_active, featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, slug, safeImage, description, data.productCount || 0, status, isActive, featured]
  );

  await logActivity({
    adminEmail,
    action: 'Created Category',
    target: name,
    details: `Slug: ${slug} (ID: ${id})`,
  });

  invalidateCategoryCache();
  return (await getCategoryByIdFromDb(id))!;
}

export async function updateCategoryInDb(
  id: string,
  updates: Partial<Category>,
  adminEmail = 'admin@alhamd.com'
): Promise<Category> {
  const existing = await getCategoryByIdFromDb(id);
  if (!existing) {
    throw new Error(`Category with ID "${id}" was not found.`);
  }

  const name = updates.name !== undefined ? updates.name.trim() : existing.name;
  const slug = updates.slug !== undefined ? updates.slug.trim().toLowerCase() : existing.slug;
  const image =
    updates.image !== undefined
      ? (await ensureSafeMediaUrl(updates.image, 'categories')) || existing.image
      : existing.image;
  const description = updates.description !== undefined ? updates.description : existing.description;
  const status = updates.status !== undefined ? updates.status : existing.status;
  const isActive = (updates as any).isActive !== undefined ? ((updates as any).isActive ? 1 : 0) : (existing.isActive ? 1 : 0);
  const featured = updates.featured !== undefined ? (updates.featured ? 1 : 0) : (existing.featured ? 1 : 0);

  await execute(
    `UPDATE categories SET
      name = ?, slug = ?, image = ?, description = ?, status = ?, is_active = ?, featured = ?
     WHERE id = ?`,
    [name, slug, image, description, status, isActive, featured, id]
  );

  await logActivity({
    adminEmail,
    action: 'Updated Category',
    target: name,
    details: `Updated Category details for slug: ${slug}`,
  });

  invalidateCategoryCache();
  return (await getCategoryByIdFromDb(id))!;
}

export async function deleteCategoryInDb(
  id: string,
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const existing = await getCategoryByIdFromDb(id);
  if (!existing) return false;

  await execute('DELETE FROM categories WHERE id = ?', [id]);

  await logActivity({
    adminEmail,
    action: 'Deleted Category',
    target: existing.name,
    details: `Permanently removed category (Slug: ${existing.slug})`,
  });

  invalidateCategoryCache();
  return true;
}
