import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAllProductsFromDb,
  getProductBySlugFromDb,
  getProductByIdFromDb,
} from '@/lib/db/repositories/products';
import { allowDevMockFallback } from '@/lib/env';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');

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

    return NextResponse.json(
      { success: true, count: products.length, products },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
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
