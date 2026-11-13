import { NextRequest, NextResponse } from 'next/server';
import { validatePromoCode } from '@/lib/db/promotions';
import { getPromoCodeByCodeFromDb } from '@/lib/db/repositories/promotions';
import { isDbConfigured } from '@/lib/db/mysql';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    // Rate limit: 10 per minute and 30 per hour per IP
    const minLimit = await checkRateLimit(`promo_val_min_${ip}`, 10, 60 * 1000);
    if (!minLimit.allowed) {
      return createRateLimitResponse(minLimit.retryAfterSeconds, 'Too many promo validation attempts.');
    }
    const hrLimit = await checkRateLimit(`promo_val_hr_${ip}`, 30, 60 * 60 * 1000);
    if (!hrLimit.allowed) {
      return createRateLimitResponse(hrLimit.retryAfterSeconds, 'Too many promo validation attempts.');
    }

    const body = await request.json();
    const { code, subtotal, items, channel, customer } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Please enter a valid promo code.' },
        { status: 400 }
      );
    }

    if (Array.isArray(items) && items.length > 200) {
      return NextResponse.json(
        { valid: false, error: 'Too many items in cart for promo validation (maximum 200).' },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();
    let promoOverride;
    if (isDbConfigured()) {
      promoOverride = await getPromoCodeByCodeFromDb(normalizedCode);
    }

    const result = await validatePromoCode(
      {
        code: normalizedCode,
        subtotal: Number(subtotal) || 0,
        items: Array.isArray(items) ? items : [],
        channel: channel === 'POS' ? 'POS' : 'ONLINE',
        customer,
      },
      promoOverride || undefined
    );

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired promo code.' }, { status: 400 });
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
