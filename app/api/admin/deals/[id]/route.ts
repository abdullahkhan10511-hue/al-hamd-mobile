import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDealById, saveDeal, deleteDeal } from '@/lib/db/deals';
import { getDealByIdFromDb, updateDealInDb, deleteDealFromDb } from '@/lib/db/repositories/deals';
import { isDbConfigured } from '@/lib/db/mysql';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function getSessionUser(request: NextRequest): { email: string; role: string; permissions?: string[] } | null {
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
  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'OWNER' || role === 'MANAGER') {
    return true;
  }
  return Boolean(session.permissions?.includes(requiredPerm) || session.permissions?.includes('promotions.view'));
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
    const session = getSessionUser(request);
    if (!session || !hasPermission(session, 'promotions.edit')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    let updatedDeal;
    if (isDbConfigured()) {
      try {
        updatedDeal = await updateDealInDb(id, body);
        await saveDeal(updatedDeal, session.email);
      } catch (dbErr: any) {
        console.warn('MySQL error updating deal, fallback to storage:', dbErr);
        updatedDeal = await saveDeal({ ...body, id }, session.email);
      }
    } else {
      try {
        const { updateDevDeal } = await import('@/lib/db/serverDevStorage');
        updatedDeal = await updateDevDeal(id, body, session.email);
        await saveDeal(updatedDeal, session.email);
      } catch {
        updatedDeal = await saveDeal({ ...body, id }, session.email);
      }
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
    const session = getSessionUser(request);
    if (!session || !hasPermission(session, 'promotions.delete')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    let success = false;
    if (isDbConfigured()) {
      try {
        success = await deleteDealFromDb(id);
        await deleteDeal(id, session.email);
      } catch (dbErr) {
        console.warn('MySQL error deleting deal, fallback to storage:', dbErr);
        success = await deleteDeal(id, session.email);
      }
    } else {
      try {
        const { deleteDevDeal } = await import('@/lib/db/serverDevStorage');
        success = await deleteDevDeal(id, session.email);
        await deleteDeal(id, session.email);
      } catch {
        success = await deleteDeal(id, session.email);
      }
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
