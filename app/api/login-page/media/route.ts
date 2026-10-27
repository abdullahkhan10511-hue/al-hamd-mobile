import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllLoginPageMediaFromDb } from '@/lib/db/repositories/loginPage';
import { DEFAULT_LOGIN_PAGE_MEDIA, LoginPageMediaItem } from '@/lib/db/loginPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATA_DIR = path.join(process.cwd(), 'data');
const MEDIA_FILE = path.join(DATA_DIR, 'login-page-media.json');

function readLocalLoginPageMedia(): LoginPageMediaItem[] {
  try {
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
        items = readLocalLoginPageMedia();
      }
    } else {
      items = readLocalLoginPageMedia();
    }

    const activeItems = items.filter((m) => m && m.isActive);

    return NextResponse.json(
      { success: true, items: activeItems },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch login page media' },
      { status: 500 }
    );
  }
}
