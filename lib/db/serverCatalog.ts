import 'server-only';
import { isDbConfigured } from './mysql';
import {
  getProductBySlugFromDb,
  getStorefrontProductsFromDb,
} from './repositories/products';
import {
  getAllCategoriesFromDb,
  getCategoryBySlugFromDb,
} from './repositories/categories';
import {
  getAllBrandsFromDb,
  getBrandBySlugFromDb,
} from './repositories/brands';
import { getServerProducts as getProducts } from './productsServer';
import { getServerActiveCategories as getActiveCategories } from './categoriesServer';
import { getServerActiveBrands as getActiveBrands } from './brandsServer';
import { Product, Category } from '@/types';
import { Brand } from '@/types/admin';
import { getVerifiedReviewStats, isStorefrontVisibleProduct } from '@/lib/utils';

/**
 * Projects a product down to minimal fields required by ProductCard
 * to keep HTML and RSC transfer payloads small.
 */
export function projectMinimalCardProduct(p: Product): Product {
  const verifiedStats = getVerifiedReviewStats(p);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    brandId: p.brandId,
    brandSlug: p.brandSlug,
    category: p.category,
    categorySlug: p.categorySlug,
    price: Number(p.price) || 0,
    compareAtPrice: p.compareAtPrice !== undefined ? Number(p.compareAtPrice) : undefined,
    discountPercentage: p.discountPercentage,
    rating: Number(p.rating) || 0,
    reviewCount: Number(p.reviewCount) || 0,
    approvedReviewCount: verifiedStats.count,
    approvedRating: verifiedStats.rating,
    images: Array.isArray(p.images) ? p.images.slice(0, 2) : [],
    stock: Number(p.stock) || 0,
    shopStock: Number((p as any).shopStock) || 0,
    isNew: Boolean(p.isNew),
    isNewArrival: Boolean((p as any).isNewArrival),
    isBestSeller: Boolean(p.isBestSeller),
    isSale: Boolean(p.isSale),
    featured: Boolean(p.featured),
    trending: Boolean((p as any).trending),
    status: p.status,
    isActive: (p as any).isActive !== false,
    createdAt: (p as any).createdAt,
    description: '',
  } as Product;
}

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
    if (found && isStorefrontVisibleProduct(found)) {
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

  if (isDbConfigured()) {
    try {
      const res = await getStorefrontProductsFromDb({ category: cleanCat, limit: limit + 2, minimal: true });
      const filtered = res.products
        .filter((p) => p.id !== currentProductId && isStorefrontVisibleProduct(p))
        .slice(0, limit);
      if (filtered.length > 0) {
        return filtered.map(projectMinimalCardProduct);
      }
    } catch (err) {
      console.error('[serverCatalog] DB getServerRelatedProducts error:', err);
    }
  }

  let all: Product[] = [];
  try {
    all = getProducts();
  } catch (err) {
    console.error('[serverCatalog] Local getProducts in getServerRelatedProducts error:', err);
  }

  return all
    .filter(
      (p) =>
        isStorefrontVisibleProduct(p) &&
        p.id !== currentProductId &&
        p.categorySlug?.toLowerCase() === cleanCat
    )
    .slice(0, limit)
    .map(projectMinimalCardProduct);
}

/**
 * Server-side best sellers fetcher for Homepage SSR.
 * Returns strictly admin-flagged best sellers (isBestSeller = true), excluding any IDs in excludeIds.
 * Never falls back to random/newest/top-rated items when none are flagged.
 */
export async function getServerBestSellers(limit = 8, excludeIds: string[] = []): Promise<Product[]> {
  const excludeSet = new Set(excludeIds);
  if (isDbConfigured()) {
    try {
      const fetchLimit = Math.min(60, limit + excludeIds.length + 4);
      const res = await getStorefrontProductsFromDb({ isBestSeller: true, limit: fetchLimit, minimal: true });
      const filtered = res.products.filter(
        (p) => isStorefrontVisibleProduct(p) && Boolean(p.isBestSeller) && !excludeSet.has(p.id)
      );
      return filtered.slice(0, limit).map(projectMinimalCardProduct);
    } catch (err) {
      console.error('[serverCatalog] DB getServerBestSellers error:', err);
    }
  }
  const all = getProducts();
  return all
    .filter(
      (p) =>
        isStorefrontVisibleProduct(p) &&
        Boolean(p.isBestSeller) &&
        !excludeSet.has(p.id)
    )
    .slice(0, limit)
    .map(projectMinimalCardProduct);
}

/**
 * Server-side new arrivals fetcher for Homepage SSR.
 * Returns strictly admin-flagged new arrivals (isNewArrival = true), sorted by newest first.
 * Never falls back to unflagged products or seed lists.
 */
export async function getServerNewArrivals(limit = 8): Promise<Product[]> {
  if (isDbConfigured()) {
    try {
      const res = await getStorefrontProductsFromDb({ isNewArrival: true, limit, minimal: true });
      const filtered = res.products.filter(
        (p) => isStorefrontVisibleProduct(p) && Boolean((p as any).isNewArrival)
      );
      return filtered.slice(0, limit).map(projectMinimalCardProduct);
    } catch (err) {
      console.error('[serverCatalog] DB getServerNewArrivals error:', err);
    }
  }
  const all = getProducts()
    .filter((p) => isStorefrontVisibleProduct(p) && Boolean((p as any).isNewArrival))
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const tA = (a.item as any).createdAt ? new Date((a.item as any).createdAt).getTime() : 0;
      const tB = (b.item as any).createdAt ? new Date((b.item as any).createdAt).getTime() : 0;
      if (!Number.isNaN(tB) && !Number.isNaN(tA) && tB !== tA) {
        return tB - tA;
      }
      return a.idx - b.idx;
    })
    .map(({ item }) => item);

  return all.slice(0, limit).map(projectMinimalCardProduct);
}

/**
 * Server-side all-products fetcher for Homepage initial render.
 * Excludes products already shown in New Arrivals or Best Sellers.
 */
export async function getServerHomepageProducts(
  limit = 8,
  excludeIds: string[] = []
): Promise<{ products: Product[]; total: number }> {
  const excludeSet = new Set(excludeIds);
  if (isDbConfigured()) {
    try {
      const fetchLimit = Math.min(60, limit + excludeIds.length + 8);
      const res = await getStorefrontProductsFromDb({ limit: fetchLimit, page: 1, minimal: true });
      const eligible = res.products.filter((p) => isStorefrontVisibleProduct(p) && !excludeSet.has(p.id));
      return {
        products: eligible.slice(0, limit).map(projectMinimalCardProduct),
        total: Math.max(eligible.length, res.total - excludeIds.length),
      };
    } catch (err) {
      console.error('[serverCatalog] DB getServerHomepageProducts error:', err);
    }
  }
  const all = getProducts().filter((p) => isStorefrontVisibleProduct(p) && !excludeSet.has(p.id));
  return {
    products: all.slice(0, limit).map(projectMinimalCardProduct),
    total: all.length,
  };
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
    } catch { }
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
  category: Category,
  limit = 16
): Promise<{ products: Product[]; total: number }> {
  const targetSlug = (category.slug || category.id || '').trim().toLowerCase();

  if (isDbConfigured()) {
    try {
      const res = await getStorefrontProductsFromDb({ category: targetSlug, limit, page: 1, minimal: true });
      if (res.products.length > 0 || res.total > 0) {
        return {
          products: res.products.map(projectMinimalCardProduct),
          total: res.total,
        };
      }
    } catch (err) {
      console.error(`[serverCatalog] DB getServerCategoryProducts error for "${targetSlug}":`, err);
    }
  }

  let allProds: Product[] = [];
  try {
    allProds = getProducts();
  } catch (err) {
    console.error('[serverCatalog] Local getProducts in getServerCategoryProducts error:', err);
  }

  const targetName = (category.name || '').trim().toLowerCase();
  const targetId = (category.id || '').trim().toLowerCase();

  const filtered = allProds.filter((p) => {
    if (!isStorefrontVisibleProduct(p)) {
      return false;
    }

    const pCat = (p.category || '').trim().toLowerCase();
    const pCatSlug = (p.categorySlug || '').trim().toLowerCase();
    const pCatId = ((p as any).categoryId || '').toString().trim().toLowerCase();

    return (
      pCat === targetName ||
      pCat === targetSlug ||
      pCatSlug === targetSlug ||
      pCatSlug === targetName ||
      (targetId && pCatId === targetId)
    );
  });

  return {
    products: filtered.slice(0, limit).map(projectMinimalCardProduct),
    total: filtered.length,
  };
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
    } catch { }
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
export async function getServerBrandProducts(
  brand: Brand,
  limit = 16
): Promise<{ products: Product[]; total: number }> {
  const targetSlug = (brand.slug || brand.id || '').trim().toLowerCase();

  if (isDbConfigured()) {
    try {
      const res = await getStorefrontProductsFromDb({ brand: targetSlug, limit, page: 1, minimal: true });
      if (res.products.length > 0 || res.total > 0) {
        return {
          products: res.products.map(projectMinimalCardProduct),
          total: res.total,
        };
      }
    } catch (err) {
      console.error(`[serverCatalog] DB getServerBrandProducts error for "${targetSlug}":`, err);
    }
  }

  let allProds: Product[] = [];
  try {
    allProds = getProducts();
  } catch (err) {
    console.error('[serverCatalog] Local getProducts in getServerBrandProducts error:', err);
  }

  const targetName = (brand.name || '').trim().toLowerCase();
  const targetId = (brand.id || '').trim().toLowerCase();

  const filtered = allProds.filter((p) => {
    if (!isStorefrontVisibleProduct(p)) {
      return false;
    }

    const pBrand = (p.brand || '').trim().toLowerCase();
    const pBrandSlug = (p.brandSlug || '').trim().toLowerCase();
    const pBrandId = ((p as any).brandId || '').toString().trim().toLowerCase();

    return (
      pBrand === targetName ||
      pBrand === targetSlug ||
      pBrandSlug === targetSlug ||
      pBrandSlug === targetName ||
      (targetId && pBrandId === targetId)
    );
  });

  return {
    products: filtered.slice(0, limit).map(projectMinimalCardProduct),
    total: filtered.length,
  };
}

/**
 * Fetch all categories for filter options on the server.
 */
export async function getServerAllCategories(): Promise<Category[]> {
  if (isDbConfigured()) {
    try {
      const cats = await getAllCategoriesFromDb();
      return cats.filter((c) => {
        if (!c || (c as any).isActive === false) return false;
        const st = typeof c.status === 'string' ? c.status.trim().toLowerCase() : 'active';
        return st !== 'inactive' && st !== 'archived';
      });
    } catch (err) {
      console.error('[serverCatalog] DB getAllCategories error:', err);
      if (process.env.NODE_ENV === 'production') {
        return [];
      }
    }
  }
  return getActiveCategories();
}

/**
 * Fetch all brands for storefront display and filter options on the server.
 */
export async function getServerAllBrands(activeOnly = true): Promise<Brand[]> {
  if (isDbConfigured()) {
    try {
      const brands = await getAllBrandsFromDb(activeOnly);
      if (brands.length > 0) {
        return activeOnly ? brands.filter((b) => b.status === 'active') : brands;
      }
    } catch (err) {
      console.error('[serverCatalog] DB getAllBrands error:', err);
    }
  }
  const fallback = getActiveBrands();
  return activeOnly ? fallback.filter((b) => b.status === 'active') : fallback;
}
