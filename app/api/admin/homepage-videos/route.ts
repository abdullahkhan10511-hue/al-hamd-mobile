import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
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

const VIDEOS_FILE_PATH = path.join(process.cwd(), 'data', 'homepage-videos.json');

const DEFAULT_VIDEOS: HomepageVideo[] = [
  {
    id: 'video-1',
    title: 'AL-HAMD Mobile Ecosystem Showcase',
    url: '/uploads/videos/alhamd_hero_showcase_1.mp4',
    thumbnailUrl: '',
    active: true,
    displayOrder: 1,
    duration: 5,
    size: 1128375,
    mimeType: 'video/mp4',
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-25T10:00:00.000Z',
  },
  {
    id: 'video-2',
    title: 'GaN Fast Charging & Premium Accessories',
    url: '/uploads/videos/alhamd_hero_showcase_2.mp4',
    thumbnailUrl: '',
    active: true,
    displayOrder: 2,
    duration: 52,
    size: 4372373,
    mimeType: 'video/mp4',
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-25T10:00:00.000Z',
  },
];

function readVideosFile(): HomepageVideo[] {
  try {
    if (fs.existsSync(VIDEOS_FILE_PATH)) {
      const content = fs.readFileSync(VIDEOS_FILE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read homepage-videos.json:', err);
  }
  return DEFAULT_VIDEOS;
}

function writeVideosFile(items: HomepageVideo[]): void {
  try {
    const dir = path.dirname(VIDEOS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(VIDEOS_FILE_PATH, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write homepage-videos.json:', err);
  }
}

export async function GET() {
  const items = readVideosFile();
  items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  return NextResponse.json({ success: true, items });
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

    let currentList = readVideosFile();

    if (action === 'sync' && Array.isArray(items)) {
      currentList = items;
      writeVideosFile(currentList);
      return NextResponse.json({ success: true, items: currentList });
    }

    if (action === 'add' && item) {
      const nextOrder =
        item.displayOrder !== undefined
          ? item.displayOrder
          : currentList.length > 0
          ? Math.max(...currentList.map((m) => m.displayOrder || 0)) + 1
          : 1;

      const newItem: HomepageVideo = {
        ...item,
        id: item.id || `video-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        displayOrder: nextOrder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      currentList.push(newItem);
      currentList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      writeVideosFile(currentList);
      return NextResponse.json({ success: true, item: newItem, items: currentList });
    }

    if (action === 'update' && id && updates) {
      const idx = currentList.findIndex((m) => m.id === id);
      if (idx === -1) {
        return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
      }
      currentList[idx] = {
        ...currentList[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      currentList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      writeVideosFile(currentList);
      return NextResponse.json({ success: true, item: currentList[idx], items: currentList });
    }

    if (action === 'delete' && id) {
      currentList = currentList.filter((m) => m.id !== id);
      currentList.forEach((v, idx) => {
        v.displayOrder = idx + 1;
      });
      writeVideosFile(currentList);
      return NextResponse.json({ success: true, items: currentList });
    }

    if (action === 'reorder' && Array.isArray(orderedIds)) {
      const map = new Map(currentList.map((m) => [m.id, m]));
      const reordered: HomepageVideo[] = [];
      orderedIds.forEach((mId, idx) => {
        const found = map.get(mId);
        if (found) {
          reordered.push({ ...found, displayOrder: idx + 1, updatedAt: new Date().toISOString() });
          map.delete(mId);
        }
      });
      map.forEach((rem) => {
        reordered.push({ ...rem, displayOrder: reordered.length + 1 });
      });
      writeVideosFile(reordered);
      return NextResponse.json({ success: true, items: reordered });
    }

    // Direct list overwrite
    if (Array.isArray(body)) {
      writeVideosFile(body);
      return NextResponse.json({ success: true, items: body });
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
