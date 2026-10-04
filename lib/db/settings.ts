import { StoreSettings, SocialLinksSettings, SocialAccountConfig } from '@/types/admin';
import { seedStoreSettings } from './seed';
import { getLocal, setLocal } from './storage';
import { logActivity } from './activity';
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
  STANDARD_SOCIAL_PLATFORMS.forEach(({ platform, defaultUrl }) => {
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

  // Ensure official business information
  if (base.storeName === 'AL-HAMD-MOBILE' || base.storeName === 'AL·HAMD' || !base.storeName) {
    base.storeName = 'AL-HAMD MOBILE ACCESSORIES';
  }

  // SEO & Branding Defaults and Fallbacks
  const websiteTitle =
    base.websiteTitle ||
    base.seo?.websiteTitle ||
    base.seo?.metaTitle ||
    `${base.storeName} | Mobile Accessories in Pakistan`;
  const canonicalUrl = normalizeCanonicalUrl(base.canonicalUrl || base.seo?.canonicalUrl || 'https://alhamdshop.com');
  const metaDescription =
    base.seo?.metaDescription ||
    'Shop quality mobile accessories in Pakistan including phone cases, screen protectors, chargers, cables, power banks, earbuds and more.';
  const searchEngineTitle = base.seo?.searchEngineTitle || websiteTitle;
  const searchEngineDescription = base.seo?.searchEngineDescription || metaDescription;
  const ogImageUrl = base.ogImageUrl || base.seo?.ogImageUrl || '';

  base.websiteTitle = websiteTitle;
  base.canonicalUrl = canonicalUrl;
  base.ogImageUrl = ogImageUrl;
  base.seo = {
    ...base.seo,
    websiteTitle,
    searchEngineTitle,
    searchEngineDescription,
    canonicalUrl,
    metaDescription,
    metaTitle: base.seo?.metaTitle || websiteTitle,
    logoUrl: base.seo?.logoUrl || base.logoUrl || '',
    faviconUrl: base.seo?.faviconUrl || base.faviconUrl || '/favicon.ico',
    ogImageUrl,
  };

  // Currency migrations
  if (!base.currency || base.currency === 'USD') {
    base.currency = 'PKR';
    base.currencySymbol = 'Rs.';
    base.freeShippingThreshold = base.freeShippingThreshold && base.freeShippingThreshold > 500 ? base.freeShippingThreshold : 5000;
    base.standardShippingFee = base.standardShippingFee && base.standardShippingFee >= 50 ? base.standardShippingFee : 200;
    base.expressShippingFee = base.expressShippingFee && base.expressShippingFee >= 100 ? base.expressShippingFee : 450;
  }

  // Address/phone/email migrations
  if (!base.phone || base.phone.includes('+1') || base.phone.includes('+92 300 1234567')) {
    base.phone = '+92 343 2200995';
  }
  if (!base.whatsapp || base.whatsapp.includes('923001234567')) {
    base.whatsapp = '+923432200995';
  }
  if (!base.email || base.email.includes('alhamd-accessories.com') || base.email.includes('example.com')) {
    base.email = 'support@alhamd-mobile.com';
  }
  if (
    !base.address ||
    base.address.includes('New York') ||
    base.address.includes('Lahore') ||
    base.address.includes('MM Alam') ||
    base.address.includes('Commercial Plaza') ||
    base.address.includes('Gulberg')
  ) {
    base.address = 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan';
  }
  if (
    !base.footerDescription ||
    base.footerDescription.includes('premier destination for high-performance') ||
    base.footerDescription.includes('military-grade')
  ) {
    base.footerDescription =
      'Quality mobile accessories, chargers, cables, cases, audio products and everyday smartphone essentials, serving customers across Pakistan.';
  }

  // Normalize social links with individual active/inactive statuses
  base.socialLinks = normalizeSocialLinks(base.socialLinks);

  return base;
}

let isSyncingStoreSettings = false;

export async function syncStoreSettingsFromApi(): Promise<StoreSettings> {
  if (typeof window === 'undefined') return getStoreSettings();
  if (isSyncingStoreSettings) return getStoreSettings();
  isSyncingStoreSettings = true;
  try {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.settings) {
        const current = getStoreSettings();
        const merged: StoreSettings = {
          ...current,
          ...data.settings,
          websiteTitle: data.settings.websiteTitle || data.settings.seo?.websiteTitle || current.websiteTitle,
          canonicalUrl: normalizeCanonicalUrl(data.settings.canonicalUrl || data.settings.seo?.canonicalUrl || current.canonicalUrl),
          ogImageUrl: data.settings.ogImageUrl || data.settings.seo?.ogImageUrl || current.ogImageUrl,
          seo: {
            ...current.seo,
            ...(data.settings.seo || {}),
          },
        };
        setLocal(SETTINGS_KEY, merged);
        window.dispatchEvent(new CustomEvent('alhamd:data-updated', { detail: { key: SETTINGS_KEY } }));
        return merged;
      }
    }
  } catch (err) {
    console.warn('API error syncing store settings:', err);
  } finally {
    isSyncingStoreSettings = false;
  }
  return getStoreSettings();
}

export async function updateStoreSettings(
  settings: Partial<StoreSettings>,
  adminEmail = 'admin@alhamd.com'
): Promise<StoreSettings> {
  const current = getStoreSettings();
  const updated: StoreSettings = {
    ...current,
    ...settings,
    websiteTitle: settings.websiteTitle !== undefined ? settings.websiteTitle : (settings.seo?.websiteTitle !== undefined ? settings.seo.websiteTitle : current.websiteTitle),
    canonicalUrl: settings.canonicalUrl !== undefined ? normalizeCanonicalUrl(settings.canonicalUrl) : (settings.seo?.canonicalUrl !== undefined ? normalizeCanonicalUrl(settings.seo.canonicalUrl) : current.canonicalUrl),
    ogImageUrl: settings.ogImageUrl !== undefined ? settings.ogImageUrl : (settings.seo?.ogImageUrl !== undefined ? settings.seo.ogImageUrl : current.ogImageUrl),
    seo: {
      ...current.seo,
      ...(settings.seo || {}),
    },
    socialLinks: settings.socialLinks ? normalizeSocialLinks({ ...current.socialLinks, ...settings.socialLinks }) : current.socialLinks,
  };

  // Keep seo mirror properties aligned
  if (updated.seo) {
    if (settings.websiteTitle) updated.seo.websiteTitle = settings.websiteTitle;
    if (settings.canonicalUrl) updated.seo.canonicalUrl = normalizeCanonicalUrl(settings.canonicalUrl);
    if (settings.ogImageUrl !== undefined) updated.seo.ogImageUrl = settings.ogImageUrl;
    if (settings.logoUrl !== undefined) updated.seo.logoUrl = settings.logoUrl;
    if (settings.faviconUrl !== undefined) updated.seo.faviconUrl = settings.faviconUrl;
  }

  setLocal(SETTINGS_KEY, updated);

  // Sync to server storage and database via API
  if (typeof window !== 'undefined') {
    fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
  }

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
    } catch (e) {
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

  return updated;
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
