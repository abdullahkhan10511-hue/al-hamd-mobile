import 'server-only';
import fs from 'fs';
import { PaymentMethodConfig, PaymentSecuritySettings } from '@/types/admin';
import { seedPaymentMethods, seedPaymentSecuritySettings } from './paymentMethods';
import { getDataDir, getDataFilePath } from '@/lib/storage/dataDir';

function getPaymentMethodsFile(): string {
  return getDataFilePath('payment-methods.json');
}

function ensureDataDir(): void {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export interface PersistentPaymentConfig {
  methods: PaymentMethodConfig[];
  security: PaymentSecuritySettings;
}

/**
 * Computes default allowedCustomerTypes based on payment method type for backward compatibility:
 * - type === 'cod' -> ['RETAIL']
 * - every other type -> ['WHOLESALE', 'SUPER_WHOLESALE']
 */
export function computeAllowedCustomerTypes(method: Pick<PaymentMethodConfig, 'type' | 'allowedCustomerTypes'>): ('RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE')[] {
  if (Array.isArray(method.allowedCustomerTypes) && method.allowedCustomerTypes.length > 0) {
    const valid = method.allowedCustomerTypes.filter((t) => t === 'RETAIL' || t === 'WHOLESALE' || t === 'SUPER_WHOLESALE');
    if (valid.length > 0) return valid;
  }
  return method.type === 'cod' ? ['RETAIL'] : ['WHOLESALE', 'SUPER_WHOLESALE'];
}

export function readPersistentPaymentConfig(): PersistentPaymentConfig {
  const filePath = getPaymentMethodsFile();
  try {
    ensureDataDir();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        const rawMethods: PaymentMethodConfig[] = Array.isArray(parsed.methods) && parsed.methods.length > 0
          ? parsed.methods.map((pm: PaymentMethodConfig) => {
              const seed = seedPaymentMethods.find((s) => s.id === pm.id);
              const merged = seed ? { ...seed, ...pm } : pm;
              merged.allowedCustomerTypes = computeAllowedCustomerTypes(merged);
              return merged;
            })
          : seedPaymentMethods.map((m) => ({
              ...m,
              allowedCustomerTypes: computeAllowedCustomerTypes(m),
            }));

        const security = parsed.security && typeof parsed.security === 'object'
          ? { ...seedPaymentSecuritySettings, ...parsed.security }
          : seedPaymentSecuritySettings;

        return {
          methods: rawMethods.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)),
          security,
        };
      }
    }
  } catch (err) {
    console.warn('Error reading payment-methods.json:', err);
  }

  const defaultMethods = seedPaymentMethods.map((m) => ({
    ...m,
    allowedCustomerTypes: computeAllowedCustomerTypes(m),
  }));

  const defaults: PersistentPaymentConfig = {
    methods: defaultMethods,
    security: seedPaymentSecuritySettings,
  };

  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2), 'utf8');
  } catch {}

  return defaults;
}

export function writePersistentPaymentConfig(data: Partial<PersistentPaymentConfig>): void {
  const filePath = getPaymentMethodsFile();
  try {
    ensureDataDir();
    const current = readPersistentPaymentConfig();
    const updatedMethods = data.methods
      ? data.methods.map((m) => ({
          ...m,
          allowedCustomerTypes: computeAllowedCustomerTypes(m),
        })).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      : current.methods;

    const updated: PersistentPaymentConfig = {
      methods: updatedMethods,
      security: data.security ? { ...current.security, ...data.security } : current.security,
    };
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write payment-methods.json:', err);
    throw new Error('Failed to write payment methods configuration to persistent server storage.');
  }
}
