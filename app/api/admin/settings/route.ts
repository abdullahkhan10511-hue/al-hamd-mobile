import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { seedStoreSettings } from '@/lib/db/seed';
import { StoreSettings } from '@/types/admin';
import { isDbConfigured } from '@/lib/db/mysql';
import { getStoreSettingsFromDb, updateStoreSettingsInDb } from '@/lib/db/repositories/settings';
import { normalizeCanonicalUrl } from '@/lib/db/settings';

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

const SETTINGS_FILE_PATH = path.join(process.cwd(), 'data', 'store-settings.json');

function readLocalFileSettings(): StoreSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const content = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      const data = Array.isArray(parsed) ? parsed[0] : (parsed && parsed['0'] ? parsed['0'] : parsed);
      return {
        ...seedStoreSettings,
        ...(data || {}),
        seo: {
          ...seedStoreSettings.seo,
          ...(data?.seo || {}),
        },
      };
    }
  } catch (err) {
    console.warn('Failed to read store-settings.json:', err);
  }
  return seedStoreSettings;
}

async function readServerSettings(): Promise<StoreSettings> {
  if (isDbConfigured()) {
    try {
      return await getStoreSettingsFromDb();
    } catch (err) {
      console.warn('MySQL readServerSettings notice:', err);
    }
  }
  return readLocalFileSettings();
}

async function writeServerSettings(settings: StoreSettings): Promise<void> {
  if (isDbConfigured()) {
    try {
      await updateStoreSettingsInDb(settings);
    } catch (err) {
      console.warn('MySQL updateStoreSettingsInDb notice:', err);
    }
  }

  // Persistent file cache on disk so file-based reads & local fallback stay synchronized
  try {
    const dir = path.dirname(SETTINGS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write store-settings.json:', err);
  }
}

export async function GET() {
  const settings = await readServerSettings();
  return NextResponse.json(
    { success: true, settings },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');

    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to update settings.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const current = await readServerSettings();
    const rawCanonical = body.canonicalUrl || body.seo?.canonicalUrl || current.canonicalUrl || current.seo?.canonicalUrl;
    const normalizedCanonical = rawCanonical ? normalizeCanonicalUrl(rawCanonical) : 'https://alhamdshop.com';

    const updated: StoreSettings = {
      ...current,
      ...body,
      canonicalUrl: normalizedCanonical,
      seo: {
        ...current.seo,
        ...(body.seo || {}),
        canonicalUrl: normalizedCanonical,
      },
    };

    await writeServerSettings(updated);

    try {
      revalidatePath('/', 'layout');
    } catch (revalidateErr) {
      console.warn('revalidatePath notice:', revalidateErr);
    }

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error('Failed to save store settings:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error while saving settings.' },
      { status: 500 }
    );
  }
}
