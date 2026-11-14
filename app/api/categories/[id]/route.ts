import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/db/requireAdmin';
import { isDbConfigured } from '@/lib/db/mysql';
import { getCategoryByIdFromDb, updateCategoryInDb, deleteCategoryInDb } from '@/lib/db/repositories/categories';
import { allowDevMockFallback } from '@/lib/env';
import { getPublicCacheHeaders } from '@/lib/cacheControl';
import { serverCache } from '@/lib/cache/memoryCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let category: any = null;

    if (isDbConfigured()) {
      category = await getCategoryByIdFromDb(id);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevCategoryById } = await import('@/lib/db/serverDevStorage');
      category = getDevCategoryById(id);
    } else {
      return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
    }

    if (!category) {
      return NextResponse.json({ success: false, error: 'Category not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, category }, { headers: getPublicCacheHeaders(request) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request, ['categories.edit', 'categories.manage']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const body = await request.json();
    let category: any = null;

    if (isDbConfigured()) {
      category = await updateCategoryInDb(id, body, session.email);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { updateDevCategory } = await import('@/lib/db/serverDevStorage');
      category = await updateDevCategory(id, body, session.email);
    } else {
      return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
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
      console.warn('Category update revalidation notice:', revErr);
      revalidated = false;
    }

    return NextResponse.json({
      success: true,
      category,
      revalidated,
      message: revalidated ? 'Saved and live' : 'Saved to server, but storefront revalidation is pending.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request, ['categories.delete', 'categories.manage']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    let ok = false;

    if (isDbConfigured()) {
      ok = await deleteCategoryInDb(id, session.email);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { deleteDevCategory } = await import('@/lib/db/serverDevStorage');
      ok = await deleteDevCategory(id, session.email);
    } else {
      return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
    }

    if (!ok) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    serverCache.invalidate('categories');
    let revalidated = true;
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      revalidatePath('/shop');
      revalidatePath('/categories');
      revalidatePath('/api/categories');
      revalidatePath('/admin/categories');
    } catch (revErr) {
      console.warn('Category delete revalidation notice:', revErr);
      revalidated = false;
    }

    return NextResponse.json({
      success: true,
      revalidated,
      message: revalidated ? 'Saved and live' : 'Category deleted, but storefront revalidation is pending.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
