import { isDbConfigured } from './mysql';
import {
  getProductBySlugFromDb,
  getAllProductsFromDb,
} from './repositories/products';
import {
  getAllCategoriesFromDb,
  getCategoryBySlugFromDb,
} from './repositories/categories';
import {
  getAllBrandsFromDb,
  getBrandBySlugFromDb,
} from './repositories/brands';
import { getProducts } from './products';
import { getActiveCategories } from './categories';
import { getActiveBrands } from './brands';
import { Product, Category } from '@/types';
import { Brand } from '@/types/admin';

/**
 * Server-side product fetcher for SSR and generateMetadata.
 * Safely accesses MySQL if configured, or falls back to local data.
 */
export async function getServerProductBySlug(
  rawSlug: string
): Promise<Product | null> {
  const cleanSlug = decodeURIComponent(rawSlug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  if (!cleanSlug) return null;

  if (isDbConfigured()) {
    try {
      const dbProd = await getProductBySlugFromDb(cleanSlug);
      if (dbProd && (dbProd as any).status !== 'archived' && (dbProd as any).isActive !== false) {
        return dbProd;
      }
    } catch (err) {
      console.warn(`[serverCatalog] DB getProductBySlug error for "${cleanSlug}":`, err);
    }
  }

  // Fallback to memory / local data store
  try {
    const prods = getProducts();
    const found = prods.find(
      (p) =>
        p.slug?.toLowerCase() === cleanSlug ||
        p.id?.toLowerCase() === cleanSlug
    );
    if (found && (found as any).status !== 'archived' && (found as any).isActive !== false) {
      return found;
    }
  } catch (err) {
    console.warn(`[serverCatalog] Local getProducts fallback error for "${cleanSlug}":`, err);
  }

  return null;
}

/**
 * Server-side related products fetcher for SSR.
 */
export async function getServerRelatedProducts(
  categorySlug: string,
  currentProductId: string,
  limit = 4
): Promise<Product[]> {
  const cleanCat = (categorySlug || '').trim().toLowerCase();
  let all: Product[] = [];

  if (isDbConfigured()) {
    try {
      const dbProds = await getAllProductsFromDb();
      all = dbProds;
    } catch {}
  }

  if (all.length === 0) {
    try {
      all = getProducts();
    } catch {}
  }

  return all
    .filter(
      (p) =>
        (p as any).status !== 'archived' &&
        (p as any).status !== 'inactive' &&
        (p as any).isActive !== false &&
        p.id !== currentProductId &&
        p.categorySlug?.toLowerCase() === cleanCat
    )
    .slice(0, limit);
}

/**
 * Server-side category fetcher for SSR and generateMetadata.
 */
export async function getServerCategoryBySlug(
  rawSlug: string
): Promise<Category | null> {
  const cleanSlug = decodeURIComponent(rawSlug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  if (!cleanSlug) return null;

  if (isDbConfigured()) {
    try {
      const dbCat = await getCategoryBySlugFromDb(cleanSlug);
      if (dbCat && dbCat.status !== 'archived' && (dbCat as any).isActive !== false) {
        return dbCat;
      }
    } catch (err) {
      console.warn(`[serverCatalog] DB getCategoryBySlug error:`, err);
    }
  }

  let allCats: Category[] = [];

  if (isDbConfigured()) {
    try {
      allCats = await getAllCategoriesFromDb();
    } catch (err) {
      console.warn(`[serverCatalog] DB getAllCategories error:`, err);
    }
  }

  if (allCats.length === 0) {
    try {
      allCats = getActiveCategories();
    } catch {}
  }

  const found = allCats.find((c) => {
    const slug = (c.slug || '').trim().toLowerCase();
    const name = (c.name || '').trim().toLowerCase();
    const id = (c.id || '').trim().toLowerCase();
    const slugifiedName = name.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    return (
      slug === cleanSlug ||
      name === cleanSlug ||
      id === cleanSlug ||
      slugifiedName === cleanSlug
    );
  });

  return found || null;
}

/**
 * Server-side category products fetcher for SSR.
 */
export async function getServerCategoryProducts(
  category: Category
): Promise<Product[]> {
  let allProds: Product[] = [];

  if (isDbConfigured()) {
    try {
      allProds = await getAllProductsFromDb();
    } catch {}
  }

  if (allProds.length === 0) {
    try {
      allProds = getProducts();
    } catch {}
  }

  const targetName = (category.name || '').trim().toLowerCase();
  const targetSlug = (category.slug || '').trim().toLowerCase();
  const targetId = (category.id || '').trim().toLowerCase();
  const targetSlugifiedName = targetName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return allProds.filter((p) => {
    if ((p as any).status === 'archived' || (p as any).status === 'inactive' || (p as any).isActive === false) {
      return false;
    }

    const pCat = (p.category || '').trim().toLowerCase();
    const pCatSlug = (p.categorySlug || '').trim().toLowerCase();
    const pCatId = ((p as any).categoryId || '').toString().trim().toLowerCase();
    const pCatSlugified = pCat.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    return (
      (pCat && (pCat === targetName || pCat === targetSlug || pCatSlugified === targetSlug || pCatSlugified === targetSlugifiedName)) ||
      (pCatSlug && (pCatSlug === targetSlug || pCatSlug === targetName || pCatSlug === targetSlugifiedName)) ||
      (targetId && pCatId && pCatId === targetId) ||
      (targetId && pCat && pCat === targetId)
    );
  });
}

/**
 * Server-side brand fetcher for SSR and generateMetadata.
 */
export async function getServerBrandBySlug(
  rawSlug: string
): Promise<Brand | null> {
  const cleanSlug = decodeURIComponent(rawSlug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  if (!cleanSlug) return null;

  if (isDbConfigured()) {
    try {
      const dbBrand = await getBrandBySlugFromDb(cleanSlug);
      if (dbBrand && dbBrand.status !== 'inactive') {
        return dbBrand;
      }
    } catch (err) {
      console.warn(`[serverCatalog] DB getBrandBySlug error:`, err);
    }
  }

  let allBrands: Brand[] = [];

  if (isDbConfigured()) {
    try {
      allBrands = await getAllBrandsFromDb(false);
    } catch (err) {
      console.warn(`[serverCatalog] DB getAllBrands error:`, err);
    }
  }

  if (allBrands.length === 0) {
    try {
      allBrands = getActiveBrands();
    } catch {}
  }

  const found = allBrands.find((b) => {
    const slug = (b.slug || '').trim().toLowerCase();
    const name = (b.name || '').trim().toLowerCase();
    const id = (b.id || '').trim().toLowerCase();
    const slugifiedName = name.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    return (
      slug === cleanSlug ||
      name === cleanSlug ||
      id === cleanSlug ||
      slugifiedName === cleanSlug
    );
  });

  return found || null;
}

/**
 * Server-side brand products fetcher for SSR.
 */
export async function getServerBrandProducts(brand: Brand): Promise<Product[]> {
  let allProds: Product[] = [];

  if (isDbConfigured()) {
    try {
      allProds = await getAllProductsFromDb();
    } catch {}
  }

  if (allProds.length === 0) {
    try {
      allProds = getProducts();
    } catch {}
  }

  const targetName = (brand.name || '').trim().toLowerCase();
  const targetSlug = (brand.slug || '').trim().toLowerCase();
  const targetId = (brand.id || '').trim().toLowerCase();
  const targetSlugifiedName = targetName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return allProds.filter((p) => {
    if ((p as any).status === 'archived' || (p as any).status === 'inactive' || (p as any).isActive === false) {
      return false;
    }

    const pBrand = (p.brand || '').trim().toLowerCase();
    const pBrandSlug = (p.brandSlug || '').trim().toLowerCase();
    const pBrandId = ((p as any).brandId || '').toString().trim().toLowerCase();
    const pBrandSlugified = pBrand.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    return (
      (pBrand && (pBrand === targetName || pBrand === targetSlug || pBrandSlugified === targetSlug || pBrandSlugified === targetSlugifiedName)) ||
      (pBrandSlug && (pBrandSlug === targetSlug || pBrandSlug === targetName || pBrandSlug === targetSlugifiedName)) ||
      (targetId && pBrandId && pBrandId === targetId) ||
      (targetId && pBrand && pBrand === targetId)
    );
  });
}

/**
 * Fetch all categories for filter options on the server.
 */
export async function getServerAllCategories(): Promise<Category[]> {
  if (isDbConfigured()) {
    try {
      const cats = await getAllCategoriesFromDb();
      if (cats.length > 0) return cats;
    } catch {}
  }
  return getActiveCategories();
}

/**
 * Fetch all brands for filter options on the server.
 */
export async function getServerAllBrands(): Promise<Brand[]> {
  if (isDbConfigured()) {
    try {
      const brands = await getAllBrandsFromDb(false);
      if (brands.length > 0) return brands;
    } catch {}
  }
  return getActiveBrands();
}
