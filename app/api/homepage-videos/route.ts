import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getActiveHomepageVideosFromDb } from '@/lib/db/repositories/homepageVideos';
import { readPersistentHomepageVideos } from '@/lib/db/homepageVideosStorage';
import { HomepageVideo } from '@/types/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    let items: HomepageVideo[] = [];

    if (isDbConfigured()) {
      try {
        items = await getActiveHomepageVideosFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/homepage-videos:', err);
        items = readPersistentHomepageVideos();
      }
    } else {
      // Disk-persisted storage fallback when DB is not configured
      items = readPersistentHomepageVideos();
    }

    // Filter strictly for active items with valid non-empty URLs
    const activePlayable = (items || []).filter((v) => {
      if (!v) return false;
      const isActive =
        (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') &&
        v.active !== false &&
        (v.active as any) !== 0 &&
        (v.active as any) !== '0' &&
        (v.active as any) !== 'false';
      const hasUrl = typeof v.url === 'string' && v.url.trim().length > 0;
      return Boolean(isActive && hasUrl);
    });

    // Deterministic sort: displayOrder ASC, then id ASC
    activePlayable.sort((a, b) => {
      const orderA = typeof a.displayOrder === 'number' && !isNaN(a.displayOrder) ? a.displayOrder : 0;
      const orderB = typeof b.displayOrder === 'number' && !isNaN(b.displayOrder) ? b.displayOrder : 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.id || '').localeCompare(b.id || '');
    });

    return NextResponse.json(
      {
        success: true,
        videos: activePlayable,
        items: activePlayable,
        activeVideos: activePlayable,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to load homepage videos',
        videos: [],
        items: [],
        activeVideos: [],
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  }
}
