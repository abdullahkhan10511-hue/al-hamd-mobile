import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAllHomepageVideosFromDb,
  saveHomepageVideoInDb,
  deleteHomepageVideoInDb,
  reorderHomepageVideosInDb,
} from '@/lib/db/repositories/homepageVideos';
import { seedHomepageVideos } from '@/lib/db/homepageVideos';
import { HomepageVideo } from '@/types/admin';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function getSessionUser(request: NextRequest): { email: string; role: string } | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (!cookieVal) return null;

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

  return null;
}

export async function GET() {
  try {
    let items: HomepageVideo[] = [];

    if (isDbConfigured()) {
      try {
        items = await getAllHomepageVideosFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/admin/homepage-videos:', err);
        items = seedHomepageVideos;
      }
    } else {
      items = seedHomepageVideos;
    }

    items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load homepage videos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');
    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to modify homepage videos.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, items, item, id, updates, orderedIds } = body;

    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database is not configured.' },
        { status: 503 }
      );
    }

    if (action === 'sync' && Array.isArray(items)) {
      for (const itm of items) {
        await saveHomepageVideoInDb(itm);
      }
      const updated = await getAllHomepageVideosFromDb();
      return NextResponse.json({ success: true, items: updated });
    }

    if (action === 'add' && item) {
      const saved = await saveHomepageVideoInDb(item);
      const all = await getAllHomepageVideosFromDb();
      return NextResponse.json({ success: true, item: saved, items: all });
    }

    if (action === 'update' && id && updates) {
      const saved = await saveHomepageVideoInDb({ ...updates, id });
      const all = await getAllHomepageVideosFromDb();
      return NextResponse.json({ success: true, item: saved, items: all });
    }

    if (action === 'delete' && id) {
      await deleteHomepageVideoInDb(id);
      const all = await getAllHomepageVideosFromDb();
      return NextResponse.json({ success: true, items: all });
    }

    if (action === 'reorder' && Array.isArray(orderedIds)) {
      await reorderHomepageVideosInDb(orderedIds);
      const all = await getAllHomepageVideosFromDb();
      return NextResponse.json({ success: true, items: all });
    }

    // Direct list overwrite
    if (Array.isArray(body)) {
      for (const itm of body) {
        await saveHomepageVideoInDb(itm);
      }
      const all = await getAllHomepageVideosFromDb();
      return NextResponse.json({ success: true, items: all });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in homepage videos API:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process homepage videos request' },
      { status: 500 }
    );
  }
}
