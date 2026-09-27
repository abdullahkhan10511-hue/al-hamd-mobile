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

export async function GET() {
  try {
    let settings: BillSettings;

    if (isDbConfigured()) {
      try {
        settings = await getBillSettingsFromDb();
      } catch (err) {
        console.warn('MySQL error in /api/admin/bill-settings GET:', err);
        settings = defaultBillSettings;
      }
    } else {
      settings = defaultBillSettings;
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

    return NextResponse.json({ success: true, settings: { ...defaultBillSettings, ...body } });
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
