import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllPagesFromDb } from '@/lib/db/repositories/pages';
import { readPersistentPages } from '@/lib/db/pagesStorage';

export async function GET() {
  try {
    let pages: any[] = [];

    if (isDbConfigured()) {
      try {
        pages = await getAllPagesFromDb();
      } catch (err: any) {
        console.error('MySQL error in /api/pages:', err);
        pages = readPersistentPages();
      }
    } else {
      pages = readPersistentPages();
    }

    return NextResponse.json(
      { success: true, count: pages.length, pages },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
