import { NextRequest, NextResponse } from 'next/server';
import { getMergedHomepageSettings } from '@/lib/db/homepageSettingsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isFresh = searchParams.has('fresh') || searchParams.has('t');

    const settings = getMergedHomepageSettings();

    const headers: Record<string, string> = isFresh
      ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      : { 'Cache-Control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=60' };

    return NextResponse.json({ success: true, settings }, { headers });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to read homepage settings.' },
      { status: 500 }
    );
  }
}
