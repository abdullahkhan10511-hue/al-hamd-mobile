import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllPagesFromDb, savePageInDb } from '@/lib/db/repositories/pages';
import { readPersistentPages, savePersistentPage } from '@/lib/db/pagesStorage';
import { getAdminSession, hasAdminPermission, forbiddenResponse } from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
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
    const session = getAdminSession(request);
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

    try {
      revalidatePath('/pages');
      revalidatePath(`/pages/${body.slug}`);
    } catch {}

    return NextResponse.json({ success: true, page }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to save custom page.' }, { status: 500 });
  }
}
