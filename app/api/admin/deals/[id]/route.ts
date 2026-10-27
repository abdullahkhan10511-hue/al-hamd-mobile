import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDealById, saveDeal, deleteDeal } from '@/lib/db/deals';
import { getDealByIdFromDb, updateDealInDb, deleteDealFromDb } from '@/lib/db/repositories/deals';
import { isDbConfigured } from '@/lib/db/mysql';
import { allowDevMockFallback } from '@/lib/env';
import {
  getAdminSession,
  hasAdminPermission,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';

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
      return forbiddenResponse('Forbidden: Staff permissions required to view deals.');
    }

    const { id } = await params;
    let deal = null;

    if (isDbConfigured()) {
      try {
        deal = await getDealByIdFromDb(id);
      } catch (dbErr) {
        console.warn('MySQL error fetching deal by id:', dbErr);
        deal = await getDealById(id);
      }
    } else {
      try {
        const { getDevDealById } = await import('@/lib/db/serverDevStorage');
        deal = getDevDealById(id);
      } catch {
        deal = await getDealById(id);
      }
    }

    if (!deal) {
      return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deal });
  } catch (error: any) {
    console.error('Error fetching deal:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error' },
      { status: 500 }
    );
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
      return forbiddenResponse('Forbidden: Admin or Promotion Manager credentials required.');
    }

    const { id } = await params;
    const body = await request.json();

    if (body.products !== undefined) {
      if (!Array.isArray(body.products) || body.products.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Please select at least one product for this deal.' },
          { status: 400 }
        );
      }
      if (body.products.length > 100) {
        return NextResponse.json(
          { success: false, error: 'A deal cannot contain more than 100 products.' },
          { status: 400 }
        );
      }
    }

    let updatedDeal;
    if (isDbConfigured()) {
      updatedDeal = await updateDealInDb(id, body);
      try {
        await saveDeal(updatedDeal, session.email);
      } catch (cacheErr) {
        console.warn('Notice syncing updated deal to local cache:', cacheErr);
      }
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      try {
        const { updateDevDeal } = await import('@/lib/db/serverDevStorage');
        updatedDeal = await updateDevDeal(id, body, session.email);
        await saveDeal(updatedDeal, session.email);
      } catch {
        updatedDeal = await saveDeal({ ...body, id }, session.email);
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    try {
      revalidatePath('/');
      revalidatePath('/deals');
      revalidatePath('/api/deals');
    } catch {}

    return NextResponse.json({
      success: true,
      deal: updatedDeal,
      message: `Deal "${updatedDeal.name}" updated successfully.`,
    });
  } catch (error: any) {
    console.error('Error updating deal:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update deal' },
      { status: 500 }
    );
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
      return forbiddenResponse('Forbidden: Admin or Promotion Manager credentials required.');
    }

    const { id } = await params;

    let success = false;
    if (isDbConfigured()) {
      success = await deleteDealFromDb(id);
      if (!success) {
        return NextResponse.json({ success: false, error: 'Deal not found in database.' }, { status: 404 });
      }
      try {
        await deleteDeal(id, session.email);
      } catch (cacheErr) {
        console.warn('Notice deleting deal from local cache:', cacheErr);
      }
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      try {
        const { deleteDevDeal } = await import('@/lib/db/serverDevStorage');
        success = await deleteDevDeal(id, session.email);
        await deleteDeal(id, session.email);
      } catch {
        success = await deleteDeal(id, session.email);
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Database is not configured in production.' },
        { status: 503 }
      );
    }

    try {
      revalidatePath('/');
      revalidatePath('/deals');
      revalidatePath('/api/deals');
    } catch {}

    return NextResponse.json({
      success,
      message: success ? 'Deal deleted successfully' : 'Deal not found',
    });
  } catch (error: any) {
    console.error('Error deleting deal:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete deal' },
      { status: 500 }
    );
  }
}
