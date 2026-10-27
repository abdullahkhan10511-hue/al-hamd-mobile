import fs from 'fs';
import path from 'path';
import { PaymentMethodConfig, PaymentSecuritySettings } from '@/types/admin';
import { seedPaymentMethods, seedPaymentSecuritySettings } from './paymentMethods';

const DATA_DIR = path.join(process.cwd(), 'data');
const PAYMENT_METHODS_FILE = path.join(DATA_DIR, 'payment-methods.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export interface PersistentPaymentConfig {
  methods: PaymentMethodConfig[];
  security: PaymentSecuritySettings;
}

export function readPersistentPaymentConfig(): PersistentPaymentConfig {
  try {
    ensureDataDir();
    if (fs.existsSync(PAYMENT_METHODS_FILE)) {
      const content = fs.readFileSync(PAYMENT_METHODS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        const methods = Array.isArray(parsed.methods) && parsed.methods.length > 0
          ? parsed.methods.map((pm: PaymentMethodConfig) => {
              const seed = seedPaymentMethods.find((s) => s.id === pm.id);
              return seed ? { ...seed, ...pm } : pm;
            })
          : seedPaymentMethods;
        const security = parsed.security && typeof parsed.security === 'object'
          ? { ...seedPaymentSecuritySettings, ...parsed.security }
          : seedPaymentSecuritySettings;

        return {
          methods: methods.sort((a: PaymentMethodConfig, b: PaymentMethodConfig) => (a.displayOrder || 0) - (b.displayOrder || 0)),
          security,
        };
      }
    }
  } catch (err) {
    console.warn('Error reading payment-methods.json:', err);
  }

  const defaults: PersistentPaymentConfig = {
    methods: seedPaymentMethods,
    security: seedPaymentSecuritySettings,
  };

  try {
    ensureDataDir();
    fs.writeFileSync(PAYMENT_METHODS_FILE, JSON.stringify(defaults, null, 2), 'utf8');
  } catch {}

  return defaults;
}

export function writePersistentPaymentConfig(data: Partial<PersistentPaymentConfig>): void {
  try {
    ensureDataDir();
    const current = readPersistentPaymentConfig();
    const updated: PersistentPaymentConfig = {
      methods: data.methods ? data.methods.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)) : current.methods,
      security: data.security ? { ...current.security, ...data.security } : current.security,
    };
    fs.writeFileSync(PAYMENT_METHODS_FILE, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write payment-methods.json:', err);
    throw new Error('Failed to write payment methods configuration to persistent server storage.');
  }
}
