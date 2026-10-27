import { NextRequest, NextResponse } from 'next/server';
import { readPersistentAnnouncements } from '@/lib/db/announcementsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const items = readPersistentAnnouncements();

    return NextResponse.json(
      { success: true, items, count: items.length },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to read announcements.' },
      { status: 500 }
    );
  }
}
