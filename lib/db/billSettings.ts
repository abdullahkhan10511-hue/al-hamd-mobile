import { BillSettings, BillFieldToggles } from '@/types/admin';
import { getLocal, setLocal } from './storage';
import { logActivity } from './activity';
import { DEFAULT_THERMAL_WIDTH, DEFAULT_CUSTOM_WIDTH } from '@/lib/utils/thermalWidth';

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

let hasSyncedBillSettingsFromApi = false;
export async function syncBillSettingsFromApi(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/admin/bill-settings', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.settings) {
        setLocal(BILL_SETTINGS_KEY, data.settings);
        window.dispatchEvent(
          new CustomEvent('alhamd:data-updated', {
            detail: { key: BILL_SETTINGS_KEY, value: data.settings },
          })
        );
      }
    }
  } catch {}
}

export function getBillSettings(): BillSettings {
  if (typeof window !== 'undefined' && !hasSyncedBillSettingsFromApi) {
    hasSyncedBillSettingsFromApi = true;
    syncBillSettingsFromApi().catch(() => {});
  }
  const current = getLocal<BillSettings>(BILL_SETTINGS_KEY, defaultBillSettings);

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

  setLocal(BILL_SETTINGS_KEY, updated);

  if (typeof window !== 'undefined') {
    fetch('/api/admin/bill-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).catch(() => {});
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: BILL_SETTINGS_KEY, value: updated },
      })
    );
  }

  await logActivity({
    adminEmail,
    action: 'Updated Store & Bill Settings',
    target: 'Invoice & Bill Configuration',
    details: `Updated fields: ${Object.keys(settings).join(', ')}`,
  });

  return updated;
}
