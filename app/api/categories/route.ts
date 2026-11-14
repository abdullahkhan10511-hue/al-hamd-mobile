import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllCategoriesFromDb, insertCategoryToDb } from '@/lib/db/repositories/categories';
import { getAdminSessionAsync, hasAdminPermission } from '@/lib/db/adminAuth';
import { allowDevMockFallback } from '@/lib/env';
import { deduplicateCategoriesById } from '@/lib/utils';
import { getPublicCacheHeaders } from '@/lib/cacheControl';
import { serverCache } from '@/lib/cache/memoryCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const isBestSeller = request.nextUrl.searchParams.get('isBestSeller') === 'true';
    const isNewArrival = request.nextUrl.searchParams.get('isNewArrival') === 'true';
    const isSale = request.nextUrl.searchParams.get('isSale') === 'true';
    const collectionFilter = (isBestSeller || isNewArrival || isSale)
      ? { isBestSeller, isNewArrival, isSale }
      : undefined;

    let list: any[] = [];
    if (isDbConfigured()) {
      try {
        list = await getAllCategoriesFromDb(collectionFilter);
      } catch (err: any) {
        console.error('MySQL error in /api/categories GET:', err);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch categories from database.' },
          { status: 500 }
        );
      }
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevCategories, getDevProducts } = await import('@/lib/db/serverDevStorage');
      const devCats = getDevCategories();
      if (collectionFilter) {
        const devProds = getDevProducts().filter((p) => {
          if (isBestSeller && !p.isBestSeller) return false;
          if (isNewArrival && !(p.isNewArrival || (p as any).is_new_arrival)) return false;
          if (isSale && !(p as any).isSale) return false;
          return true;
        });
        list = devCats
          .map((c) => {
            const count = devProds.filter(
              (p) =>
                p.categorySlug === c.slug ||
                p.category?.toLowerCase() === c.name.toLowerCase()
            ).length;
            return { ...c, productCount: count };
          })
          .filter((c) => (c.productCount || 0) > 0);
      } else {
        list = devCats;
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    const uniqueCategories = deduplicateCategoriesById(list);

    return NextResponse.json(
      { success: true, count: uniqueCategories.length, categories: uniqueCategories },
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
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }
    if (!hasAdminPermission(session, ['categories.add', 'categories.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions to create categories.' }, { status: 403 });
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Category name is required.' }, { status: 400 });
    }

    let category: any = null;
    if (isDbConfigured()) {
      category = await insertCategoryToDb(body, session.email);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { insertDevCategory } = await import('@/lib/db/serverDevStorage');
      category = await insertDevCategory(body, session.email);
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    serverCache.invalidate('categories');
    let revalidated = true;
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      revalidatePath('/shop');
      revalidatePath('/categories');
      if (category?.slug) {
        revalidatePath(`/category/${category.slug}`);
      }
      revalidatePath('/api/categories');
      revalidatePath('/admin/categories');
    } catch (revErr) {
      console.warn('Category revalidation notice:', revErr);
      revalidated = false;
    }

    return NextResponse.json({
      success: true,
      category,
      revalidated,
      message: revalidated ? 'Saved and live' : 'Saved to server, but storefront revalidation is pending.',
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create category.' },
      { status: 500 }
    );
  }
}
