import { NextRequest, NextResponse } from 'next/server';
import {
  getHomepageAnimationsSettings,
  getWhatsAppButtonSettings,
  getOrderSuccessSettings,
} from '@/lib/db/repositories/siteUiSettings';
import { getPublicCacheHeaders } from '@/lib/cacheControl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const [animationsRes, whatsappRes, orderSuccessRes] = await Promise.all([
      getHomepageAnimationsSettings(),
      getWhatsAppButtonSettings(),
      getOrderSuccessSettings(),
    ]);

    return NextResponse.json(
      {
        success: true,
        animations: animationsRes.settings,
        whatsapp: whatsappRes.settings,
        orderSuccess: orderSuccessRes.settings,
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

