import { NextRequest, NextResponse } from 'next/server';
import { readPersistentNavigation } from '@/lib/db/navigationStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isFresh = searchParams.has('fresh') || searchParams.has('t');

    const items = readPersistentNavigation();

    const cacheControl = isFresh
      ? 'no-cache, no-store, must-revalidate, max-age=0'
      : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

    return NextResponse.json(
      { success: true, items, count: items.length },
      {
        headers: {
          'Cache-Control': cacheControl,
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to read navigation items.' },
      { status: 500 }
    );
  }
}
