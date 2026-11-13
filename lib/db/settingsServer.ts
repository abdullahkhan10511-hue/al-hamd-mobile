import 'server-only';
import fs from 'fs';
import path from 'path';
import { StoreSettings } from '@/types/admin';
import { seedStoreSettings } from './seed';
import { getDataFilePath } from '@/lib/storage/dataDir';
import {
  normalizeCanonicalUrl,
  resolveFaviconUrl,
  normalizeSocialLinks,
} from './settings';

export { normalizeCanonicalUrl, resolveFaviconUrl, normalizeSocialLinks };

export function getServerSavedSettings(): Partial<StoreSettings> | null {
  try {
    const filePath = getDataFilePath('store-settings.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed[0] : parsed;
    }
  } catch {
    // Graceful fallback
  }
  return null;
}

export function getServerStoreSettings(): StoreSettings {
  const serverSaved = getServerSavedSettings();

  const base: StoreSettings = {
    ...seedStoreSettings,
    ...(serverSaved || {}),
    seo: {
      ...seedStoreSettings.seo,
      ...(serverSaved?.seo || {}),
    },
  };

  // Ensure official business information fallback
  if (base.storeName === undefined || base.storeName === null || !base.storeName.trim()) {
    base.storeName = 'AL-HAMD SHOP';
  } else {
    base.storeName = base.storeName.trim();
  }

  // SEO & Branding Defaults and Fallbacks
  const websiteTitle =
    base.websiteTitle ||
    base.seo?.websiteTitle ||
    base.seo?.metaTitle ||
    `${base.storeName} | Mobile Accessories Pakistan`;
  const canonicalUrl = normalizeCanonicalUrl(base.canonicalUrl || base.seo?.canonicalUrl || 'https://alhamdshop.com');
  const metaDescription =
    base.seo?.metaDescription ||
    'Shop mobile accessories at AL-HAMD SHOP. Explore chargers, cables, cases, earbuds, power banks and more, with reliable delivery across Pakistan.';
  const searchEngineTitle = base.seo?.searchEngineTitle || websiteTitle;
  const searchEngineDescription = base.seo?.searchEngineDescription || metaDescription;
  const ogImageUrl = base.ogImageUrl || base.seo?.ogImageUrl || '';

  const resolvedFavicon = resolveFaviconUrl(
    base.faviconUrl,
    base.seo?.faviconUrl || serverSaved?.faviconUrl || serverSaved?.seo?.faviconUrl
  );

  base.websiteTitle = websiteTitle;
  base.canonicalUrl = canonicalUrl;
  base.ogImageUrl = ogImageUrl;
  base.faviconUrl = resolvedFavicon;
  base.seo = {
    ...base.seo,
    websiteTitle,
    searchEngineTitle,
    searchEngineDescription,
    canonicalUrl,
    metaDescription,
    ogImageUrl,
    faviconUrl: resolvedFavicon,
  };

  if (base.socialLinks) {
    base.socialLinks = normalizeSocialLinks(base.socialLinks);
  }

  return base;
}

