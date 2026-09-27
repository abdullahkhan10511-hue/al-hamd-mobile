import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { categories as initialCategories } from '../../data/categories';
import { seedProducts, seedBrands, seedStoreSettings, seedAdmins } from '../../lib/db/seed';

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

interface MigrationStats {
  entity: string;
  imported: number;
  skipped: number;
  errors: number;
}

async function runImport() {
  const host = process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME;

  console.log('====================================================');
  console.log(' AL-HAMD MOBILE ACCESSORIES - DATA IMPORT TOOL');
  console.log('====================================================\n');

  if (!host || !user || !database) {
    console.error('ERROR: Missing required database environment variables:');
    if (!host) console.error('  - DB_HOST');
    if (!user) console.error('  - DB_USER');
    if (!database) console.error('  - DB_NAME');
    console.error('\nPlease define your database configuration in .env first.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  const stats: MigrationStats[] = [];

  // ----------------------------------------------------------------------------
  // 1. IMPORT CATEGORIES
  // ----------------------------------------------------------------------------
  console.log('--> Importing Categories...');
  let catImported = 0;
  let catSkipped = 0;
  let catErrors = 0;

  for (const cat of initialCategories) {
    try {
      const [existing]: any = await connection.query(
        'SELECT id FROM categories WHERE id = ? OR slug = ?',
        [cat.id, cat.slug]
      );
      if (existing.length > 0) {
        catSkipped++;
        continue;
      }

      await connection.query(
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
      catImported++;
    } catch (e: any) {
      console.error(`  [!] Error importing category ${cat.name}:`, e.message);
      catErrors++;
    }
  }
  stats.push({ entity: 'Categories', imported: catImported, skipped: catSkipped, errors: catErrors });

  // ----------------------------------------------------------------------------
  // 2. IMPORT BRANDS
  // ----------------------------------------------------------------------------
  console.log('--> Importing Brands...');
  let brandImported = 0;
  let brandSkipped = 0;
  let brandErrors = 0;

  for (const brand of seedBrands) {
    try {
      const [existing]: any = await connection.query(
        'SELECT id FROM brands WHERE id = ? OR slug = ?',
        [brand.id, brand.slug]
      );
      if (existing.length > 0) {
        brandSkipped++;
        continue;
      }

      await connection.query(
        `INSERT INTO brands (id, name, slug, logo, description, status, product_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          brand.id,
          brand.name,
          brand.slug,
          brand.logo || null,
          brand.description || null,
          brand.status || 'active',
          brand.productCount || 0,
        ]
      );
      brandImported++;
    } catch (e: any) {
      console.error(`  [!] Error importing brand ${brand.name}:`, e.message);
      brandErrors++;
    }
  }
  stats.push({ entity: 'Brands', imported: brandImported, skipped: brandSkipped, errors: brandErrors });

  // ----------------------------------------------------------------------------
  // 3. IMPORT PRODUCTS, MODELS, COLORS, MEDIA
  // ----------------------------------------------------------------------------
  console.log('--> Importing Products and Variants...');
  let prodImported = 0;
  let prodSkipped = 0;
  let prodErrors = 0;

  for (const p of seedProducts) {
    try {
      const [existing]: any = await connection.query(
        'SELECT id FROM products WHERE id = ? OR slug = ?',
        [p.id, p.slug]
      );

      if (existing.length > 0) {
        prodSkipped++;
        continue;
      }

      const sku = p.sku || `ALH-${p.id}`;
      const compareAtPrice = p.compareAtPrice !== undefined ? p.compareAtPrice : null;
      const wholesalePrice = p.wholesalePrice !== undefined && Number(p.wholesalePrice) > 0 ? Number(p.wholesalePrice) : null;
      const discountPercentage = p.discountPercentage !== undefined ? p.discountPercentage : null;
      const lowStockThreshold = p.lowStockThreshold !== undefined ? p.lowStockThreshold : 5;

      await connection.query(
        `INSERT INTO products (
          id, slug, name, tagline, description, long_description,
          price, compare_at_price, wholesale_price, discount_percentage,
          category, category_slug, brand, origin, sku, stock, low_stock_threshold,
          rating, review_count, status, is_active, is_new, is_new_arrival,
          is_best_seller, is_sale, featured, trending,
          enable_model_selection, enable_color_selection,
          specifications, features, tags, variants, shipping_info, returns_info
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
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
          compareAtPrice,
          wholesalePrice,
          discountPercentage,
          p.category,
          p.categorySlug,
          p.brand,
          (p as any).origin || 'Pakistan',
          sku,
          p.stock || 0,
          lowStockThreshold,
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

      // Import gallery images & videos
      if (Array.isArray(p.images) && p.images.length > 0) {
        let sortOrder = 0;
        for (const img of p.images) {
          if (!img) continue;
          await connection.query(
            `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
             VALUES (?, ?, 'image', ?, ?)`,
            [`med-${p.id}-${sortOrder}`, p.id, img, sortOrder]
          );
          sortOrder++;
        }
      }

      if (Array.isArray(p.videos) && p.videos.length > 0) {
        let sortOrder = 100;
        for (const vid of p.videos) {
          if (!vid) continue;
          await connection.query(
            `INSERT INTO product_media (id, product_id, media_type, url, sort_order)
             VALUES (?, ?, 'video', ?, ?)`,
            [`med-vid-${p.id}-${sortOrder}`, p.id, vid, sortOrder]
          );
          sortOrder++;
        }
      }

      // Import product models if present
      if (Array.isArray(p.models) && p.models.length > 0) {
        let sortOrder = 0;
        for (const model of p.models) {
          const modelId = model.id || `mod-${p.id}-${sortOrder}`;
          await connection.query(
            `INSERT INTO product_models (
              id, product_id, name, price, compare_at_price, wholesale_price,
              stock, sku, is_active, images, videos, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              modelId,
              p.id,
              model.name,
              Number(model.price) || 0,
              model.compareAtPrice !== undefined ? Number(model.compareAtPrice) : null,
              model.wholesalePrice !== undefined ? Number(model.wholesalePrice) : null,
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

      // Import product colors if present
      if (Array.isArray(p.colors) && p.colors.length > 0) {
        let sortOrder = 0;
        for (const color of p.colors) {
          const colorId = color.id || `col-${p.id}-${sortOrder}`;
          await connection.query(
            `INSERT INTO product_colors (id, product_id, name, hex, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              colorId,
              p.id,
              color.name,
              color.hex || null,
              color.isActive !== false ? 1 : 0,
              sortOrder,
            ]
          );
          sortOrder++;
        }
      }

      prodImported++;
    } catch (e: any) {
      console.error(`  [!] Error importing product ${p.name}:`, e.message);
      prodErrors++;
    }
  }
  stats.push({ entity: 'Products', imported: prodImported, skipped: prodSkipped, errors: prodErrors });

  // ----------------------------------------------------------------------------
  // 4. IMPORT STORE SETTINGS
  // ----------------------------------------------------------------------------
  console.log('--> Importing Store Settings...');
  let settingsImported = 0;
  let settingsSkipped = 0;
  let settingsErrors = 0;

  try {
    let rawSettings = seedStoreSettings;
    const settingsFilePath = path.join(process.cwd(), 'data', 'store-settings.json');
    if (fs.existsSync(settingsFilePath)) {
      try {
        const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
        const parsed = JSON.parse(fileContent);
        const data = Array.isArray(parsed) ? parsed[0] : (parsed && parsed['0'] ? parsed['0'] : parsed);
        rawSettings = { ...seedStoreSettings, ...(data || {}) };
      } catch (err) {
        console.warn('  Notice: Could not parse store-settings.json, using seed defaults.');
      }
    }

    await connection.query(
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
    settingsImported = 1;
  } catch (e: any) {
    console.error('  [!] Error importing store settings:', e.message);
    settingsErrors = 1;
  }
  stats.push({ entity: 'Store Settings', imported: settingsImported, skipped: settingsSkipped, errors: settingsErrors });

  // ----------------------------------------------------------------------------
  // 5. IMPORT STAFF USERS
  // ----------------------------------------------------------------------------
  console.log('--> Importing Staff Users...');
  let staffImported = 0;
  let staffSkipped = 0;
  let staffErrors = 0;

  const staffFilePath = path.join(process.cwd(), 'data', 'staff-users.json');
  let staffToImport: any[] = [];

  if (fs.existsSync(staffFilePath)) {
    try {
      const raw = fs.readFileSync(staffFilePath, 'utf8');
      staffToImport = JSON.parse(raw);
      console.log(`  Found local staff file with ${staffToImport.length} accounts.`);
    } catch (err: any) {
      console.warn('  Notice: Could not parse staff-users.json:', err.message);
    }
  }

  // If no local staff file exists, import seed super admin
  if (staffToImport.length === 0) {
    staffToImport = seedAdmins;
  }

  for (const staff of staffToImport) {
    try {
      const [existing]: any = await connection.query(
        'SELECT id FROM staff_users WHERE id = ? OR LOWER(email) = LOWER(?)',
        [staff.id, staff.email]
      );
      if (existing.length > 0) {
        staffSkipped++;
        continue;
      }

      await connection.query(
        `INSERT INTO staff_users (
          id, name, email, phone, role, role_id, permissions, avatar, status, is_owner, password_hash, salt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          staff.id,
          staff.name,
          staff.email.toLowerCase(),
          staff.phone || null,
          staff.role || 'Manager',
          staff.roleId || null,
          JSON.stringify(staff.permissions || []),
          staff.avatar || null,
          staff.status || 'active',
          staff.isOwner ? 1 : 0,
          staff.passwordHash || '',
          staff.salt || '',
        ]
      );
      staffImported++;
    } catch (e: any) {
      console.error(`  [!] Error importing staff ${staff.email}:`, e.message);
      staffErrors++;
    }
  }
  stats.push({ entity: 'Staff Accounts', imported: staffImported, skipped: staffSkipped, errors: staffErrors });

  // ----------------------------------------------------------------------------
  // 6. IMPORT CUSTOMERS & WHOLESALE ACCOUNTS
  // ----------------------------------------------------------------------------
  console.log('--> Importing Customers...');
  let custImported = 0;
  let custSkipped = 0;
  let custErrors = 0;

  const custFilePath = path.join(process.cwd(), 'data', 'customers.json');
  let customersToImport: any[] = [];

  if (fs.existsSync(custFilePath)) {
    try {
      const raw = fs.readFileSync(custFilePath, 'utf8');
      customersToImport = JSON.parse(raw);
      console.log(`  Found local customers file with ${customersToImport.length} records.`);
    } catch (err: any) {
      console.warn('  Notice: Could not parse customers.json:', err.message);
    }
  }

  for (const cust of customersToImport) {
    try {
      const [existing]: any = await connection.query(
        'SELECT id FROM customers WHERE id = ?',
        [cust.id]
      );
      if (existing.length > 0) {
        custSkipped++;
        continue;
      }

      await connection.query(
        `INSERT INTO customers (
          id, customer_type, shop_name, full_name, first_name, last_name,
          email, phone, password_hash, password_salt, address, city, province,
          postal_code, date_of_birth, total_orders, total_spent, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cust.id,
          cust.customerType || 'RETAIL',
          cust.shopName || null,
          cust.fullName || `${cust.firstName || ''} ${cust.lastName || ''}`.trim(),
          cust.firstName || cust.fullName || 'Customer',
          cust.lastName || '',
          cust.email || null,
          cust.phone || '',
          cust.passwordHash || null,
          cust.passwordSalt || null,
          cust.address || null,
          cust.city || null,
          cust.province || null,
          cust.postalCode || null,
          cust.dateOfBirth || null,
          cust.totalOrders || 0,
          cust.totalSpent || 0,
          cust.status || 'active',
          cust.createdAt || new Date().toISOString(),
        ]
      );
      custImported++;
    } catch (e: any) {
      console.error(`  [!] Error importing customer ${cust.id}:`, e.message);
      custErrors++;
    }
  }
  stats.push({ entity: 'Customers & Wholesale', imported: custImported, skipped: custSkipped, errors: custErrors });

  // ----------------------------------------------------------------------------
  // 7. IMPORT PROMOTIONS
  // ----------------------------------------------------------------------------
  console.log('--> Importing Default Promotions...');
  let promoImported = 0;
  let promoSkipped = 0;
  let promoErrors = 0;

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
      const [existing]: any = await connection.query(
        'SELECT id FROM promotions WHERE LOWER(code) = LOWER(?)',
        [promo.code]
      );
      if (existing.length > 0) {
        promoSkipped++;
        continue;
      }

      await connection.query(
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
      promoImported++;
    } catch (e: any) {
      console.error(`  [!] Error importing promo ${promo.code}:`, e.message);
      promoErrors++;
    }
  }
  stats.push({ entity: 'Promotions', imported: promoImported, skipped: promoSkipped, errors: promoErrors });

  // ----------------------------------------------------------------------------
  // 8. IMPORT BILL SETTINGS
  // ----------------------------------------------------------------------------
  console.log('--> Importing Bill Settings...');
  try {
    await connection.query(
      `INSERT INTO bill_settings (
        id, store_name, store_address, phone, whatsapp, email, website,
        invoice_header_text, invoice_footer_text, tax_number, thermal_footer_note
      ) VALUES (
        1, 'AL-HAMD MOBILE ACCESSORIES',
        'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan',
        '+92 343 2200995', '+923432200995', 'support@alhamd-mobile.com',
        'https://alhamdmobile.com',
        'Official Sales Receipt & Tax Invoice',
        'Thank you for shopping at Al-Hamd Mobile Accessories! 7-day warranty claim applicable.',
        'NTN-9988231',
        'Items once sold can be exchanged within 7 days with original sales invoice.'
      ) ON DUPLICATE KEY UPDATE store_name = VALUES(store_name)`
    );
    stats.push({ entity: 'Bill Settings', imported: 1, skipped: 0, errors: 0 });
  } catch (e: any) {
    stats.push({ entity: 'Bill Settings', imported: 0, skipped: 0, errors: 1 });
  }

  await connection.end();

  // ----------------------------------------------------------------------------
  // REPORT
  // ----------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(' IMPORT SUMMARY REPORT');
  console.log('====================================================');
  console.log('Entity                      | Imported | Skipped | Errors');
  console.log('----------------------------|----------|---------|-------');
  for (const s of stats) {
    const entityPad = s.entity.padEnd(27, ' ');
    const impPad = String(s.imported).padStart(8, ' ');
    const skipPad = String(s.skipped).padStart(7, ' ');
    const errPad = String(s.errors).padStart(6, ' ');
    console.log(`${entityPad} | ${impPad} | ${skipPad} | ${errPad}`);
  }
  console.log('====================================================\n');
  console.log('All source data processed. Original JSON/data files were preserved.');
  console.log('MySQL database is ready for production use.\n');
}

runImport().catch((err) => {
  console.error('Data import failed:', err);
  process.exit(1);
});
