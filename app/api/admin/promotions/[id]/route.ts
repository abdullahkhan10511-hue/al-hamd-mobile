import { NextRequest, NextResponse } from 'next/server';
import {
  getPromoCodeById,
  updatePromoCode,
  togglePromoCodeStatus,
  deletePromoCode,
} from '@/lib/db/promotions';
import {
  getAllPromoCodesFromDb,
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
      const allPromos = await getAllPromoCodesFromDb();
      const promo = allPromos.find((p) => p.id === id);
      if (!promo) {
        return NextResponse.json({ success: false, error: 'Promo code not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, promo }, { status: 200 });
    }

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
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'promotions.edit')) {
      return forbiddenResponse('Permission Denied: Unauthorized to edit promotions.');
    }

    const { id } = await params;
    const body = await request.json();

    if (isDbConfigured()) {
      try {
        const promo = await updatePromoCodeInDb(id, body);
        return NextResponse.json({ success: true, promo }, { status: 200 });
      } catch (updateErr: any) {
        return NextResponse.json({ success: false, error: updateErr.message || 'Failed to update promo.' }, { status: 400 });
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, ['promotions.activate', 'promotions.edit'])) {
      return forbiddenResponse('Permission Denied: Unauthorized to toggle promotions.');
    }

    const { id } = await params;

    if (isDbConfigured()) {
      try {
        const allPromos = await getAllPromoCodesFromDb();
        const target = allPromos.find((p) => p.id === id);
        if (!target) {
          return NextResponse.json({ success: false, error: 'Promo code not found.' }, { status: 404 });
        }
        const promo = await updatePromoCodeInDb(id, { isActive: !target.isActive });
        return NextResponse.json({ success: true, promo }, { status: 200 });
      } catch (toggleErr: any) {
        return NextResponse.json({ success: false, error: toggleErr.message || 'Failed to toggle promo.' }, { status: 400 });
      }
    }

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
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'promotions.delete')) {
      return forbiddenResponse('Permission Denied: Unauthorized to delete promotions.');
    }

    const { id } = await params;

    if (isDbConfigured()) {
      try {
        const success = await deletePromoCodeInDb(id);
        return NextResponse.json({ success }, { status: 200 });
      } catch (delErr: any) {
        return NextResponse.json({ success: false, error: delErr.message || 'Failed to delete promo.' }, { status: 400 });
      }
    }

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
