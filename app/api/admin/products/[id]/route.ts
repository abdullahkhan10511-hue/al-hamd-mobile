import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminSession, hasAdminPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { getProductByIdFromDb, updateProductInDb, deleteProductInDb } from '@/lib/db/repositories/products';
import { allowDevMockFallback } from '@/lib/env';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let product: any = null;

    if (isDbConfigured()) {
      product = await getProductByIdFromDb(id);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevProductById } = await import('@/lib/db/serverDevStorage');
      product = getDevProductById(id);
    } else {
      return NextResponse.json({ success: false, error: 'Database is not configured in production.' }, { status: 503 });
    }

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
      return unauthorizedResponse('Unauthorized: Admin session required.');
    }

    if (!hasAdminPermission(session, 'products.edit')) {
      return forbiddenResponse('Forbidden: Insufficient permissions to edit products.');
    }

    const { id } = await params;
    const body = await request.json();

    if (Array.isArray(body.images) && body.images.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 images allowed per product.' },
        { status: 400 }
      );
    }

    if (Array.isArray(body.models) && body.models.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Maximum 200 models/variants allowed per product.' },
        { status: 400 }
      );
    }

    let product: any = null;

    if (isDbConfigured()) {
      product = await updateProductInDb(id, body, session.email);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { updateDevProduct } = await import('@/lib/db/serverDevStorage');
      product = await updateDevProduct(id, body, session.email);
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    try {
      revalidatePath('/');
      revalidatePath('/api/products');
      revalidatePath('/products');
      revalidatePath('/admin/products');
      if (product?.slug) {
        revalidatePath(`/product/${product.slug}`);
      }
    } catch (revErr) {
      console.warn('revalidatePath notice:', revErr);
    }

    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    console.error('Error updating product:', err);
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
      return unauthorizedResponse('Unauthorized: Admin session required.');
    }

    if (!hasAdminPermission(session, 'products.delete')) {
      return forbiddenResponse('Forbidden: Insufficient permissions to delete products.');
    }

    const { id } = await params;
    let ok = false;

    if (isDbConfigured()) {
      ok = await deleteProductInDb(id, session.email);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { deleteDevProduct } = await import('@/lib/db/serverDevStorage');
      ok = await deleteDevProduct(id, session.email);
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    if (!ok) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    try {
      revalidatePath('/');
      revalidatePath('/api/products');
      revalidatePath('/products');
      revalidatePath('/admin/products');
    } catch (revErr) {
      console.warn('revalidatePath notice:', revErr);
    }

    return NextResponse.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting product:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete product.' },
      { status: 500 }
    );
  }
}
