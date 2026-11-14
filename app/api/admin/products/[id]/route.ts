import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/db/requireAdmin';
import { getAdminSessionAsync, forbiddenResponse } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { getProductByIdFromDb, updateProductInDb, deleteProductInDb } from '@/lib/db/repositories/products';
import { allowDevMockFallback } from '@/lib/env';
import {
  sanitizeProductForSession,
  validateProductWritePermissions,
} from '@/lib/productSanitizer';
import { serverCache } from '@/lib/cache/memoryCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const session = await getAdminSessionAsync(request);
    const safeProduct = session ? sanitizeProductForSession(product, session) : product;

    return NextResponse.json({ success: true, product: safeProduct });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request, ['products.edit', 'products.manage']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const body = await request.json();

    let existing: any = null;
    if (isDbConfigured()) {
      existing = await getProductByIdFromDb(id);
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevProductById } = await import('@/lib/db/serverDevStorage');
      existing = getDevProductById(id);
    }

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    // Granular write validation for pricing, stock, sku, and media
    const writeError = validateProductWritePermissions(body, session, existing);
    if (writeError) {
      return forbiddenResponse(writeError);
    }

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

    serverCache.invalidate('products');
    let revalidated = true;
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      revalidatePath('/shop');
      revalidatePath('/search');
      revalidatePath('/categories');
      revalidatePath('/brands');
      if (existing?.slug) {
        revalidatePath(`/product/${existing.slug}`);
      }
      if (product?.slug && product.slug !== existing?.slug) {
        revalidatePath(`/product/${product.slug}`);
      }
      revalidatePath('/api/products');
      revalidatePath('/admin/products');
    } catch (revErr) {
      console.warn('revalidatePath notice:', revErr);
      revalidated = false;
    }

    const safeProduct = sanitizeProductForSession(product, session);
    return NextResponse.json({
      success: true,
      product: safeProduct,
      revalidated,
      message: revalidated ? 'Saved and live' : 'Saved to server, but storefront revalidation is pending.',
    });
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
    const auth = await requireAdmin(request, ['products.delete', 'products.manage']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

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

    serverCache.invalidate('products');
    let revalidated = true;
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      revalidatePath('/shop');
      revalidatePath('/search');
      revalidatePath('/categories');
      revalidatePath('/brands');
      revalidatePath('/api/products');
      revalidatePath('/admin/products');
    } catch (revErr) {
      console.warn('revalidatePath notice:', revErr);
      revalidated = false;
    }

    return NextResponse.json({
      success: true,
      revalidated,
      message: revalidated ? 'Saved and live' : 'Product deleted, but storefront revalidation is pending.',
    });
  } catch (err: any) {
    console.error('Error deleting product:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete product.' },
      { status: 500 }
    );
  }
}
