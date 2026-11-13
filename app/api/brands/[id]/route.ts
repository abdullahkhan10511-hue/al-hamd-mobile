import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getBrandByIdOrSlugFromDb,
  updateBrandInDb,
  deleteBrandInDb,
} from '@/lib/db/repositories/brands';
import { requireAdmin } from '@/lib/db/requireAdmin';
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
    let brand: any = null;

    if (isDbConfigured()) {
      brand = await getBrandByIdOrSlugFromDb(id);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevBrandByIdOrSlug } = await import('@/lib/db/serverDevStorage');
      brand = getDevBrandByIdOrSlug(id);
    } else {
      return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
    }

    if (!brand) {
      return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, brand }, { headers: getPublicCacheHeaders(request) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request, ['brands.edit', 'brands.manage', 'products.edit', 'categories.edit']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const body = await request.json();
    let brand: any = null;

    if (isDbConfigured()) {
      brand = await updateBrandInDb(id, body);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { updateDevBrand } = await import('@/lib/db/serverDevStorage');
      brand = await updateDevBrand(id, body, session.email);
    } else {
      return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
    }

    return NextResponse.json({ success: true, brand });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to update brand.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request, ['brands.delete', 'brands.manage', 'products.delete', 'categories.delete']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    let ok = false;

    if (isDbConfigured()) {
      ok = await deleteBrandInDb(id);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { deleteDevBrand } = await import('@/lib/db/serverDevStorage');
      ok = await deleteDevBrand(id, session.email);
    } else {
      return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
    }

    if (!ok) {
      return NextResponse.json({ success: false, error: 'Brand not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Brand deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete brand.' }, { status: 500 });
  }
}
