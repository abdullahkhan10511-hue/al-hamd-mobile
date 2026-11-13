import { NextRequest, NextResponse } from 'next/server';
import {
  getHomepageAnimationsSettings,
  getWhatsAppButtonSettings,
} from '@/lib/db/repositories/siteUiSettings';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // 1-minute cache

export async function GET(request: NextRequest) {
  try {
    const [animationsRes, whatsappRes] = await Promise.all([
      getHomepageAnimationsSettings(),
      getWhatsAppButtonSettings(),
    ]);

    return NextResponse.json(
      {
        success: true,
        animations: animationsRes.settings,
        whatsapp: whatsappRes.settings,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve public UI settings.' },
      { status: 500 }
    );
  }
}
