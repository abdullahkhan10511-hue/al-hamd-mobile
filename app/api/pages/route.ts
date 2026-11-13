import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllPagesFromDb } from '@/lib/db/repositories/pages';
import { readPersistentPages } from '@/lib/db/pagesStorage';
import { getPublicCacheHeaders } from '@/lib/cacheControl';

export async function GET(request: Request) {
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
        headers: getPublicCacheHeaders(request),
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
