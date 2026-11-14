import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getBillSettingsFromDb, updateBillSettingsInDb } from '@/lib/db/repositories/settings';
import { defaultBillSettings } from '@/lib/db/billSettings';
import { BillSettings } from '@/types/admin';
import { getAdminSessionAsync, hasAdminPermission } from '@/lib/db/adminAuth';

import fs from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { getDataFilePath, writeAtomicJsonFile } from '@/lib/storage/dataDir';

const DEV_BILL_SETTINGS_FILE = getDataFilePath('dev-bill-settings.json');

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
    writeAtomicJsonFile(DEV_BILL_SETTINGS_FILE, settings);
  } catch (err) {
    console.error('Failed to save bill settings atomically:', err);
    throw err;
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

  if (!hasAdminPermission(session, ['settings.view', 'settings.edit', 'inventory.shop_bill'])) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to view bill settings.' },
      { status: 403 }
    );
  }

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
    const session = await getAdminSessionAsync(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to modify bill settings.' },
        { status: 401 }
      );
    }

    if (!hasAdminPermission(session, ['settings.edit', 'inventory.shop_bill'])) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions to modify bill settings.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (isDbConfigured()) {
      const updated = await updateBillSettingsInDb(body, session?.email || 'system');
      try {
        revalidatePath('/admin/pos');
        revalidatePath('/admin/orders');
        revalidatePath('/api/admin/bill-settings');
      } catch (revErr) {
        console.warn('Revalidation warning in /api/admin/bill-settings:', revErr);
      }
      return NextResponse.json({ success: true, settings: updated, revalidated: true });
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
      updatedBy: session?.email || 'system',
    };
    saveDevBillSettings(updated);

    try {
      revalidatePath('/admin/pos');
      revalidatePath('/admin/orders');
      revalidatePath('/api/admin/bill-settings');
    } catch (revErr) {
      console.warn('Revalidation warning in /api/admin/bill-settings dev mode:', revErr);
    }

    return NextResponse.json({ success: true, settings: updated, revalidated: true });
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
