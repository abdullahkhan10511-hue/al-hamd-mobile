import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getActiveDealsFromDb } from '@/lib/db/repositories/deals';
import { getDeals, isDealCurrentlyActive } from '@/lib/db/deals';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const homepageOnly = searchParams.get('homepage') === 'true';

    let deals = [];
    if (isDbConfigured()) {
      try {
        deals = await getActiveDealsFromDb();
      } catch (dbErr) {
        console.warn('MySQL error fetching active deals, falling back to storage:', dbErr);
        deals = getDeals().filter((d) => d && isDealCurrentlyActive(d));
      }
    } else {
      // Local dev offline fallback
      try {
        const { getDevDeals } = await import('@/lib/db/serverDevStorage');
        deals = getDevDeals().filter((d) => d && isDealCurrentlyActive(d));
      } catch {
        deals = getDeals().filter((d) => d && isDealCurrentlyActive(d));
      }
    }

    if (homepageOnly) {
      deals = deals.filter((d: any) => d && d.showOnHomepage);
    }

    return NextResponse.json(
      {
        success: true,
        deals,
        count: deals.length,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching deals:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}
