import { NextRequest, NextResponse } from 'next/server';
import {
  getPromoCodeById,
  updatePromoCode,
  togglePromoCodeStatus,
  deletePromoCode,
} from '@/lib/db/promotions';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionUser(request);
    if (!session || !hasPermission(session, 'promotions.view')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const promo = getPromoCodeById(id);

    if (!promo) {
      return NextResponse.json({ success: false, error: 'Promo code not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, promo }, { status: 200 });
  } catch (error: any) {
    console.error('API /api/admin/promotions/[id] GET Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionUser(request);
    if (!session || !hasPermission(session, 'promotions.edit')) {
      return NextResponse.json(
        { success: false, error: 'Permission Denied: Unauthorized to edit promotions.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const result = await updatePromoCode(id, body, session.email);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('API /api/admin/promotions/[id] PUT Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionUser(request);
    if (!session || (!hasPermission(session, 'promotions.activate') && !hasPermission(session, 'promotions.edit'))) {
      return NextResponse.json(
        { success: false, error: 'Permission Denied: Unauthorized to toggle promotions.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const result = await togglePromoCodeStatus(id, session.email);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('API /api/admin/promotions/[id] PATCH Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionUser(request);
    if (!session || !hasPermission(session, 'promotions.delete')) {
      return NextResponse.json(
        { success: false, error: 'Permission Denied: Unauthorized to delete promotions.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const result = await deletePromoCode(id, session.email);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('API /api/admin/promotions/[id] DELETE Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
