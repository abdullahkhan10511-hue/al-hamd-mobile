import { Brand } from '@/types/admin';
import { seedBrands } from './seed';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';
import { allowDevMockFallback } from '../env';

const COLLECTION_KEY = 'brands';

let hasSyncedBrandsFromApi = false;
let isSyncingBrands = false;

export async function syncBrandsFromApi(): Promise<Brand[]> {
  const fallback = allowDevMockFallback() ? seedBrands : [];
  if (typeof window === 'undefined') return fallback;
  if (isSyncingBrands) return getBrands();
  isSyncingBrands = true;
  try {
    const res = await fetch('/api/brands', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.brands)) {
        await persistCollection(COLLECTION_KEY, data.brands);
        hasSyncedBrandsFromApi = true;
        return data.brands;
      }
    }
  } catch (err) {
    console.warn('Could not sync brands from API:', err);
  } finally {
    isSyncingBrands = false;
  }
  return getStoredCollection(COLLECTION_KEY, fallback);
}

export function getBrands(): Brand[] {
  const fallback = allowDevMockFallback() ? seedBrands : [];
  if (typeof window !== 'undefined' && !hasSyncedBrandsFromApi) {
    hasSyncedBrandsFromApi = true;
    syncBrandsFromApi().catch(() => {});
  }
  return getStoredCollection(COLLECTION_KEY, fallback);
}

export function getActiveBrands(): Brand[] {
  return getBrands().filter((b) => b.status === 'active');
}

export function getBrandById(id: string): Brand | undefined {
  const brands = getBrands();
  return brands.find((b) => b.id === id);
}

export function getBrandBySlug(slug: string): Brand | undefined {
  const brands = getBrands();
  const clean = (slug || '').trim().toLowerCase();
  return brands.find(
    (b) =>
      b.slug.toLowerCase() === clean ||
      b.id.toLowerCase() === clean ||
      b.name.toLowerCase() === clean
  );
}

export async function createBrand(
  data: Omit<Brand, 'id'>,
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; brand?: Brand; error?: string }> {
  const brands = getBrands();
  const slug = (data.slug || data.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  if (brands.some((b) => b.slug.toLowerCase() === slug)) {
    return { success: false, error: `Brand slug "${slug}" already exists.` };
  }

  const newBrand: Brand = {
    ...data,
    id: `brand-${Date.now()}`,
    slug,
    status: data.status || 'active',
  };

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBrand),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to create brand in database.' };
      }
      if (json.brand) {
        newBrand.id = json.brand.id || newBrand.id;
      }
    } catch (err: any) {
      console.warn('API error creating brand, persisting locally:', err);
    }
  }

  const updated = [...brands, newBrand];
  await persistCollection(COLLECTION_KEY, updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: updated },
      })
    );
  }

  await logActivity({
    adminEmail,
    action: 'Created Brand',
    target: newBrand.name,
    details: `Slug: ${newBrand.slug}`,
  });

  return { success: true, brand: newBrand };
}

export async function updateBrand(
  id: string,
  updates: Partial<Brand>,
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  const brands = getBrands();
  const index = brands.findIndex((b) => b.id === id);
  if (index === -1) {
    return { success: false, error: 'Brand not found.' };
  }

  const updated: Brand = {
    ...brands[index],
    ...updates,
  };

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to update brand in database.' };
      }
      if (json.brand?.logo) {
        updated.logo = json.brand.logo;
      }
    } catch (err: any) {
      console.warn('API error updating brand:', err);
      return { success: false, error: err?.message || 'Failed to update brand in database.' };
    }
  }

  brands[index] = updated;
  await persistCollection(COLLECTION_KEY, brands);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: brands },
      })
    );
  }

  await logActivity({
    adminEmail,
    action: 'Updated Brand',
    target: updated.name,
  });

  return { success: true };
}

export async function deleteBrand(id: string, adminEmail = 'admin@alhamd.com'): Promise<boolean> {
  const brands = getBrands();
  const target = brands.find((b) => b.id === id);
  if (!target) return false;

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error('API error deleting brand:', json.error);
      }
    } catch (err: any) {
      console.warn('API error deleting brand:', err);
    }
  }

  const filtered = brands.filter((b) => b.id !== id);
  await persistCollection(COLLECTION_KEY, filtered);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: filtered },
      })
    );
  }

  await logActivity({
    adminEmail,
    action: 'Deleted Brand',
    target: target.name,
  });

  return true;
}
