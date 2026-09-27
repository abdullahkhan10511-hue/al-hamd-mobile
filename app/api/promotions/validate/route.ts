import { NextRequest, NextResponse } from 'next/server';
import { validatePromoCode } from '@/lib/db/promotions';
import { getPromoCodeByCodeFromDb } from '@/lib/db/repositories/promotions';
import { isDbConfigured } from '@/lib/db/mysql';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, subtotal, items, channel, customer } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Please enter a valid promo code.' },
        { status: 400 }
      );
    }

    let promoOverride;
    if (isDbConfigured()) {
      promoOverride = await getPromoCodeByCodeFromDb(code);
    }

    const result = await validatePromoCode(
      {
        code,
        subtotal: Number(subtotal) || 0,
        items: Array.isArray(items) ? items : [],
        channel: channel === 'POS' ? 'POS' : 'ONLINE',
        customer,
      },
      promoOverride || undefined
    );

    if (!result.valid) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('API /api/promotions/validate Error:', error);
    return NextResponse.json(
      { valid: false, error: error?.message || 'Failed to validate promo code.' },
      { status: 500 }
    );
  }
}
