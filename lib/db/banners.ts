import { Banner } from '@/types/admin';
import { getStoredCollection, persistCollection, getLocal, setLocal } from './storage';
import { seedBanners } from './seed';
import { logActivity } from './activity';

import { allowDevMockFallback } from '../env';

export const BANNERS_STORAGE_KEY = 'homepage_banners';
const DELETED_BANNERS_KEY = 'deleted_banner_ids';

// Ensure migration from old 'banners' key to unified 'homepage_banners'
if (typeof window !== 'undefined') {
  try {
    const oldBannersStr = localStorage.getItem('alhamd_store_banners');
    const newBannersStr = localStorage.getItem('alhamd_store_homepage_banners');
    if (oldBannersStr && !newBannersStr) {
      localStorage.setItem('alhamd_store_homepage_banners', oldBannersStr);
    }
  } catch (e) {
    // ignore
  }
}

export function getDeletedBannerIds(): Set<string> {
  const ids = getLocal<string[]>(DELETED_BANNERS_KEY, []);
  return new Set(Array.isArray(ids) ? ids : []);
}

export function getBanners(): Banner[] {
  const deletedIds = getDeletedBannerIds();
  const fallback = allowDevMockFallback() ? seedBanners : [];
  let data = getStoredCollection<Banner>(BANNERS_STORAGE_KEY, fallback);

  if (allowDevMockFallback()) {
    // Ensure default 3 banners exist if not deleted only during local dev
    let hasMissingSeed = false;
    seedBanners.forEach((seed) => {
      if (!deletedIds.has(seed.id) && !data.some((b) => b.id === seed.id)) {
        data.push({ ...seed });
        hasMissingSeed = true;
      }
    });

    if (hasMissingSeed) {
      persistCollection(BANNERS_STORAGE_KEY, data);
    }
  } else {
    // In production, strictly purge any legacy seed banners
    const cleanBanners = data.filter(
      (b) =>
        b &&
        b.id !== 'banner-1' &&
        b.id !== 'banner-2' &&
        b.id !== 'banner-3' &&
        !(typeof b.image === 'string' && b.image.includes('photo-1556905055-8f358a7a47b2'))
    );
    if (cleanBanners.length !== data.length) {
      data = cleanBanners;
      persistCollection(BANNERS_STORAGE_KEY, data);
    }
  }

  // Filter out any permanently deleted banner IDs
  const filtered = data.filter((b) => !deletedIds.has(b.id));

  return filtered.sort((a: Banner, b: Banner) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export async function getBannerById(id: string): Promise<Banner | null> {
  const banners = getBanners();
  return banners.find((b) => b.id === id) || null;
}

export async function saveBanner(
  banner: Omit<Banner, 'id'> & { id?: string },
  adminEmail: string = 'admin@alhamd.com'
): Promise<Banner> {
  const banners = getBanners();
  const id = banner.id || `banner-${Date.now()}`;
  const existingIndex = banners.findIndex((b) => b.id === id);

  // If restoring or updating a previously deleted banner ID, remove it from blacklist
  const deletedIds = getDeletedBannerIds();
  if (deletedIds.has(id)) {
    deletedIds.delete(id);
    setLocal(DELETED_BANNERS_KEY, Array.from(deletedIds));
  }

  const newBanner: Banner = {
    ...banner,
    id,
    displayOrder: banner.displayOrder ?? banners.length + 1,
    status: banner.status || 'active',
  };

  let updatedList: Banner[];
  if (existingIndex >= 0) {
    updatedList = [...banners];
    updatedList[existingIndex] = newBanner;
    await logActivity({
      adminEmail,
      action: 'UPDATE_BANNER',
      target: newBanner.title,
      details: `Updated promotional banner "${newBanner.title}"`,
    });
  } else {
    updatedList = [...banners, newBanner];
    await logActivity({
      adminEmail,
      action: 'CREATE_BANNER',
      target: newBanner.title,
      details: `Created new promotional banner "${newBanner.title}"`,
    });
  }

  await persistCollection(BANNERS_STORAGE_KEY, updatedList);
  return newBanner;
}

export async function deleteBanner(id: string, adminEmail: string = 'admin@alhamd.com'): Promise<boolean> {
  const banners = getBanners();
  const target = banners.find((b) => b.id === id);
  if (!target) return false;

  // Add to deleted blacklist to guarantee it never resurrects from seed data
  const deletedIds = getDeletedBannerIds();
  deletedIds.add(id);
  setLocal(DELETED_BANNERS_KEY, Array.from(deletedIds));

  const filtered = banners.filter((b) => b.id !== id);
  await persistCollection(BANNERS_STORAGE_KEY, filtered);

  await logActivity({
    adminEmail,
    action: 'DELETE_BANNER',
    target: target.title,
    details: `Permanently deleted promotional banner "${target.title}"`,
  });

  return true;
}

export async function toggleBannerStatus(id: string, adminEmail: string = 'admin@alhamd.com'): Promise<Banner | null> {
  const banner = await getBannerById(id);
  if (!banner) return null;

  const updated = {
    ...banner,
    status: banner.status === 'active' ? 'inactive' : 'active',
  } as Banner;

  return saveBanner(updated, adminEmail);
}
