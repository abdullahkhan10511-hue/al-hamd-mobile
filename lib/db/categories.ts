import { Category } from '@/types';
import { categories as initialCategories } from '@/data/categories';
import { getStoredCollection, persistCollection, getLocal, setLocal } from './storage';
import { logActivity } from './activity';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

const COLLECTION_KEY = 'categories';
const DELETED_CATEGORY_SLUGS_KEY = 'deleted_category_slugs';

export function getDeletedCategorySlugs(): Set<string> {
  const slugs = getLocal<string[]>(DELETED_CATEGORY_SLUGS_KEY, []);
  return new Set(Array.isArray(slugs) ? slugs.map((s) => s.toLowerCase()) : []);
}

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function generateCategorySlug(name: string): string {
  return normalizeCategoryName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const LEGACY_UNRELATED_SLUGS = new Set([
  'fashion',
  'beauty',
  'fitness',
  'home-decor',
  'accessories',
  'gaming',
  'kids',
  'vlogging',
  'pos',
  'smart-home',
]);

export function getCategories(): Category[] {
  let list = getStoredCollection(COLLECTION_KEY, initialCategories);
  let modified = false;
  const deletedSlugs = getDeletedCategorySlugs();

  // Filter out legacy non-mobile categories and permanently deleted categories
  const filtered = list.filter(
    (c) => !LEGACY_UNRELATED_SLUGS.has(c.slug.toLowerCase()) && !deletedSlugs.has(c.slug.toLowerCase())
  );
  if (filtered.length !== list.length) {
    list = filtered;
    modified = true;
  }

  if (modified) {
    persistCollection(COLLECTION_KEY, list);
  }

  if (typeof window !== 'undefined' && !hasSyncedCategoriesFromApi) {
    hasSyncedCategoriesFromApi = true;
    syncCategoriesFromApi().catch(() => {});
  }

  return list;
}

let hasSyncedCategoriesFromApi = false;
export async function syncCategoriesFromApi(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/categories', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        await persistCollection(COLLECTION_KEY, data.categories);
        window.dispatchEvent(
          new CustomEvent('alhamd:data-updated', {
            detail: { key: COLLECTION_KEY, value: data.categories },
          })
        );
      }
    }
  } catch {}
}

export function isCategoryActive(c: Category): boolean {
  if (!c) return false;
  if ((c as any).isActive === false) return false;
  if (c.status === 'archived' || c.status === 'inactive') return false;
  return true;
}

export function getActiveCategories(): Category[] {
  return getCategories().filter(isCategoryActive);
}

export function getCategoryById(id: string): Category | undefined {
  return getCategories().find((c) => c.id === id);
}

export function getCategoryBySlug(slug: string): Category | undefined {
  const clean = slug.trim().toLowerCase();
  return getCategories().find((c) => c.slug.toLowerCase() === clean);
}

export async function createCategory(
  data: Omit<Category, 'id'>,
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; category?: Category; error?: string }> {
  try {
    const rawName = data.name ? data.name.trim() : '';
    if (!rawName) {
      return { success: false, error: 'Category name is required.' };
    }

    const cleanName = normalizeCategoryName(rawName);
    const categories = getCategories();

    // Duplicate check on category name (case and whitespace insensitive)
    const duplicateByName = categories.find(
      (c) => normalizeCategoryName(c.name).toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicateByName) {
      return { success: false, error: 'A category with this name already exists.' };
    }

    // Generate or clean slug
    const rawSlug = data.slug && data.slug.trim() ? data.slug.trim() : cleanName;
    const cleanSlug = generateCategorySlug(rawSlug);
    if (!cleanSlug) {
      return { success: false, error: 'A valid slug URL is required.' };
    }

    const duplicateBySlug = categories.find(
      (c) => c.slug.toLowerCase() === cleanSlug.toLowerCase()
    );
    if (duplicateBySlug) {
      return { success: false, error: 'A category with this name already exists.' };
    }

    const newCat: Category = {
      ...data,
      id: `cat-${Date.now()}`,
      name: cleanName,
      slug: cleanSlug,
      status: data.status || 'active',
      productCount: data.productCount || 0,
      image:
        data.image?.trim() ||
        'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=800&auto=format&fit=crop',
    };

    const updated = [...categories, newCat];
    await persistCollection(COLLECTION_KEY, updated);

    if (typeof window !== 'undefined') {
      fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCat),
      }).catch(() => {});
    }

    // Remove from deleted slugs blacklist if previously deleted
    const deletedSlugs = getLocal<string[]>(DELETED_CATEGORY_SLUGS_KEY, []);
    if (deletedSlugs.includes(cleanSlug.toLowerCase())) {
      setLocal(
        DELETED_CATEGORY_SLUGS_KEY,
        deletedSlugs.filter((s) => s.toLowerCase() !== cleanSlug.toLowerCase())
      );
    }

    // Direct Firestore doc sync only if real Firebase credentials exist
    const hasRealFirebase =
      Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key-placeholder';

    if (hasRealFirebase && db && typeof (db as any).type === 'string') {
      try {
        const docRef = doc(db, 'categories', newCat.id);
        await Promise.race([
          setDoc(docRef, newCat, { merge: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500)),
        ]);
      } catch (err) {
        console.warn('Firestore create category notice:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: COLLECTION_KEY, value: updated },
        })
      );
    }

    await logActivity({
      adminEmail,
      action: 'Created Category',
      target: newCat.name,
      details: `Slug: ${newCat.slug}`,
    });

    return { success: true, category: newCat };
  } catch (err: any) {
    console.error('Error creating category:', err);
    return { success: false, error: err?.message || 'Failed to create category.' };
  }
}

export async function updateCategory(
  id: string,
  updates: Partial<Category>,
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  try {
    const categories = getCategories();
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) {
      return { success: false, error: 'Category not found.' };
    }

    const sanitizedUpdates: Partial<Category> = { ...updates };

    if (updates.name !== undefined) {
      const cleanName = normalizeCategoryName(updates.name);
      if (!cleanName) {
        return { success: false, error: 'Category name cannot be empty.' };
      }
      const duplicate = categories.find(
        (c) => c.id !== id && normalizeCategoryName(c.name).toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        return { success: false, error: 'A category with this name already exists.' };
      }
      sanitizedUpdates.name = cleanName;
    }

    if (updates.slug !== undefined) {
      const cleanSlug = generateCategorySlug(updates.slug);
      if (!cleanSlug) {
        return { success: false, error: 'A valid slug URL is required.' };
      }
      const duplicate = categories.find(
        (c) => c.id !== id && c.slug.toLowerCase() === cleanSlug.toLowerCase()
      );
      if (duplicate) {
        return { success: false, error: 'A category with this name already exists.' };
      }
      sanitizedUpdates.slug = cleanSlug;
    }

    const updated = {
      ...categories[index],
      ...sanitizedUpdates,
    };

    categories[index] = updated;
    await persistCollection(COLLECTION_KEY, categories);

    if (typeof window !== 'undefined') {
      try {
        await fetch(`/api/categories/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitizedUpdates),
        });
      } catch (err) {
        console.warn('API error updating category:', err);
      }
    }

    await logActivity({
      adminEmail,
      action: 'Updated Category',
      target: updated.name,
      details: `Updated fields: ${Object.keys(updates).join(', ')}`,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error updating category:', err);
    return { success: false, error: err?.message || 'Failed to update category.' };
  }
}

export async function deleteCategory(id: string, adminEmail = 'admin@alhamd.com'): Promise<boolean> {
  try {
    const categories = getCategories();
    const target = categories.find((c) => c.id === id);
    if (!target) return false;

    const filtered = categories.filter((c) => c.id !== id);
    await persistCollection(COLLECTION_KEY, filtered);

    if (typeof window !== 'undefined') {
      try {
        await fetch(`/api/categories/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.warn('API error deleting category:', err);
      }
    }

    // Blacklist deleted slug so getCategories() seed rehydration never resurrects it
    const deletedSlugs = getLocal<string[]>(DELETED_CATEGORY_SLUGS_KEY, []);
    const targetSlug = target.slug.toLowerCase();
    if (!deletedSlugs.includes(targetSlug)) {
      setLocal(DELETED_CATEGORY_SLUGS_KEY, [...deletedSlugs, targetSlug]);
    }

    // Direct Firestore doc deletion only if real Firebase credentials exist
    const hasRealFirebase =
      Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key-placeholder';

    if (hasRealFirebase && db && typeof (db as any).type === 'string') {
      try {
        const docRef = doc(db, 'categories', id);
        await Promise.race([
          deleteDoc(docRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500)),
        ]);
      } catch (err) {
        console.warn('Firestore delete category notice:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: COLLECTION_KEY, value: filtered },
        })
      );
    }

    await logActivity({
      adminEmail,
      action: 'Deleted Category',
      target: target.name,
    });

    return true;
  } catch (err) {
    console.error('Error deleting category:', err);
    return false;
  }
}

export async function reorderCategories(orderedIds: string[], adminEmail = 'admin@alhamd.com'): Promise<boolean> {
  try {
    const categories = getCategories();
    const map = new Map(categories.map((c) => [c.id, c]));
    const reordered: Category[] = [];

    orderedIds.forEach((id) => {
      const item = map.get(id);
      if (item) {
        reordered.push(item);
        map.delete(id);
      }
    });

    // Append any remainder
    map.forEach((item) => reordered.push(item));

    await persistCollection(COLLECTION_KEY, reordered);

    await logActivity({
      adminEmail,
      action: 'Reordered Categories',
      target: 'Categories list',
    });

    return true;
  } catch (err) {
    console.error('Error reordering categories:', err);
    return false;
  }
}
