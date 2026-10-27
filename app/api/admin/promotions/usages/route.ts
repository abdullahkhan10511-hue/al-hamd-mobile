import { NextRequest, NextResponse } from 'next/server';
import { getPromoCodeUsages } from '@/lib/db/promotions';
import {
  getAdminSession,
  hasAdminPermission,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/db/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'promotions.view')) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view promotion usages.');
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code') || undefined;
    const promoCodeId = searchParams.get('promoCodeId') || undefined;
    const channel = (searchParams.get('channel') as 'ONLINE' | 'POS') || undefined;

    const usages = getPromoCodeUsages({
      code,
      promoCodeId,
      channel,
    });

    return NextResponse.json({ success: true, usages }, { status: 200 });
  } catch (error: any) {
    console.error('API /api/admin/promotions/usages GET Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
