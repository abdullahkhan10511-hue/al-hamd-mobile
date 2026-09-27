import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { getProductByIdFromDb, updateProductInDb, deleteProductInDb } from '@/lib/db/repositories/products';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
    }

    const product = await getProductByIdFromDb(id);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
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
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required.' },
        { status: 401 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database is not configured. Please define DB credentials in .env.' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const product = await updateProductInDb(id, body, session.email);
    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    console.error('Error updating product in MySQL:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update product.' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required.' },
        { status: 401 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database is not configured.' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const ok = await deleteProductInDb(id, session.email);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting product in MySQL:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete product.' },
      { status: 500 }
    );
  }
}
