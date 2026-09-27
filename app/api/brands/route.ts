import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllBrandsFromDb, insertBrandToDb } from '@/lib/db/repositories/brands';
import { seedBrands } from '@/lib/db/seed';
import { getAdminSession } from '@/lib/db/adminAuth';

export async function GET() {
  try {
    let brands: any[] = [];

    if (isDbConfigured()) {
      try {
        brands = await getAllBrandsFromDb();
      } catch (err: any) {
        console.warn('MySQL error in /api/brands GET:', err.message);
        brands = seedBrands;
      }
    } else {
      brands = seedBrands;
    }

    return NextResponse.json(
      { success: true, count: brands.length, brands },
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
        { success: false, error: 'Database is not configured.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Brand name is required.' }, { status: 400 });
    }

    const brand = await insertBrandToDb(body);
    return NextResponse.json({ success: true, brand }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create brand.' },
      { status: 500 }
    );
  }
}
