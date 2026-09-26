import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
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

const MEDIA_FILE_PATH = path.join(process.cwd(), 'data', 'login-page-media.json');

function readMediaFile(): LoginPageMediaItem[] {
  try {
    if (fs.existsSync(MEDIA_FILE_PATH)) {
      const content = fs.readFileSync(MEDIA_FILE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read login-page-media.json:', err);
  }
  return DEFAULT_LOGIN_PAGE_MEDIA;
}

function writeMediaFile(items: LoginPageMediaItem[]): void {
  try {
    const dir = path.dirname(MEDIA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MEDIA_FILE_PATH, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write login-page-media.json:', err);
  }
}

export async function GET() {
  const items = readMediaFile();
  return NextResponse.json({ success: true, items });
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

    let currentList = readMediaFile();

    if (action === 'sync' && Array.isArray(items)) {
      currentList = items;
      writeMediaFile(currentList);
      return NextResponse.json({ success: true, items: currentList });
    }

    if (action === 'add' && item) {
      const nextOrder =
        item.displayOrder !== undefined
          ? item.displayOrder
          : currentList.length > 0
          ? Math.max(...currentList.map((m) => m.displayOrder || 0)) + 1
          : 1;

      const newItem: LoginPageMediaItem = {
        ...item,
        id: item.id || `login-media-${Date.now()}`,
        displayOrder: nextOrder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      currentList.push(newItem);
      currentList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      writeMediaFile(currentList);
      return NextResponse.json({ success: true, item: newItem, items: currentList });
    }

    if (action === 'update' && id && updates) {
      const idx = currentList.findIndex((m) => m.id === id);
      if (idx === -1) {
        return NextResponse.json({ success: false, error: 'Media not found' }, { status: 404 });
      }
      currentList[idx] = {
        ...currentList[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      currentList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      writeMediaFile(currentList);
      return NextResponse.json({ success: true, item: currentList[idx], items: currentList });
    }

    if (action === 'delete' && id) {
      currentList = currentList.filter((m) => m.id !== id);
      writeMediaFile(currentList);
      return NextResponse.json({ success: true, items: currentList });
    }

    if (action === 'reorder' && Array.isArray(orderedIds)) {
      const map = new Map(currentList.map((m) => [m.id, m]));
      const reordered: LoginPageMediaItem[] = [];
      orderedIds.forEach((mId, idx) => {
        const found = map.get(mId);
        if (found) {
          reordered.push({ ...found, displayOrder: idx + 1, updatedAt: new Date().toISOString() });
          map.delete(mId);
        }
      });
      map.forEach((rem) => reordered.push(rem));
      writeMediaFile(reordered);
      return NextResponse.json({ success: true, items: reordered });
    }

    // Default fallback: direct list overwrite if array passed
    if (Array.isArray(body)) {
      writeMediaFile(body);
      return NextResponse.json({ success: true, items: body });
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
