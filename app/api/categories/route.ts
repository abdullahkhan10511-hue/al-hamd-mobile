import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllCategoriesFromDb, insertCategoryToDb } from '@/lib/db/repositories/categories';
import { categories as initialCategories } from '@/data/categories';
import { getAdminSession } from '@/lib/db/adminAuth';

export async function GET() {
  try {
    let list: any[] = [];
    if (isDbConfigured()) {
      try {
        list = await getAllCategoriesFromDb();
      } catch (err: any) {
        console.error('MySQL error in /api/categories GET:', err);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch categories. Please try again later.' },
          { status: 500 }
        );
      }
    } else {
      list = initialCategories;
    }

    return NextResponse.json(
      { success: true, count: list.length, categories: list },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Category name is required.' }, { status: 400 });
    }

    const category = await insertCategoryToDb(body, session.email);
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create category.' },
      { status: 500 }
    );
  }
}
