import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllPagesFromDb, savePageInDb } from '@/lib/db/repositories/pages';
import { readPersistentPages, savePersistentPage } from '@/lib/db/pagesStorage';
import { getAdminSessionAsync, hasAdminPermission, forbiddenResponse } from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAdminPermission(session, ['pages.view', 'pages.create', 'pages.edit', 'pages.delete', 'pages.publish', 'pages.manage_nav', 'content.navigation', 'content.footer'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view pages.');
    }

    let pages: any[] = [];
    if (isDbConfigured()) {
      try {
        pages = await getAllPagesFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/admin/pages:', err);
        pages = readPersistentPages();
      }
    } else {
      pages = readPersistentPages();
    }

    return NextResponse.json({ success: true, count: pages.length, pages });
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

    if (!hasAdminPermission(session, ['pages.create', 'pages.edit'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to create pages.');
    }

    const body = await request.json();
    if (!body.title || !body.slug) {
      return NextResponse.json({ success: false, error: 'Title and slug are required.' }, { status: 400 });
    }

    let page: any;
    if (isDbConfigured()) {
      page = await savePageInDb(body);
    } else {
      page = savePersistentPage(body);
    }

    let revalidated = true;
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      if (body.slug) {
        revalidatePath(`/${body.slug}`);
        revalidatePath(`/api/pages/${body.slug}`);
      }
      revalidatePath('/pages');
      revalidatePath('/api/pages');
      revalidatePath('/admin/pages');
    } catch (revErr) {
      console.warn('Page revalidation notice:', revErr);
      revalidated = false;
    }

    return NextResponse.json({
      success: true,
      page,
      revalidated,
      message: revalidated ? 'Saved and live' : 'Page saved, but storefront revalidation is pending.',
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to save custom page.' }, { status: 500 });
  }
}
