import fs from 'fs';
import path from 'path';
import { ShopLocation } from '@/types/admin';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCATIONS_FILE = path.join(DATA_DIR, 'shop-locations.json');

export function readPersistentLocations(): ShopLocation[] {
  try {
    if (fs.existsSync(LOCATIONS_FILE)) {
      const content = fs.readFileSync(LOCATIONS_FILE, 'utf8');
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
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write shop-locations.json:', err);
    throw new Error('Failed to write shop location to persistent server storage.');
  }
}
