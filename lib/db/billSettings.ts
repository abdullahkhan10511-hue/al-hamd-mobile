import { BillSettings, BillFieldToggles } from '@/types/admin';
import { getLocal, setLocal } from './storage';
import { logActivity } from './activity';
import { DEFAULT_THERMAL_WIDTH, DEFAULT_CUSTOM_WIDTH } from '@/lib/utils/thermalWidth';
import { getAdminAuthHeaders } from './staff';

const BILL_SETTINGS_KEY = 'bill_settings';

export const defaultBillFieldToggles: BillFieldToggles = {
  showLogo: true,
  showStoreName: true,
  showStoreAddress: true,
  showCustomerName: true,
  showCustomerPhone: true,
  showCustomerAddress: true,
  showInvoiceNumber: true,
  showDate: true,
  showTime: true,
  showPaymentMethod: true,
  showWebsite: true,
  showThankYou: true,
  footerMessage: 'Thank You for Shopping!',
  thermalPaperWidth: DEFAULT_THERMAL_WIDTH,
  thermalCustomWidth: DEFAULT_CUSTOM_WIDTH,
};

export const defaultBillSettings: BillSettings = {
  storeName: 'AL-HAMD MOBILE ACCESSORIES',
  storeLogo: '',
  storeAddress: 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan',
  phone: '+92 343 2200995',
  whatsapp: '+92 343 2200995',
  email: 'support@alhamd-mobile.com',
  website: 'alhamd.pk',
  invoiceHeaderText: 'Quality Mobile Accessories & Smartphone Essentials',
  invoiceFooterText: 'Thank You for Shopping!',
  taxNumber: '',
  thermalFooterNote: 'Thank You for Shopping!',
  thermalPaperWidth: DEFAULT_THERMAL_WIDTH,
  thermalCustomWidth: DEFAULT_CUSTOM_WIDTH,
  a4Config: { ...defaultBillFieldToggles, footerMessage: 'Thank You for Shopping!' },
  thermalConfig: {
    ...defaultBillFieldToggles,
    footerMessage: 'Thank You for Shopping!',
    thermalPaperWidth: DEFAULT_THERMAL_WIDTH,
    thermalCustomWidth: DEFAULT_CUSTOM_WIDTH,
  },
  showLogo: true,
  showStoreName: true,
  showStoreAddress: true,
  showCustomerName: true,
  showCustomerPhone: true,
  showCustomerAddress: true,
  showInvoiceNumber: true,
  showDate: true,
  showTime: true,
  showPaymentMethod: true,
  showWebsite: true,
  showThankYou: true,
};

let inFlightBillSettingsPromise: Promise<boolean> | null = null;
export async function syncBillSettingsFromApi(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (inFlightBillSettingsPromise) return inFlightBillSettingsPromise;

  inFlightBillSettingsPromise = (async () => {
    try {
      const res = await fetch(`/api/admin/bill-settings?t=${Date.now()}`, {
        cache: 'no-store',
        headers: getAdminAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setLocal(BILL_SETTINGS_KEY, data.settings, true);
          window.dispatchEvent(
            new CustomEvent('alhamd:data-updated', {
              detail: { key: BILL_SETTINGS_KEY, value: data.settings },
            })
          );
          return true;
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      inFlightBillSettingsPromise = null;
    }
  })();

  return inFlightBillSettingsPromise;
}

export function getBillSettings(): BillSettings {
  let fallback = defaultBillSettings;
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      const devFile = path.join(process.cwd(), 'data', 'dev-bill-settings.json');
      if (fs.existsSync(devFile)) {
        const parsed = JSON.parse(fs.readFileSync(devFile, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          fallback = { ...defaultBillSettings, ...parsed };
        }
      }
    } catch {}
  }
  const current = getLocal<BillSettings>(BILL_SETTINGS_KEY, fallback);

  // Preserve existing saved thermal width, fallback to default '80mm' only if unset
  const savedWidth = current?.thermalPaperWidth || current?.thermalConfig?.thermalPaperWidth || DEFAULT_THERMAL_WIDTH;
  const savedCustomWidth =
    typeof current?.thermalCustomWidth === 'number'
      ? current.thermalCustomWidth
      : typeof current?.thermalConfig?.thermalCustomWidth === 'number'
      ? current.thermalConfig.thermalCustomWidth
      : DEFAULT_CUSTOM_WIDTH;

  const base: BillSettings = {
    ...defaultBillSettings,
    ...(current || {}),
    thermalPaperWidth: savedWidth,
    thermalCustomWidth: savedCustomWidth,
    a4Config: {
      ...defaultBillFieldToggles,
      ...(current?.a4Config || {}),
      footerMessage: current?.a4Config?.footerMessage || current?.invoiceFooterText || defaultBillFieldToggles.footerMessage,
    },
    thermalConfig: {
      ...defaultBillFieldToggles,
      ...(current?.thermalConfig || {}),
      thermalPaperWidth: savedWidth,
      thermalCustomWidth: savedCustomWidth,
      footerMessage: current?.thermalConfig?.footerMessage || current?.thermalFooterNote || defaultBillFieldToggles.footerMessage,
    },
  };

  if (!base.storeName || !base.storeName.trim()) {
    base.storeName = 'AL-HAMD MOBILE ACCESSORIES';
  }
  if (!base.phone || base.phone.includes('+92 300 1234567')) {
    base.phone = '+92 343 2200995';
  }
  if (!base.whatsapp || base.whatsapp.includes('923001234567')) {
    base.whatsapp = '+92 343 2200995';
  }
  if (
    !base.storeAddress ||
    base.storeAddress.includes('Lahore') ||
    base.storeAddress.includes('MM Alam') ||
    base.storeAddress.includes('Commercial Plaza')
  ) {
    base.storeAddress = 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan';
  }

  return base;
}

export async function updateBillSettings(
  settings: Partial<BillSettings>,
  adminEmail = 'admin@alhamd.com'
): Promise<BillSettings> {
  const current = getBillSettings();
  const width =
    settings.thermalPaperWidth ||
    settings.thermalConfig?.thermalPaperWidth ||
    current.thermalPaperWidth ||
    DEFAULT_THERMAL_WIDTH;
  const customWidth =
    typeof settings.thermalCustomWidth === 'number'
      ? settings.thermalCustomWidth
      : typeof settings.thermalConfig?.thermalCustomWidth === 'number'
      ? settings.thermalConfig.thermalCustomWidth
      : current.thermalCustomWidth || DEFAULT_CUSTOM_WIDTH;

  const updated: BillSettings = {
    ...current,
    ...settings,
    thermalPaperWidth: width,
    thermalCustomWidth: customWidth,
    thermalConfig: {
      ...defaultBillFieldToggles,
      ...(current.thermalConfig || {}),
      ...(settings.thermalConfig || {}),
      thermalPaperWidth: width,
      thermalCustomWidth: customWidth,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };

  let serverSavedSettings: BillSettings = updated;
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/admin/bill-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeaders(adminEmail),
      },
      credentials: 'include',
      body: JSON.stringify(settings),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Failed to save bill settings (Server status: ${res.status})`);
    }
    if (data.settings) {
      serverSavedSettings = data.settings;
    }
  }

  setLocal(BILL_SETTINGS_KEY, serverSavedSettings);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: BILL_SETTINGS_KEY, value: serverSavedSettings },
      })
    );
  }

  await logActivity({
    adminEmail,
    action: 'Updated Store & Bill Settings',
    target: 'Invoice & Bill Configuration',
    details: `Updated fields: ${Object.keys(settings).join(', ')}`,
  });

  return serverSavedSettings;
}
