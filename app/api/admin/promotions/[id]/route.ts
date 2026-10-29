import { NextRequest, NextResponse } from 'next/server';
import { getPromoCodes, updatePromoCode, deletePromoCode } from '@/lib/db/promotions';
import {
  getPromoCodeByIdFromDb,
  updatePromoCodeInDb,
  deletePromoCodeInDb,
} from '@/lib/db/repositories/promotions';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAdminSession,
  hasAdminPermission,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'promotions.view')) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view promotions.');
    }

    const { id } = await params;

    if (isDbConfigured()) {
      const promo = await getPromoCodeByIdFromDb(id);
      if (!promo) {
        return NextResponse.json({ success: false, error: 'Promo code not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, promo }, { status: 200 });
    }

    const promos = getPromoCodes();
    const promo = promos.find((p) => p.id === id);
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
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'promotions.edit') && !hasAdminPermission(session, 'promotions.manage')) {
      return forbiddenResponse('Forbidden: Insufficient permissions to edit promotions.');
    }

    const { id } = await params;
    const body = await request.json();

    if (isDbConfigured()) {
      try {
        const promo = await updatePromoCodeInDb(id, body);
        return NextResponse.json({ success: true, promo }, { status: 200 });
      } catch (dbErr: any) {
        return NextResponse.json(
          { success: false, error: dbErr.message || 'Failed to update promo code.' },
          { status: 400 }
        );
      }
    }

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
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'promotions.delete') && !hasAdminPermission(session, 'promotions.manage')) {
      return forbiddenResponse('Forbidden: Insufficient permissions to delete promotions.');
    }

    const { id } = await params;

    if (isDbConfigured()) {
      const ok = await deletePromoCodeInDb(id);
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Promo code not found or already deleted.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Promo code deleted successfully.' }, { status: 200 });
    }

    const result = await deletePromoCode(id, session.email);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Promo code deleted successfully.' }, { status: 200 });
  } catch (error: any) {
    console.error('API /api/admin/promotions/[id] DELETE Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
