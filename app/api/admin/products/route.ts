import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { insertProductToDb, getAllProductsFromDb } from '@/lib/db/repositories/products';
import { allowDevMockFallback } from '@/lib/env';

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required.' },
        { status: 401 }
      );
    }

    if (isDbConfigured()) {
      const products = await getAllProductsFromDb();
      return NextResponse.json({ success: true, products });
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevProducts } = await import('@/lib/db/serverDevStorage');
      const products = getDevProducts();
      return NextResponse.json({ success: true, products });
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin credentials required to add products.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Product name is required.' },
        { status: 400 }
      );
    }

    if (isDbConfigured()) {
      const product = await insertProductToDb(body, session.email);
      return NextResponse.json({ success: true, product }, { status: 201 });
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { insertDevProduct } = await import('@/lib/db/serverDevStorage');
      const product = await insertDevProduct(body, session.email);
      return NextResponse.json({ success: true, product }, { status: 201 });
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }
  } catch (err: any) {
    console.error('Error creating product:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create product.' },
      { status: 500 }
    );
  }
}
