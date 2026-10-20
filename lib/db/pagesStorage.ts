import fs from 'fs';
import path from 'path';
import { CustomPage } from '@/types/admin';
import { seedPages } from './pages';

/**
 * Server Disk Storage & Fallback Cache for Custom Pages.
 *
 * PRIMARY / PRODUCTION STORE: MySQL `custom_pages` table via `lib/db/repositories/pages.ts`.
 * SECONDARY / FALLBACK STORE: `data/custom-pages.json` for offline resilience and local dev caching.
 */
const DATA_DIR = path.join(process.cwd(), 'data');
const PAGES_FILE = path.join(DATA_DIR, 'custom-pages.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizePages(raw: CustomPage[]): CustomPage[] {
  return (raw || []).sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function readPersistentPages(): CustomPage[] {
  try {
    ensureDataDir();
    if (fs.existsSync(PAGES_FILE)) {
      const content = fs.readFileSync(PAGES_FILE, 'utf8');
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
    ensureDataDir();
    fs.writeFileSync(PAGES_FILE, JSON.stringify(defaults, null, 2), 'utf8');
  } catch {}
  return defaults;
}

export function writePersistentPages(items: CustomPage[]): void {
  try {
    ensureDataDir();
    const sorted = normalizePages(items);
    fs.writeFileSync(PAGES_FILE, JSON.stringify(sorted, null, 2), 'utf8');
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
