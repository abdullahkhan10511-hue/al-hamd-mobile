import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDeals, saveDeal } from '@/lib/db/deals';
import { getAllDealsFromDb, insertDealToDb } from '@/lib/db/repositories/deals';
import { isDbConfigured } from '@/lib/db/mysql';
import { allowDevMockFallback } from '@/lib/env';
import {
  getAdminSession,
  hasAdminPermission,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'promotions.view')) {
      return forbiddenResponse('Forbidden: Staff permissions required to view deals.');
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
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }
    if (!hasAdminPermission(session, 'promotions.add')) {
      return forbiddenResponse('Forbidden: Admin or Promotion Manager credentials required.');
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

    if (body.products.length > 100) {
      return NextResponse.json(
        { success: false, error: 'A deal cannot contain more than 100 products.' },
        { status: 400 }
      );
    }

    let savedDeal;
    if (isDbConfigured()) {
      savedDeal = await insertDealToDb(body);
      try {
        await saveDeal(savedDeal, session.email);
      } catch (cacheErr) {
        console.warn('Notice syncing deal to local cache:', cacheErr);
      }
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      try {
        const { insertDevDeal } = await import('@/lib/db/serverDevStorage');
        savedDeal = await insertDevDeal(body, session.email);
        await saveDeal(savedDeal, session.email);
      } catch {
        savedDeal = await saveDeal(body, session.email);
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
