import { query, execute, withTransaction, isDbConfigured } from '../mysql';
import { Product, ProductModelVariant, ProductColorVariant, ProductMediaItem, BulkPricingRule, ProductReview } from '@/types';
import { RowDataPacket } from 'mysql2/promise';
import { logActivity } from '@/lib/db/repositories/activity';
import { recordInventoryLog } from '@/lib/db/repositories/inventory';

interface ProductRow extends RowDataPacket {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  long_description: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  wholesale_price: number | string | null;
  super_wholesale_price: number | string | null;
  discount_percentage: number | null;
  category: string;
  category_slug: string;
  brand: string;
  origin: string | null;
  sku: string | null;
  stock: number;
  low_stock_threshold: number;
  rating: number | string;
  review_count: number;
  status: 'active' | 'inactive' | 'archived';
  is_active: number;
  is_new: number;
  is_new_arrival: number;
  is_best_seller: number;
  is_sale: number;
  featured: number;
  trending: number;
  enable_model_selection: number;
  enable_color_selection: number;
  specifications: any;
  features: any;
  tags: any;
  variants: any;
  shipping_info: string | null;
  returns_info: string | null;
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

export function mapRowToProduct(
  row: ProductRow,
  models: ProductModelVariant[] = [],
  colors: ProductColorVariant[] = [],
  media: ProductMediaItem[] = [],
  bulkPricing: BulkPricingRule[] = [],
  reviews: ProductReview[] = []
): Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean } {
  // Extract gallery images and videos from media
  const galleryImages = media
    .filter((m) => m.type === 'image')
    .map((m) => m.url);
  const galleryVideos = media
    .filter((m) => m.type === 'video')
    .map((m) => m.url);

  const parsedSpecs = parseJsonField<Record<string, string>>(row.specifications, {});
  const parsedFeatures = parseJsonField<string[]>(row.features, []);
  const parsedTags = parseJsonField<string[]>(row.tags, []);
  const parsedVariants = parseJsonField<any>(row.variants, undefined);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || undefined,
    description: row.description,
    longDescription: row.long_description || undefined,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price !== null ? Number(row.compare_at_price) : undefined,
    wholesalePrice: row.wholesale_price !== null ? Number(row.wholesale_price) : undefined,
    superWholesalePrice: row.super_wholesale_price !== null && row.super_wholesale_price !== undefined ? Number(row.super_wholesale_price) : undefined,
    discountPercentage: row.discount_percentage !== null ? Number(row.discount_percentage) : undefined,
    category: row.category,
    categorySlug: row.category_slug,
    brand: row.brand,
    sku: row.sku || `ALH-${row.id}`,
    stock: Number(row.stock),
    lowStockThreshold: Number(row.low_stock_threshold),
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    status: row.status,
    isActive: Boolean(row.is_active),
    isNew: Boolean(row.is_new),
    isNewArrival: Boolean(row.is_new_arrival),
    isBestSeller: Boolean(row.is_best_seller),
    isSale: Boolean(row.is_sale),
    featured: Boolean(row.featured),
    trending: Boolean(row.trending),
    enableModelSelection: Boolean(row.enable_model_selection),
    enableColorSelection: Boolean(row.enable_color_selection),
    models: models.length > 0 ? models : undefined,
    colors: colors.length > 0 ? colors : undefined,
    media: media.length > 0 ? media : undefined,
    images: galleryImages.length > 0 ? galleryImages : ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=800&auto=format&fit=crop'],
    videos: galleryVideos.length > 0 ? galleryVideos : undefined,
    bulkPricing: bulkPricing.length > 0 ? bulkPricing : undefined,
    reviews: reviews.length > 0 ? reviews : undefined,
    specifications: Object.keys(parsedSpecs).length > 0 ? parsedSpecs : undefined,
    features: parsedFeatures.length > 0 ? parsedFeatures : undefined,
    tags: parsedTags.length > 0 ? parsedTags : undefined,
    variants: parsedVariants,
    shippingInfo: row.shipping_info || undefined,
    returnsInfo: row.returns_info || undefined,
  };
}

export async function getAllProductsFromDb(): Promise<(Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean })[]> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const productRows = await query<ProductRow[]>(
    'SELECT * FROM products ORDER BY created_at DESC'
  );

  if (!productRows || productRows.length === 0) {
    return [];
  }

  const productIds = productRows.map((p) => p.id);

  // Fetch related records in bulk
  const placeholders = productIds.map(() => '?').join(',');

  const [modelsRows, colorsRows, mediaRows, bulkRows, reviewsRows] = await Promise.all([
    query<RowDataPacket[]>(
      `SELECT * FROM product_models WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC`,
      productIds
    ),
    query<RowDataPacket[]>(
      `SELECT * FROM product_colors WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC`,
      productIds
    ),
    query<RowDataPacket[]>(
      `SELECT * FROM product_media WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC`,
      productIds
    ),
    query<RowDataPacket[]>(
      `SELECT * FROM product_bulk_pricing WHERE product_id IN (${placeholders}) ORDER BY min_qty ASC`,
      productIds
    ),
    query<RowDataPacket[]>(
      `SELECT * FROM product_reviews WHERE product_id IN (${placeholders}) ORDER BY date DESC`,
      productIds
    ),
  ]);

  // Group related by product_id
  const modelsByProd = new Map<string, ProductModelVariant[]>();
  for (const m of modelsRows) {
    const list = modelsByProd.get(m.product_id) || [];
    list.push({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      compareAtPrice: m.compare_at_price !== null ? Number(m.compare_at_price) : undefined,
      wholesalePrice: m.wholesale_price !== null ? Number(m.wholesale_price) : undefined,
      superWholesalePrice: m.super_wholesale_price !== null && m.super_wholesale_price !== undefined ? Number(m.super_wholesale_price) : undefined,
      stock: Number(m.stock),
      sku: m.sku || undefined,
      isActive: Boolean(m.is_active),
      images: parseJsonField<string[]>(m.images, []),
      videos: parseJsonField<string[]>(m.videos, []),
    });
    modelsByProd.set(m.product_id, list);
  }

  const colorsByProd = new Map<string, ProductColorVariant[]>();
  for (const c of colorsRows) {
    const list = colorsByProd.get(c.product_id) || [];
    list.push({
      id: c.id,
      name: c.name,
      hex: c.hex || undefined,
      isActive: Boolean(c.is_active),
    });
    colorsByProd.set(c.product_id, list);
  }

  const mediaByProd = new Map<string, ProductMediaItem[]>();
  for (const med of mediaRows) {
    const list = mediaByProd.get(med.product_id) || [];
    list.push({
      id: med.id,
      url: med.url,
      type: med.media_type,
      name: med.name || undefined,
      size: med.size || undefined,
    });
    mediaByProd.set(med.product_id, list);
  }

  const bulkByProd = new Map<string, BulkPricingRule[]>();
  for (const b of bulkRows) {
    const list = bulkByProd.get(b.product_id) || [];
    list.push({
      id: b.id,
      minQty: Number(b.min_qty),
      maxQty: Number(b.max_qty),
      discountPercentage: Number(b.discount_percentage),
    });
    bulkByProd.set(b.product_id, list);
  }

  const reviewsByProd = new Map<string, ProductReview[]>();
  for (const r of reviewsRows) {
    const list = reviewsByProd.get(r.product_id) || [];
    list.push({
      id: r.id,
      author: r.author,
      authorEmail: r.author_email || undefined,
      rating: Number(r.rating),
      title: r.title || '',
      comment: r.comment,
      verified: Boolean(r.verified),
      date: r.date,
    });
    reviewsByProd.set(r.product_id, list);
  }

  return productRows.map((row) =>
    mapRowToProduct(
      row,
      modelsByProd.get(row.id) || [],
      colorsByProd.get(row.id) || [],
      mediaByProd.get(row.id) || [],
      bulkByProd.get(row.id) || [],
      reviewsByProd.get(row.id) || []
    )
  );
}

export async function getProductByIdFromDb(id: string): Promise<(Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean }) | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<ProductRow[]>(
    'SELECT * FROM products WHERE id = ? LIMIT 1',
    [id]
  );

  if (!rows || rows.length === 0) return null;

  const [models, colors, media, bulkPricing, reviews] = await Promise.all([
    query<RowDataPacket[]>(
      'SELECT * FROM product_models WHERE product_id = ? ORDER BY sort_order ASC',
      [id]
    ),
    query<RowDataPacket[]>(
      'SELECT * FROM product_colors WHERE product_id = ? ORDER BY sort_order ASC',
      [id]
    ),
    query<RowDataPacket[]>(
      'SELECT * FROM product_media WHERE product_id = ? ORDER BY sort_order ASC',
      [id]
    ),
    query<RowDataPacket[]>(
      'SELECT * FROM product_bulk_pricing WHERE product_id = ? ORDER BY min_qty ASC',
      [id]
    ),
    query<RowDataPacket[]>(
      'SELECT * FROM product_reviews WHERE product_id = ? ORDER BY date DESC',
      [id]
    ),
  ]);

  return mapRowToProduct(
    rows[0],
    models.map((m) => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      compareAtPrice: m.compare_at_price !== null ? Number(m.compare_at_price) : undefined,
      wholesalePrice: m.wholesale_price !== null ? Number(m.wholesale_price) : undefined,
      superWholesalePrice: m.super_wholesale_price !== null && m.super_wholesale_price !== undefined ? Number(m.super_wholesale_price) : undefined,
      stock: Number(m.stock),
      sku: m.sku || undefined,
      isActive: Boolean(m.is_active),
      images: parseJsonField<string[]>(m.images, []),
      videos: parseJsonField<string[]>(m.videos, []),
    })),
    colors.map((c) => ({
      id: c.id,
      name: c.name,
      hex: c.hex || undefined,
      isActive: Boolean(c.is_active),
    })),
    media.map((med) => ({
      id: med.id,
      url: med.url,
      type: med.media_type,
      name: med.name || undefined,
      size: med.size || undefined,
    })),
    bulkPricing.map((b) => ({
      id: b.id,
      minQty: Number(b.min_qty),
      maxQty: Number(b.max_qty),
      discountPercentage: Number(b.discount_percentage),
    })),
    reviews.map((r) => ({
      id: r.id,
      author: r.author,
      authorEmail: r.author_email || undefined,
      rating: Number(r.rating),
      title: r.title || '',
      comment: r.comment,
      verified: Boolean(r.verified),
      date: r.date,
    }))
  );
}

export async function getProductBySlugFromDb(slug: string): Promise<(Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean }) | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<ProductRow[]>(
    'SELECT * FROM products WHERE slug = ? LIMIT 1',
    [slug.trim().toLowerCase()]
  );

  if (!rows || rows.length === 0) return null;
  return getProductByIdFromDb(rows[0].id);
}

export async function insertProductToDb(
  data: Partial<Product & { sku?: string; lowStockThreshold?: number; trending?: boolean }>,
  adminEmail = 'admin@alhamd.com'
): Promise<Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean }> {
  return withTransaction(async (conn) => {
    const id = data.id || `prod-${Date.now()}`;
    const slug = data.slug || `product-${Date.now()}`;
    const name = (data.name || 'Untitled Product').trim();
    const sku = data.sku ? data.sku.trim().toUpperCase() : `ALH-${id}`;

    // Calculate default price and stock if model selection is ON
    let finalPrice = data.price !== undefined && data.price !== null ? Number(data.price) : 0;
    let finalStock = data.stock !== undefined && data.stock !== null ? Number(data.stock) : 0;
    if (data.enableModelSelection && Array.isArray(data.models) && data.models.length > 0) {
      const activeModels = data.models.filter((m) => m.isActive !== false);
      if (activeModels.length > 0 && (!finalPrice || finalPrice <= 0)) {
        finalPrice = activeModels[0].price;
      }
      const totalModelStock = activeModels.reduce((acc, m) => acc + (m.stock ?? 0), 0);
      if (totalModelStock > 0 && (!finalStock || finalStock <= 0)) {
        finalStock = totalModelStock;
      }
    }

    const compareAtPrice = data.compareAtPrice !== undefined && data.compareAtPrice !== null ? Number(data.compareAtPrice) : null;
    const wholesalePrice = data.wholesalePrice !== undefined && data.wholesalePrice !== null && Number(data.wholesalePrice) > 0
      ? Number(data.wholesalePrice)
      : null;
    const superWholesalePrice = data.superWholesalePrice !== undefined && data.superWholesalePrice !== null && Number(data.superWholesalePrice) > 0
      ? Number(data.superWholesalePrice)
      : null;
    const discountPercentage = data.discountPercentage !== undefined && data.discountPercentage !== null ? Number(data.discountPercentage) : null;
    const lowStockThreshold = data.lowStockThreshold !== undefined && data.lowStockThreshold !== null ? Number(data.lowStockThreshold) : 5;
    const status = data.status || 'active';
    const isActive = (data as any).isActive !== undefined ? ((data as any).isActive ? 1 : 0) : 1;

    await conn.execute(
      `INSERT INTO products (
        id, slug, name, tagline, description, long_description,
        price, compare_at_price, wholesale_price, super_wholesale_price, discount_percentage,
        category, category_slug, brand, origin, sku, stock, low_stock_threshold,
        rating, review_count, status, is_active, is_new, is_new_arrival,
        is_best_seller, is_sale, featured, trending,
        enable_model_selection, enable_color_selection,
        specifications, features, tags, variants, shipping_info, returns_info
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?
      )`,
      [
        id,
        slug,
        name,
        data.tagline || null,
        data.description || '',
        data.longDescription || null,
        finalPrice,
        compareAtPrice,
        wholesalePrice,
        superWholesalePrice,
        discountPercentage,
        data.category || 'Accessories',
        data.categorySlug || 'accessories',
        data.brand || 'Al-Hamd',
        (data as any).origin || 'Pakistan',
        sku,
        finalStock,
        lowStockThreshold,
        data.rating || 5.0,
        data.reviewCount || 0,
        status,
        isActive,
        data.isNew ? 1 : 0,
        data.isNewArrival ? 1 : 0,
        data.isBestSeller ? 1 : 0,
        data.isSale ? 1 : 0,
        data.featured ? 1 : 0,
        data.trending ? 1 : 0,
        data.enableModelSelection ? 1 : 0,
        data.enableColorSelection ? 1 : 0,
        data.specifications ? JSON.stringify(data.specifications) : null,
        data.features ? JSON.stringify(data.features) : null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.variants ? JSON.stringify(data.variants) : null,
        data.shippingInfo || null,
        data.returnsInfo || null,
      ]
    );

    // Insert Media
    if (Array.isArray(data.images) && data.images.length > 0) {
      let sortOrder = 0;
      for (const imgUrl of data.images) {
        if (!imgUrl || !imgUrl.trim()) continue;
        await conn.execute(
          `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
           VALUES (?, ?, 'image', ?, ?)`,
          [`med-${id}-${sortOrder}`, id, imgUrl.trim(), sortOrder]
        );
        sortOrder++;
      }
    }

    if (Array.isArray(data.videos) && data.videos.length > 0) {
      let sortOrder = 100;
      for (const vidUrl of data.videos) {
        if (!vidUrl || !vidUrl.trim()) continue;
        await conn.execute(
          `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
           VALUES (?, ?, 'video', ?, ?)`,
          [`med-vid-${id}-${sortOrder}`, id, vidUrl.trim(), sortOrder]
        );
        sortOrder++;
      }
    }

    // Insert Models
    if (Array.isArray(data.models)) {
      let sortOrder = 0;
      for (const model of data.models) {
        const modelId = model.id || `mod-${id}-${sortOrder}`;
        await conn.execute(
          `INSERT INTO product_models (
            id, product_id, name, price, compare_at_price, wholesale_price, super_wholesale_price, stock, sku, is_active, images, videos, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            modelId,
            id,
            model.name,
            Number(model.price) || 0,
            model.compareAtPrice !== undefined ? Number(model.compareAtPrice) : null,
            model.wholesalePrice !== undefined ? Number(model.wholesalePrice) : null,
            model.superWholesalePrice !== undefined ? Number(model.superWholesalePrice) : null,
            Number(model.stock) || 0,
            model.sku || null,
            model.isActive !== false ? 1 : 0,
            model.images ? JSON.stringify(model.images) : null,
            model.videos ? JSON.stringify(model.videos) : null,
            sortOrder,
          ]
        );
        sortOrder++;
      }
    }

    // Insert Colors
    if (Array.isArray(data.colors)) {
      let sortOrder = 0;
      for (const color of data.colors) {
        const colorId = color.id || `col-${id}-${sortOrder}`;
        await conn.execute(
          `INSERT INTO product_colors (id, product_id, name, hex, is_active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            colorId,
            id,
            color.name,
            color.hex || null,
            color.isActive !== false ? 1 : 0,
            sortOrder,
          ]
        );
        sortOrder++;
      }
    }

    // Log activity
    await logActivity({
      adminEmail,
      action: 'Created Product',
      target: name,
      details: `SKU: ${sku}, Price: Rs. ${finalPrice}, Stock: ${finalStock}`,
    });

    return getProductByIdFromDb(id) as Promise<any>;
  });
}

export async function updateProductInDb(
  id: string,
  updates: Partial<Product & { sku?: string; lowStockThreshold?: number; trending?: boolean }>,
  adminEmail = 'admin@alhamd.com'
): Promise<Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean }> {
  return withTransaction(async (conn) => {
    const existing = await getProductByIdFromDb(id);
    if (!existing) {
      throw new Error(`Product with ID "${id}" was not found.`);
    }

    const name = updates.name !== undefined ? updates.name.trim() : existing.name;
    const slug = updates.slug !== undefined ? updates.slug.trim().toLowerCase() : existing.slug;
    const sku = updates.sku !== undefined ? updates.sku.trim().toUpperCase() : existing.sku;
    const finalPrice = updates.price !== undefined ? Number(updates.price) : existing.price;
    const compareAtPrice = updates.compareAtPrice !== undefined ? (updates.compareAtPrice !== null ? Number(updates.compareAtPrice) : null) : (existing.compareAtPrice || null);
    const wholesalePrice = updates.wholesalePrice !== undefined ? (updates.wholesalePrice !== null && Number(updates.wholesalePrice) > 0 ? Number(updates.wholesalePrice) : null) : (existing.wholesalePrice || null);
    const superWholesalePrice = updates.superWholesalePrice !== undefined ? (updates.superWholesalePrice !== null && Number(updates.superWholesalePrice) > 0 ? Number(updates.superWholesalePrice) : null) : (existing.superWholesalePrice || null);
    const discountPercentage = updates.discountPercentage !== undefined ? (updates.discountPercentage !== null ? Number(updates.discountPercentage) : null) : (existing.discountPercentage || null);
    const finalStock = updates.stock !== undefined ? Number(updates.stock) : existing.stock;
    const lowStockThreshold = updates.lowStockThreshold !== undefined ? Number(updates.lowStockThreshold) : existing.lowStockThreshold;
    const status = updates.status !== undefined ? updates.status : existing.status;
    const isActive = (updates as any).isActive !== undefined ? ((updates as any).isActive ? 1 : 0) : (existing.isActive ? 1 : 0);

    await conn.execute(
      `UPDATE products SET
        slug = ?, name = ?, tagline = ?, description = ?, long_description = ?,
        price = ?, compare_at_price = ?, wholesale_price = ?, super_wholesale_price = ?, discount_percentage = ?,
        category = ?, category_slug = ?, brand = ?, origin = ?, sku = ?, stock = ?, low_stock_threshold = ?,
        status = ?, is_active = ?, is_new = ?, is_new_arrival = ?,
        is_best_seller = ?, is_sale = ?, featured = ?, trending = ?,
        enable_model_selection = ?, enable_color_selection = ?,
        specifications = ?, features = ?, tags = ?, variants = ?, shipping_info = ?, returns_info = ?
      WHERE id = ?`,
      [
        slug,
        name,
        updates.tagline !== undefined ? updates.tagline : (existing.tagline || null),
        updates.description !== undefined ? updates.description : existing.description,
        updates.longDescription !== undefined ? updates.longDescription : (existing.longDescription || null),
        finalPrice,
        compareAtPrice,
        wholesalePrice,
        superWholesalePrice,
        discountPercentage,
        updates.category !== undefined ? updates.category : existing.category,
        updates.categorySlug !== undefined ? updates.categorySlug : existing.categorySlug,
        updates.brand !== undefined ? updates.brand : existing.brand,
        (updates as any).origin !== undefined ? (updates as any).origin : ((existing as any).origin || 'Pakistan'),
        sku,
        finalStock,
        lowStockThreshold,
        status,
        isActive,
        (updates.isNew !== undefined ? updates.isNew : existing.isNew) ? 1 : 0,
        (updates.isNewArrival !== undefined ? updates.isNewArrival : existing.isNewArrival) ? 1 : 0,
        (updates.isBestSeller !== undefined ? updates.isBestSeller : existing.isBestSeller) ? 1 : 0,
        (updates.isSale !== undefined ? updates.isSale : existing.isSale) ? 1 : 0,
        (updates.featured !== undefined ? updates.featured : existing.featured) ? 1 : 0,
        (updates.trending !== undefined ? updates.trending : existing.trending) ? 1 : 0,
        (updates.enableModelSelection !== undefined ? updates.enableModelSelection : existing.enableModelSelection) ? 1 : 0,
        (updates.enableColorSelection !== undefined ? updates.enableColorSelection : existing.enableColorSelection) ? 1 : 0,
        updates.specifications !== undefined ? JSON.stringify(updates.specifications) : (existing.specifications ? JSON.stringify(existing.specifications) : null),
        updates.features !== undefined ? JSON.stringify(updates.features) : (existing.features ? JSON.stringify(existing.features) : null),
        updates.tags !== undefined ? JSON.stringify(updates.tags) : (existing.tags ? JSON.stringify(existing.tags) : null),
        updates.variants !== undefined ? JSON.stringify(updates.variants) : (existing.variants ? JSON.stringify(existing.variants) : null),
        updates.shippingInfo !== undefined ? updates.shippingInfo : (existing.shippingInfo || null),
        updates.returnsInfo !== undefined ? updates.returnsInfo : (existing.returnsInfo || null),
        id,
      ]
    );

    // Update media if provided
    if (updates.images !== undefined || updates.videos !== undefined) {
      await conn.execute('DELETE FROM product_media WHERE product_id = ?', [id]);
      const imagesToSave = updates.images !== undefined ? updates.images : existing.images;
      const videosToSave = updates.videos !== undefined ? updates.videos : (existing.videos || []);

      let sortOrder = 0;
      for (const imgUrl of imagesToSave) {
        if (!imgUrl || !imgUrl.trim()) continue;
        await conn.execute(
          `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
           VALUES (?, ?, 'image', ?, ?)`,
          [`med-${id}-${sortOrder}`, id, imgUrl.trim(), sortOrder]
        );
        sortOrder++;
      }
      for (const vidUrl of videosToSave) {
        if (!vidUrl || !vidUrl.trim()) continue;
        await conn.execute(
          `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
           VALUES (?, ?, 'video', ?, ?)`,
          [`med-vid-${id}-${sortOrder}`, id, vidUrl.trim(), sortOrder]
        );
        sortOrder++;
      }
    }

    // Update models if provided
    if (updates.models !== undefined) {
      await conn.execute('DELETE FROM product_models WHERE product_id = ?', [id]);
      let sortOrder = 0;
      for (const model of updates.models) {
        const modelId = model.id || `mod-${id}-${sortOrder}`;
        await conn.execute(
          `INSERT INTO product_models (
            id, product_id, name, price, compare_at_price, wholesale_price, super_wholesale_price, stock, sku, is_active, images, videos, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            modelId,
            id,
            model.name,
            Number(model.price) || 0,
            model.compareAtPrice !== undefined ? Number(model.compareAtPrice) : null,
            model.wholesalePrice !== undefined ? Number(model.wholesalePrice) : null,
            model.superWholesalePrice !== undefined ? Number(model.superWholesalePrice) : null,
            Number(model.stock) || 0,
            model.sku || null,
            model.isActive !== false ? 1 : 0,
            model.images ? JSON.stringify(model.images) : null,
            model.videos ? JSON.stringify(model.videos) : null,
            sortOrder,
          ]
        );
        sortOrder++;
      }
    }

    // Update colors if provided
    if (updates.colors !== undefined) {
      await conn.execute('DELETE FROM product_colors WHERE product_id = ?', [id]);
      let sortOrder = 0;
      for (const color of updates.colors) {
        const colorId = color.id || `col-${id}-${sortOrder}`;
        await conn.execute(
          `INSERT INTO product_colors (id, product_id, name, hex, is_active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            colorId,
            id,
            color.name,
            color.hex || null,
            color.isActive !== false ? 1 : 0,
            sortOrder,
          ]
        );
        sortOrder++;
      }
    }

    await logActivity({
      adminEmail,
      action: 'Updated Product',
      target: name,
      details: `Updated details for SKU: ${sku}`,
    });

    return getProductByIdFromDb(id) as Promise<any>;
  });
}

export async function deleteProductInDb(
  id: string,
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const existing = await getProductByIdFromDb(id);
  if (!existing) return false;

  await execute('DELETE FROM products WHERE id = ?', [id]);

  await logActivity({
    adminEmail,
    action: 'Deleted Product',
    target: existing.name,
    details: `Permanently removed SKU: ${existing.sku || 'N/A'} (ID: ${id})`,
  });

  return true;
}

export async function adjustStockInDb(
  productId: string,
  delta: number,
  reason = 'Inventory adjustment',
  adminEmail = 'system',
  modelName?: string
): Promise<{ success: boolean; newStock: number }> {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<ProductRow[]>(
      'SELECT id, name, sku, stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE',
      [productId]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`Product ${productId} not found.`);
    }

    const prod = rows[0];
    const prevStock = Number(prod.stock);
    const newStock = Math.max(0, prevStock + delta);

    await conn.execute(
      'UPDATE products SET stock = ? WHERE id = ?',
      [newStock, productId]
    );

    // If specific model specified, adjust model stock as well
    if (modelName) {
      const [modRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, stock FROM product_models WHERE product_id = ? AND (name = ? OR id = ?) LIMIT 1 FOR UPDATE',
        [productId, modelName, modelName]
      );
      if (modRows && modRows.length > 0) {
        const mPrev = Number(modRows[0].stock);
        const mNew = Math.max(0, mPrev + delta);
        await conn.execute(
          'UPDATE product_models SET stock = ? WHERE id = ?',
          [mNew, modRows[0].id]
        );
      }
    }

    await recordInventoryLog({
      productId,
      productName: prod.name,
      sku: prod.sku || `ALH-${productId}`,
      changeAmount: delta,
      previousStock: prevStock,
      newStock,
      reason: modelName ? `${reason} (Model: ${modelName})` : reason,
      adminEmail,
    });

    return { success: true, newStock };
  });
}
