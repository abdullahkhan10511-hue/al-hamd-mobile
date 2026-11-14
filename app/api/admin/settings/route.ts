import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { seedStoreSettings } from '@/lib/db/seed';
import { StoreSettings } from '@/types/admin';
import { isDbConfigured } from '@/lib/db/mysql';
import { getStoreSettingsFromDb, updateStoreSettingsInDb, invalidateStoreSettingsCache } from '@/lib/db/repositories/settings';
import { normalizeCanonicalUrl, resolveFaviconUrl } from '@/lib/db/settings';
import { getAdminSessionAsync, hasAdminPermission } from '@/lib/db/adminAuth';
import { getDataFilePath, writeAtomicJsonFile } from '@/lib/storage/dataDir';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SETTINGS_FILE_PATH = getDataFilePath('store-settings.json');

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
  let dbError: any = null;
  if (isDbConfigured()) {
    try {
      await updateStoreSettingsInDb(settings);
    } catch (err: any) {
      console.error('MySQL updateStoreSettingsInDb error:', err);
      dbError = err;
    }
  }

  // Invalidate in-memory server cache
  invalidateStoreSettingsCache();

  // Persistent file cache on disk so file-based reads & local fallback stay synchronized
  try {
    writeAtomicJsonFile(SETTINGS_FILE_PATH, settings);
  } catch (err) {
    console.error('Failed to write store-settings.json:', err);
    if (!isDbConfigured() || dbError) {
      throw new Error('Failed to write store settings to persistent server storage.');
    }
  }

  if (isDbConfigured() && dbError) {
    throw new Error(`Database error saving store settings: ${dbError?.message || dbError}`);
  }
}

export async function GET(request: NextRequest) {
  const session = await getAdminSessionAsync(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin session required.' },
      { status: 401 }
    );
  }

  if (!hasAdminPermission(session, ['settings.view', 'settings.edit'])) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to view store settings.' },
      { status: 403 }
    );
  }

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
    const session = await getAdminSessionAsync(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to update settings.' },
        { status: 401 }
      );
    }

    if (!hasAdminPermission(session, ['settings.edit'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions to edit store settings.' },
        { status: 403 }
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

    let revalidated = true;
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      revalidatePath('/shop');
      revalidatePath('/contact');
      revalidatePath('/api/settings');
      revalidatePath('/admin/settings');
      revalidatePath('/admin/settings/seo');
    } catch (revalidateErr) {
      console.warn('revalidatePath notice:', revalidateErr);
      revalidated = false;
    }

    return NextResponse.json({
      success: true,
      revalidated,
      message: revalidated ? 'Saved and live' : 'Saved to server, but storefront revalidation is pending.',
      settings: updated,
    });
  } catch (err: any) {
    console.error('Failed to save store settings:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error while saving settings.' },
      { status: 500 }
    );
  }
}
