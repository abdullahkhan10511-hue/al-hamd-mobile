import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllProductsFromDb } from '@/lib/db/repositories/products';
import { seedProducts } from '@/lib/db/seed';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let products: any[] = [];

    if (isDbConfigured()) {
      try {
        products = await getAllProductsFromDb();
      } catch (err: any) {
        console.warn('MySQL error in /api/products, falling back to seed:', err.message);
        products = seedProducts;
      }
    } else {
      products = seedProducts;
    }

    if (category) {
      const catClean = category.trim().toLowerCase();
      products = products.filter(
        (p) => p.categorySlug?.toLowerCase() === catClean || p.category?.toLowerCase() === catClean
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
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
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
