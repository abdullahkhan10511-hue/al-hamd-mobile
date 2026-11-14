import 'server-only';
import fs from 'fs';
import path from 'path';
import { ShopLocation } from '@/types/admin';
import { getDataFilePath, writeAtomicJsonFile } from '@/lib/storage/dataDir';

function getLocationsFilePath(): string {
  return getDataFilePath('shop-locations.json');
}

export function readPersistentLocations(): ShopLocation[] {
  const filePath = getLocationsFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading shop-locations.json:', err);
  }
  return [];
}

export function writePersistentLocations(locations: ShopLocation[]): void {
  try {
    const filePath = getLocationsFilePath();
    writeAtomicJsonFile(filePath, locations);
  } catch (err) {
    console.error('Failed to write shop-locations.json:', err);
    throw new Error('Failed to write shop location to persistent server storage.');
  }
}
