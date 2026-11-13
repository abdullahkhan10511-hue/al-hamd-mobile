import { NextRequest, NextResponse } from 'next/server';
import { getMergedHomepageSettings } from '@/lib/db/homepageSettingsStorage';
import { getPublicCacheHeaders } from '@/lib/cacheControl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const settings = getMergedHomepageSettings();

    return NextResponse.json(
      { success: true, settings },
      {
        headers: getPublicCacheHeaders(request),
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to read homepage settings.' },
      { status: 500 }
    );
  }
}
