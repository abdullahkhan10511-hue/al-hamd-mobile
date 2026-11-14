import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { getDataFilePath, writeAtomicJsonFile } from '@/lib/storage/dataDir';
import { query, execute, isDbConfigured } from '../mysql';
import { RowDataPacket } from 'mysql2/promise';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/db/repositories/activity';
import {
  HomepageAnimationsSettings,
  HomepageAnimationsSettingsSchema,
  DEFAULT_HOMEPAGE_ANIMATIONS,
  WhatsAppButtonSettings,
  WhatsAppButtonSettingsSchema,
  DEFAULT_WHATSAPP_SETTINGS,
  OrderSuccessPageSettings,
  OrderSuccessPageSettingsSchema,
  DEFAULT_ORDER_SUCCESS_SETTINGS,
} from '@/lib/db/siteUiSettings';

const SETTINGS_FILE_NAME = 'site-ui-settings.json';

interface LocalSettingsFile {
  homepage_animations?: HomepageAnimationsSettings;
  whatsapp_button?: WhatsAppButtonSettings;
  order_success?: OrderSuccessPageSettings;
}

export function readLocalSiteUiSettings(): LocalSettingsFile {
  try {
    const filePath = getDataFilePath(SETTINGS_FILE_NAME);
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeLocalSiteUiSettings(data: LocalSettingsFile): void {
  try {
    const filePath = getDataFilePath(SETTINGS_FILE_NAME);
    writeAtomicJsonFile(filePath, data);
  } catch (err) {
    console.error('Failed to write local site-ui-settings.json:', err);
    throw err;
  }
}

interface SiteUiSettingRow extends RowDataPacket {
  setting_key: string;
  setting_value: string;
  updated_by: string | null;
  updated_at: string;
}

let tableChecked = false;
let tableExistsCached = false;

export function _resetSiteUiTableCheckForTest(): void {
  tableChecked = false;
  tableExistsCached = false;
}

export async function isSiteUiSettingsTableAvailable(): Promise<boolean> {
  if (!isDbConfigured()) return false;
  if (tableChecked) return tableExistsCached;

  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'site_ui_settings' LIMIT 1"
    );
    tableExistsCached = Boolean(rows && rows.length > 0);
    tableChecked = true;
    return tableExistsCached;
  } catch {
    tableChecked = true;
    tableExistsCached = false;
    return false;
  }
}

// =============================================================================
// HOMEPAGE ANIMATIONS
// =============================================================================

export async function getHomepageAnimationsSettings(): Promise<{
  settings: HomepageAnimationsSettings;
  tableExists: boolean;
  isDbBacked: boolean;
  source: 'db' | 'local';
}> {
  const tableExists = await isSiteUiSettingsTableAvailable();

  if (tableExists) {
    try {
      const rows = await query<SiteUiSettingRow[]>(
        "SELECT setting_value FROM site_ui_settings WHERE setting_key = 'homepage_animations' LIMIT 1"
      );
      if (rows && rows.length > 0 && rows[0].setting_value) {
        const parsed = JSON.parse(rows[0].setting_value);
        const validated = HomepageAnimationsSettingsSchema.safeParse(parsed);
        if (validated.success) {
          return { settings: validated.data, tableExists: true, isDbBacked: true, source: 'db' };
        }
      }
    } catch (err) {
      console.warn('Error reading homepage_animations from DB, falling back:', err);
    }
  }

  // Fallback: local file under getDataDir()
  const local = readLocalSiteUiSettings();
  if (local.homepage_animations) {
    const validated = HomepageAnimationsSettingsSchema.safeParse(local.homepage_animations);
    if (validated.success) {
      return { settings: validated.data, tableExists, isDbBacked: false, source: 'local' };
    }
  }

  return { settings: DEFAULT_HOMEPAGE_ANIMATIONS, tableExists, isDbBacked: false, source: 'local' };
}

export async function saveHomepageAnimationsSettings(
  data: HomepageAnimationsSettings,
  adminEmail?: string
): Promise<{ success: boolean; tableExists: boolean; isDbBacked: boolean; error?: string }> {
  const validated = HomepageAnimationsSettingsSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, tableExists: false, isDbBacked: false, error: 'Invalid settings payload.' };
  }

  const tableExists = await isSiteUiSettingsTableAvailable();
  const current = await getHomepageAnimationsSettings();

  if (isDbConfigured() && !tableExists) {
    return {
      success: false,
      tableExists: false,
      isDbBacked: false,
      error: 'Run add_site_ui_settings.sql to save these settings',
    };
  }

  if (tableExists) {
    await execute(
      `INSERT INTO site_ui_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ('homepage_animations', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()`,
      [JSON.stringify(validated.data), adminEmail || 'admin']
    );
  } else {
    const local = readLocalSiteUiSettings();
    local.homepage_animations = validated.data;
    writeLocalSiteUiSettings(local);
  }

  await logActivity({
    adminEmail: adminEmail || 'system',
    action: 'UPDATE_HOMEPAGE_ANIMATIONS',
    target: 'site_ui_settings:homepage_animations',
    details: `Updated homepage animation controls. Old: ${JSON.stringify(current.settings)}, New: ${JSON.stringify(validated.data)}`,
  });

  try {
    revalidatePath('/');
    revalidatePath('/[slug]', 'page');
  } catch {}

  return { success: true, tableExists, isDbBacked: tableExists };
}

// =============================================================================
// ORDER SUCCESS PAGE
// =============================================================================

export async function getOrderSuccessSettings(): Promise<{
  settings: OrderSuccessPageSettings;
  tableExists: boolean;
  isDbBacked: boolean;
  source: 'db' | 'local';
}> {
  const tableExists = await isSiteUiSettingsTableAvailable();

  if (tableExists) {
    try {
      const rows = await query<SiteUiSettingRow[]>(
        "SELECT setting_value FROM site_ui_settings WHERE setting_key = 'order_success' LIMIT 1"
      );
      if (rows && rows.length > 0 && rows[0].setting_value) {
        const parsed = JSON.parse(rows[0].setting_value);
        const validated = OrderSuccessPageSettingsSchema.safeParse(parsed);
        if (validated.success) {
          return { settings: validated.data, tableExists: true, isDbBacked: true, source: 'db' };
        }
      }
    } catch (err) {
      console.warn('Error reading order_success from DB, falling back:', err);
    }
  }

  // Fallback: local file under getDataDir()
  const local = readLocalSiteUiSettings();
  if (local.order_success) {
    const validated = OrderSuccessPageSettingsSchema.safeParse(local.order_success);
    if (validated.success) {
      return { settings: validated.data, tableExists, isDbBacked: false, source: 'local' };
    }
  }

  return { settings: DEFAULT_ORDER_SUCCESS_SETTINGS, tableExists, isDbBacked: false, source: 'local' };
}

export async function saveOrderSuccessSettings(
  data: OrderSuccessPageSettings,
  adminEmail?: string
): Promise<{ success: boolean; tableExists: boolean; isDbBacked: boolean; error?: string }> {
  const validated = OrderSuccessPageSettingsSchema.safeParse(data);
  if (!validated.success) {
    const firstIssue = validated.error.issues[0]?.message || 'Invalid settings payload.';
    return { success: false, tableExists: false, isDbBacked: false, error: firstIssue };
  }

  const tableExists = await isSiteUiSettingsTableAvailable();
  const current = await getOrderSuccessSettings();

  if (isDbConfigured() && !tableExists) {
    return {
      success: false,
      tableExists: false,
      isDbBacked: false,
      error: 'Run add_site_ui_settings.sql to save these settings',
    };
  }

  if (tableExists) {
    await execute(
      `INSERT INTO site_ui_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ('order_success', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()`,
      [JSON.stringify(validated.data), adminEmail || 'admin']
    );
  } else {
    const local = readLocalSiteUiSettings();
    local.order_success = validated.data;
    writeLocalSiteUiSettings(local);
  }

  await logActivity({
    adminEmail: adminEmail || 'system',
    action: 'UPDATE_ORDER_SUCCESS_SETTINGS',
    target: 'site_ui_settings:order_success',
    details: `Updated Order Success page settings. Old: ${JSON.stringify(current.settings)}, New: ${JSON.stringify(validated.data)}`,
  });

  try {
    revalidatePath('/checkout');
    revalidatePath('/api/ui-settings');
  } catch {}

  return { success: true, tableExists, isDbBacked: tableExists };
}

// =============================================================================
// WHATSAPP BUTTON
// =============================================================================

export async function getWhatsAppButtonSettings(): Promise<{
  settings: WhatsAppButtonSettings;
  tableExists: boolean;
  isDbBacked: boolean;
  source: 'db' | 'local';
}> {
  const tableExists = await isSiteUiSettingsTableAvailable();

  if (tableExists) {
    try {
      const rows = await query<SiteUiSettingRow[]>(
        "SELECT setting_value FROM site_ui_settings WHERE setting_key = 'whatsapp_button' LIMIT 1"
      );
      if (rows && rows.length > 0 && rows[0].setting_value) {
        const parsed = JSON.parse(rows[0].setting_value);
        const validated = WhatsAppButtonSettingsSchema.safeParse(parsed);
        if (validated.success) {
          return { settings: validated.data, tableExists: true, isDbBacked: true, source: 'db' };
        }
      }
    } catch (err) {
      console.warn('Error reading whatsapp_button from DB, falling back:', err);
    }
  }

  // Fallback: local file under getDataDir()
  const local = readLocalSiteUiSettings();
  if (local.whatsapp_button) {
    const validated = WhatsAppButtonSettingsSchema.safeParse(local.whatsapp_button);
    if (validated.success) {
      return { settings: validated.data, tableExists, isDbBacked: false, source: 'local' };
    }
  }

  return { settings: DEFAULT_WHATSAPP_SETTINGS, tableExists, isDbBacked: false, source: 'local' };
}

export async function saveWhatsAppButtonSettings(
  data: WhatsAppButtonSettings,
  adminEmail?: string
): Promise<{ success: boolean; tableExists: boolean; isDbBacked: boolean; error?: string }> {
  const validated = WhatsAppButtonSettingsSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, tableExists: false, isDbBacked: false, error: 'Invalid settings payload.' };
  }

  const tableExists = await isSiteUiSettingsTableAvailable();
  const current = await getWhatsAppButtonSettings();

  if (isDbConfigured() && !tableExists) {
    return {
      success: false,
      tableExists: false,
      isDbBacked: false,
      error: 'Run add_site_ui_settings.sql to save these settings',
    };
  }

  if (tableExists) {
    await execute(
      `INSERT INTO site_ui_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ('whatsapp_button', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()`,
      [JSON.stringify(validated.data), adminEmail || 'admin']
    );
  } else {
    const local = readLocalSiteUiSettings();
    local.whatsapp_button = validated.data;
    writeLocalSiteUiSettings(local);
  }

  await logActivity({
    adminEmail: adminEmail || 'system',
    action: 'UPDATE_WHATSAPP_SETTINGS',
    target: 'site_ui_settings:whatsapp_button',
    details: `Updated WhatsApp button controls. Old: ${JSON.stringify(current.settings)}, New: ${JSON.stringify(validated.data)}`,
  });

  try {
    revalidatePath('/');
    revalidatePath('/[slug]', 'page');
  } catch {}

  return { success: true, tableExists, isDbBacked: tableExists };
}
