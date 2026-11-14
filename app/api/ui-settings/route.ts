import { NextRequest, NextResponse } from 'next/server';
import {
  getHomepageAnimationsSettings,
  getWhatsAppButtonSettings,
} from '@/lib/db/repositories/siteUiSettings';
import { getPublicCacheHeaders } from '@/lib/cacheControl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
        headers: getPublicCacheHeaders(request),
      }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve public UI settings.' },
      { status: 500 }
    );
  }
}

