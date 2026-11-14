import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAllProductsFromDb,
  getStorefrontProductsFromDb,
  getProductBySlugFromDb,
  getProductByIdFromDb,
} from '@/lib/db/repositories/products';
import { getAdminSessionAsync } from '@/lib/db/adminAuth';
import { sanitizeProductsForSession, sanitizeProductsForPublic } from '@/lib/productSanitizer';
import { getCustomerSession } from '@/lib/db/customerSession';
import { allowDevMockFallback } from '@/lib/env';
import { getPublicCacheHeaders } from '@/lib/cacheControl';
import { getVerifiedReviewStats, isStorefrontVisibleProduct } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const search = searchParams.get('search') || searchParams.get('q');
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');
    const idsParam = searchParams.get('ids');
    const limitParam = searchParams.get('limit');
    const pageParam = searchParams.get('page');
    const sortBy = searchParams.get('sortBy') || searchParams.get('sort') || 'featured';
    const inStockOnly = searchParams.get('inStock') === 'true' || searchParams.get('inStockOnly') === 'true';
    const minPriceParam = searchParams.get('minPrice') || searchParams.get('min_price');
    const maxPriceParam = searchParams.get('maxPrice') || searchParams.get('max_price');
    const minPrice = minPriceParam ? parseFloat(minPriceParam) : undefined;
    const maxPrice = maxPriceParam ? parseFloat(maxPriceParam) : undefined;
    const minimal = searchParams.get('minimal') === 'true';

    // Parse requested IDs (up to 50 items for cart and wishlist)
    const idsList = idsParam
      ? idsParam
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean)
          .slice(0, 50)
      : undefined;

    // Check if request is authenticated as an admin or verified customer
    const adminSession = await getAdminSessionAsync(request);
    const isAdmin = Boolean(adminSession);
    const customerSession = !isAdmin ? await getCustomerSession(request) : null;
    const customerTier = customerSession?.customerType || 'RETAIL';

    const sanitizeList = (prods: any[]) => {
      if (isAdmin) {
        return sanitizeProductsForSession(prods, adminSession);
      }
      return sanitizeProductsForPublic(prods, customerTier);
    };

    // Single item by slug lookup
    if (slug) {
      const cleanSlug = slug.trim().toLowerCase();
      let product: any = null;
      if (isDbConfigured()) {
        product = await getProductBySlugFromDb(cleanSlug);
      } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
        const { getDevProducts } = await import('@/lib/db/serverDevStorage');
        const devProds = getDevProducts();
        product = devProds.find((p) => p.slug?.toLowerCase() === cleanSlug || p.id === cleanSlug) || null;
      }
      const products = product ? sanitizeList([product]) : [];
      return NextResponse.json(
        {
          success: true,
          count: products.length,
          total: products.length,
          products,
        },
        { headers: getPublicCacheHeaders(request) }
      );
    }

    // Single item by ID lookup
    if (id) {
      const cleanId = id.trim();
      let product: any = null;
      if (isDbConfigured()) {
        product = await getProductByIdFromDb(cleanId);
      } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
        const { getDevProducts } = await import('@/lib/db/serverDevStorage');
        const devProds = getDevProducts();
        product = devProds.find((p) => p.id === cleanId) || null;
      }
      const products = product ? sanitizeList([product]) : [];
      return NextResponse.json(
        {
          success: true,
          count: products.length,
          total: products.length,
          products,
        },
        { headers: getPublicCacheHeaders(request) }
      );
    }

    // Full Unpaginated Catalogue: Strictly restricted to Authenticated Admin Requests
    // Public requests can NEVER request unpaginated catalogue
    if (isAdmin && limitParam === null && !category && !brand && !search && !idsList) {
      let rawProducts: any[] = [];
      if (isDbConfigured()) {
        rawProducts = await getAllProductsFromDb();
      } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
        const { getDevProducts } = await import('@/lib/db/serverDevStorage');
        rawProducts = getDevProducts();
      }
      const sanitized = sanitizeProductsForSession(rawProducts, adminSession);
      return NextResponse.json(
        {
          success: true,
          count: sanitized.length,
          total: sanitized.length,
          products: sanitized,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Pagination calculations:
    // Public default: 24 items per page.
    // Public maximum: capped at 60 items per page (Admin with explicit limit can request up to 500).
    const parsedLimit = limitParam !== null ? parseInt(limitParam, 10) : 24;
    const maxAllowedLimit = isAdmin ? 500 : 60;
    const limit = Math.max(1, Math.min(isNaN(parsedLimit) ? 24 : parsedLimit, maxAllowedLimit));

    const parsedPage = parseInt(pageParam || '1', 10);
    const page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage);

    // If search term is provided but shorter than 2 chars, return empty results
    if (search && search.trim().length < 2) {
      return NextResponse.json(
        {
          success: true,
          count: 0,
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasMore: false,
          products: [],
        },
        { headers: getPublicCacheHeaders(request) }
      );
    }

    // Database configured: Use high-efficiency SQL pagination, filtering and sorting
    if (isDbConfigured()) {
      const result = await getStorefrontProductsFromDb({
        category: category || undefined,
        brand: brand || undefined,
        search: search || undefined,
        ids: idsList,
        page,
        limit,
        sortBy,
        inStockOnly,
        minPrice: minPrice && !isNaN(minPrice) ? minPrice : undefined,
        maxPrice: maxPrice && !isNaN(maxPrice) ? maxPrice : undefined,
        minimal,
      });

      return NextResponse.json(
        {
          success: true,
          count: result.products.length,
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
          products: sanitizeList(result.products),
        },
        { headers: getPublicCacheHeaders(request) }
      );
    }

    // Offline / Local Development Fallback
    if (process.env.NODE_ENV === 'production' || !allowDevMockFallback()) {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    const { getDevProducts } = await import('@/lib/db/serverDevStorage');
    let devList = getDevProducts()
      .filter(isStorefrontVisibleProduct)
      .map((p) => {
        const stats = getVerifiedReviewStats(p);
        return {
          ...p,
          approvedReviewCount: stats.count,
          approvedRating: stats.rating,
        };
      });

    if (idsList && idsList.length > 0) {
      const idSet = new Set(idsList);
      devList = devList.filter((p) => idSet.has(p.id));
    }

    if (category && category !== 'all') {
      const catClean = category.trim().toLowerCase();
      devList = devList.filter(
        (p) => p.categorySlug?.toLowerCase() === catClean || p.category?.toLowerCase() === catClean
      );
    }

    if (brand && brand !== 'all') {
      const brandClean = brand.trim().toLowerCase();
      devList = devList.filter(
        (p) =>
          p.brandSlug?.toLowerCase() === brandClean ||
          p.brand?.toLowerCase() === brandClean ||
          (p.brandId && p.brandId.toLowerCase() === brandClean)
      );
    }

    if (search) {
      const q = search.trim().toLowerCase();
      devList = devList.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    if (inStockOnly) {
      devList = devList.filter((p) => (p.stock || 0) > 0 || ((p as any).shopStock || 0) > 0);
    }

    // Sorting
    if (sortBy === 'price-asc') {
      devList.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price-desc') {
      devList.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'rating') {
      devList.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else {
      devList.sort((a, b) => new Date((b as any).createdAt || 0).getTime() - new Date((a as any).createdAt || 0).getTime());
    }

    const total = devList.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginatedProducts = devList.slice(startIndex, startIndex + limit);

    return NextResponse.json(
      {
        success: true,
        count: paginatedProducts.length,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
        products: paginatedProducts,
      },
      { headers: getPublicCacheHeaders(request) }
    );
  } catch (err: any) {
    console.error('API /api/products error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
