import { NextRequest, NextResponse } from 'next/server';
import { getPromoCodeUsages } from '@/lib/db/promotions';

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
