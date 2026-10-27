import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isDbConfigured } from '@/lib/db/mysql';
import { getLoginPageSettingsFromDb } from '@/lib/db/repositories/loginPage';
import { DEFAULT_LOGIN_PAGE_SETTINGS, LoginPageSettings } from '@/lib/db/loginPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'login-page-settings.json');

function extractCleanSettings(parsed: any): any {
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.id || parsed.mainHeading || parsed.brandName) {
    const { '0': _zero, '1': _one, ...topLevel } = parsed;
    return topLevel;
  }
  if (parsed['0']) {
    return extractCleanSettings(parsed['0']);
  }
  return parsed;
}

function readLocalLoginPageSettings(): LoginPageSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const clean = extractCleanSettings(parsed);
      if (clean && typeof clean === 'object' && !Array.isArray(clean)) {
        return { ...DEFAULT_LOGIN_PAGE_SETTINGS, ...clean };
      }
    }
  } catch (err) {
    console.warn('Error reading login-page-settings.json:', err);
  }
  return DEFAULT_LOGIN_PAGE_SETTINGS;
}

export async function GET() {
  try {
    let settings: LoginPageSettings;

    if (isDbConfigured()) {
      try {
        settings = await getLoginPageSettingsFromDb();
      } catch (err) {
        settings = readLocalLoginPageSettings();
      }
    } else {
      settings = readLocalLoginPageSettings();
    }

    return NextResponse.json(
      { success: true, settings },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch login page settings' },
      { status: 500 }
    );
  }
}
