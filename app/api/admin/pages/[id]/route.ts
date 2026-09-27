import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { deletePageInDb, savePageInDb } from '@/lib/db/repositories/pages';
import { getAdminSession } from '@/lib/db/adminAuth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const { id } = await params;
    const body = await request.json();

    const page = await savePageInDb({ ...body, id });
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

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const { id } = await params;
    const ok = await deletePageInDb(id);

    if (!ok) {
      return NextResponse.json({ success: false, error: 'Page not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Custom page deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete custom page.' }, { status: 500 });
  }
}
