import { PaymentMethodConfig, PaymentSecuritySettings } from '@/types/admin';
import { getStoredCollection, persistCollection, getLocal, setLocal } from './storage';
import { logActivity } from './activity';
import { getAdminAuthHeaders } from './staff';

const METHODS_KEY = 'payment_methods';
const SECURITY_KEY = 'payment_security_settings';

export const seedPaymentMethods: PaymentMethodConfig[] = [
  {
    id: 'cod',
    name: 'Cash on Delivery',
    type: 'cod',
    enabled: true,
    badgeText: 'COD',
    description: 'Pay cash when your order is delivered.',
    instructions:
      'Pay cash to our courier delivery rider upon arrival of your parcel. Please keep the exact amount ready to avoid delays.',
    detailsHeading: 'Payment Details: Cash on Delivery',
    displayOrder: 1,
    requiresReference: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'card',
    name: 'Credit / Debit Card',
    type: 'card',
    enabled: true,
    badgeText: 'VISA / MC',
    description: 'Pay securely with Visa, Mastercard, or PayPak.',
    instructions:
      'Online card payments are processed via 3D Secure 2.0 banking gateways. Card processing is currently undergoing banking PCI-DSS certification — please choose Cash on Delivery, Easypaisa, or JazzCash for immediate order dispatch.',
    detailsHeading: 'Payment Details: Credit / Debit Card',
    warningHeading: 'Card Gateway Under Banking Certification',
    warningMessage:
      'Direct credit/debit card processing is currently undergoing banking PCI-DSS integration with State Bank of Pakistan compliant gateways. To place your order immediately, please select Cash on Delivery, Easypaisa, or JazzCash.',
    displayOrder: 2,
    requiresReference: false,
    isConfigured: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'easypaisa',
    name: 'Easypaisa',
    type: 'wallet',
    enabled: true,
    badgeText: 'EP',
    description: 'Instant transfer via Easypaisa Mobile App or *786#.',
    instructions:
      '1. Open your Easypaisa app or dial *786#.\n2. Transfer the exact order amount to our official merchant account.\n3. Enter your Order ID in the transfer remarks/reference.\n4. Enter the 11-digit Transaction ID (TID) received via SMS below for verification.',
    detailsHeading: 'Payment Details: Easypaisa',
    accountSectionHeading: 'Official Payment Account',
    accountNameLabel: 'Account / Business Name',
    accountNumberLabel: 'Official Payment Number / ID',
    accountHelpText:
      '💡 Please include your customer contact number or upcoming Order ID in the payment message so our accounts team can verify immediately.',
    merchantName: 'AL-HAMD-MOBILE OFFICIAL',
    merchantIdentifier: '0300-1234567',
    displayOrder: 3,
    requiresReference: true,
    referenceLabel: 'Payment Reference / Transaction ID (TID) *',
    referencePlaceholder: 'e.g. TID: 109823019 (11 digits)',
    referenceHelpText:
      'After sending payment from your mobile wallet, paste the reference ID from your SMS above.',
    minReferenceLength: 11,
    maxReferenceLength: 11,
    referenceValidationMessage:
      'Please enter a valid 11-digit Easypaisa Transaction ID (TID).',
    referenceFormat: '11-digit TID (e.g. 10982736451)',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'jazzcash',
    name: 'JazzCash',
    type: 'wallet',
    enabled: true,
    badgeText: 'JC',
    description: 'Instant transfer via JazzCash Mobile App or *786#.',
    instructions:
      '1. Open your JazzCash app or dial *786#.\n2. Transfer the exact order amount to our official JazzCash account.\n3. Mention your Order ID in the reference field.\n4. Enter the Transaction ID (TID) received from 8558 below for verification.',
    detailsHeading: 'Payment Details: JazzCash',
    accountSectionHeading: 'Official Payment Account',
    accountNameLabel: 'Account / Business Name',
    accountNumberLabel: 'Official Payment Number / ID',
    accountHelpText:
      '💡 Please include your customer contact number or upcoming Order ID in the payment message so our accounts team can verify immediately.',
    merchantName: 'AL-HAMD-MOBILE OFFICIAL',
    merchantIdentifier: '0321-7654321',
    displayOrder: 4,
    requiresReference: true,
    referenceLabel: 'Payment Reference / Transaction ID (TID) *',
    referencePlaceholder: 'e.g. TID: 984512340192 (12 digits)',
    referenceHelpText:
      'After sending payment from your mobile wallet, paste the reference ID from your SMS above.',
    minReferenceLength: 12,
    maxReferenceLength: 12,
    referenceValidationMessage:
      'Please enter a valid 12-digit JazzCash Transaction ID (TID).',
    referenceFormat: '12-digit TID (e.g. 984512340192)',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const seedPaymentSecuritySettings: PaymentSecuritySettings = {
  sectionHeading: '4. Choose Payment Method',
  securitySubheading: '100% Secure Checkout',
  generalInstructions:
    'Select your preferred payment method below. All transactions are monitored and encrypted.',
  securityNotice:
    'Only make payments using the official payment details shown on this website. We will never ask you to send money to a personal account or share your password, OTP, PIN, CVV or full card details.',
  processingMessage:
    'Orders paid via Easypaisa or JazzCash are placed on hold ("Awaiting Verification") until our accounts department confirms receipt of the Transaction ID.',
  manualVerificationEnabled: true,
  customInfoBlocks: [
    {
      id: 'block-tamper-proof',
      title: 'Discreet & Secure Parcel Handling',
      content:
        'Every package is sealed with tamper-evident tape and tracked throughout courier transit across Pakistan.',
      type: 'tip',
      enabled: true,
      displayOrder: 1,
    },
  ],
};

let inFlightPaymentPromise: Promise<{ methods: PaymentMethodConfig[]; security: PaymentSecuritySettings }> | null = null;

export async function syncPaymentMethodsFromApi(): Promise<{ methods: PaymentMethodConfig[]; security: PaymentSecuritySettings }> {
  if (typeof window === 'undefined') {
    return { methods: getPaymentMethods(), security: getPaymentSecuritySettings() };
  }
  if (inFlightPaymentPromise) return inFlightPaymentPromise;

  inFlightPaymentPromise = (async () => {
    try {
      const res = await fetch(`/api/payment-methods?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.methods)) {
          const sorted = data.methods.sort((a: PaymentMethodConfig, b: PaymentMethodConfig) => (a.displayOrder || 0) - (b.displayOrder || 0));
          await persistCollection(METHODS_KEY, sorted, true);
          if (data.security) {
            setLocal(SECURITY_KEY, data.security);
          }
          window.dispatchEvent(
            new CustomEvent('alhamd:data-updated', {
              detail: { key: METHODS_KEY, value: sorted },
            })
          );
          return { methods: sorted, security: data.security || getPaymentSecuritySettings() };
        }
      }
    } catch (err) {
      console.warn('Could not sync payment methods from API:', err);
    } finally {
      inFlightPaymentPromise = null;
    }
    return { methods: getPaymentMethods(), security: getPaymentSecuritySettings() };
  })();

  return inFlightPaymentPromise;
}

export function getPaymentMethods(): PaymentMethodConfig[] {
  const methods = getStoredCollection<PaymentMethodConfig>(METHODS_KEY, seedPaymentMethods);
  return [...methods].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export function getEnabledPaymentMethods(): PaymentMethodConfig[] {
  return getPaymentMethods().filter((m) => m.enabled);
}

export function getPaymentMethodById(id: string): PaymentMethodConfig | undefined {
  return getPaymentMethods().find((m) => m.id === id);
}

async function savePaymentConfigToServer(
  payload: { methods?: PaymentMethodConfig[]; security?: PaymentSecuritySettings },
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/admin/payment-methods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeaders(adminEmail),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn('Failed to save payment configuration to server API, status:', res.status);
    }
  } catch (err) {
    console.warn('Network error saving payment configuration to server:', err);
  }
}

export async function updatePaymentMethod(
  id: string,
  updates: Partial<PaymentMethodConfig>,
  adminEmail = 'admin@alhamd.com'
): Promise<PaymentMethodConfig | null> {
  const methods = getPaymentMethods();
  const index = methods.findIndex((m) => m.id === id);
  if (index === -1) return null;

  const current = methods[index];
  const updatedItem: PaymentMethodConfig = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  methods[index] = updatedItem;
  await persistCollection(METHODS_KEY, methods);
  await savePaymentConfigToServer({ methods }, adminEmail);

  await logActivity({
    adminEmail,
    action: 'Updated Payment Method',
    target: updatedItem.name,
    details: `Updated fields: ${Object.keys(updates).join(', ')}`,
  });

  return updatedItem;
}

export async function togglePaymentMethod(
  id: string,
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const methods = getPaymentMethods();
  const method = methods.find((m) => m.id === id);
  if (!method) return false;

  const nextState = !method.enabled;
  await updatePaymentMethod(id, { enabled: nextState }, adminEmail);

  await logActivity({
    adminEmail,
    action: nextState ? 'Enabled Payment Method' : 'Disabled Payment Method',
    target: method.name,
    details: `${method.name} is now ${nextState ? 'active on customer checkout' : 'hidden from checkout'}`,
  });

  return true;
}

export async function reorderPaymentMethods(
  orderedIds: string[],
  adminEmail = 'admin@alhamd.com'
): Promise<PaymentMethodConfig[]> {
  const methods = getPaymentMethods();
  const updated = methods.map((m) => {
    const newIndex = orderedIds.indexOf(m.id);
    return {
      ...m,
      displayOrder: newIndex !== -1 ? newIndex + 1 : m.displayOrder,
      updatedAt: new Date().toISOString(),
    };
  });

  updated.sort((a, b) => a.displayOrder - b.displayOrder);
  await persistCollection(METHODS_KEY, updated);
  await savePaymentConfigToServer({ methods: updated }, adminEmail);

  await logActivity({
    adminEmail,
    action: 'Reordered Payment Methods',
    target: 'Payment Methods Sequence',
    details: `New order: ${updated.map((m) => m.name).join(' → ')}`,
  });

  return updated;
}

export function getPaymentSecuritySettings(): PaymentSecuritySettings {
  return getLocal<PaymentSecuritySettings>(SECURITY_KEY, seedPaymentSecuritySettings);
}

export async function updatePaymentSecuritySettings(
  updates: Partial<PaymentSecuritySettings>,
  adminEmail = 'admin@alhamd.com'
): Promise<PaymentSecuritySettings> {
  const current = getPaymentSecuritySettings();
  const updated = { ...current, ...updates };
  setLocal(SECURITY_KEY, updated);
  await savePaymentConfigToServer({ security: updated }, adminEmail);

  await logActivity({
    adminEmail,
    action: 'Updated Payment Security Settings',
    target: 'Anti-Fraud Notice',
    details: 'Security notice / payment processing rules updated',
  });

  return updated;
}

export async function resetPaymentMethodsToDefault(
  adminEmail = 'admin@alhamd.com'
): Promise<PaymentMethodConfig[]> {
  await persistCollection(METHODS_KEY, seedPaymentMethods);
  setLocal(SECURITY_KEY, seedPaymentSecuritySettings);
  await savePaymentConfigToServer(
    { methods: seedPaymentMethods, security: seedPaymentSecuritySettings },
    adminEmail
  );

  await logActivity({
    adminEmail,
    action: 'Reset Payment Methods to Default',
    target: 'Payment Methods',
    details: 'Restored 4 standard Pakistan payment methods',
  });

  return seedPaymentMethods;
}

export async function saveCompletePaymentConfig(
  methods: PaymentMethodConfig[],
  security: PaymentSecuritySettings,
  adminEmail = 'admin@alhamd.com'
): Promise<{ methods: PaymentMethodConfig[]; security: PaymentSecuritySettings }> {
  const sortedMethods = [...methods].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  await persistCollection(METHODS_KEY, sortedMethods);
  setLocal(SECURITY_KEY, security);
  await savePaymentConfigToServer({ methods: sortedMethods, security }, adminEmail);

  await logActivity({
    adminEmail,
    action: 'Saved Complete Payment Configuration',
    target: 'Checkout Payment CMS',
    details: `Updated payment settings and ${sortedMethods.length} methods globally`,
  });

  return { methods: sortedMethods, security };
}
