import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDeals, saveDeal } from '@/lib/db/deals';
import { getAllDealsFromDb, insertDealToDb } from '@/lib/db/repositories/deals';
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

export async function GET(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    if (!session || !hasPermission(session, 'promotions.view')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Staff permissions required to view deals.' },
        { status: 401 }
      );
    }

    let deals = [];
    if (isDbConfigured()) {
      try {
        deals = await getAllDealsFromDb();
      } catch (dbErr) {
        console.warn('MySQL error fetching admin deals, falling back to local storage:', dbErr);
        deals = getDeals();
      }
    } else {
      try {
        const { getDevDeals } = await import('@/lib/db/serverDevStorage');
        deals = getDevDeals();
      } catch {
        deals = getDeals();
      }
    }

    return NextResponse.json({
      success: true,
      deals,
      count: deals.length,
    });
  } catch (error: any) {
    console.error('Error fetching admin deals:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    if (!session || !hasPermission(session, 'promotions.add')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin or Promotion Manager credentials required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (!body || !body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Deal Name is required.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.products) || body.products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one product for this deal.' },
        { status: 400 }
      );
    }

    let savedDeal;
    if (isDbConfigured()) {
      try {
        savedDeal = await insertDealToDb(body);
        await saveDeal(savedDeal, session.email);
      } catch (dbErr: any) {
        console.warn('MySQL error inserting deal, falling back to local storage:', dbErr);
        savedDeal = await saveDeal(body, session.email);
      }
    } else {
      try {
        const { insertDevDeal } = await import('@/lib/db/serverDevStorage');
        savedDeal = await insertDevDeal(body, session.email);
        await saveDeal(savedDeal, session.email);
      } catch {
        savedDeal = await saveDeal(body, session.email);
      }
    }

    try {
      revalidatePath('/');
      revalidatePath('/deals');
      revalidatePath('/api/deals');
    } catch {}

    return NextResponse.json({
      success: true,
      deal: savedDeal,
      message: `Deal "${savedDeal.name}" created successfully.`,
    });
  } catch (error: any) {
    console.error('Error creating deal:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create deal' },
      { status: 500 }
    );
  }
}
