import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminSession, hasAdminPermission } from '@/lib/db/adminAuth';
import {
  readPersistentAnnouncements,
  writePersistentAnnouncements,
} from '@/lib/db/announcementsStorage';
import { AnnouncementItem } from '@/types/admin';

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

  if (!hasAdminPermission(session, ['content.banners', 'content.homepage', 'settings.edit', 'settings.view'])) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to view announcements.' },
      { status: 403 }
    );
  }

  const items = readPersistentAnnouncements();
  return NextResponse.json(
    { success: true, items, count: items.length },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const session = getAdminSession(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin session required.' },
      { status: 401 }
    );
  }

  if (!hasAdminPermission(session, ['content.banners', 'content.homepage', 'settings.edit'])) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to modify announcements.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const items: AnnouncementItem[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
      ? body.items
      : null;

    if (!items) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload: items array is required.' },
        { status: 400 }
      );
    }

    writePersistentAnnouncements(items);

    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      revalidatePath('/admin/navigation');
      revalidatePath('/api/announcements');
    } catch (revalErr) {
      console.warn('Announcements revalidation note:', revalErr);
    }

    const saved = readPersistentAnnouncements();
    return NextResponse.json({
      success: true,
      message: 'Announcements saved successfully.',
      items: saved,
    });
  } catch (err: any) {
    console.error('Failed to save announcements:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save announcements.' },
      { status: 500 }
    );
  }
}
