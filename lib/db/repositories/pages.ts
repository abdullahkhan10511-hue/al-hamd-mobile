import { query, execute, isDbConfigured } from '../mysql';
import { CustomPage, PageBlock } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';

interface PageRow extends RowDataPacket {
  id: string;
  title: string;
  slug: string;
  status: 'Published' | 'Draft' | 'Hidden';
  show_in_header: number;
  show_in_footer: number;
  show_in_mobile: number;
  footer_category: 'customer_service' | 'legal' | 'about' | null;
  seo_title: string | null;
  seo_description: string | null;
  target_keywords: any;
  seo_image: string | null;
  blocks: any;
  page_order: number;
  created_at: string;
  updated_at: string;
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

function mapRowToPage(row: PageRow): CustomPage {
  const blocks = parseJsonField<PageBlock[]>(row.blocks, []);
  const targetKeywords = parseJsonField<string[]>(row.target_keywords, []);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    showInHeader: Boolean(row.show_in_header),
    showInFooter: Boolean(row.show_in_footer),
    showInMobile: Boolean(row.show_in_mobile),
    footerCategory: row.footer_category || undefined,
    seoTitle: row.seo_title || undefined,
    seoDescription: row.seo_description || undefined,
    targetKeywords: targetKeywords.length > 0 ? targetKeywords : undefined,
    seoImage: row.seo_image || undefined,
    blocks,
    order: row.page_order,
    enabled: row.status === 'Published',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllPagesFromDb(): Promise<CustomPage[]> {
  if (!isDbConfigured()) return [];

  const rows = await query<PageRow[]>('SELECT * FROM custom_pages ORDER BY page_order ASC, title ASC');
  return rows.map(mapRowToPage);
}

export async function getPageBySlugFromDb(slug: string): Promise<CustomPage | null> {
  if (!isDbConfigured()) return null;

  const rows = await query<PageRow[]>(
    'SELECT * FROM custom_pages WHERE LOWER(slug) = LOWER(?) LIMIT 1',
    [slug.trim()]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToPage(rows[0]);
}

export async function savePageInDb(page: Partial<CustomPage>): Promise<CustomPage> {
  if (!page.id || !page.slug || !page.title) {
    throw new Error('Page id, title, and slug are required.');
  }

  await execute(
    `INSERT INTO custom_pages (
      id, title, slug, status, show_in_header, show_in_footer, show_in_mobile,
      footer_category, seo_title, seo_description, target_keywords, seo_image,
      blocks, page_order, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, NOW()
    ) ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      slug = VALUES(slug),
      status = VALUES(status),
      show_in_header = VALUES(show_in_header),
      show_in_footer = VALUES(show_in_footer),
      show_in_mobile = VALUES(show_in_mobile),
      footer_category = VALUES(footer_category),
      seo_title = VALUES(seo_title),
      seo_description = VALUES(seo_description),
      target_keywords = VALUES(target_keywords),
      seo_image = VALUES(seo_image),
      blocks = VALUES(blocks),
      page_order = VALUES(page_order),
      updated_at = NOW()`,
    [
      page.id,
      page.title.trim(),
      page.slug.trim().toLowerCase(),
      page.status || 'Published',
      page.showInHeader ? 1 : 0,
      page.showInFooter !== false ? 1 : 0,
      page.showInMobile ? 1 : 0,
      page.footerCategory || null,
      page.seoTitle || null,
      page.seoDescription || null,
      page.targetKeywords ? JSON.stringify(page.targetKeywords) : null,
      page.seoImage || null,
      JSON.stringify(page.blocks || []),
      page.order || 0,
    ]
  );

  return (await getPageBySlugFromDb(page.slug))!;
}

export async function deletePageInDb(id: string): Promise<boolean> {
  const result = await execute('DELETE FROM custom_pages WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
