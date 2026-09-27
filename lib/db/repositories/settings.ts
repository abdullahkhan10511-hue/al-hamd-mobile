import { query, execute, isDbConfigured } from '../mysql';
import { StoreSettings, BillSettings } from '@/types/admin';
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
  updated_at: string;
  updated_by: string | null;
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

  const rows = await query<StoreSettingsRow[]>('SELECT * FROM store_settings WHERE id = 1 LIMIT 1');
  if (!rows || rows.length === 0) {
    return seedStoreSettings;
  }

  const r = rows[0];
  const socialLinks = parseJsonField(r.social_links, seedStoreSettings.socialLinks);
  const keywords = parseJsonField<string[]>(r.seo_keywords, seedStoreSettings.seo.keywords);

  return {
    storeName: r.store_name,
    storeTagline: r.store_tagline || seedStoreSettings.storeTagline,
    logoUrl: r.logo_url || undefined,
    faviconUrl: r.favicon_url || seedStoreSettings.faviconUrl,
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
      logoUrl: r.seo_logo_url || r.logo_url || undefined,
      faviconUrl: r.seo_favicon_url || r.favicon_url || undefined,
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
    ]
  );

  return merged;
}

export async function getBillSettingsFromDb(): Promise<BillSettings> {
  const fallback: BillSettings = {
    storeName: 'AL-HAMD MOBILE ACCESSORIES',
    storeAddress: 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin',
    phone: '+92 343 2200995',
    whatsapp: '+923432200995',
    email: 'support@alhamd-mobile.com',
    website: 'https://alhamdmobile.com',
    invoiceHeaderText: 'Official Sales Receipt & Tax Invoice',
    invoiceFooterText: 'Thank you for choosing Al-Hamd Mobile Accessories! Verified 7-day replacement warranty.',
    thermalFooterNote: 'Items once sold can be exchanged within 7 days with original receipt and packaging intact.',
  };

  if (!isDbConfigured()) return fallback;

  const rows = await query<BillSettingsRow[]>('SELECT * FROM bill_settings WHERE id = 1 LIMIT 1');
  if (!rows || rows.length === 0) return fallback;

  const r = rows[0];
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
    updatedAt: r.updated_at,
    updatedBy: r.updated_by || undefined,
  };
}

export async function updateBillSettingsInDb(updates: Partial<BillSettings>, adminEmail = 'admin@alhamd.com'): Promise<BillSettings> {
  const current = await getBillSettingsFromDb();
  const merged: BillSettings = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };

  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

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

  return merged;
}
