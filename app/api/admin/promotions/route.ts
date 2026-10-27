import { NextRequest, NextResponse } from 'next/server';
import { getPromoCodes, createPromoCode } from '@/lib/db/promotions';
import { getAllPromoCodesFromDb, insertPromoCodeToDb } from '@/lib/db/repositories/promotions';
import { isDbConfigured } from '@/lib/db/mysql';

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
      return forbiddenResponse('Forbidden: Insufficient permissions to view promotions.');
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const status = searchParams.get('status'); // 'all' | 'active' | 'inactive' | 'expired'

    let promos = isDbConfigured()
      ? await getAllPromoCodesFromDb()
      : getPromoCodes();
    const now = new Date();

    if (search) {
      promos = promos.filter(
        (p) =>
          p.code.toLowerCase().includes(search) ||
          (p.description && p.description.toLowerCase().includes(search))
      );
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        promos = promos.filter((p) => {
          if (!p.isActive) return false;
          if (p.expiryDate && new Date(p.expiryDate) < now) return false;
          return true;
        });
      } else if (status === 'inactive') {
        promos = promos.filter((p) => !p.isActive);
      } else if (status === 'expired') {
        promos = promos.filter((p) => p.expiryDate && new Date(p.expiryDate) < now);
      }
    }

    return NextResponse.json({ success: true, promotions: promos }, { status: 200 });
  } catch (error: any) {
    console.error('API /api/admin/promotions GET Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'promotions.add')) {
      return forbiddenResponse('Permission Denied: Unauthorized to create promotions.');
    }

    const body = await request.json();

    if (isDbConfigured()) {
      try {
        const promo = await insertPromoCodeToDb(body);
        return NextResponse.json({ success: true, promo }, { status: 201 });
      } catch (insertErr: any) {
        return NextResponse.json({ success: false, error: insertErr.message || 'Failed to create promo code.' }, { status: 400 });
      }
    }

    const result = await createPromoCode(body, session.email);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('API /api/admin/promotions POST Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
