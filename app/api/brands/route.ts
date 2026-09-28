import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllBrandsFromDb, insertBrandToDb } from '@/lib/db/repositories/brands';
import { getAdminSession } from '@/lib/db/adminAuth';
import { allowDevMockFallback } from '@/lib/env';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let brands: any[] = [];

    if (isDbConfigured()) {
      try {
        brands = await getAllBrandsFromDb(activeOnly);
      } catch (err: any) {
        console.error('MySQL error in /api/brands GET:', err);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch brands from database.' },
          { status: 500 }
        );
      }
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevBrands } = await import('@/lib/db/serverDevStorage');
      brands = getDevBrands(activeOnly);
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: true, count: brands.length, brands },
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
      return NextResponse.json({ success: false, error: 'Brand name is required.' }, { status: 400 });
    }

    if (isDbConfigured()) {
      const brand = await insertBrandToDb(body);
      return NextResponse.json({ success: true, brand }, { status: 201 });
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { insertDevBrand } = await import('@/lib/db/serverDevStorage');
      const brand = await insertDevBrand(body, session.email);
      return NextResponse.json({ success: true, brand }, { status: 201 });
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create brand.' },
      { status: 500 }
    );
  }
}
