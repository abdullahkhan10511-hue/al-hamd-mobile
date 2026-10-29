import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminSession, hasAdminPermission } from '@/lib/db/adminAuth';
import {
  readPersistentNavigation,
  writePersistentNavigation,
} from '@/lib/db/navigationStorage';
import { invalidateClientCache } from '@/lib/db/storage';
import { NavigationItem } from '@/types/admin';

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

  if (!hasAdminPermission(session, ['content.navigation', 'settings.edit', 'settings.view', 'pages.manage_nav'])) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to view navigation menu.' },
      { status: 403 }
    );
  }

  const items = readPersistentNavigation();
  return NextResponse.json(
    { success: true, items, count: items.length },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
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

  if (!hasAdminPermission(session, ['content.navigation', 'settings.edit', 'pages.manage_nav'])) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to modify navigation menu.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const items: NavigationItem[] = Array.isArray(body)
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

    writePersistentNavigation(items);
    invalidateClientCache();

    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      revalidatePath('/admin/navigation');
      revalidatePath('/api/navigation');
    } catch (revalErr) {
      console.warn('Navigation revalidation note:', revalErr);
    }

    const saved = readPersistentNavigation();
    return NextResponse.json({
      success: true,
      message: 'Navigation menu saved successfully.',
      items: saved,
    });
  } catch (err: any) {
    console.error('Failed to save navigation:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save navigation menu.' },
      { status: 500 }
    );
  }
}
