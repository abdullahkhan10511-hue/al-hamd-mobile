import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAllProductsFromDb,
  getProductBySlugFromDb,
  getProductByIdFromDb,
} from '@/lib/db/repositories/products';
import { allowDevMockFallback } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');
    const limitParam = searchParams.get('limit');
    const pageParam = searchParams.get('page');

    let products: any[] = [];

    if (isDbConfigured()) {
      try {
        if (slug) {
          const item = await getProductBySlugFromDb(slug);
          products = item ? [item] : [];
        } else if (id) {
          const item = await getProductByIdFromDb(id);
          products = item ? [item] : [];
        } else {
          products = await getAllProductsFromDb();
        }
      } catch (err: any) {
        console.error('MySQL error in /api/products:', err);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch products from database.' },
          { status: 500 }
        );
      }
    } else {
      if (process.env.NODE_ENV === 'production' || !allowDevMockFallback()) {
        return NextResponse.json(
          { success: false, error: 'Database is not configured in production.' },
          { status: 503 }
        );
      }
      // Strictly local development offline testing - dynamic import isolated from production
      const { getDevProducts } = await import('@/lib/db/serverDevStorage');
      products = getDevProducts();
      if (slug) {
        products = products.filter((p) => p.slug === slug);
      } else if (id) {
        products = products.filter((p) => p.id === id);
      }
    }

    const brand = searchParams.get('brand');

    if (category) {
      const catClean = category.trim().toLowerCase();
      products = products.filter(
        (p) => p.categorySlug?.toLowerCase() === catClean || p.category?.toLowerCase() === catClean
      );
    }

    if (brand) {
      const brandClean = brand.trim().toLowerCase();
      products = products.filter(
        (p) =>
          p.brandSlug?.toLowerCase() === brandClean ||
          p.brand?.toLowerCase() === brandClean ||
          (p.brandId && p.brandId.toLowerCase() === brandClean)
      );
    }

    if (search) {
      const q = search.trim().toLowerCase();
      products = products.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    const totalCount = products.length;

    // Optional Bounded Pagination:
    // If 'limit' or 'page' is explicitly requested, enforce pagination bounds (1 to 200 items per page).
    // If 'limit' is omitted, return complete catalogue for backward compatibility with storefront sync routines.
    let paginatedProducts = products;
    let page = 1;
    let limit = totalCount;
    let totalPages = 1;
    let isPaginated = false;

    if (limitParam !== null || pageParam !== null) {
      isPaginated = true;
      const parsedLimit = parseInt(limitParam || '50', 10);
      limit = Math.max(1, Math.min(isNaN(parsedLimit) ? 50 : parsedLimit, 200));

      const parsedPage = parseInt(pageParam || '1', 10);
      page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage);

      totalPages = Math.max(1, Math.ceil(totalCount / limit));
      const startIndex = (page - 1) * limit;
      paginatedProducts = products.slice(startIndex, startIndex + limit);
    }

    const isFresh = searchParams.get('fresh') === 'true' || searchParams.has('t');
    const cacheControl = isFresh
      ? 'no-cache, no-store, must-revalidate, max-age=0'
      : 'no-cache, no-store, must-revalidate, max-age=0';

    return NextResponse.json(
      {
        success: true,
        count: paginatedProducts.length,
        total: totalCount,
        ...(isPaginated ? { page, limit, totalPages } : {}),
        products: paginatedProducts,
      },
      {
        headers: {
          'Cache-Control': cacheControl,
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/products error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
