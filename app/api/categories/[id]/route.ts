import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/db/requireAdmin';
import { isDbConfigured } from '@/lib/db/mysql';
import { getCategoryByIdFromDb, updateCategoryInDb, deleteCategoryInDb } from '@/lib/db/repositories/categories';
import { allowDevMockFallback } from '@/lib/env';
import { getPublicCacheHeaders } from '@/lib/cacheControl';

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

    return NextResponse.json({ success: true, category });
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

    return NextResponse.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
