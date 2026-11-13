import 'server-only';
import fs from 'fs';
import path from 'path';
import {
  seedHomepageSections,
  seedHeroConfig,
  seedFlashSaleConfig,
  seedTrustBenefits,
  seedAllProductsConfig,
} from '@/lib/db/seed';
import { getDataDir } from '@/lib/storage/dataDir';

const DATA_DIR = getDataDir();
const SETTINGS_FILE = path.join(DATA_DIR, 'homepage-settings.json');

export interface PersistentHomepageSettings {
  sections?: any[];
  hero?: any;
  flashSale?: any;
  trustBenefits?: any[];
  allProducts?: any;
}

export function readPersistentHomepageSettings(): PersistentHomepageSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading homepage-settings.json:', err);
  }
  return {};
}

export function writePersistentHomepageSettings(settings: PersistentHomepageSettings): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write homepage-settings.json:', err);
    throw new Error('Failed to write homepage settings to persistent server storage.');
  }
}

export function getMergedHomepageSettings() {
  const saved = readPersistentHomepageSettings();
  return {
    sections: saved.sections || seedHomepageSections,
    hero: { showText: false, ...seedHeroConfig, ...(saved.hero || {}) },
    flashSale: saved.flashSale || seedFlashSaleConfig,
    trustBenefits: saved.trustBenefits || seedTrustBenefits,
    allProducts: saved.allProducts || seedAllProductsConfig,
  };
}
