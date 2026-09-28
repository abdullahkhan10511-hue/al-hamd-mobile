import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllCategoriesFromDb, insertCategoryToDb } from '@/lib/db/repositories/categories';
import { getAdminSession } from '@/lib/db/adminAuth';
import { allowDevMockFallback } from '@/lib/env';
import { deduplicateCategoriesById } from '@/lib/utils';

export async function GET() {
  try {
    let list: any[] = [];
    if (isDbConfigured()) {
      try {
        list = await getAllCategoriesFromDb();
      } catch (err: any) {
        console.error('MySQL error in /api/categories GET:', err);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch categories from database.' },
          { status: 500 }
        );
      }
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevCategories } = await import('@/lib/db/serverDevStorage');
      list = getDevCategories();
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    const uniqueCategories = deduplicateCategoriesById(list);

    return NextResponse.json(
      { success: true, count: uniqueCategories.length, categories: uniqueCategories },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
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

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Category name is required.' }, { status: 400 });
    }

    if (isDbConfigured()) {
      const category = await insertCategoryToDb(body, session.email);
      return NextResponse.json({ success: true, category }, { status: 201 });
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { insertDevCategory } = await import('@/lib/db/serverDevStorage');
      const category = await insertDevCategory(body, session.email);
      return NextResponse.json({ success: true, category }, { status: 201 });
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create category.' },
      { status: 500 }
    );
  }
}
