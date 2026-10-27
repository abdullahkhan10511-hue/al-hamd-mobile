import { NextRequest, NextResponse } from 'next/server';
import { getMergedHomepageSettings } from '@/lib/db/homepageSettingsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const settings = getMergedHomepageSettings();

    return NextResponse.json(
      { success: true, settings },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to read homepage settings.' },
      { status: 500 }
    );
  }
}
