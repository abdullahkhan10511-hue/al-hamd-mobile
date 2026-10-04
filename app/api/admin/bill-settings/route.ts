import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getBillSettingsFromDb, updateBillSettingsInDb } from '@/lib/db/repositories/settings';
import { defaultBillSettings } from '@/lib/db/billSettings';
import { BillSettings } from '@/types/admin';

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

import fs from 'fs';
import path from 'path';

const DEV_BILL_SETTINGS_FILE = path.join(process.cwd(), 'data', 'dev-bill-settings.json');

function getDevBillSettings(): BillSettings {
  try {
    if (fs.existsSync(DEV_BILL_SETTINGS_FILE)) {
      const raw = fs.readFileSync(DEV_BILL_SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const width =
          parsed.thermalPaperWidth ||
          parsed.thermalConfig?.thermalPaperWidth ||
          defaultBillSettings.thermalPaperWidth ||
          '80mm';
        const customWidth =
          typeof parsed.thermalCustomWidth === 'number'
            ? parsed.thermalCustomWidth
            : typeof parsed.thermalConfig?.thermalCustomWidth === 'number'
            ? parsed.thermalConfig.thermalCustomWidth
            : defaultBillSettings.thermalCustomWidth || 80;

        return {
          ...defaultBillSettings,
          ...parsed,
          thermalPaperWidth: width,
          thermalCustomWidth: customWidth,
          thermalConfig: {
            ...defaultBillSettings.thermalConfig,
            ...(parsed.thermalConfig || {}),
            thermalPaperWidth: width,
            thermalCustomWidth: customWidth,
          },
        };
      }
    }
  } catch {}
  return defaultBillSettings;
}

function saveDevBillSettings(settings: BillSettings): void {
  try {
    const dir = path.dirname(DEV_BILL_SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DEV_BILL_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch {}
}

export async function GET() {
  try {
    let settings: BillSettings;

    if (isDbConfigured()) {
      try {
        settings = await getBillSettingsFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/admin/bill-settings GET:', err);
        settings = getDevBillSettings();
      }
    } else {
      settings = getDevBillSettings();
    }

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load bill settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');

    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to modify bill settings.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (isDbConfigured()) {
      const updated = await updateBillSettingsInDb(body, session?.email || 'admin@alhamd.com');
      return NextResponse.json({ success: true, settings: updated });
    }

    const current = getDevBillSettings();
    const width =
      body.thermalPaperWidth ||
      body.thermalConfig?.thermalPaperWidth ||
      current.thermalPaperWidth ||
      '80mm';
    const customWidth =
      typeof body.thermalCustomWidth === 'number'
        ? body.thermalCustomWidth
        : typeof body.thermalConfig?.thermalCustomWidth === 'number'
        ? body.thermalConfig.thermalCustomWidth
        : current.thermalCustomWidth || 80;

    const updated = {
      ...current,
      ...body,
      thermalPaperWidth: width,
      thermalCustomWidth: customWidth,
      thermalConfig: {
        ...(current.thermalConfig || {}),
        ...(body.thermalConfig || {}),
        thermalPaperWidth: width,
        thermalCustomWidth: customWidth,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: session?.email || 'admin@alhamd.com',
    };
    saveDevBillSettings(updated);

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error('Error updating bill settings in MySQL:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update bill settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return PUT(request);
}
