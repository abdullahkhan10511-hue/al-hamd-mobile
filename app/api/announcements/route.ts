import { NextRequest, NextResponse } from 'next/server';
import { readPersistentAnnouncements } from '@/lib/db/announcementsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isFresh = searchParams.has('fresh') || searchParams.has('t');

    const items = readPersistentAnnouncements();

    const headers: Record<string, string> = isFresh
      ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      : { 'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=120' };

    return NextResponse.json(
      { success: true, items, count: items.length },
      { headers }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to read announcements.' },
      { status: 500 }
    );
  }
}
