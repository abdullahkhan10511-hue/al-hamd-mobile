import { NextResponse } from 'next/server';
import { readPersistentLocations } from '@/lib/db/locationStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isFresh = searchParams.has('fresh') || searchParams.has('t');
    const all = readPersistentLocations();
    const active = all
      .filter((loc) => loc && (loc.isActive === true || (loc.isActive as any) === 1 || (loc.isActive as any) === '1'))
      .sort((a, b) => (a.displayOrder || 1) - (b.displayOrder || 1));

    const cacheControl = isFresh
      ? 'no-cache, no-store, must-revalidate, max-age=0'
      : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

    return NextResponse.json(
      {
        success: true,
        locations: active,
        items: active,
      },
      {
        headers: {
          'Cache-Control': cacheControl,
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error fetching shop locations' },
      { status: 500 }
    );
  }
}
