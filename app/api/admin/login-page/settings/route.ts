import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getLoginPageSettingsFromDb,
  updateLoginPageSettingsInDb,
} from '@/lib/db/repositories/loginPage';
import { DEFAULT_LOGIN_PAGE_SETTINGS, LoginPageSettings } from '@/lib/db/loginPage';
import { getAdminSession } from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'login-page-settings.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

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
    ensureDataDir();
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

function writeLocalLoginPageSettings(settings: LoginPageSettings): void {
  try {
    ensureDataDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write login-page-settings.json:', err);
  }
}

export async function GET() {
  try {
    let settings: LoginPageSettings;

    if (isDbConfigured()) {
      try {
        settings = await getLoginPageSettingsFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/admin/login-page/settings:', err);
        settings = readLocalLoginPageSettings();
      }
    } else {
      settings = readLocalLoginPageSettings();
    }

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load login page settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to modify settings.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    let updated: LoginPageSettings;

    if (isDbConfigured()) {
      try {
        updated = await updateLoginPageSettingsInDb(body);
        writeLocalLoginPageSettings(updated);
      } catch (dbErr) {
        console.warn('MySQL error saving login page settings, fallback to disk:', dbErr);
        const current = readLocalLoginPageSettings();
        updated = { ...current, ...body, updatedAt: new Date().toISOString() };
        writeLocalLoginPageSettings(updated);
      }
    } else {
      const current = readLocalLoginPageSettings();
      updated = { ...current, ...body, updatedAt: new Date().toISOString() };
      writeLocalLoginPageSettings(updated);
    }

    try {
      revalidatePath('/login');
      revalidatePath('/admin/login-page');
      revalidatePath('/api/login-page/settings');
    } catch {}

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error('Error saving login page settings:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save settings' },
      { status: 500 }
    );
  }
}
