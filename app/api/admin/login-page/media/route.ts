import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAllLoginPageMediaFromDb,
  saveLoginPageMediaInDb,
  deleteLoginPageMediaInDb,
  reorderLoginPageMediaInDb,
} from '@/lib/db/repositories/loginPage';
import { DEFAULT_LOGIN_PAGE_MEDIA, LoginPageMediaItem } from '@/lib/db/loginPage';
import { getAdminSession } from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATA_DIR = path.join(process.cwd(), 'data');
const MEDIA_FILE = path.join(DATA_DIR, 'login-page-media.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalLoginPageMedia(): LoginPageMediaItem[] {
  try {
    ensureDataDir();
    if (fs.existsSync(MEDIA_FILE)) {
      const raw = fs.readFileSync(MEDIA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading login-page-media.json:', err);
  }
  return DEFAULT_LOGIN_PAGE_MEDIA;
}

function writeLocalLoginPageMedia(media: LoginPageMediaItem[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(MEDIA_FILE, JSON.stringify(media, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write login-page-media.json:', err);
  }
}

export async function GET() {
  try {
    let items: LoginPageMediaItem[] = [];

    if (isDbConfigured()) {
      try {
        items = await getAllLoginPageMediaFromDb();
        if (items.length === 0) {
          items = readLocalLoginPageMedia();
        }
      } catch (err) {
        console.warn('MySQL error in /api/admin/login-page/media:', err);
        items = readLocalLoginPageMedia();
      }
    } else {
      items = readLocalLoginPageMedia();
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
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to modify media.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, items, item, id, updates, orderedIds } = body;
    let localMedia = readLocalLoginPageMedia();

    if (action === 'sync' && Array.isArray(items)) {
      if (isDbConfigured()) {
        try {
          for (const itm of items) {
            await saveLoginPageMediaInDb(itm);
          }
        } catch (dbErr) {
          console.warn('MySQL sync media warning:', dbErr);
        }
      }
      writeLocalLoginPageMedia(items);
      try { revalidatePath('/login'); revalidatePath('/admin/login-page'); } catch {}
      return NextResponse.json({ success: true, items });
    }

    if (action === 'add' && item) {
      const newItem: LoginPageMediaItem = {
        id: item.id || `login-media-${Date.now()}`,
        type: item.type || 'image',
        url: item.url || '',
        thumbnailUrl: item.thumbnailUrl || undefined,
        title: item.title || 'Media Showcase',
        caption: item.caption,
        productName: item.productName,
        priceTag: item.priceTag,
        transition: item.transition || 'default',
        duration: item.duration,
        autoPlay: item.autoPlay,
        loop: item.loop,
        isActive: item.isActive !== false,
        displayOrder: Number(item.displayOrder) || localMedia.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isDbConfigured()) {
        try {
          await saveLoginPageMediaInDb(newItem);
        } catch (dbErr) {
          console.warn('MySQL add media warning:', dbErr);
        }
      }

      localMedia.push(newItem);
      localMedia.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      writeLocalLoginPageMedia(localMedia);

      try { revalidatePath('/login'); revalidatePath('/admin/login-page'); } catch {}
      return NextResponse.json({ success: true, item: newItem, items: localMedia });
    }

    if (action === 'update' && id && updates) {
      const index = localMedia.findIndex((m) => m.id === id);
      const updatedItem = index !== -1
        ? { ...localMedia[index], ...updates, updatedAt: new Date().toISOString() }
        : { ...updates, id, updatedAt: new Date().toISOString() };

      if (isDbConfigured()) {
        try {
          await saveLoginPageMediaInDb(updatedItem);
        } catch (dbErr) {
          console.warn('MySQL update media warning:', dbErr);
        }
      }

      if (index !== -1) {
        localMedia[index] = updatedItem;
      } else {
        localMedia.push(updatedItem);
      }
      localMedia.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      writeLocalLoginPageMedia(localMedia);

      try { revalidatePath('/login'); revalidatePath('/admin/login-page'); } catch {}
      return NextResponse.json({ success: true, item: updatedItem, items: localMedia });
    }

    if (action === 'delete' && id) {
      if (isDbConfigured()) {
        try {
          await deleteLoginPageMediaInDb(id);
        } catch (dbErr) {
          console.warn('MySQL delete media warning:', dbErr);
        }
      }
      localMedia = localMedia.filter((m) => m.id !== id);
      writeLocalLoginPageMedia(localMedia);

      try { revalidatePath('/login'); revalidatePath('/admin/login-page'); } catch {}
      return NextResponse.json({ success: true, items: localMedia });
    }

    if (action === 'reorder' && Array.isArray(orderedIds)) {
      if (isDbConfigured()) {
        try {
          await reorderLoginPageMediaInDb(orderedIds);
        } catch (dbErr) {
          console.warn('MySQL reorder media warning:', dbErr);
        }
      }

      localMedia = localMedia.map((m) => {
        const newIdx = orderedIds.indexOf(m.id);
        return {
          ...m,
          displayOrder: newIdx !== -1 ? newIdx + 1 : m.displayOrder,
        };
      }).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

      writeLocalLoginPageMedia(localMedia);

      try { revalidatePath('/login'); revalidatePath('/admin/login-page'); } catch {}
      return NextResponse.json({ success: true, items: localMedia });
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
