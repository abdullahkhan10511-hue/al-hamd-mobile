import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/db/requireAdmin';
import { forbiddenResponse } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { insertProductToDb, getAllProductsFromDb } from '@/lib/db/repositories/products';
import { allowDevMockFallback } from '@/lib/env';
import {
  sanitizeProductsForSession,
  sanitizeProductForSession,
  validateProductWritePermissions,
} from '@/lib/productSanitizer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, [
      'products.view',
      'products.manage',
      'pos.view',
      'pos.create_sale',
      'deals.view',
      'deals.manage',
      'shop_bills.view',
      'shop_bills.manage',
      'inventory.view',
    ]);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    let rawProducts: any[] = [];
    if (isDbConfigured()) {
      rawProducts = await getAllProductsFromDb();
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevProducts } = await import('@/lib/db/serverDevStorage');
      rawProducts = getDevProducts();
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    // Sanitize prices and sensitive financial data according to session permissions
    const products = sanitizeProductsForSession(rawProducts, session);
    return NextResponse.json({ success: true, products });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['products.add', 'products.create', 'products.manage']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Product name is required.' },
        { status: 400 }
      );
    }

    // Granular permission check for pricing, stock, media, and sku
    const writeError = validateProductWritePermissions(body, session);
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
      product = await insertProductToDb(body, session.email);
      try {
        revalidatePath('/');
        revalidatePath('/api/products');
        revalidatePath('/products');
        revalidatePath('/admin/products');
      } catch (revErr) {
        console.warn('revalidatePath notice:', revErr);
      }
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { insertDevProduct } = await import('@/lib/db/serverDevStorage');
      product = await insertDevProduct(body, session.email);
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    const safeProduct = sanitizeProductForSession(product, session);
    return NextResponse.json({ success: true, product: safeProduct }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating product:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create product.' },
      { status: 500 }
    );
  }
}
