import { NextRequest, NextResponse } from 'next/server';
import { readPersistentNavigation } from '@/lib/db/navigationStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const items = readPersistentNavigation();

    return NextResponse.json(
      { success: true, items, count: items.length },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
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
