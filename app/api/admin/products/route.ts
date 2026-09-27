import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/db/adminAuth';
import { isDbConfigured } from '@/lib/db/mysql';
import { insertProductToDb, getAllProductsFromDb } from '@/lib/db/repositories/products';

export async function GET(request: NextRequest) {
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
        { success: false, error: 'Database is not configured. Please define DB_HOST, DB_USER, DB_NAME in .env.' },
        { status: 503 }
      );
    }

    const products = await getAllProductsFromDb();
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
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin credentials required to add products.' },
        { status: 401 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database is not configured. Please define DB_HOST, DB_USER, DB_NAME in .env.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Product name is required.' },
        { status: 400 }
      );
    }

    const product = await insertProductToDb(body, session.email);
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating product in MySQL:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create product.' },
      { status: 500 }
    );
  }
}
