import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { seedStoreSettings } from '@/lib/db/seed';
import { StoreSettings } from '@/types/admin';
import { isDbConfigured } from '@/lib/db/mysql';
import { getStoreSettingsFromDb } from '@/lib/db/repositories/settings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    console.warn('Failed to read store-settings.json in public API:', err);
  }
  return seedStoreSettings;
}

async function readServerSettings(): Promise<StoreSettings> {
  if (isDbConfigured()) {
    try {
      return await getStoreSettingsFromDb();
    } catch (err) {
      console.warn('MySQL readServerSettings notice in public API:', err);
    }
  }
  return readLocalFileSettings();
}

export async function GET() {
  try {
    const settings = await readServerSettings();
    return NextResponse.json(
      { success: true, settings },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error fetching store settings' },
      { status: 500 }
    );
  }
}
