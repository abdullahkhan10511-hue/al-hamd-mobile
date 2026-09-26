import { Brand } from '@/types/admin';
import { seedBrands } from './seed';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';

const COLLECTION_KEY = 'brands';

export function getBrands(): Brand[] {
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

  await logActivity({
    adminEmail,
    action: 'Deleted Brand',
    target: target.name,
  });

  return true;
}
