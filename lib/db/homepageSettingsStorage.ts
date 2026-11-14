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
import { getDataFilePath, writeAtomicJsonFile } from '@/lib/storage/dataDir';

export interface PersistentHomepageSettings {
  sections?: any[];
  hero?: any;
  flashSale?: any;
  trustBenefits?: any[];
  allProducts?: any;
}

function getSettingsFilePath(): string {
  return getDataFilePath('homepage-settings.json');
}

export function readPersistentHomepageSettings(): PersistentHomepageSettings {
  const filePath = getSettingsFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
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
    const filePath = getSettingsFilePath();
    writeAtomicJsonFile(filePath, settings);
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
