import { BillSettings } from '@/types/admin';
import { getLocal, setLocal } from './storage';
import { logActivity } from './activity';

const BILL_SETTINGS_KEY = 'bill_settings';

export const defaultBillSettings: BillSettings = {
  storeName: 'AL-HAMD MOBILE ACCESSORIES',
  storeLogo: '',
  storeAddress: 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan',
  phone: '+92 343 2200995',
  whatsapp: '+92 343 2200995',
  email: 'support@alhamd-mobile.com',
  website: 'alhamd.pk',
  invoiceHeaderText: 'Quality Mobile Accessories & Smartphone Essentials',
  invoiceFooterText: 'Thank you for your business.',
  taxNumber: '',
  thermalFooterNote: 'THANK YOU FOR YOUR PATRONAGE!',
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
  const base = {
    ...defaultBillSettings,
    ...(current || {}),
  };

  if (base.storeName === 'AL-HAMD-MOBILE' || base.storeName === 'AL·HAMD') {
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
  const updated: BillSettings = {
    ...current,
    ...settings,
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
