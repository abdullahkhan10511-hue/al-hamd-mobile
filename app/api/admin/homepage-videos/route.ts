import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAllHomepageVideosFromDb,
  saveHomepageVideoInDb,
  deleteHomepageVideoInDb,
  reorderHomepageVideosInDb,
} from '@/lib/db/repositories/homepageVideos';
import {
  readPersistentHomepageVideos,
  writePersistentHomepageVideos,
  savePersistentHomepageVideo,
  deletePersistentHomepageVideo,
  reorderPersistentHomepageVideos,
} from '@/lib/db/homepageVideosStorage';
import { seedHomepageVideos } from '@/lib/db/homepageVideos';
import { HomepageVideo } from '@/types/admin';
import { getAdminSession, hasAdminPermission } from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = getAdminSession(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin session required.' },
      { status: 401 }
    );
  }

  if (!hasAdminPermission(session, ['content.homepage', 'content.banners', 'settings.edit', 'settings.view'])) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to view homepage videos.' },
      { status: 403 }
    );
  }

  try {
    let items: HomepageVideo[] = [];

    if (isDbConfigured()) {
      try {
        items = await getAllHomepageVideosFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/admin/homepage-videos:', err);
        items = readPersistentHomepageVideos();
      }
    } else {
      items = readPersistentHomepageVideos();
    }

    // Deterministic sort: displayOrder ASC, then id ASC
    items.sort((a, b) => {
      const orderDiff = (a.displayOrder || 0) - (b.displayOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json(
      { success: true, items, videos: items },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load homepage videos', items: seedHomepageVideos, videos: seedHomepageVideos },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to modify homepage videos.' },
        { status: 401 }
      );
    }

    if (!hasAdminPermission(session, ['content.homepage', 'content.banners', 'settings.edit'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions to modify homepage videos.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, items, item, id, updates, orderedIds } = body;

    const sortDeterministic = (list: HomepageVideo[]) => {
      return list.sort((a, b) => {
        const orderDiff = (a.displayOrder || 0) - (b.displayOrder || 0);
        if (orderDiff !== 0) return orderDiff;
        return a.id.localeCompare(b.id);
      });
    };

    if (isDbConfigured()) {
      if (action === 'sync' && Array.isArray(items)) {
        for (let idx = 0; idx < items.length; idx++) {
          const itm = items[idx];
          if (!itm) continue;
          const displayOrder = typeof itm.displayOrder === 'number' && itm.displayOrder > 0 ? itm.displayOrder : idx + 1;
          await saveHomepageVideoInDb({ ...itm, displayOrder });
        }

        const updated = sortDeterministic(await getAllHomepageVideosFromDb());
        try { writePersistentHomepageVideos(updated); } catch {}
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, items: updated, videos: updated });
      }

      if (action === 'add' && item) {
        const saved = await saveHomepageVideoInDb(item);
        const all = sortDeterministic(await getAllHomepageVideosFromDb());
        try { writePersistentHomepageVideos(all); } catch {}
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, item: saved, items: all, videos: all });
      }

      if (action === 'update' && id && updates) {
        const saved = await saveHomepageVideoInDb({ ...updates, id });
        const all = sortDeterministic(await getAllHomepageVideosFromDb());
        try { writePersistentHomepageVideos(all); } catch {}
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, item: saved, items: all, videos: all });
      }

      if (action === 'delete' && id) {
        await deleteHomepageVideoInDb(id);
        const all = sortDeterministic(await getAllHomepageVideosFromDb());
        try { writePersistentHomepageVideos(all); } catch {}
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, items: all, videos: all });
      }

      if (action === 'reorder' && Array.isArray(orderedIds)) {
        await reorderHomepageVideosInDb(orderedIds);
        if (Array.isArray(items)) {
          for (const itm of items) {
            if (itm && itm.id) {
              await saveHomepageVideoInDb(itm);
            }
          }
        }
        const all = sortDeterministic(await getAllHomepageVideosFromDb());
        try { writePersistentHomepageVideos(all); } catch {}
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, items: all, videos: all });
      }

      // Direct list upsert without destructive deletion
      if (Array.isArray(body)) {
        for (let idx = 0; idx < body.length; idx++) {
          const itm = body[idx];
          if (!itm) continue;
          const displayOrder = typeof itm.displayOrder === 'number' && itm.displayOrder > 0 ? itm.displayOrder : idx + 1;
          await saveHomepageVideoInDb({ ...itm, displayOrder });
        }
        const all = sortDeterministic(await getAllHomepageVideosFromDb());
        try { writePersistentHomepageVideos(all); } catch {}
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, items: all, videos: all });
      }
    } else {
      // Disk-based fallback storage
      if (action === 'sync' && Array.isArray(items)) {
        writePersistentHomepageVideos(items);
        const updated = readPersistentHomepageVideos();
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, items: updated, videos: updated });
      }

      if (action === 'add' && item) {
        const saved = savePersistentHomepageVideo(item);
        const all = readPersistentHomepageVideos();
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, item: saved, items: all, videos: all });
      }

      if (action === 'update' && id && updates) {
        const saved = savePersistentHomepageVideo({ ...updates, id });
        const all = readPersistentHomepageVideos();
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, item: saved, items: all, videos: all });
      }

      if (action === 'delete' && id) {
        deletePersistentHomepageVideo(id);
        const all = readPersistentHomepageVideos();
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, items: all, videos: all });
      }

      if (action === 'reorder' && Array.isArray(orderedIds)) {
        const all = reorderPersistentHomepageVideos(orderedIds);
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, items: all, videos: all });
      }

      if (Array.isArray(body)) {
        writePersistentHomepageVideos(body);
        const all = readPersistentHomepageVideos();
        try { revalidatePath('/'); } catch {}
        return NextResponse.json({ success: true, items: all, videos: all });
      }
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
