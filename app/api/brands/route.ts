import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllBrandsFromDb, insertBrandToDb } from '@/lib/db/repositories/brands';
import { requireAdmin } from '@/lib/db/requireAdmin';
import { allowDevMockFallback } from '@/lib/env';
import { getPublicCacheHeaders } from '@/lib/cacheControl';
import { serverCache } from '@/lib/cache/memoryCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let brands: any[] = [];

    if (isDbConfigured()) {
      try {
        brands = await getAllBrandsFromDb(activeOnly);
      } catch (err: any) {
        console.error('MySQL error in /api/brands GET:', err);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch brands from database.' },
          { status: 500 }
        );
      }
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevBrands } = await import('@/lib/db/serverDevStorage');
      brands = getDevBrands(activeOnly);
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: true, count: brands.length, brands },
      {
        headers: getPublicCacheHeaders(request),
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['brands.add', 'brands.create', 'brands.manage', 'products.add', 'categories.add']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Brand name is required.' }, { status: 400 });
    }

    let brand: any = null;
    if (isDbConfigured()) {
      brand = await insertBrandToDb(body);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { insertDevBrand } = await import('@/lib/db/serverDevStorage');
      brand = await insertDevBrand(body, session.email);
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    serverCache.invalidate('brands');
    let revalidated = true;
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      revalidatePath('/shop');
      revalidatePath('/brands');
      if (brand?.slug) {
        revalidatePath(`/brand/${brand.slug}`);
      }
      revalidatePath('/api/brands');
      revalidatePath('/admin/brands');
    } catch (revErr) {
      console.warn('Brand revalidation notice:', revErr);
      revalidated = false;
    }

    return NextResponse.json({
      success: true,
      brand,
      revalidated,
      message: revalidated ? 'Saved and live' : 'Saved to server, but storefront revalidation is pending.',
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create brand.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['brands.edit', 'brands.manage', 'products.edit', 'categories.edit']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    if (body.action === 'reorder' && Array.isArray(body.orderedIds)) {
      if (isDbConfigured()) {
        const { reorderBrandsInDb } = await import('@/lib/db/repositories/brands');
        await reorderBrandsInDb(body.orderedIds);
      } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
        const { reorderDevBrands } = await import('@/lib/db/serverDevStorage');
        await reorderDevBrands(body.orderedIds, session.email);
      } else {
        return NextResponse.json(
          { success: false, error: 'Database is not configured in production.' },
          { status: 503 }
        );
      }

      serverCache.invalidate('brands');
      let revalidated = true;
      try {
        revalidatePath('/', 'layout');
        revalidatePath('/');
        revalidatePath('/shop');
        revalidatePath('/brands');
        revalidatePath('/api/brands');
        revalidatePath('/admin/brands');
      } catch (revErr) {
        console.warn('Brands reorder revalidation notice:', revErr);
        revalidated = false;
      }

      return NextResponse.json({
        success: true,
        revalidated,
        message: revalidated ? 'Saved and live' : 'Brands reordered, but storefront revalidation is pending.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid brand action.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process brand action.' },
      { status: 500 }
    );
  }
}
