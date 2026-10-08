import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getDealBySlugFromDb, getDealByIdFromDb } from '@/lib/db/repositories/deals';
import { getDealBySlug, getDealById, isDealCurrentlyActive } from '@/lib/db/deals';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Deal slug is required' }, { status: 400 });
    }

    let deal = null;

    if (isDbConfigured()) {
      try {
        deal = (await getDealBySlugFromDb(slug)) || (await getDealByIdFromDb(slug));
      } catch (err) {
        console.warn('MySQL lookup error for deal, falling back:', err);
      }
    }

    if (!deal) {
      try {
        const { getDevDeals } = await import('@/lib/db/serverDevStorage');
        const devList = getDevDeals();
        const clean = decodeURIComponent(slug).toLowerCase().trim();
        deal = devList.find((d) => d && (d.slug?.toLowerCase().trim() === clean || d.id === slug)) || null;
      } catch {}
    }

    if (!deal) {
      deal = getDealBySlug(slug) || (await getDealById(slug));
    }

    if (!deal) {
      return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    }

    const isActive = isDealCurrentlyActive(deal);

    return NextResponse.json({
      success: true,
      deal,
      isActive,
    });
  } catch (error: any) {
    console.error('Error fetching deal by slug:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch deal' },
      { status: 500 }
    );
  }
}
