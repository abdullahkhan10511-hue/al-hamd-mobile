import { StoreSettings, SocialLinksSettings, SocialAccountConfig } from '@/types/admin';
import { seedStoreSettings } from './seed';
import { getLocal, setLocal } from './storage';
import { logActivity } from './activity';
import { getAdminAuthHeaders } from './staff';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const SETTINGS_KEY = 'store_settings';

export const STANDARD_SOCIAL_PLATFORMS: { platform: string; name: string; placeholder: string; defaultUrl: string }[] = [
  { platform: 'facebook', name: 'Facebook', placeholder: 'https://facebook.com/your-page', defaultUrl: '' },
  { platform: 'instagram', name: 'Instagram', placeholder: 'https://instagram.com/your-profile', defaultUrl: '' },
  { platform: 'tiktok', name: 'TikTok', placeholder: 'https://tiktok.com/@your-channel', defaultUrl: '' },
  { platform: 'youtube', name: 'YouTube', placeholder: 'https://youtube.com/@your-channel', defaultUrl: '' },
  { platform: 'whatsapp', name: 'WhatsApp', placeholder: 'https://wa.me/923432200995', defaultUrl: 'https://wa.me/923432200995' },
];

export function isGenericSocialUrl(url: string): boolean {
  if (!url) return true;
  const clean = url.trim().replace(/\/+$/, '').toLowerCase();
  return (
    clean === 'https://facebook.com' ||
    clean === 'http://facebook.com' ||
    clean === 'https://www.facebook.com' ||
    clean === 'http://www.facebook.com' ||
    clean === 'https://instagram.com' ||
    clean === 'http://instagram.com' ||
    clean === 'https://www.instagram.com' ||
    clean === 'http://www.instagram.com' ||
    clean === 'https://tiktok.com' ||
    clean === 'http://tiktok.com' ||
    clean === 'https://www.tiktok.com' ||
    clean === 'http://www.tiktok.com' ||
    clean === 'https://youtube.com' ||
    clean === 'http://youtube.com' ||
    clean === 'https://www.youtube.com' ||
    clean === 'http://www.youtube.com'
  );
}

export function normalizeSocialLinks(rawSocial: any): SocialLinksSettings {
  const current = rawSocial || {};
  const status: Record<string, boolean> = { ...(current.status || {}) };

  // Standard platforms
  STANDARD_SOCIAL_PLATFORMS.forEach(({ platform }) => {
    // WhatsApp defaults to true; others default to true only if a real non-generic URL is provided
    if (status[platform] === undefined) {
      if (platform === 'whatsapp') {
        status[platform] = true;
      } else {
        const existingVal = current[platform];
        status[platform] = Boolean(existingVal && !isGenericSocialUrl(existingVal));
      }
    }
  });

  // Build accounts array
  const accounts: SocialAccountConfig[] = STANDARD_SOCIAL_PLATFORMS.map(({ platform, name, defaultUrl }) => {
    const accItem = Array.isArray(current.accounts) ? current.accounts.find((a: any) => a.platform === platform) : null;
    let existingUrl = accItem?.url !== undefined ? accItem.url : (typeof current[platform] === 'string' ? current[platform] : '');
    
    // Migrate old demo whatsapp links
    if (platform === 'whatsapp' && (existingUrl.includes('923001234567') || !existingUrl)) {
      existingUrl = 'https://wa.me/923432200995';
    }

    const url = existingUrl || defaultUrl;
    const isActive = status[platform] !== undefined ? status[platform] : (accItem?.isActive ?? (platform === 'whatsapp' ? true : false));

    return {
      platform,
      name,
      url,
      isActive,
    };
  });

  // Preserve any custom accounts
  if (Array.isArray(current.accounts)) {
    current.accounts.forEach((acc: any) => {
      if (!accounts.some((a) => a.platform === acc.platform) && acc.platform) {
        const isAct = status[acc.platform] !== undefined ? status[acc.platform] : (acc.isActive ?? true);
        accounts.push({
          platform: acc.platform,
          name: acc.name || acc.platform,
          url: acc.url || '',
          isActive: isAct,
        });
        if (status[acc.platform] === undefined) {
          status[acc.platform] = isAct;
        }
      }
    });
  }

  return {
    ...current,
    facebook: accounts.find((a) => a.platform === 'facebook')?.url || current.facebook || '',
    instagram: accounts.find((a) => a.platform === 'instagram')?.url || current.instagram || '',
    tiktok: accounts.find((a) => a.platform === 'tiktok')?.url || current.tiktok || '',
    youtube: accounts.find((a) => a.platform === 'youtube')?.url || current.youtube || '',
    whatsapp: accounts.find((a) => a.platform === 'whatsapp')?.url || current.whatsapp || 'https://wa.me/923432200995',
    status,
    accounts,
  };
}

export function isValidCustomFavicon(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '/favicon.ico' || trimmed === 'favicon.ico') {
    return false;
  }
  // Exclude corrupted test download files
  if (trimmed.includes('favicon_1791116789478_download.jpg')) {
    return false;
  }
  return true;
}

export function resolveFaviconUrl(
  primary?: string | null,
  secondary?: string | null,
  fallback = '/favicon.ico'
): string {
  if (isValidCustomFavicon(primary)) return primary!.trim();
  if (isValidCustomFavicon(secondary)) return secondary!.trim();
  return fallback;
}

export function normalizeCanonicalUrl(url?: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return 'https://alhamdshop.com';
  }
  let clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  try {
    const parsed = new URL(clean);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return clean.replace(/\/+$/, '');
  }
}

function getServerSavedSettings(): Partial<StoreSettings> | null {
  if (typeof window !== 'undefined') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const filePath = path.join(process.cwd(), 'data', 'store-settings.json');
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

export function getStoreSettings(): StoreSettings {
  const serverSaved = getServerSavedSettings();
  const settings = getLocal<StoreSettings>(
    SETTINGS_KEY,
    serverSaved ? ({ ...seedStoreSettings, ...serverSaved } as StoreSettings) : seedStoreSettings
  );

  const base: StoreSettings = {
    ...seedStoreSettings,
    ...(serverSaved || {}),
    ...(settings || {}),
    seo: {
      ...seedStoreSettings.seo,
      ...(serverSaved?.seo || {}),
      ...(settings?.seo || {}),
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
    metaTitle: base.seo?.metaTitle || websiteTitle,
    logoUrl: base.seo?.logoUrl || base.logoUrl || '',
    faviconUrl: resolvedFavicon,
    ogImageUrl,
  };

  // Currency fallbacks if unset
  if (!base.currency) {
    base.currency = 'PKR';
    base.currencySymbol = 'Rs.';
  }
  if (base.freeShippingThreshold === undefined || base.freeShippingThreshold === null) {
    base.freeShippingThreshold = 5000;
  }
  if (base.standardShippingFee === undefined || base.standardShippingFee === null) {
    base.standardShippingFee = 200;
  }
  if (base.expressShippingFee === undefined || base.expressShippingFee === null) {
    base.expressShippingFee = 450;
  }

  // Address/phone/email fallbacks only if completely missing
  if (!base.phone || !base.phone.trim()) {
    base.phone = '+92 343 2200995';
  }
  if (!base.whatsapp || !base.whatsapp.trim()) {
    base.whatsapp = '+923432200995';
  }
  if (!base.email || !base.email.trim()) {
    base.email = 'support@alhamd-mobile.com';
  }
  if (!base.address || !base.address.trim()) {
    base.address = 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan';
  }
  if (!base.footerDescription || !base.footerDescription.trim()) {
    base.footerDescription =
      'Quality mobile accessories, chargers, cables, cases, audio products and everyday smartphone essentials, serving customers across Pakistan.';
  }

  // Normalize social links with individual active/inactive statuses
  base.socialLinks = normalizeSocialLinks(base.socialLinks);

  return base;
}

export function resetSettingsSyncTimestamp(): void {
  lastSettingsSyncTimestamp = 0;
}

let inFlightSettingsPromise: Promise<StoreSettings> | null = null;
let lastSettingsSyncTimestamp = 0;
const SETTINGS_SYNC_DEBOUNCE_MS = 60000; // 60s client-side sync debounce

export async function syncStoreSettingsFromApi(forceFresh = false): Promise<StoreSettings> {
  if (typeof window === 'undefined') return getStoreSettings();
  if (inFlightSettingsPromise && !forceFresh) {
    return inFlightSettingsPromise;
  }
  if (!forceFresh && Date.now() - lastSettingsSyncTimestamp < SETTINGS_SYNC_DEBOUNCE_MS) {
    return getStoreSettings();
  }

  inFlightSettingsPromise = (async () => {
    try {
      const url = forceFresh ? `/api/settings?t=${Date.now()}` : '/api/settings';
      const res = await fetch(url, forceFresh ? { cache: 'no-store' } : undefined);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          const serverData: StoreSettings = data.settings;
          const freshSettings: StoreSettings = {
            ...seedStoreSettings,
            ...serverData,
            storeName: serverData.storeName || 'AL-HAMD SHOP',
            websiteTitle: serverData.websiteTitle || serverData.seo?.websiteTitle || 'AL-HAMD SHOP | Mobile Accessories Pakistan',
            canonicalUrl: normalizeCanonicalUrl(serverData.canonicalUrl || serverData.seo?.canonicalUrl || 'https://alhamdshop.com'),
            ogImageUrl: serverData.ogImageUrl || serverData.seo?.ogImageUrl || '',
            seo: {
              ...seedStoreSettings.seo,
              ...(serverData.seo || {}),
              websiteTitle: serverData.websiteTitle || serverData.seo?.websiteTitle || 'AL-HAMD SHOP | Mobile Accessories Pakistan',
              canonicalUrl: normalizeCanonicalUrl(serverData.canonicalUrl || serverData.seo?.canonicalUrl || 'https://alhamdshop.com'),
              ogImageUrl: serverData.ogImageUrl || serverData.seo?.ogImageUrl || '',
            },
            socialLinks: normalizeSocialLinks(serverData.socialLinks),
          };
          const current = getStoreSettings();
          const hasChanged = JSON.stringify(current) !== JSON.stringify(freshSettings);
          setLocal(SETTINGS_KEY, freshSettings, true);
          lastSettingsSyncTimestamp = Date.now();
          if (hasChanged) {
            window.dispatchEvent(new CustomEvent('alhamd:data-updated', { detail: { key: SETTINGS_KEY, value: freshSettings } }));
          }
          return freshSettings;
        }
      }
    } catch (err) {
      console.warn('API error syncing store settings:', err);
    } finally {
      inFlightSettingsPromise = null;
    }
    return getStoreSettings();
  })();

  return inFlightSettingsPromise;
}

export async function fetchAuthoritativeAdminSettings(): Promise<StoreSettings> {
  if (typeof window === 'undefined') return getStoreSettings();
  try {
    const authHeaders = getAdminAuthHeaders();
    const res = await fetch('/api/admin/settings?t=' + Date.now(), {
      headers: authHeaders,
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.settings) {
        const serverData = data.settings;
        const freshSettings: StoreSettings = {
          ...seedStoreSettings,
          ...serverData,
          storeName: serverData.storeName || 'AL-HAMD SHOP',
          websiteTitle: serverData.websiteTitle || serverData.seo?.websiteTitle || 'AL-HAMD SHOP | Mobile Accessories Pakistan',
          canonicalUrl: normalizeCanonicalUrl(serverData.canonicalUrl || serverData.seo?.canonicalUrl || 'https://alhamdshop.com'),
          ogImageUrl: serverData.ogImageUrl || serverData.seo?.ogImageUrl || '',
          seo: {
            ...seedStoreSettings.seo,
            ...(serverData.seo || {}),
            websiteTitle: serverData.websiteTitle || serverData.seo?.websiteTitle || 'AL-HAMD SHOP | Mobile Accessories Pakistan',
            canonicalUrl: normalizeCanonicalUrl(serverData.canonicalUrl || serverData.seo?.canonicalUrl || 'https://alhamdshop.com'),
            ogImageUrl: serverData.ogImageUrl || serverData.seo?.ogImageUrl || '',
          },
          socialLinks: normalizeSocialLinks(serverData.socialLinks),
        };
        setLocal(SETTINGS_KEY, freshSettings, true);
        lastSettingsSyncTimestamp = Date.now();
        window.dispatchEvent(new CustomEvent('alhamd:data-updated', { detail: { key: SETTINGS_KEY, value: freshSettings } }));
        return freshSettings;
      }
    }
  } catch (err) {
    console.warn('Error fetching authoritative admin settings:', err);
  }
  return syncStoreSettingsFromApi(true);
}

export async function updateStoreSettings(
  settings: Partial<StoreSettings>,
  adminEmail = 'admin@alhamd.com'
): Promise<StoreSettings> {
  const current = getStoreSettings();
  const resolvedFavicon = resolveFaviconUrl(
    settings.faviconUrl,
    settings.seo?.faviconUrl || current.faviconUrl || current.seo?.faviconUrl
  );

  const updated: StoreSettings = {
    ...current,
    ...settings,
    storeName: settings.storeName !== undefined ? settings.storeName.trim() : current.storeName,
    websiteTitle: settings.websiteTitle !== undefined ? settings.websiteTitle : (settings.seo?.websiteTitle !== undefined ? settings.seo.websiteTitle : current.websiteTitle),
    canonicalUrl: settings.canonicalUrl !== undefined ? normalizeCanonicalUrl(settings.canonicalUrl) : (settings.seo?.canonicalUrl !== undefined ? normalizeCanonicalUrl(settings.seo.canonicalUrl) : current.canonicalUrl),
    ogImageUrl: settings.ogImageUrl !== undefined ? settings.ogImageUrl : (settings.seo?.ogImageUrl !== undefined ? settings.seo.ogImageUrl : current.ogImageUrl),
    faviconUrl: resolvedFavicon,
    logoUrl: settings.logoUrl !== undefined ? settings.logoUrl : (settings.seo?.logoUrl !== undefined ? settings.seo.logoUrl : current.logoUrl),
    seo: {
      ...current.seo,
      ...(settings.seo || {}),
      websiteTitle: settings.websiteTitle !== undefined ? settings.websiteTitle : (settings.seo?.websiteTitle !== undefined ? settings.seo.websiteTitle : current.seo?.websiteTitle || current.websiteTitle),
      canonicalUrl: settings.canonicalUrl !== undefined ? normalizeCanonicalUrl(settings.canonicalUrl) : (settings.seo?.canonicalUrl !== undefined ? normalizeCanonicalUrl(settings.seo.canonicalUrl) : current.seo?.canonicalUrl || current.canonicalUrl),
      ogImageUrl: settings.ogImageUrl !== undefined ? settings.ogImageUrl : (settings.seo?.ogImageUrl !== undefined ? settings.seo.ogImageUrl : current.seo?.ogImageUrl || current.ogImageUrl),
      logoUrl: settings.logoUrl !== undefined ? settings.logoUrl : (settings.seo?.logoUrl !== undefined ? settings.seo.logoUrl : current.seo?.logoUrl || current.logoUrl),
      faviconUrl: resolvedFavicon,
    },
    socialLinks: settings.socialLinks ? normalizeSocialLinks({ ...current.socialLinks, ...settings.socialLinks }) : current.socialLinks,
  };

  // Authoritative server persistence first
  let serverSavedSettings: StoreSettings = updated;
  if (typeof window !== 'undefined') {
    const authHeaders = getAdminAuthHeaders(adminEmail);
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      credentials: 'include',
      body: JSON.stringify(updated),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      const errMsg = data?.error || `Failed to save store settings (Server status: ${res.status})`;
      throw new Error(errMsg);
    }

    if (data.settings) {
      serverSavedSettings = data.settings;
    }
  }

  // Only update local storage once authoritative database/server persistence succeeds
  setLocal(SETTINGS_KEY, serverSavedSettings);

  // Attempt Firestore sync with non-destructive merge
  const hasRealFirebase =
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key-placeholder';

  if (hasRealFirebase && db && typeof db.type === 'string') {
    try {
      const docRef = doc(db, 'system_data', SETTINGS_KEY);
      await Promise.race([
        setDoc(docRef, updated, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore sync timeout')), 1500)),
      ]);
    } catch {
      // Offline or permission restriction; local persistence is already guaranteed
    }
  }

  await logActivity({
    adminEmail,
    action: 'Updated Store Settings',
    target: 'Store Settings',
    details: `Updated: ${Object.keys(settings).join(', ')}`,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alhamd:data-updated'));
  }

  return serverSavedSettings;
}

// Check if a specific social platform is active and has a valid URL
export function isSocialPlatformActive(settings: StoreSettings | null, platform: string): boolean {
  if (!settings || !settings.socialLinks) return false;
  const social = settings.socialLinks;

  // Check explicit status map
  const statusValue = social.status?.[platform];
  if (statusValue === false) {
    return false;
  }

  // Check accounts list
  if (Array.isArray(social.accounts)) {
    const acc = social.accounts.find((a) => a.platform.toLowerCase() === platform.toLowerCase());
    if (acc) {
      return Boolean(acc.isActive && acc.url && acc.url.trim().length > 0 && !isGenericSocialUrl(acc.url));
    }
  }

  // Fallback to legacy field
  const url = (social as any)[platform];
  return Boolean(url && typeof url === 'string' && url.trim().length > 0 && !isGenericSocialUrl(url));
}

// Get only active social accounts
export function getActiveSocialAccounts(settings: StoreSettings | null): SocialAccountConfig[] {
  if (!settings || !settings.socialLinks) return [];
  const normalized = normalizeSocialLinks(settings.socialLinks);
  return (normalized.accounts || []).filter(
    (acc) => acc.isActive && acc.url && acc.url.trim().length > 0 && !isGenericSocialUrl(acc.url)
  );
}

// Real-time toggle of social platform status
export async function toggleSocialPlatformStatus(
  platform: string,
  isActive: boolean,
  adminEmail = 'admin@alhamd.com'
): Promise<StoreSettings> {
  const current = getStoreSettings();
  const currentSocial = current.socialLinks || {};
  const status = { ...(currentSocial.status || {}), [platform]: isActive };

  let found = false;
  const accounts = (currentSocial.accounts || []).map((acc) => {
    if (acc.platform === platform) {
      found = true;
      return { ...acc, isActive };
    }
    return acc;
  });
  if (!found) {
    accounts.push({
      platform,
      name: STANDARD_SOCIAL_PLATFORMS.find((p) => p.platform === platform)?.name || platform,
      url: (currentSocial as any)[platform] || '',
      isActive,
    });
  }

  const updatedSocial: SocialLinksSettings = {
    ...currentSocial,
    status,
    accounts,
  };

  const updatedSettings: StoreSettings = {
    ...current,
    socialLinks: updatedSocial,
  };

  setLocal(SETTINGS_KEY, updatedSettings);

  // Firestore sync if available
  const hasRealFirebase =
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key-placeholder';

  if (hasRealFirebase && db && typeof db.type === 'string') {
    try {
      const docRef = doc(db, 'system_data', SETTINGS_KEY);
      await Promise.race([
        setDoc(docRef, updatedSettings, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore sync timeout')), 1500)),
      ]);
    } catch {
      // ignore
    }
  }

  await logActivity({
    adminEmail,
    action: isActive ? 'Activated Social Platform' : 'Deactivated Social Platform',
    target: `Social Media (${platform})`,
    details: `Set ${platform} to ${isActive ? 'Active' : 'Inactive'}`,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alhamd:data-updated'));
  }

  return updatedSettings;
}

// Update URL for a social platform without altering its active status
export async function updateSocialPlatformUrl(
  platform: string,
  url: string,
  adminEmail = 'admin@alhamd.com'
): Promise<StoreSettings> {
  const current = getStoreSettings();
  const currentSocial = current.socialLinks || {};

  let found = false;
  const accounts = (currentSocial.accounts || []).map((acc) => {
    if (acc.platform === platform) {
      found = true;
      return { ...acc, url };
    }
    return acc;
  });
  if (!found) {
    accounts.push({
      platform,
      name: STANDARD_SOCIAL_PLATFORMS.find((p) => p.platform === platform)?.name || platform,
      url,
      isActive: currentSocial.status?.[platform] !== false,
    });
  }

  const updatedSocial: SocialLinksSettings = {
    ...currentSocial,
    [platform]: url,
    accounts,
  };

  return await updateStoreSettings({ socialLinks: updatedSocial }, adminEmail);
}
