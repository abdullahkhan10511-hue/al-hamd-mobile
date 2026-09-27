import { Brand } from '@/types/admin';
import { seedBrands } from './seed';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';

const COLLECTION_KEY = 'brands';

let hasSyncedBrandsFromApi = false;
export async function syncBrandsFromApi(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/brands', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.brands) && data.brands.length > 0) {
        await persistCollection(COLLECTION_KEY, data.brands);
        window.dispatchEvent(
          new CustomEvent('alhamd:data-updated', {
            detail: { key: COLLECTION_KEY, value: data.brands },
          })
        );
      }
    }
  } catch {}
}

export function getBrands(): Brand[] {
  if (typeof window !== 'undefined' && !hasSyncedBrandsFromApi) {
    hasSyncedBrandsFromApi = true;
    syncBrandsFromApi().catch(() => {});
  }
  return getStoredCollection(COLLECTION_KEY, seedBrands);
}

export async function createBrand(
  data: Omit<Brand, 'id'>,
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; brand?: Brand; error?: string }> {
  const brands = getBrands();
  const slug = data.slug.trim().toLowerCase().replace(/\s+/g, '-');

  if (brands.some((b) => b.slug.toLowerCase() === slug)) {
    return { success: false, error: `Brand slug "${slug}" already exists.` };
  }

  const newBrand: Brand = {
    ...data,
    id: `brand-${Date.now()}`,
    slug,
    status: data.status || 'active',
  };

  const updated = [...brands, newBrand];
  await persistCollection(COLLECTION_KEY, updated);

  if (typeof window !== 'undefined') {
    fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBrand),
    }).catch(() => {});
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

  const updated = {
    ...brands[index],
    ...updates,
  };

  brands[index] = updated;
  await persistCollection(COLLECTION_KEY, brands);

  if (typeof window !== 'undefined') {
    fetch(`/api/brands/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});
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

  const filtered = brands.filter((b) => b.id !== id);
  await persistCollection(COLLECTION_KEY, filtered);

  if (typeof window !== 'undefined') {
    fetch(`/api/brands/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
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
