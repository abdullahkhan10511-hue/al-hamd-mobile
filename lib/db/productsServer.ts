import 'server-only';
import fs from 'fs';
import path from 'path';
import { Product } from '@/types';
import { seedProducts } from './seed';
import { getDataFilePath } from '@/lib/storage/dataDir';
import { allowDevMockFallback } from '@/lib/env';
import { sanitizeProducts } from './products';

export function getServerProducts(): (Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean })[] {
  let fallback: any[] = allowDevMockFallback() ? [...seedProducts] : [];
  try {
    const devFile = getDataFilePath('dev-products.json');
    if (fs.existsSync(devFile)) {
      const parsed = JSON.parse(fs.readFileSync(devFile, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        fallback = parsed;
      }
    }
  } catch {}

  return sanitizeProducts(fallback);
}

