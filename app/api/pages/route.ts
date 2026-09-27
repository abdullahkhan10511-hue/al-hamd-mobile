import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllPagesFromDb } from '@/lib/db/repositories/pages';
import { seedPages } from '@/lib/db/pages';

export async function GET() {
  try {
    let pages: any[] = [];

    if (isDbConfigured()) {
      try {
        pages = await getAllPagesFromDb();
      } catch (err: any) {
        console.warn('MySQL error in /api/pages:', err.message);
        pages = seedPages;
      }
    } else {
      pages = seedPages;
    }

    return NextResponse.json(
      { success: true, count: pages.length, pages },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
