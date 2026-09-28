import fs from 'fs';
import path from 'path';
import { query, execute, isDbConfigured, withTransaction } from './mysql';
import { categories as initialCategories } from '@/data/categories';
import { seedProducts, seedBrands, seedStoreSettings, seedAdmins } from './seed';
import { seedPages } from './pages';
import { defaultBillSettings } from './billSettings';
import { DEFAULT_LOGIN_PAGE_MEDIA, DEFAULT_LOGIN_PAGE_SETTINGS } from './loginPage';
import { seedHomepageVideos } from './homepageVideos';
import { RowDataPacket } from 'mysql2/promise';

export interface MigrationEntityStat {
  entity: string;
  imported: number;
  skipped: number;
  errors: number;
  message?: string;
}

export interface MigrationReport {
  success: boolean;
  databaseConfigured: boolean;
  timestamp: string;
  stats: MigrationEntityStat[];
  summary: string;
}

export async function getDatabaseTableCounts(): Promise<Record<string, number>> {
  if (!isDbConfigured()) {
    return {};
  }

  const tables = [
    'categories',
    'brands',
    'products',
    'product_media',
    'product_models',
    'product_colors',
    'product_bulk_pricing',
    'product_reviews',
    'customers',
    'staff_users',
    'orders',
    'order_items',
    'promotions',
    'promo_code_usages',
    'store_settings',
    'bill_settings',
    'activity_logs',
    'inventory_logs',
    'custom_pages',
    'homepage_videos',
    'login_page_media',
    'login_page_settings',
  ];

  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const rows = await query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM \`${table}\``);
      counts[table] = rows && rows.length > 0 ? Number(rows[0].count) : 0;
    } catch {
      counts[table] = -1; // Table might not exist or error
    }
  }

  return counts;
}

/**
 * Execute the safe, one-time migration of store data into Hostinger MySQL.
 */
export async function runProductionMigration(): Promise<MigrationReport> {
  const timestamp = new Date().toISOString();

  if (!isDbConfigured()) {
    return {
      success: false,
      databaseConfigured: false,
      timestamp,
      stats: [],
      summary: 'MySQL database is not configured. Please define DB_HOST, DB_USER, DB_NAME in environment.',
    };
  }

  // 0. Critical Production Safety Lock:
  // Data seeding and demo importing must NEVER execute in production.
  // The Hostinger MySQL database is the sole source of truth for persistent business data.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    return {
      success: true,
      databaseConfigured: true,
      timestamp,
      stats: [],
      summary: 'Data migration/seeding is permanently disabled in production mode. Existing Hostinger MySQL production data is preserved and untouched.',
    };
  }

  const stats: MigrationEntityStat[] = [];

  // 0. Safety Lock Check: Never re-populate or restore deleted records if migration has already run
  // or if MySQL already contains catalog/store data.
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) NOT NULL PRIMARY KEY,
        executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const alreadyRun = await query<RowDataPacket[]>(
      "SELECT version FROM schema_migrations WHERE version = 'initial_seed_data' LIMIT 1"
    );
    if (alreadyRun && alreadyRun.length > 0) {
      return {
        success: true,
        databaseConfigured: true,
        timestamp,
        stats: [],
        summary: 'One-time initial seed migration has already been executed on this database. Seed data will not re-populate to prevent restoring admin-deleted records.',
      };
    }

    // Check if products or categories tables already contain live records
    const [existingProds, existingCats] = await Promise.all([
      query<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM products'),
      query<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM categories'),
    ]);
    const prodCount = Number(existingProds[0]?.cnt || 0);
    const catCount = Number(existingCats[0]?.cnt || 0);

    if (prodCount > 0 || catCount > 0) {
      await execute("INSERT IGNORE INTO schema_migrations (version) VALUES ('initial_seed_data')");
      return {
        success: true,
        databaseConfigured: true,
        timestamp,
        stats: [],
        summary: `Production database already contains ${prodCount} products and ${catCount} categories. Seed data re-population was skipped to preserve database records and prevent resurrecting deleted items.`,
      };
    }
  } catch (err: any) {
    console.warn('[Migration] Safety check notice:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 1. CATEGORIES
  // ---------------------------------------------------------------------------
  let catImp = 0, catSkip = 0, catErr = 0;
  for (const cat of initialCategories) {
    try {
      const existing = await query<RowDataPacket[]>(
        'SELECT id FROM categories WHERE id = ? OR slug = ? LIMIT 1',
        [cat.id, cat.slug]
      );
      if (existing.length > 0) {
        catSkip++;
        continue;
      }

      await execute(
        `INSERT INTO categories (
          id, name, slug, image, description, product_count, status, is_active, featured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cat.id,
          cat.name,
          cat.slug,
          cat.image,
          cat.description || '',
          cat.productCount || 0,
          cat.status || 'active',
          (cat as any).isActive !== false ? 1 : 0,
          cat.featured ? 1 : 0,
        ]
      );
      catImp++;
    } catch (err: any) {
      catErr++;
      console.warn(`[Migration] Error category ${cat.name}:`, err.message);
    }
  }
  stats.push({ entity: 'Categories', imported: catImp, skipped: catSkip, errors: catErr });

  // ---------------------------------------------------------------------------
  // 2. BRANDS
  // ---------------------------------------------------------------------------
  let brandImp = 0, brandSkip = 0, brandErr = 0;
  for (const b of seedBrands) {
    try {
      const existing = await query<RowDataPacket[]>(
        'SELECT id FROM brands WHERE id = ? OR slug = ? LIMIT 1',
        [b.id, b.slug]
      );
      if (existing.length > 0) {
        brandSkip++;
        continue;
      }

      await execute(
        `INSERT INTO brands (id, name, slug, logo, description, status, product_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          b.id,
          b.name,
          b.slug,
          b.logo || null,
          b.description || null,
          b.status || 'active',
          b.productCount || 0,
        ]
      );
      brandImp++;
    } catch (err: any) {
      brandErr++;
      console.warn(`[Migration] Error brand ${b.name}:`, err.message);
    }
  }
  stats.push({ entity: 'Brands', imported: brandImp, skipped: brandSkip, errors: brandErr });

  // ---------------------------------------------------------------------------
  // 3. PRODUCTS & VARIANTS & MEDIA
  // ---------------------------------------------------------------------------
  let prodImp = 0, prodSkip = 0, prodErr = 0;
  for (const p of seedProducts) {
    try {
      const existing = await query<RowDataPacket[]>(
        'SELECT id FROM products WHERE id = ? OR slug = ? LIMIT 1',
        [p.id, p.slug]
      );
      if (existing.length > 0) {
        prodSkip++;
        continue;
      }

      const sku = p.sku || `ALH-${p.id}`;
      const compareAt = p.compareAtPrice !== undefined ? Number(p.compareAtPrice) : null;
      const wholesale = p.wholesalePrice !== undefined && Number(p.wholesalePrice) > 0 ? Number(p.wholesalePrice) : null;
      const superWholesale = (p as any).superWholesalePrice !== undefined && Number((p as any).superWholesalePrice) > 0 ? Number((p as any).superWholesalePrice) : null;
      const discountPct = p.discountPercentage !== undefined ? Number(p.discountPercentage) : null;
      const lowStock = p.lowStockThreshold !== undefined ? Number(p.lowStockThreshold) : 5;

      await execute(
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
          p.id,
          p.slug,
          p.name,
          p.tagline || null,
          p.description || '',
          p.longDescription || null,
          p.price || 0,
          compareAt,
          wholesale,
          superWholesale,
          discountPct,
          p.category,
          p.categorySlug,
          p.brand,
          (p as any).origin || 'Pakistan',
          sku,
          p.stock || 0,
          lowStock,
          p.rating || 5.0,
          p.reviewCount || 0,
          p.status || 'active',
          (p as any).isActive !== false ? 1 : 0,
          p.isNew ? 1 : 0,
          p.isNewArrival ? 1 : 0,
          p.isBestSeller ? 1 : 0,
          p.isSale ? 1 : 0,
          p.featured ? 1 : 0,
          p.trending ? 1 : 0,
          p.enableModelSelection ? 1 : 0,
          p.enableColorSelection ? 1 : 0,
          p.specifications ? JSON.stringify(p.specifications) : null,
          p.features ? JSON.stringify(p.features) : null,
          p.tags ? JSON.stringify(p.tags) : null,
          p.variants ? JSON.stringify(p.variants) : null,
          p.shippingInfo || null,
          p.returnsInfo || null,
        ]
      );

      // Gallery Images & Videos -> product_media
      if (Array.isArray(p.images) && p.images.length > 0) {
        let sortOrder = 0;
        for (const img of p.images) {
          if (!img || !img.trim()) continue;
          await execute(
            `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
             VALUES (?, ?, 'image', ?, ?)`,
            [`med-${p.id}-${sortOrder}`, p.id, img.trim(), sortOrder]
          );
          sortOrder++;
        }
      }

      if (Array.isArray(p.videos) && p.videos.length > 0) {
        let sortOrder = 100;
        for (const vid of p.videos) {
          if (!vid || !vid.trim()) continue;
          await execute(
            `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
             VALUES (?, ?, 'video', ?, ?)`,
            [`med-vid-${p.id}-${sortOrder}`, p.id, vid.trim(), sortOrder]
          );
          sortOrder++;
        }
      }

      // Models -> product_models
      if (Array.isArray(p.models) && p.models.length > 0) {
        let sortOrder = 0;
        for (const m of p.models) {
          const modelId = m.id || `mod-${p.id}-${sortOrder}`;
          await execute(
            `INSERT INTO product_models (
              id, product_id, name, price, compare_at_price, wholesale_price, super_wholesale_price,
              stock, sku, is_active, images, videos, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              modelId,
              p.id,
              m.name,
              Number(m.price) || 0,
              m.compareAtPrice !== undefined ? Number(m.compareAtPrice) : null,
              m.wholesalePrice !== undefined ? Number(m.wholesalePrice) : null,
              (m as any).superWholesalePrice !== undefined ? Number((m as any).superWholesalePrice) : null,
              Number(m.stock) || 0,
              m.sku || null,
              m.isActive !== false ? 1 : 0,
              m.images ? JSON.stringify(m.images) : null,
              m.videos ? JSON.stringify(m.videos) : null,
              sortOrder,
            ]
          );
          sortOrder++;
        }
      }

      // Colors -> product_colors
      if (Array.isArray(p.colors) && p.colors.length > 0) {
        let sortOrder = 0;
        for (const c of p.colors) {
          const colorId = c.id || `col-${p.id}-${sortOrder}`;
          await execute(
            `INSERT INTO product_colors (id, product_id, name, hex, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              colorId,
              p.id,
              c.name,
              c.hex || null,
              c.isActive !== false ? 1 : 0,
              sortOrder,
            ]
          );
          sortOrder++;
        }
      }

      prodImp++;
    } catch (err: any) {
      prodErr++;
      console.warn(`[Migration] Error product ${p.name}:`, err.message);
    }
  }
  stats.push({ entity: 'Products & Variants', imported: prodImp, skipped: prodSkip, errors: prodErr });

  // ---------------------------------------------------------------------------
  // 4. STORE SETTINGS & SEO
  // ---------------------------------------------------------------------------
  let setImp = 0, setSkip = 0, setErr = 0;
  try {
    let rawSettings = seedStoreSettings;
    const settingsPath = path.join(process.cwd(), 'data', 'store-settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        const parsed = JSON.parse(raw);
        const data = Array.isArray(parsed) ? parsed[0] : (parsed && parsed['0'] ? parsed['0'] : parsed);
        rawSettings = { ...seedStoreSettings, ...(data || {}) };
      } catch {}
    }

    await execute(
      `INSERT INTO store_settings (
        id, store_name, store_tagline, logo_url, favicon_url, email, phone, address,
        whatsapp, currency, currency_symbol, free_shipping_threshold, standard_shipping_fee,
        express_shipping_fee, delivery_message, estimated_delivery_text, pakistan_only,
        tax_percentage, social_links, seo_meta_title, seo_meta_description, seo_keywords,
        seo_logo_url, seo_favicon_url, footer_description, business_hours
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      ) ON DUPLICATE KEY UPDATE
        store_name = VALUES(store_name),
        store_tagline = VALUES(store_tagline),
        logo_url = VALUES(logo_url),
        favicon_url = VALUES(favicon_url),
        email = VALUES(email),
        phone = VALUES(phone),
        address = VALUES(address),
        whatsapp = VALUES(whatsapp),
        currency = VALUES(currency),
        currency_symbol = VALUES(currency_symbol),
        free_shipping_threshold = VALUES(free_shipping_threshold),
        standard_shipping_fee = VALUES(standard_shipping_fee),
        express_shipping_fee = VALUES(express_shipping_fee),
        delivery_message = VALUES(delivery_message),
        estimated_delivery_text = VALUES(estimated_delivery_text),
        pakistan_only = VALUES(pakistan_only),
        tax_percentage = VALUES(tax_percentage),
        social_links = VALUES(social_links),
        seo_meta_title = VALUES(seo_meta_title),
        seo_meta_description = VALUES(seo_meta_description),
        seo_keywords = VALUES(seo_keywords),
        seo_logo_url = VALUES(seo_logo_url),
        seo_favicon_url = VALUES(seo_favicon_url),
        footer_description = VALUES(footer_description),
        business_hours = VALUES(business_hours)`,
      [
        rawSettings.storeName,
        rawSettings.storeTagline,
        rawSettings.logoUrl || null,
        rawSettings.faviconUrl || null,
        rawSettings.email,
        rawSettings.phone,
        rawSettings.address,
        rawSettings.whatsapp || null,
        rawSettings.currency,
        rawSettings.currencySymbol,
        rawSettings.freeShippingThreshold,
        rawSettings.standardShippingFee,
        rawSettings.expressShippingFee,
        rawSettings.deliveryMessage || null,
        rawSettings.estimatedDeliveryText || null,
        rawSettings.pakistanOnly ? 1 : 0,
        rawSettings.taxPercentage,
        JSON.stringify(rawSettings.socialLinks),
        rawSettings.seo?.metaTitle || rawSettings.storeName,
        rawSettings.seo?.metaDescription || '',
        JSON.stringify(rawSettings.seo?.keywords || []),
        rawSettings.seo?.logoUrl || rawSettings.logoUrl || null,
        rawSettings.seo?.faviconUrl || rawSettings.faviconUrl || null,
        rawSettings.footerDescription,
        rawSettings.businessHours,
      ]
    );
    setImp = 1;
  } catch (err: any) {
    setErr = 1;
    console.warn('[Migration] Store Settings error:', err.message);
  }
  stats.push({ entity: 'Store Settings & SEO', imported: setImp, skipped: setSkip, errors: setErr });

  // ---------------------------------------------------------------------------
  // 5. BILL SETTINGS
  // ---------------------------------------------------------------------------
  let billImp = 0, billSkip = 0, billErr = 0;
  try {
    const bs = defaultBillSettings;
    await execute(
      `INSERT INTO bill_settings (
        id, store_name, store_logo, store_address, phone, whatsapp, email, website,
        invoice_header_text, invoice_footer_text, tax_number, thermal_footer_note
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      ) ON DUPLICATE KEY UPDATE store_name = VALUES(store_name)`,
      [
        bs.storeName,
        bs.storeLogo || null,
        bs.storeAddress,
        bs.phone,
        bs.whatsapp || null,
        bs.email,
        bs.website || null,
        bs.invoiceHeaderText || null,
        bs.invoiceFooterText || null,
        bs.taxNumber || null,
        bs.thermalFooterNote || null,
      ]
    );
    billImp = 1;
  } catch (err: any) {
    billErr = 1;
    console.warn('[Migration] Bill Settings error:', err.message);
  }
  stats.push({ entity: 'Bill Settings', imported: billImp, skipped: billSkip, errors: billErr });

  // ---------------------------------------------------------------------------
  // 6. HOMEPAGE VIDEOS
  // ---------------------------------------------------------------------------
  let vidImp = 0, vidSkip = 0, vidErr = 0;
  let videosToLoad = seedHomepageVideos;
  const vidPath = path.join(process.cwd(), 'data', 'homepage-videos.json');
  if (fs.existsSync(vidPath)) {
    try {
      const raw = fs.readFileSync(vidPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) videosToLoad = parsed;
    } catch {}
  }

  for (const v of videosToLoad) {
    try {
      const existing = await query<RowDataPacket[]>(
        'SELECT id FROM homepage_videos WHERE id = ? OR url = ? LIMIT 1',
        [v.id, v.url]
      );
      if (existing.length > 0) {
        vidSkip++;
        continue;
      }

      await execute(
        `INSERT INTO homepage_videos (
          id, title, url, thumbnail_url, active, display_order, duration, size, mime_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id,
          v.title,
          v.url,
          v.thumbnailUrl || null,
          v.active !== false ? 1 : 0,
          v.displayOrder || 1,
          v.duration || null,
          v.size || null,
          v.mimeType || 'video/mp4',
        ]
      );
      vidImp++;
    } catch (err: any) {
      vidErr++;
      console.warn(`[Migration] Video ${v.title} error:`, err.message);
    }
  }
  stats.push({ entity: 'Homepage Videos', imported: vidImp, skipped: vidSkip, errors: vidErr });

  // ---------------------------------------------------------------------------
  // 7. LOGIN PAGE MEDIA & SETTINGS
  // ---------------------------------------------------------------------------
  let lmedImp = 0, lmedSkip = 0, lmedErr = 0;
  let loginMediaToLoad = DEFAULT_LOGIN_PAGE_MEDIA;
  const lmedPath = path.join(process.cwd(), 'data', 'login-page-media.json');
  if (fs.existsSync(lmedPath)) {
    try {
      const raw = fs.readFileSync(lmedPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) loginMediaToLoad = parsed;
    } catch {}
  }

  for (const m of loginMediaToLoad) {
    try {
      const existing = await query<RowDataPacket[]>(
        'SELECT id FROM login_page_media WHERE id = ? LIMIT 1',
        [m.id]
      );
      if (existing.length > 0) {
        lmedSkip++;
        continue;
      }

      const meta = JSON.stringify({
        caption: m.caption,
        productName: m.productName,
        priceTag: m.priceTag,
        transition: m.transition || 'default',
        duration: m.duration,
        autoPlay: m.autoPlay,
        loop: m.loop,
      });

      await execute(
        `INSERT INTO login_page_media (
          id, title, type, url, thumbnail_url, active, display_order, mime_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          m.title,
          m.type,
          m.url,
          m.thumbnailUrl || null,
          m.isActive !== false ? 1 : 0,
          m.displayOrder || 1,
          meta,
        ]
      );
      lmedImp++;
    } catch (err: any) {
      lmedErr++;
      console.warn(`[Migration] Login media ${m.title} error:`, err.message);
    }
  }
  stats.push({ entity: 'Login Page Media', imported: lmedImp, skipped: lmedSkip, errors: lmedErr });

  // Login Page Settings
  try {
    let lsettings = DEFAULT_LOGIN_PAGE_SETTINGS;
    const lsetPath = path.join(process.cwd(), 'data', 'login-page-settings.json');
    if (fs.existsSync(lsetPath)) {
      try {
        const raw = fs.readFileSync(lsetPath, 'utf8');
        const parsed = JSON.parse(raw);
        const data = Array.isArray(parsed) ? parsed[0] : (parsed && parsed['0'] ? parsed['0'] : parsed);
        lsettings = { ...DEFAULT_LOGIN_PAGE_SETTINGS, ...(data || {}) };
      } catch {}
    }

    const serialized = JSON.stringify(lsettings);
    await execute(
      `INSERT INTO login_page_settings (
        id, theme, overlay_opacity, headline, subheadline, media_type
      ) VALUES (
        1, ?, ?, ?, ?, ?
      ) ON DUPLICATE KEY UPDATE
        headline = VALUES(headline),
        subheadline = VALUES(subheadline)`,
      [
        lsettings.backgroundStyle || 'dark',
        lsettings.overlayEnabled ? 0.6 : 0.0,
        (lsettings.mainHeading || 'Welcome to AL-HAMD').slice(0, 255),
        serialized,
        'mixed',
      ]
    );
    stats.push({ entity: 'Login Page Settings', imported: 1, skipped: 0, errors: 0 });
  } catch (err: any) {
    stats.push({ entity: 'Login Page Settings', imported: 0, skipped: 0, errors: 1, message: err.message });
  }

  // ---------------------------------------------------------------------------
  // 8. CUSTOM PAGES
  // ---------------------------------------------------------------------------
  let pageImp = 0, pageSkip = 0, pageErr = 0;
  for (const page of seedPages) {
    try {
      const existing = await query<RowDataPacket[]>(
        'SELECT id FROM custom_pages WHERE id = ? OR slug = ? LIMIT 1',
        [page.id, page.slug]
      );
      if (existing.length > 0) {
        pageSkip++;
        continue;
      }

      await execute(
        `INSERT INTO custom_pages (
          id, title, slug, status, show_in_header, show_in_footer, show_in_mobile,
          footer_category, seo_title, seo_description, target_keywords, seo_image,
          blocks, page_order
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )`,
        [
          page.id,
          page.title,
          page.slug,
          page.status || 'Published',
          page.showInHeader ? 1 : 0,
          page.showInFooter ? 1 : 0,
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
      pageImp++;
    } catch (err: any) {
      pageErr++;
      console.warn(`[Migration] Custom page ${page.title} error:`, err.message);
    }
  }
  stats.push({ entity: 'Custom Pages', imported: pageImp, skipped: pageSkip, errors: pageErr });

  // ---------------------------------------------------------------------------
  // 9. PROMOTIONS
  // ---------------------------------------------------------------------------
  let promoImp = 0, promoSkip = 0, promoErr = 0;
  const defaultPromos = [
    {
      id: 'promo-fast50',
      code: 'FAST50',
      description: '50% off GaN Fast Chargers & Power Banks Flash Sale',
      discountType: 'percentage',
      discountValue: 50,
      maximumDiscount: 2500,
      minimumOrderAmount: 3000,
      isActive: true,
      applicableType: 'all',
      posAllowed: true,
      onlineAllowed: true,
    },
    {
      id: 'promo-welcome10',
      code: 'WELCOME10',
      description: '10% discount on your first mobile accessories order',
      discountType: 'percentage',
      discountValue: 10,
      maximumDiscount: 1000,
      minimumOrderAmount: 1500,
      isActive: true,
      applicableType: 'all',
      posAllowed: true,
      onlineAllowed: true,
    },
  ];

  for (const promo of defaultPromos) {
    try {
      const existing = await query<RowDataPacket[]>(
        'SELECT id FROM promotions WHERE LOWER(code) = LOWER(?) LIMIT 1',
        [promo.code]
      );
      if (existing.length > 0) {
        promoSkip++;
        continue;
      }

      await execute(
        `INSERT INTO promotions (
          id, code, description, discount_type, discount_value, maximum_discount,
          minimum_order_amount, is_active, applicable_type, pos_allowed, online_allowed, used_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          promo.id,
          promo.code,
          promo.description,
          promo.discountType,
          promo.discountValue,
          promo.maximumDiscount,
          promo.minimumOrderAmount,
          promo.isActive ? 1 : 0,
          promo.applicableType,
          promo.posAllowed ? 1 : 0,
          promo.onlineAllowed ? 1 : 0,
        ]
      );
      promoImp++;
    } catch (err: any) {
      promoErr++;
      console.warn(`[Migration] Promo ${promo.code} error:`, err.message);
    }
  }
  stats.push({ entity: 'Promotions', imported: promoImp, skipped: promoSkip, errors: promoErr });

  // ---------------------------------------------------------------------------
  // 10. STAFF ACCOUNTS (Safe non-destructive migration)
  // ---------------------------------------------------------------------------
  let staffImp = 0, staffSkip = 0, staffErr = 0;
  try {
    const [staffCountRow]: any = await query<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM staff_users');
    const existingStaffCount = staffCountRow && staffCountRow.cnt ? Number(staffCountRow.cnt) : 0;

    let staffList: any[] = [];
    const staffPath = path.join(process.cwd(), 'data', 'staff-users.json');
    if (fs.existsSync(staffPath)) {
      try {
        const raw = fs.readFileSync(staffPath, 'utf8');
        staffList = JSON.parse(raw);
      } catch {}
    }

    // Only import initial seed admin if DB has zero staff
    if (existingStaffCount === 0 && staffList.length === 0) {
      staffList = seedAdmins;
    }

    for (const s of staffList) {
      try {
        const existing = await query<RowDataPacket[]>(
          'SELECT id FROM staff_users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
          [s.id, s.email]
        );
        if (existing.length > 0) {
          staffSkip++;
          continue;
        }

        await execute(
          `INSERT INTO staff_users (
            id, name, email, phone, role, role_id, permissions, avatar, status, is_owner, password_hash, salt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.name,
            s.email.toLowerCase(),
            s.phone || null,
            s.role || 'Manager',
            s.roleId || null,
            JSON.stringify(s.permissions || []),
            s.avatar || null,
            s.status || 'active',
            s.isOwner ? 1 : 0,
            s.passwordHash || '',
            s.salt || '',
          ]
        );
        staffImp++;
      } catch (err: any) {
        staffErr++;
        console.warn(`[Migration] Staff ${s.email} error:`, err.message);
      }
    }
    stats.push({
      entity: 'Staff Accounts',
      imported: staffImp,
      skipped: staffSkip,
      errors: staffErr,
      message: existingStaffCount > 0 ? `Preserved ${existingStaffCount} existing staff account(s) in MySQL.` : undefined,
    });
  } catch (err: any) {
    stats.push({ entity: 'Staff Accounts', imported: 0, skipped: 0, errors: 1, message: err.message });
  }

  // ---------------------------------------------------------------------------
  // 11. CUSTOMER ACCOUNTS (Safe migration of local file if present)
  // ---------------------------------------------------------------------------
  let custImp = 0, custSkip = 0, custErr = 0;
  const custPath = path.join(process.cwd(), 'data', 'customers.json');
  if (fs.existsSync(custPath)) {
    try {
      const raw = fs.readFileSync(custPath, 'utf8');
      const custList = JSON.parse(raw);
      if (Array.isArray(custList)) {
        for (const c of custList) {
          try {
            const existing = await query<RowDataPacket[]>(
              'SELECT id FROM customers WHERE id = ? LIMIT 1',
              [c.id]
            );
            if (existing.length > 0) {
              custSkip++;
              continue;
            }

            await execute(
              `INSERT INTO customers (
                id, customer_type, shop_name, full_name, first_name, last_name,
                email, phone, password_hash, password_salt, address, city, province,
                postal_code, date_of_birth, total_orders, total_spent, status, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                c.id,
                c.customerType || 'RETAIL',
                c.shopName || null,
                c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
                c.firstName || c.fullName || 'Customer',
                c.lastName || '',
                c.email || null,
                c.phone || '',
                c.passwordHash || null,
                c.passwordSalt || null,
                c.address || null,
                c.city || null,
                c.province || null,
                c.postalCode || null,
                c.dateOfBirth || null,
                c.totalOrders || 0,
                c.totalSpent || 0,
                c.status || 'active',
                c.createdAt || new Date().toISOString(),
              ]
            );
            custImp++;
          } catch (err: any) {
            custErr++;
            console.warn(`[Migration] Customer ${c.id} error:`, err.message);
          }
        }
      }
      stats.push({ entity: 'Customer & Wholesale Accounts', imported: custImp, skipped: custSkip, errors: custErr });
    } catch (err: any) {
      stats.push({ entity: 'Customer & Wholesale Accounts', imported: 0, skipped: 0, errors: 1, message: err.message });
    }
  } else {
    stats.push({
      entity: 'Customer & Wholesale Accounts',
      imported: 0,
      skipped: 0,
      errors: 0,
      message: 'data/customers.json was not present in repository (intentionally excluded from Git). Existing MySQL accounts preserved.',
    });
  }

  const totalImported = stats.reduce((sum, s) => sum + s.imported, 0);
  const totalSkipped = stats.reduce((sum, s) => sum + s.skipped, 0);
  const totalErrors = stats.reduce((sum, s) => sum + s.errors, 0);
  try {
    await execute("INSERT IGNORE INTO schema_migrations (version) VALUES ('initial_seed_data')");
  } catch {}

  return {
    success: totalErrors === 0,
    databaseConfigured: true,
    timestamp,
    stats,
    summary: `Migration completed: ${totalImported} records imported, ${totalSkipped} existing records preserved, ${totalErrors} errors. MySQL is now the active source of truth.`,
  };
}
