import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { seedStoreSettings } from '@/lib/db/seed';
import { StoreSettings } from '@/types/admin';
import { isDbConfigured } from '@/lib/db/mysql';
import { getStoreSettingsFromDb, updateStoreSettingsInDb } from '@/lib/db/repositories/settings';
import { normalizeCanonicalUrl, resolveFaviconUrl } from '@/lib/db/settings';
import { getAdminSession } from '@/lib/db/adminAuth';

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
    const session = getAdminSession(request) || getSessionUser(request);
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
    const rawFavicon = resolveFaviconUrl(
      body.faviconUrl,
      body.seo?.faviconUrl || current.faviconUrl || current.seo?.faviconUrl
    );
    const rawLogo = body.logoUrl !== undefined ? body.logoUrl : (body.seo?.logoUrl !== undefined ? body.seo.logoUrl : current.logoUrl);
    const rawWebsiteTitle = body.websiteTitle !== undefined ? body.websiteTitle : (body.seo?.websiteTitle !== undefined ? body.seo.websiteTitle : current.websiteTitle);
    const rawOgImage = body.ogImageUrl !== undefined ? body.ogImageUrl : (body.seo?.ogImageUrl !== undefined ? body.seo.ogImageUrl : current.ogImageUrl);
    const rawStoreName = body.storeName !== undefined ? body.storeName.trim() : current.storeName;
    const rawSearchTitle = body.seo?.searchEngineTitle !== undefined ? body.seo.searchEngineTitle : (body.searchEngineTitle !== undefined ? body.searchEngineTitle : current.seo?.searchEngineTitle);
    const rawSearchDesc = body.seo?.searchEngineDescription !== undefined ? body.seo.searchEngineDescription : (body.searchEngineDescription !== undefined ? body.searchEngineDescription : current.seo?.searchEngineDescription);
    const rawMetaDesc = body.seo?.metaDescription !== undefined ? body.seo.metaDescription : (body.metaDescription !== undefined ? body.metaDescription : current.seo?.metaDescription);

    const updated: StoreSettings = {
      ...current,
      ...body,
      storeName: rawStoreName,
      logoUrl: rawLogo,
      faviconUrl: rawFavicon,
      websiteTitle: rawWebsiteTitle,
      ogImageUrl: rawOgImage,
      canonicalUrl: normalizedCanonical,
      seo: {
        ...current.seo,
        ...(body.seo || {}),
        websiteTitle: rawWebsiteTitle,
        canonicalUrl: normalizedCanonical,
        logoUrl: rawLogo,
        faviconUrl: rawFavicon,
        ogImageUrl: rawOgImage,
        searchEngineTitle: rawSearchTitle,
        searchEngineDescription: rawSearchDesc,
        metaTitle: rawWebsiteTitle,
        metaDescription: rawMetaDesc,
      },
    };

    await writeServerSettings(updated);

    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
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
