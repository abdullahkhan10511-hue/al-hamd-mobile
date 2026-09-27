import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllPagesFromDb, savePageInDb } from '@/lib/db/repositories/pages';
import { getAdminSession } from '@/lib/db/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const pages = await getAllPagesFromDb();
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

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const body = await request.json();
    if (!body.title || !body.slug) {
      return NextResponse.json({ success: false, error: 'Title and slug are required.' }, { status: 400 });
    }

    const page = await savePageInDb(body);
    return NextResponse.json({ success: true, page }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to save custom page.' }, { status: 500 });
  }
}
