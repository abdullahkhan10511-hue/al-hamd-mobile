import fs from 'fs';
import path from 'path';
import { NavigationItem } from '@/types/admin';
import { seedNavigation } from './seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const NAVIGATION_FILE = path.join(DATA_DIR, 'navigation.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readPersistentNavigation(): NavigationItem[] {
  try {
    ensureDataDir();
    if (fs.existsSync(NAVIGATION_FILE)) {
      const content = fs.readFileSync(NAVIGATION_FILE, 'utf8');
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
    ensureDataDir();
    fs.writeFileSync(NAVIGATION_FILE, JSON.stringify(defaults, null, 2), 'utf8');
  } catch {}
  return defaults;
}

export function writePersistentNavigation(items: NavigationItem[]): void {
  try {
    ensureDataDir();
    const normalized = normalizeNavigationItems(items);
    fs.writeFileSync(NAVIGATION_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write navigation.json:', err);
    throw new Error('Failed to write navigation menu to persistent server storage.');
  }
}

function normalizeNavigationItems(raw: NavigationItem[]): NavigationItem[] {
  const items = (raw || [])
    .filter((n) => n && n.href !== '/blog' && n.label?.toLowerCase() !== 'blog')
    .map((n) => {
      if (n.label?.toLowerCase() === 'new arrivals' && n.href !== '/new-arrivals') return { ...n, href: '/new-arrivals' };
      if (n.label?.toLowerCase() === 'best sellers' && n.href !== '/best-sellers') return { ...n, href: '/best-sellers' };
      if ((n.label?.toLowerCase() === 'categories' || n.href === '/#categories') && n.href !== '/categories') return { ...n, href: '/categories' };
      return n;
    });

  if (!items.some((n) => n.href === '/deals' || n.label?.toLowerCase() === 'deals')) {
    items.push({
      id: 'nav-deals',
      label: 'Deals',
      href: '/deals',
      displayOrder: 8,
      visible: true,
    });
  }

  return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}
