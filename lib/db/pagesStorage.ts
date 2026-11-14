import 'server-only';
import fs from 'fs';
import path from 'path';
import { CustomPage } from '@/types/admin';
import { seedPages } from './pages';
import { getDataFilePath, writeAtomicJsonFile } from '@/lib/storage/dataDir';

/**
 * Server Disk Storage & Fallback Cache for Custom Pages.
 *
 * PRIMARY / PRODUCTION STORE: MySQL `custom_pages` table via `lib/db/repositories/pages.ts`.
 * SECONDARY / FALLBACK STORE: `data/custom-pages.json` for offline resilience and local dev caching.
 */
function getPagesFilePath(): string {
  return getDataFilePath('custom-pages.json');
}

function normalizePages(raw: CustomPage[]): CustomPage[] {
  return (raw || []).sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function readPersistentPages(): CustomPage[] {
  const filePath = getPagesFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizePages(parsed);
      }
    }
  } catch (err) {
    console.warn('Error reading custom-pages.json:', err);
  }

  const defaults = normalizePages(seedPages);
  try {
    writeAtomicJsonFile(filePath, defaults);
  } catch {}
  return defaults;
}

export function writePersistentPages(items: CustomPage[]): void {
  try {
    const filePath = getPagesFilePath();
    const sorted = normalizePages(items);
    writeAtomicJsonFile(filePath, sorted);
  } catch (err) {
    console.error('Failed to write custom-pages.json:', err);
    throw new Error('Failed to write custom pages to persistent server storage.');
  }
}

export function savePersistentPage(page: CustomPage): CustomPage {
  const current = readPersistentPages();
  const idx = current.findIndex((p) => p.id === page.id || p.slug === page.slug);
  const now = new Date().toISOString();

  let savedPage: CustomPage;
  if (idx >= 0) {
    savedPage = {
      ...current[idx],
      ...page,
      updatedAt: now,
    };
    current[idx] = savedPage;
  } else {
    savedPage = {
      ...page,
      id: page.id || `page-${Date.now()}`,
      order: page.order || current.length + 1,
      createdAt: page.createdAt || now,
      updatedAt: now,
    };
    current.push(savedPage);
  }

  writePersistentPages(current);
  return savedPage;
}

export function deletePersistentPage(id: string): boolean {
  const current = readPersistentPages();
  const filtered = current.filter((p) => p.id !== id && p.slug !== id);
  if (filtered.length === current.length) return false;

  filtered.forEach((p, idx) => {
    p.order = idx + 1;
  });

  writePersistentPages(filtered);
  return true;
}
