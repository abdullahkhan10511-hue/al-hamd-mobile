import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAllHomepageVideosFromDb,
  getActiveHomepageVideosFromDb,
} from '@/lib/db/repositories/homepageVideos';
import { seedHomepageVideos } from '@/lib/db/homepageVideos';
import { HomepageVideo } from '@/types/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let items: HomepageVideo[] = [];

    if (isDbConfigured()) {
      try {
        items = await getAllHomepageVideosFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/homepage-videos:', err);
        items = seedHomepageVideos;
      }
    } else {
      items = seedHomepageVideos;
    }

    if (!items || items.length === 0) {
      items = seedHomepageVideos;
    }

    // Sort by displayOrder ascending, then updated_at descending
    items.sort((a, b) => {
      const orderDiff = (a.displayOrder || 0) - (b.displayOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    const activeVideos = items.filter((v) => v.active);

    return NextResponse.json(
      {
        success: true,
        videos: items,
        items,
        activeVideos,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to load homepage videos',
        videos: seedHomepageVideos,
        items: seedHomepageVideos,
      },
      { status: 500 }
    );
  }
}
