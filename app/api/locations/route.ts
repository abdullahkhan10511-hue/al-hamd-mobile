import { NextResponse } from 'next/server';
import { readPersistentLocations } from '@/lib/db/locationStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const all = readPersistentLocations();
    const active = all
      .filter((loc) => loc && (loc.isActive === true || (loc.isActive as any) === 1 || (loc.isActive as any) === '1'))
      .sort((a, b) => (a.displayOrder || 1) - (b.displayOrder || 1));

    return NextResponse.json(
      {
        success: true,
        locations: active,
        items: active,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
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
