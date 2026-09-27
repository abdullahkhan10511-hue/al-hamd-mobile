import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAllLoginPageMediaFromDb,
  saveLoginPageMediaInDb,
  deleteLoginPageMediaInDb,
  reorderLoginPageMediaInDb,
} from '@/lib/db/repositories/loginPage';
import { DEFAULT_LOGIN_PAGE_MEDIA, LoginPageMediaItem } from '@/lib/db/loginPage';

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
    let items: LoginPageMediaItem[] = [];

    if (isDbConfigured()) {
      try {
        items = await getAllLoginPageMediaFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/admin/login-page/media:', err);
        items = DEFAULT_LOGIN_PAGE_MEDIA;
      }
    } else {
      items = DEFAULT_LOGIN_PAGE_MEDIA;
    }

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load login page media' },
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
        { success: false, error: 'Unauthorized. Admin credentials required to modify media.' },
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
        await saveLoginPageMediaInDb(itm);
      }
      const updated = await getAllLoginPageMediaFromDb();
      return NextResponse.json({ success: true, items: updated });
    }

    if (action === 'add' && item) {
      const saved = await saveLoginPageMediaInDb(item);
      const all = await getAllLoginPageMediaFromDb();
      return NextResponse.json({ success: true, item: saved, items: all });
    }

    if (action === 'update' && id && updates) {
      const saved = await saveLoginPageMediaInDb({ ...updates, id });
      const all = await getAllLoginPageMediaFromDb();
      return NextResponse.json({ success: true, item: saved, items: all });
    }

    if (action === 'delete' && id) {
      await deleteLoginPageMediaInDb(id);
      const all = await getAllLoginPageMediaFromDb();
      return NextResponse.json({ success: true, items: all });
    }

    if (action === 'reorder' && Array.isArray(orderedIds)) {
      await reorderLoginPageMediaInDb(orderedIds);
      const all = await getAllLoginPageMediaFromDb();
      return NextResponse.json({ success: true, items: all });
    }

    if (Array.isArray(body)) {
      for (const itm of body) {
        await saveLoginPageMediaInDb(itm);
      }
      const all = await getAllLoginPageMediaFromDb();
      return NextResponse.json({ success: true, items: all });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in login page media API:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process media request' },
      { status: 500 }
    );
  }
}
