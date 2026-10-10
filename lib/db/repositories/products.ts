import { query, execute, withTransaction, isDbConfigured } from '../mysql';
import { Product, ProductModelVariant, ProductColorVariant, ProductMediaItem, BulkPricingRule, ProductReview } from '@/types';
import { RowDataPacket } from 'mysql2/promise';
import { logActivity } from '@/lib/db/repositories/activity';
import { recordInventoryLog } from '@/lib/db/repositories/inventory';
import { ensureSafeMediaUrls } from '../serverMedia';
import { serverCache } from '@/lib/cache/memoryCache';

export function invalidateProductCache(): void {
  serverCache.invalidate('products');
}

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
  shop_stock: number;
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

/**
 * Internal-only fields that must NEVER appear in public specifications
 * (legacy fields that were once stored inside the specifications column).
 */
export const INTERNAL_SPEC_KEYS = new Set([
  'inventoryLocation', 'inventory_location',
  'isShopActive', 'is_shop_active',
  'shopLowStockThreshold', 'shop_low_stock_threshold',
  'inShopInventory', 'in_shop_inventory',
  'stock', 'shop_stock', 'shopStock', 'warehouseStock', 'warehouse_stock',
  'warehouse', 'shop', 'inventory',
  'createdAt', 'updatedAt', 'created_at', 'updated_at',
]);

/**
 * Serializes customer-facing specifications into a valid JSON string
 * to strictly satisfy the MySQL CHECK constraint: json_valid(specifications).
 *
 * Rules:
 * 1. Multiline text string:
 *    - Preserves all line breaks, punctuation, spaces, Urdu/English characters, special characters.
 *    - Encoded via JSON.stringify(text).
 *    - If empty string or whitespace-only: returns JSON.stringify("") -> '""',
 *      which is valid JSON representing an empty value in MySQL.
 * 2. Object (legacy format):
 *    - Strips internal inventory fields.
 *    - Encoded via JSON.stringify(cleanObject).
 *    - If empty object: returns JSON.stringify("") -> '""'.
 * 3. Null / undefined: returns JSON.stringify("") -> '""'.
 */
export function serializeSpecifications(specs: any): string {
  if (specs === null || specs === undefined) {
    return JSON.stringify('');
  }

  if (typeof specs === 'string') {
    if (specs.trim() === '') {
      return JSON.stringify('');
    }

    const trimmed = specs.trim();

    // Check if the string is already a JSON-serialized string (e.g. from an API or DB read)
    // Avoid double-encoding (e.g. "\"\"text\"\"")
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'string') {
          return JSON.stringify(parsed);
        }
      } catch {
        // Not a JSON string (e.g. text that happened to start and end with quotes)
      }
    }

    // Check if specs is a JSON-encoded object string (e.g. '{"Display":"6.7 inch"}')
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const cleanSpecs: Record<string, any> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (!INTERNAL_SPEC_KEYS.has(k)) {
              cleanSpecs[k] = v;
            }
          }
          return Object.keys(cleanSpecs).length > 0 ? JSON.stringify(cleanSpecs) : JSON.stringify('');
        }
      } catch {
        // Not a JSON object string
      }
    }

    // Normal multiline text: serialize to valid JSON string preserving newlines, spaces, Urdu, etc.
    return JSON.stringify(specs);
  }

  if (typeof specs === 'object' && !Array.isArray(specs)) {
    const cleanSpecs: Record<string, any> = {};
    for (const [k, v] of Object.entries(specs)) {
      if (!INTERNAL_SPEC_KEYS.has(k)) {
        cleanSpecs[k] = v;
      }
    }
    return Object.keys(cleanSpecs).length > 0 ? JSON.stringify(cleanSpecs) : JSON.stringify('');
  }

  return JSON.stringify('');
}

/**
 * Deserializes specifications from raw database value.
 *
 * Handles:
 * 1. JSON string (new format): parses to plain multiline string.
 * 2. JSON object (legacy format): returns clean Record<string, any> and extracts legacy internal fields.
 * 3. Plain text string (legacy unquoted text): returns text directly without crashing.
 * 4. Empty value / null / '""' / '{}': returns undefined for publicSpecs.
 */
export function deserializeSpecifications(
  raw: any
): { publicSpecs: Record<string, any> | string | undefined; legacyInternalFields: Record<string, any> } {
  const legacyInternalFields: Record<string, any> = {};

  if (raw === null || raw === undefined) {
    return { publicSpecs: undefined, legacyInternalFields };
  }

  let parsed: any = raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '""' || trimmed === 'null' || trimmed === '{}') {
      return { publicSpecs: undefined, legacyInternalFields };
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Legacy value was stored as unquoted plain text — keep as plain text safely
      parsed = raw;
    }
  }

  // If parsed value is a string (e.g. from JSON.parse of JSON string or unquoted text fallback)
  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    return {
      publicSpecs: trimmed !== '' ? parsed : undefined,
      legacyInternalFields,
    };
  }

  // If parsed value is an object (legacy key-value JSON)
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    const publicSpecs: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (INTERNAL_SPEC_KEYS.has(k)) {
        legacyInternalFields[k] = v;
      } else {
        publicSpecs[k] = v;
      }
    }
    return {
      publicSpecs: Object.keys(publicSpecs).length > 0 ? publicSpecs : undefined,
      legacyInternalFields,
    };
  }

  return { publicSpecs: undefined, legacyInternalFields };
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
    .filter((m) => m.type === 'image' || !m.type)
    .map((m) => m.url);
  const galleryVideos = media
    .filter((m) => m.type === 'video')
    .map((m) => m.url);

  // If no direct gallery images, check if models have variant images
  const modelImages = models
    .flatMap((m) => m.images || [])
    .filter((url) => typeof url === 'string' && url.trim().length > 0);

  const finalImages = galleryImages.length > 0
    ? galleryImages
    : modelImages.length > 0
    ? modelImages
    : [];

  // Parse specifications safely using deserializeSpecifications:
  // - JSON string (new format) -> plain multiline text
  // - JSON object (legacy format) -> Record<string, any> with internal keys stripped
  // - Unquoted text (legacy fallback) -> plain text without crashing
  const { publicSpecs: publicSpecsValue, legacyInternalFields } = deserializeSpecifications(row.specifications);

  const parsedFeatures = parseJsonField<string[]>(row.features, []);
  const parsedTags = parseJsonField<string[]>(row.tags, []);
  const parsedVariants = parseJsonField<any>(row.variants, undefined);

  // Read internal inventory flags from legacyInternalFields if no dedicated column exists
  // (legacy: these were once stored inside the specifications JSON column)
  const isShopActive = (row as any).is_shop_active !== undefined && (row as any).is_shop_active !== null
    ? Boolean((row as any).is_shop_active)
    : (legacyInternalFields.isShopActive !== undefined ? Boolean(legacyInternalFields.isShopActive) : true);

  const shopLowStockThreshold = (row as any).shop_low_stock_threshold !== undefined && (row as any).shop_low_stock_threshold !== null
    ? Number((row as any).shop_low_stock_threshold)
    : (legacyInternalFields.shopLowStockThreshold !== undefined ? Number(legacyInternalFields.shopLowStockThreshold) : 5);

  const inShopInventory = (row as any).in_shop_inventory !== undefined && (row as any).in_shop_inventory !== null
    ? Boolean((row as any).in_shop_inventory)
    : (legacyInternalFields.inShopInventory !== undefined ? Boolean(legacyInternalFields.inShopInventory) : true);

  const inventoryLocation: 'WAREHOUSE' | 'SHOP' =
    (row as any).inventory_location === 'SHOP' || legacyInternalFields.inventoryLocation === 'SHOP'
      ? 'SHOP'
      : 'WAREHOUSE';

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
    brandId: (row as any).brand_id || undefined,
    brandSlug:
      (row as any).brand_slug ||
      (row.brand ? row.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''),
    sku: row.sku || `ALH-${row.id}`,
    stock: Number(row.stock),
    shopStock: row.shop_stock !== undefined && row.shop_stock !== null ? Number(row.shop_stock) : 0,
    isShopActive,
    shopLowStockThreshold,
    inShopInventory,
    inventoryLocation,
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
    images: finalImages,
    videos: galleryVideos.length > 0 ? galleryVideos : undefined,
    bulkPricing: bulkPricing.length > 0 ? bulkPricing : undefined,
    reviews: reviews.length > 0 ? reviews : undefined,
    // Only public-safe specs are exposed — internal inventory fields are stripped
    // Supports both plain text (new format) and Record<string,any> (legacy JSON format)
    specifications: publicSpecsValue,
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

  return serverCache.getOrSet('products:all', async () => {
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
        shopStock: m.shop_stock !== undefined && m.shop_stock !== null ? Number(m.shop_stock) : 0,
        sku: m.sku || undefined,
        isActive: Boolean(m.is_active),
        images: parseJsonField<string[]>(m.images, []),
        videos: parseJsonField<string[]>(m.videos, []),
      } as any);
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
  }, 60000);
}

export async function getProductByIdFromDb(id: string): Promise<(Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean }) | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  return serverCache.getOrSet(`products:id:${id}`, async () => {
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
        shopStock: m.shop_stock !== undefined && m.shop_stock !== null ? Number(m.shop_stock) : 0,
        sku: m.sku || undefined,
        isActive: Boolean(m.is_active),
        images: parseJsonField<string[]>(m.images, []),
        videos: parseJsonField<string[]>(m.videos, []),
      } as any)),
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
  }, 60000);
}

export async function getProductBySlugFromDb(slug: string): Promise<(Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean }) | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const cleanSlug = slug.trim().toLowerCase();
  return serverCache.getOrSet(`products:slug:${cleanSlug}`, async () => {
    const rows = await query<ProductRow[]>(
      'SELECT * FROM products WHERE slug = ? LIMIT 1',
      [cleanSlug]
    );

    if (!rows || rows.length === 0) return null;
    return getProductByIdFromDb(rows[0].id);
  }, 60000);
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

    const inventoryLocation: 'WAREHOUSE' | 'SHOP' =
      data.inventoryLocation === 'SHOP' ? 'SHOP' : 'WAREHOUSE';

    // Calculate default price and stock if model selection is ON
    let finalPrice = data.price !== undefined && data.price !== null ? Number(data.price) : 0;
    let finalStock = inventoryLocation === 'SHOP' ? 0 : (data.stock !== undefined && data.stock !== null ? Number(data.stock) : 0);
    let finalShopStock = data.shopStock !== undefined && data.shopStock !== null ? Number(data.shopStock) : 0;

    if (data.enableModelSelection && Array.isArray(data.models) && data.models.length > 0) {
      const activeModels = data.models.filter((m) => m.isActive !== false);
      if (activeModels.length > 0 && (!finalPrice || finalPrice <= 0)) {
        finalPrice = activeModels[0].price;
      }
      if (inventoryLocation === 'SHOP') {
        finalStock = 0;
        const totalShopModelStock = activeModels.reduce((acc, m) => acc + (m.shopStock ?? 0), 0);
        if (totalShopModelStock > 0 && (!finalShopStock || finalShopStock <= 0)) {
          finalShopStock = totalShopModelStock;
        }
      } else {
        const totalModelStock = activeModels.reduce((acc, m) => acc + (m.stock ?? 0), 0);
        if (totalModelStock > 0 && (!finalStock || finalStock <= 0)) {
          finalStock = totalModelStock;
        }
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
        category, category_slug, brand, origin, sku, stock, shop_stock, low_stock_threshold,
        rating, review_count, status, is_active, is_new, is_new_arrival,
        is_best_seller, is_sale, featured, trending,
        enable_model_selection, enable_color_selection,
        specifications, features, tags, variants, shipping_info, returns_info
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
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
        finalShopStock,
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
        // Technical specifications serialized into valid JSON string to satisfy CHECK (json_valid(specifications))
        serializeSpecifications(data.specifications),
        data.features ? JSON.stringify(data.features) : null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.variants ? JSON.stringify(data.variants) : null,
        data.shippingInfo || null,
        data.returnsInfo || null,
      ]
    );

    // Insert Media
    const rawImages = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : Array.isArray(data.media)
      ? data.media.filter((m: any) => m && (m.type === 'image' || !m.type)).map((m: any) => typeof m === 'string' ? m : m.url)
      : [];

    const rawVideos = Array.isArray(data.videos) && data.videos.length > 0
      ? data.videos
      : Array.isArray(data.media)
      ? data.media.filter((m: any) => m && m.type === 'video').map((m: any) => typeof m === 'string' ? m : m.url)
      : [];

    const safeImages = await ensureSafeMediaUrls(rawImages, 'products');
    const safeVideos = await ensureSafeMediaUrls(rawVideos, 'products');

    if (safeImages.length > 0) {
      let sortOrder = 0;
      for (const imgUrl of safeImages) {
        if (!imgUrl || !imgUrl.trim()) continue;
        await conn.execute(
          `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
           VALUES (?, ?, 'image', ?, ?)`,
          [`med-${id}-${sortOrder}`, id, imgUrl.trim(), sortOrder]
        );
        sortOrder++;
      }
    }

    if (safeVideos.length > 0) {
      let sortOrder = 100;
      for (const vidUrl of safeVideos) {
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
        const modelImages = await ensureSafeMediaUrls(Array.isArray(model.images) ? model.images : [], 'products');
        const modelVideos = await ensureSafeMediaUrls(Array.isArray(model.videos) ? model.videos : [], 'products');
        await conn.execute(
          `INSERT INTO product_models (
            id, product_id, name, price, compare_at_price, wholesale_price, super_wholesale_price, stock, shop_stock, sku, is_active, images, videos, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            modelId,
            id,
            model.name,
            Number(model.price) || 0,
            model.compareAtPrice !== undefined ? Number(model.compareAtPrice) : null,
            model.wholesalePrice !== undefined ? Number(model.wholesalePrice) : null,
            model.superWholesalePrice !== undefined ? Number(model.superWholesalePrice) : null,
            Number(model.stock) || 0,
            Number((model as any).shopStock) || 0,
            model.sku || null,
            model.isActive !== false ? 1 : 0,
            modelImages.length > 0 ? JSON.stringify(modelImages) : null,
            modelVideos.length > 0 ? JSON.stringify(modelVideos) : null,
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

    invalidateProductCache();
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
    // shop_stock can be independently set; default to existing value if not updated
    const finalShopStock = updates.shopStock !== undefined ? Number(updates.shopStock) : (existing.shopStock ?? 0);
    const lowStockThreshold = updates.lowStockThreshold !== undefined ? Number(updates.lowStockThreshold) : existing.lowStockThreshold;
    const status = updates.status !== undefined ? updates.status : existing.status;
    const isActive = (updates as any).isActive !== undefined ? ((updates as any).isActive ? 1 : 0) : (existing.isActive ? 1 : 0);

    // Technical specifications: serialize into valid JSON string to satisfy CHECK (json_valid(specifications)).
    // - When updates.specifications is explicitly provided (even as empty string to clear), serialize it directly.
    // - When updates.specifications is undefined (admin updated another field), preserve existing specifications as valid JSON.
    let mergedSpecsJson: string;
    if (updates.specifications !== undefined) {
      mergedSpecsJson = serializeSpecifications(updates.specifications);
    } else {
      mergedSpecsJson = serializeSpecifications(existing.specifications);
    }

    await conn.execute(
      `UPDATE products SET
        slug = ?, name = ?, tagline = ?, description = ?, long_description = ?,
        price = ?, compare_at_price = ?, wholesale_price = ?, super_wholesale_price = ?, discount_percentage = ?,
        category = ?, category_slug = ?, brand = ?, origin = ?, sku = ?, stock = ?, shop_stock = ?, low_stock_threshold = ?,
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
        finalShopStock,
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
        mergedSpecsJson,
        updates.features !== undefined ? JSON.stringify(updates.features) : (existing.features ? JSON.stringify(existing.features) : null),
        updates.tags !== undefined ? JSON.stringify(updates.tags) : (existing.tags ? JSON.stringify(existing.tags) : null),
        updates.variants !== undefined ? JSON.stringify(updates.variants) : (existing.variants ? JSON.stringify(existing.variants) : null),
        updates.shippingInfo !== undefined ? updates.shippingInfo : (existing.shippingInfo || null),
        updates.returnsInfo !== undefined ? updates.returnsInfo : (existing.returnsInfo || null),
        id,
      ]
    );

    // Update media if provided
    if (updates.images !== undefined || updates.videos !== undefined || updates.media !== undefined) {
      await conn.execute('DELETE FROM product_media WHERE product_id = ?', [id]);
      const imagesToSave = updates.images !== undefined
        ? updates.images
        : Array.isArray(updates.media)
        ? updates.media.filter((m: any) => m && (m.type === 'image' || !m.type)).map((m: any) => typeof m === 'string' ? m : m.url)
        : existing.images;
      const videosToSave = updates.videos !== undefined
        ? updates.videos
        : Array.isArray(updates.media)
        ? updates.media.filter((m: any) => m && m.type === 'video').map((m: any) => typeof m === 'string' ? m : m.url)
        : (existing.videos || []);

      const safeImages = await ensureSafeMediaUrls(imagesToSave, 'products');
      const safeVideos = await ensureSafeMediaUrls(videosToSave, 'products');

      let sortOrder = 0;
      for (const imgUrl of safeImages) {
        if (!imgUrl || !imgUrl.trim()) continue;
        await conn.execute(
          `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
           VALUES (?, ?, 'image', ?, ?)`,
          [`med-${id}-${sortOrder}`, id, imgUrl.trim(), sortOrder]
        );
        sortOrder++;
      }
      for (const vidUrl of safeVideos) {
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
        const modelImages = await ensureSafeMediaUrls(Array.isArray(model.images) ? model.images : [], 'products');
        const modelVideos = await ensureSafeMediaUrls(Array.isArray(model.videos) ? model.videos : [], 'products');
        await conn.execute(
          `INSERT INTO product_models (
            id, product_id, name, price, compare_at_price, wholesale_price, super_wholesale_price, stock, shop_stock, sku, is_active, images, videos, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            modelId,
            id,
            model.name,
            Number(model.price) || 0,
            model.compareAtPrice !== undefined ? Number(model.compareAtPrice) : null,
            model.wholesalePrice !== undefined ? Number(model.wholesalePrice) : null,
            model.superWholesalePrice !== undefined ? Number(model.superWholesalePrice) : null,
            Number(model.stock) || 0,
            Number((model as any).shopStock) || 0,
            model.sku || null,
            model.isActive !== false ? 1 : 0,
            modelImages.length > 0 ? JSON.stringify(modelImages) : null,
            modelVideos.length > 0 ? JSON.stringify(modelVideos) : null,
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

    invalidateProductCache();
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

  invalidateProductCache();
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

    invalidateProductCache();
    return { success: true, newStock };
  });
}
