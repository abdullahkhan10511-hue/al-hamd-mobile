import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { getCategoryByIdFromDb, updateCategoryInDb, deleteCategoryInDb } from '@/lib/db/repositories/categories';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const category = await getCategoryByIdFromDb(id);
    if (!category) {
      return NextResponse.json({ success: false, error: 'Category not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, category });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const { id } = await params;
    const body = await request.json();

    const category = await updateCategoryInDb(id, body, session.email);
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
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const { id } = await params;
    const ok = await deleteCategoryInDb(id, session.email);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
