import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getLoginPageSettingsFromDb,
  updateLoginPageSettingsInDb,
} from '@/lib/db/repositories/loginPage';
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

export async function GET() {
  try {
    let settings: LoginPageSettings;

    if (isDbConfigured()) {
      try {
        settings = await getLoginPageSettingsFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/admin/login-page/settings:', err);
        settings = DEFAULT_LOGIN_PAGE_SETTINGS;
      }
    } else {
      settings = DEFAULT_LOGIN_PAGE_SETTINGS;
    }

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load login page settings' },
      { status: 500 }
    );
  }
}

import { getAdminSession } from '@/lib/db/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to modify settings.' },
        { status: 401 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database is not configured.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const updated = await updateLoginPageSettingsInDb(body);

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error('Error saving login page settings:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save settings' },
      { status: 500 }
    );
  }
}
