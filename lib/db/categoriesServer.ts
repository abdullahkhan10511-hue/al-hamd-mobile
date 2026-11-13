import 'server-only';
import fs from 'fs';
import path from 'path';
import { Category } from '@/types';
import { categories as initialCategories } from '@/data/categories';
import { getDataFilePath } from '@/lib/storage/dataDir';
import { allowDevMockFallback } from '@/lib/env';

export function getServerCategories(activeOnly = false): Category[] {
  let fallback: Category[] = allowDevMockFallback() ? [...initialCategories] : [];
  try {
    const devFile = getDataFilePath('dev-categories.json');
    if (fs.existsSync(devFile)) {
      const parsed = JSON.parse(fs.readFileSync(devFile, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        fallback = parsed;
      }
    }
  } catch {}

  if (activeOnly) {
    return fallback.filter((c) => {
      if (!c || (c as any).isActive === false) return false;
      const st = typeof c.status === 'string' ? c.status.trim().toLowerCase() : 'active';
      return st !== 'inactive' && st !== 'archived';
    });
  }
  return fallback;
}

export function getServerActiveCategories(): Category[] {
  return getServerCategories(true);
}

