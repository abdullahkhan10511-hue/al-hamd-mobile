import 'server-only';
import fs from 'fs';
import path from 'path';
import { Brand } from '@/types/admin';
import { seedBrands } from './seed';
import { getDataFilePath } from '@/lib/storage/dataDir';
import { allowDevMockFallback } from '@/lib/env';

export function getServerBrands(activeOnly = false): Brand[] {
  let fallback: Brand[] = allowDevMockFallback() ? [...seedBrands] : [];
  try {
    const devFile = getDataFilePath('dev-brands.json');
    if (fs.existsSync(devFile)) {
      const parsed = JSON.parse(fs.readFileSync(devFile, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        fallback = parsed.map((b: any) => {
          if (b.productCount !== undefined && b.productCount !== null) return b;
          const seed = seedBrands.find((s) => s.id === b.id || s.slug === b.slug);
          return { ...b, productCount: seed?.productCount ?? 0 };
        });
      }
    }
  } catch {}

  const sorted = [...fallback].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (activeOnly) {
    return sorted.filter((b) => b.status === 'active');
  }
  return sorted;
}

export function getServerActiveBrands(): Brand[] {
  return getServerBrands(true);
}

