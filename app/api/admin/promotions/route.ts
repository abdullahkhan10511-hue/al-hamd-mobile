import { NextRequest, NextResponse } from 'next/server';
import { getPromoCodes, createPromoCode } from '@/lib/db/promotions';
import { getAllPromoCodesFromDb, insertPromoCodeToDb } from '@/lib/db/repositories/promotions';
import { isDbConfigured } from '@/lib/db/mysql';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function getSessionUser(request: NextRequest): { id?: string; name?: string; email: string; role: string; permissions?: string[] } | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (cookieVal) {
    let raw = cookieVal;
    for (let i = 0; i < 3; i++) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email && parsed.status !== 'inactive') {
          return parsed;
        }
      } catch {
        try {
          raw = decodeURIComponent(raw);
        } catch {
          break;
        }
      }
    }
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const parsed = JSON.parse(decodeURIComponent(token));
      if (parsed && parsed.email) return parsed;
    } catch {
      if (token.includes('@')) {
        return { email: token, role: 'ADMIN' };
      }
    }
  }

  return null;
}

function hasPermission(session: { role: string; permissions?: string[] } | null, requiredPerm: string): boolean {
  if (!session) return false;
  const role = (session.role || '').toUpperCase();
  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER' || role === 'PROMOTION MANAGER') {
    return true;
  }
  return Boolean(session.permissions?.includes(requiredPerm));
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    if (!session || !hasPermission(session, 'promotions.view')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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
    const session = getSessionUser(request);
    if (!session || !hasPermission(session, 'promotions.add')) {
      return NextResponse.json(
        { success: false, error: 'Permission Denied: Unauthorized to create promotions.' },
        { status: 403 }
      );
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
