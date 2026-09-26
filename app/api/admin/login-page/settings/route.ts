import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DEFAULT_LOGIN_PAGE_SETTINGS, LoginPageSettings } from '@/lib/db/loginPage';

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

const SETTINGS_FILE_PATH = path.join(process.cwd(), 'data', 'login-page-settings.json');

function readSettingsFile(): LoginPageSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const content = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      const data = Array.isArray(parsed) ? parsed[0] : (parsed && parsed['0'] ? parsed['0'] : parsed);
      return { ...DEFAULT_LOGIN_PAGE_SETTINGS, ...(data || {}) };
    }
  } catch (err) {
    console.warn('Failed to read login-page-settings.json:', err);
  }
  return DEFAULT_LOGIN_PAGE_SETTINGS;
}

function writeSettingsFile(settings: LoginPageSettings): void {
  try {
    const dir = path.dirname(SETTINGS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write login-page-settings.json:', err);
  }
}

export async function GET() {
  const settings = readSettingsFile();
  return NextResponse.json({ success: true, settings });
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');
    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to modify settings.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const current = readSettingsFile();
    const updated: LoginPageSettings = {
      ...current,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    writeSettingsFile(updated);

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error('Error saving login page settings:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save settings' },
      { status: 500 }
    );
  }
}
