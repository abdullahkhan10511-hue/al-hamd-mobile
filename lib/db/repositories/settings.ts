import { query, execute, isDbConfigured } from '../mysql';
import { StoreSettings, BillSettings, BillFieldToggles } from '@/types/admin';
import { seedStoreSettings } from '../seed';
import { RowDataPacket } from 'mysql2/promise';

interface StoreSettingsRow extends RowDataPacket {
  id: number;
  store_name: string;
  store_tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  email: string;
  phone: string;
  address: string;
  whatsapp: string | null;
  currency: string;
  currency_symbol: string;
  free_shipping_threshold: number | string;
  standard_shipping_fee: number | string;
  express_shipping_fee: number | string;
  delivery_message: string | null;
  estimated_delivery_text: string | null;
  pakistan_only: number;
  tax_percentage: number | string;
  social_links: any;
  seo_meta_title: string | null;
  seo_meta_description: string | null;
  seo_keywords: any;
  seo_logo_url: string | null;
  seo_favicon_url: string | null;
  footer_description: string | null;
  business_hours: string | null;
  website_title?: string | null;
  search_engine_title?: string | null;
  search_engine_description?: string | null;
  canonical_url?: string | null;
  og_image_url?: string | null;
}

let checkedStoreSettingsColumns = false;

export async function ensureStoreSettingsColumns(): Promise<void> {
  if (checkedStoreSettingsColumns || !isDbConfigured()) return;
  try {
    const existingCols = await query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_settings'`
    );
    const existingSet = new Set((existingCols || []).map((c: any) => String(c.COLUMN_NAME).toLowerCase()));

    const missingAlterations: string[] = [];
    if (!existingSet.has('website_title')) {
      missingAlterations.push('ADD COLUMN `website_title` VARCHAR(500) NULL');
    }
    if (!existingSet.has('search_engine_title')) {
      missingAlterations.push('ADD COLUMN `search_engine_title` VARCHAR(500) NULL');
    }
    if (!existingSet.has('search_engine_description')) {
      missingAlterations.push('ADD COLUMN `search_engine_description` TEXT NULL');
    }
    if (!existingSet.has('canonical_url')) {
      missingAlterations.push('ADD COLUMN `canonical_url` VARCHAR(500) NULL');
    }
    if (!existingSet.has('og_image_url')) {
      missingAlterations.push('ADD COLUMN `og_image_url` VARCHAR(1000) NULL');
    }

    if (missingAlterations.length > 0) {
      for (const alt of missingAlterations) {
        try {
          await execute(`ALTER TABLE store_settings ${alt}`);
        } catch (e) {
          console.warn('Notice adding store_settings column:', e);
        }
      }
    }
    checkedStoreSettingsColumns = true;
  } catch (err) {
    console.warn('ensureStoreSettingsColumns notice:', err);
  }
}

interface BillSettingsRow extends RowDataPacket {
  id: number;
  store_name: string;
  store_logo: string | null;
  store_address: string;
  phone: string;
  whatsapp: string | null;
  email: string;
  website: string | null;
  invoice_header_text: string | null;
  invoice_footer_text: string | null;
  tax_number: string | null;
  thermal_footer_note: string | null;
  template_config?: string | null;
  updated_at: string;
  updated_by: string | null;
}

let checkedTemplateConfigColumn = false;
let hasTemplateConfigColumn = false;

async function checkOrAddTemplateConfigColumn(): Promise<boolean> {
  if (checkedTemplateConfigColumn) return hasTemplateConfigColumn;
  try {
    const cols = await query<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_settings' AND COLUMN_NAME = 'template_config'`
    );
    if (cols && cols.length > 0) {
      hasTemplateConfigColumn = true;
      checkedTemplateConfigColumn = true;
      return true;
    }
    try {
      await execute(`ALTER TABLE bill_settings ADD COLUMN template_config LONGTEXT NULL`);
      hasTemplateConfigColumn = true;
    } catch {
      hasTemplateConfigColumn = false;
    }
    checkedTemplateConfigColumn = true;
    return hasTemplateConfigColumn;
  } catch {
    return false;
  }
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

export async function getStoreSettingsFromDb(): Promise<StoreSettings> {
  if (!isDbConfigured()) {
    return seedStoreSettings;
  }

  await ensureStoreSettingsColumns();

  const rows = await query<StoreSettingsRow[]>('SELECT * FROM store_settings WHERE id = 1 LIMIT 1');
  if (!rows || rows.length === 0) {
    return seedStoreSettings;
  }

  const r = rows[0];
  const socialLinks = parseJsonField(r.social_links, seedStoreSettings.socialLinks);
  const keywords = parseJsonField<string[]>(r.seo_keywords, seedStoreSettings.seo.keywords);

  const websiteTitle = r.website_title || r.seo_meta_title || seedStoreSettings.seo.metaTitle;
  const canonicalUrl = r.canonical_url || 'https://alhamdshop.com';
  const ogImageUrl = r.og_image_url || undefined;
  const searchEngineTitle = r.search_engine_title || websiteTitle;
  const searchEngineDescription = r.search_engine_description || r.seo_meta_description || seedStoreSettings.seo.metaDescription;

  return {
    storeName: r.store_name,
    storeTagline: r.store_tagline || seedStoreSettings.storeTagline,
    websiteTitle,
    canonicalUrl,
    logoUrl: r.logo_url || undefined,
    faviconUrl: r.favicon_url || seedStoreSettings.faviconUrl,
    ogImageUrl,
    email: r.email,
    phone: r.phone,
    address: r.address,
    whatsapp: r.whatsapp || undefined,
    currency: r.currency,
    currencySymbol: r.currency_symbol,
    freeShippingThreshold: Number(r.free_shipping_threshold),
    standardShippingFee: Number(r.standard_shipping_fee),
    expressShippingFee: Number(r.express_shipping_fee),
    deliveryMessage: r.delivery_message || undefined,
    estimatedDeliveryText: r.estimated_delivery_text || undefined,
    pakistanOnly: Boolean(r.pakistan_only),
    taxPercentage: Number(r.tax_percentage),
    socialLinks,
    seo: {
      metaTitle: r.seo_meta_title || seedStoreSettings.seo.metaTitle,
      metaDescription: r.seo_meta_description || seedStoreSettings.seo.metaDescription,
      keywords,
      websiteTitle,
      searchEngineTitle,
      searchEngineDescription,
      canonicalUrl,
      logoUrl: r.seo_logo_url || r.logo_url || undefined,
      faviconUrl: r.seo_favicon_url || r.favicon_url || seedStoreSettings.faviconUrl,
      ogImageUrl,
    },
    footerDescription: r.footer_description || seedStoreSettings.footerDescription,
    businessHours: r.business_hours || seedStoreSettings.businessHours,
  };
}

export async function updateStoreSettingsInDb(updates: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = await getStoreSettingsFromDb();
  const merged: StoreSettings = {
    ...current,
    ...updates,
    websiteTitle: updates.websiteTitle !== undefined ? updates.websiteTitle : (updates.seo?.websiteTitle !== undefined ? updates.seo.websiteTitle : current.websiteTitle),
    canonicalUrl: updates.canonicalUrl !== undefined ? updates.canonicalUrl : (updates.seo?.canonicalUrl !== undefined ? updates.seo.canonicalUrl : current.canonicalUrl),
    ogImageUrl: updates.ogImageUrl !== undefined ? updates.ogImageUrl : (updates.seo?.ogImageUrl !== undefined ? updates.seo.ogImageUrl : current.ogImageUrl),
    seo: {
      ...current.seo,
      ...(updates.seo || {}),
    },
    socialLinks: {
      ...current.socialLinks,
      ...(updates.socialLinks || {}),
    },
  };

  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  await ensureStoreSettingsColumns();

  const websiteTitle = merged.websiteTitle || merged.seo?.websiteTitle || merged.seo?.metaTitle || null;
  const searchEngineTitle = merged.seo?.searchEngineTitle || websiteTitle;
  const searchEngineDescription = merged.seo?.searchEngineDescription || merged.seo?.metaDescription || null;
  const canonicalUrl = merged.canonicalUrl || merged.seo?.canonicalUrl || 'https://alhamdshop.com';
  const ogImageUrl = merged.ogImageUrl || merged.seo?.ogImageUrl || null;

  await execute(
    `INSERT INTO store_settings (
      id, store_name, store_tagline, logo_url, favicon_url, email, phone, address,
      whatsapp, currency, currency_symbol, free_shipping_threshold, standard_shipping_fee,
      express_shipping_fee, delivery_message, estimated_delivery_text, pakistan_only,
      tax_percentage, social_links, seo_meta_title, seo_meta_description, seo_keywords,
      seo_logo_url, seo_favicon_url, footer_description, business_hours,
      website_title, search_engine_title, search_engine_description, canonical_url, og_image_url
    ) VALUES (
      1, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
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
      business_hours = VALUES(business_hours),
      website_title = VALUES(website_title),
      search_engine_title = VALUES(search_engine_title),
      search_engine_description = VALUES(search_engine_description),
      canonical_url = VALUES(canonical_url),
      og_image_url = VALUES(og_image_url)`,
    [
      merged.storeName,
      merged.storeTagline,
      merged.logoUrl || null,
      merged.faviconUrl || null,
      merged.email,
      merged.phone,
      merged.address,
      merged.whatsapp || null,
      merged.currency,
      merged.currencySymbol,
      merged.freeShippingThreshold,
      merged.standardShippingFee,
      merged.expressShippingFee,
      merged.deliveryMessage || null,
      merged.estimatedDeliveryText || null,
      merged.pakistanOnly ? 1 : 0,
      merged.taxPercentage,
      JSON.stringify(merged.socialLinks),
      merged.seo.metaTitle,
      merged.seo.metaDescription,
      JSON.stringify(merged.seo.keywords),
      merged.seo.logoUrl || merged.logoUrl || null,
      merged.seo.faviconUrl || merged.faviconUrl || null,
      merged.footerDescription,
      merged.businessHours,
      websiteTitle,
      searchEngineTitle,
      searchEngineDescription,
      canonicalUrl,
      ogImageUrl,
    ]
  );

  return merged;
}

const defaultBillToggles: BillFieldToggles = {
  showLogo: true,
  showStoreName: true,
  showStoreAddress: true,
  showCustomerName: true,
  showCustomerPhone: true,
  showCustomerAddress: true,
  showInvoiceNumber: true,
  showDate: true,
  showTime: true,
  showPaymentMethod: true,
  showWebsite: true,
  showThankYou: true,
  footerMessage: 'Thank You for Shopping!',
  thermalPaperWidth: '80mm',
  thermalCustomWidth: 80,
};

export async function getBillSettingsFromDb(): Promise<BillSettings> {
  const fallback: BillSettings = {
    storeName: 'AL-HAMD MOBILE ACCESSORIES',
    storeAddress: 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan',
    phone: '+92 343 2200995',
    whatsapp: '+92 343 2200995',
    email: 'support@alhamd-mobile.com',
    website: 'alhamd.pk',
    invoiceHeaderText: 'Quality Mobile Accessories & Smartphone Essentials',
    invoiceFooterText: 'Thank You for Shopping!',
    taxNumber: '',
    thermalFooterNote: 'Thank You for Shopping!',
    thermalPaperWidth: '80mm',
    thermalCustomWidth: 80,
    a4Config: defaultBillToggles,
    thermalConfig: defaultBillToggles,
  };

  if (!isDbConfigured()) return fallback;

  const rows = await query<BillSettingsRow[]>('SELECT * FROM bill_settings WHERE id = 1 LIMIT 1');
  if (!rows || rows.length === 0) return fallback;

  const r = rows[0];
  const templateConfig = parseJsonField<{
    a4Config?: any;
    thermalConfig?: any;
    thermalPaperWidth?: any;
    thermalCustomWidth?: any;
    showLogo?: boolean;
    showStoreName?: boolean;
    showStoreAddress?: boolean;
    showCustomerName?: boolean;
    showCustomerPhone?: boolean;
    showCustomerAddress?: boolean;
    showInvoiceNumber?: boolean;
    showDate?: boolean;
    showTime?: boolean;
    showPaymentMethod?: boolean;
    showWebsite?: boolean;
    showThankYou?: boolean;
  }>((r as any).template_config, {});

  const savedWidth =
    templateConfig.thermalPaperWidth ||
    templateConfig.thermalConfig?.thermalPaperWidth ||
    '80mm';
  const savedCustomWidth =
    typeof templateConfig.thermalCustomWidth === 'number'
      ? templateConfig.thermalCustomWidth
      : typeof templateConfig.thermalConfig?.thermalCustomWidth === 'number'
      ? templateConfig.thermalConfig.thermalCustomWidth
      : 80;

  return {
    storeName: r.store_name,
    storeLogo: r.store_logo || undefined,
    storeAddress: r.store_address,
    phone: r.phone,
    whatsapp: r.whatsapp || undefined,
    email: r.email,
    website: r.website || undefined,
    invoiceHeaderText: r.invoice_header_text || undefined,
    invoiceFooterText: r.invoice_footer_text || undefined,
    taxNumber: r.tax_number || undefined,
    thermalFooterNote: r.thermal_footer_note || undefined,
    thermalPaperWidth: savedWidth,
    thermalCustomWidth: savedCustomWidth,
    a4Config: templateConfig.a4Config
      ? { ...defaultBillToggles, ...templateConfig.a4Config }
      : defaultBillToggles,
    thermalConfig: {
      ...defaultBillToggles,
      ...(templateConfig.thermalConfig || {}),
      thermalPaperWidth: savedWidth,
      thermalCustomWidth: savedCustomWidth,
    },
    showLogo: templateConfig.showLogo,
    showStoreName: templateConfig.showStoreName,
    showStoreAddress: templateConfig.showStoreAddress,
    showCustomerName: templateConfig.showCustomerName,
    showCustomerPhone: templateConfig.showCustomerPhone,
    showCustomerAddress: templateConfig.showCustomerAddress,
    showInvoiceNumber: templateConfig.showInvoiceNumber,
    showDate: templateConfig.showDate,
    showTime: templateConfig.showTime,
    showPaymentMethod: templateConfig.showPaymentMethod,
    showWebsite: templateConfig.showWebsite,
    showThankYou: templateConfig.showThankYou,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by || undefined,
  };
}

export async function updateBillSettingsInDb(updates: Partial<BillSettings>, adminEmail = 'admin@alhamd.com'): Promise<BillSettings> {
  const current = await getBillSettingsFromDb();
  const width =
    updates.thermalPaperWidth ||
    updates.thermalConfig?.thermalPaperWidth ||
    current.thermalPaperWidth ||
    '80mm';
  const customWidth =
    typeof updates.thermalCustomWidth === 'number'
      ? updates.thermalCustomWidth
      : typeof updates.thermalConfig?.thermalCustomWidth === 'number'
      ? updates.thermalConfig.thermalCustomWidth
      : current.thermalCustomWidth || 80;

  const merged: BillSettings = {
    ...current,
    ...updates,
    thermalPaperWidth: width,
    thermalCustomWidth: customWidth,
    thermalConfig: {
      ...defaultBillToggles,
      ...(current.thermalConfig || {}),
      ...(updates.thermalConfig || {}),
      thermalPaperWidth: width,
      thermalCustomWidth: customWidth,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };

  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const hasTemplateCol = await checkOrAddTemplateConfigColumn();
  const templateConfigJson = JSON.stringify({
    a4Config: merged.a4Config,
    thermalConfig: merged.thermalConfig,
    thermalPaperWidth: merged.thermalPaperWidth,
    thermalCustomWidth: merged.thermalCustomWidth,
    showLogo: merged.showLogo,
    showStoreName: merged.showStoreName,
    showStoreAddress: merged.showStoreAddress,
    showCustomerName: merged.showCustomerName,
    showCustomerPhone: merged.showCustomerPhone,
    showCustomerAddress: merged.showCustomerAddress,
    showInvoiceNumber: merged.showInvoiceNumber,
    showDate: merged.showDate,
    showTime: merged.showTime,
    showPaymentMethod: merged.showPaymentMethod,
    showWebsite: merged.showWebsite,
    showThankYou: merged.showThankYou,
  });

  if (hasTemplateCol) {
    await execute(
      `INSERT INTO bill_settings (
        id, store_name, store_logo, store_address, phone, whatsapp, email, website,
        invoice_header_text, invoice_footer_text, tax_number, thermal_footer_note, template_config, updated_by
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      ) ON DUPLICATE KEY UPDATE
        store_name = VALUES(store_name),
        store_logo = VALUES(store_logo),
        store_address = VALUES(store_address),
        phone = VALUES(phone),
        whatsapp = VALUES(whatsapp),
        email = VALUES(email),
        website = VALUES(website),
        invoice_header_text = VALUES(invoice_header_text),
        invoice_footer_text = VALUES(invoice_footer_text),
        tax_number = VALUES(tax_number),
        thermal_footer_note = VALUES(thermal_footer_note),
        template_config = VALUES(template_config),
        updated_by = VALUES(updated_by)`,
      [
        merged.storeName,
        merged.storeLogo || null,
        merged.storeAddress,
        merged.phone,
        merged.whatsapp || null,
        merged.email,
        merged.website || null,
        merged.invoiceHeaderText || null,
        merged.invoiceFooterText || null,
        merged.taxNumber || null,
        merged.thermalFooterNote || null,
        templateConfigJson,
        adminEmail,
      ]
    );
  } else {
    await execute(
      `INSERT INTO bill_settings (
        id, store_name, store_logo, store_address, phone, whatsapp, email, website,
        invoice_header_text, invoice_footer_text, tax_number, thermal_footer_note, updated_by
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      ) ON DUPLICATE KEY UPDATE
        store_name = VALUES(store_name),
        store_logo = VALUES(store_logo),
        store_address = VALUES(store_address),
        phone = VALUES(phone),
        whatsapp = VALUES(whatsapp),
        email = VALUES(email),
        website = VALUES(website),
        invoice_header_text = VALUES(invoice_header_text),
        invoice_footer_text = VALUES(invoice_footer_text),
        tax_number = VALUES(tax_number),
        thermal_footer_note = VALUES(thermal_footer_note),
        updated_by = VALUES(updated_by)`,
      [
        merged.storeName,
        merged.storeLogo || null,
        merged.storeAddress,
        merged.phone,
        merged.whatsapp || null,
        merged.email,
        merged.website || null,
        merged.invoiceHeaderText || null,
        merged.invoiceFooterText || null,
        merged.taxNumber || null,
        merged.thermalFooterNote || null,
        adminEmail,
      ]
    );
  }

  return merged;
}
