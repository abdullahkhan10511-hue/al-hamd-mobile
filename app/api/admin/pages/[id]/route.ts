import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDbConfigured } from '@/lib/db/mysql';
import { deletePageInDb, savePageInDb } from '@/lib/db/repositories/pages';
import { savePersistentPage, deletePersistentPage } from '@/lib/db/pagesStorage';
import { getAdminSession } from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    let page: any;
    if (isDbConfigured()) {
      page = await savePageInDb({ ...body, id });
    } else {
      page = savePersistentPage({ ...body, id });
    }

    try {
      revalidatePath('/pages');
      if (body.slug) revalidatePath(`/pages/${body.slug}`);
    } catch {}

    return NextResponse.json({ success: true, page });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to update custom page.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }

    const { id } = await params;
    let ok = false;

    if (isDbConfigured()) {
      ok = await deletePageInDb(id);
    } else {
      ok = deletePersistentPage(id);
    }

    if (!ok) {
      return NextResponse.json({ success: false, error: 'Page not found.' }, { status: 404 });
    }

    try {
      revalidatePath('/pages');
    } catch {}

    return NextResponse.json({ success: true, message: 'Custom page deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete custom page.' }, { status: 500 });
  }
}
