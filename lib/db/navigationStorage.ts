import 'server-only';
import fs from 'fs';
import path from 'path';
import { NavigationItem } from '@/types/admin';
import { seedNavigation } from './seed';
import { getDataFilePath, writeAtomicJsonFile } from '@/lib/storage/dataDir';

function getNavigationFilePath(): string {
  return getDataFilePath('navigation.json');
}

export function readPersistentNavigation(): NavigationItem[] {
  const filePath = getNavigationFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeNavigationItems(parsed);
      }
    }
  } catch (err) {
    console.warn('Error reading navigation.json:', err);
  }

  // Fallback to seeds, initialized to disk
  const defaults = normalizeNavigationItems(seedNavigation);
  try {
    writeAtomicJsonFile(filePath, defaults);
  } catch {}
  return defaults;
}

export function writePersistentNavigation(items: NavigationItem[]): void {
  try {
    const filePath = getNavigationFilePath();
    const normalized = normalizeNavigationItems(items);
    writeAtomicJsonFile(filePath, normalized);
  } catch (err) {
    console.error('Failed to write navigation.json:', err);
    throw new Error('Failed to write navigation menu to persistent server storage.');
  }
}

function normalizeNavigationItems(raw: NavigationItem[]): NavigationItem[] {
  const items = (raw || [])
    .filter((n) => n && typeof n === 'object' && n.label && n.href && n.href !== '/blog' && n.label?.toLowerCase() !== 'blog')
    .map((n, index) => {
      let href = (n.href || '').trim();
      const label = (n.label || '').trim();
      if (label.toLowerCase() === 'new arrivals' && href !== '/new-arrivals') href = '/new-arrivals';
      if (label.toLowerCase() === 'best sellers' && href !== '/best-sellers') href = '/best-sellers';
      if ((label.toLowerCase() === 'categories' || href === '/#categories') && href !== '/categories') href = '/categories';

      return {
        id: n.id || `nav-${Date.now()}-${index}`,
        label,
        href,
        displayOrder: typeof n.displayOrder === 'number' ? n.displayOrder : index + 1,
        visible: n.visible !== false,
      };
    });

  return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}
