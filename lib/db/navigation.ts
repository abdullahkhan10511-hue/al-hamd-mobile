import { NavigationItem } from '@/types/admin';
import { seedNavigation } from './seed';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';
import { getAdminAuthHeaders } from './staff';

const COLLECTION_KEY = 'navigation';

function normalizeNavigationList(items: NavigationItem[]): NavigationItem[] {
  const filtered = (items || [])
    .filter((n) => n && n.href !== '/blog' && n.label?.toLowerCase() !== 'blog')
    .map((n) => {
      if (n.label?.toLowerCase() === 'new arrivals' && n.href !== '/new-arrivals') return { ...n, href: '/new-arrivals' };
      if (n.label?.toLowerCase() === 'best sellers' && n.href !== '/best-sellers') return { ...n, href: '/best-sellers' };
      if ((n.label?.toLowerCase() === 'categories' || n.href === '/#categories') && n.href !== '/categories') return { ...n, href: '/categories' };
      return n;
    });

  if (!filtered.some((n) => n.href === '/deals' || n.label?.toLowerCase() === 'deals')) {
    filtered.push({
      id: 'nav-deals',
      label: 'Deals',
      href: '/deals',
      displayOrder: 8,
      visible: true,
    });
  }

  return filtered.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

let inFlightNavigationPromise: Promise<NavigationItem[]> | null = null;
let lastNavigationSyncTimestamp = 0;
const NAVIGATION_SYNC_DEBOUNCE_MS = 60000; // 60s client-side sync debounce

export async function syncNavigationFromApi(forceFresh = false): Promise<NavigationItem[]> {
  if (typeof window === 'undefined') return getNavigation();
  if (inFlightNavigationPromise && !forceFresh) return inFlightNavigationPromise;
  if (!forceFresh && Date.now() - lastNavigationSyncTimestamp < NAVIGATION_SYNC_DEBOUNCE_MS) {
    return getNavigation();
  }

  inFlightNavigationPromise = (async () => {
    try {
      const url = forceFresh ? `/api/navigation?t=${Date.now()}` : '/api/navigation';
      const res = await fetch(url, forceFresh ? { cache: 'no-store' } : undefined);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          const normalized = normalizeNavigationList(data.items);
          const current = getNavigation();
          const hasChanged = JSON.stringify(current) !== JSON.stringify(normalized);
          await persistCollection(COLLECTION_KEY, normalized, true);
          lastNavigationSyncTimestamp = Date.now();
          if (hasChanged) {
            window.dispatchEvent(
              new CustomEvent('alhamd:data-updated', {
                detail: { key: COLLECTION_KEY, value: normalized },
              })
            );
          }
          return normalized;
        }
      }
    } catch (err) {
      console.warn('Could not sync navigation from API:', err);
    } finally {
      inFlightNavigationPromise = null;
    }
    return getNavigation();
  })();

  return inFlightNavigationPromise;
}

export function getNavigation(): NavigationItem[] {
  let fallback = seedNavigation;
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readPersistentNavigation } = require('./navigationStorage');
      const saved = readPersistentNavigation();
      if (Array.isArray(saved) && saved.length > 0) {
        fallback = saved;
      }
    } catch {}
  }
  const items = getStoredCollection(COLLECTION_KEY, fallback);
  return normalizeNavigationList(items);
}

export async function updateNavigation(
  items: NavigationItem[],
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  const normalized = normalizeNavigationList(items);
  await persistCollection(COLLECTION_KEY, normalized);

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders(adminEmail),
        },
        body: JSON.stringify({ items: normalized }),
      });
      if (!res.ok) {
        console.warn('Failed to sync navigation to server API, status:', res.status);
      }
    } catch (err) {
      console.warn('Network error saving navigation to server:', err);
    }
  }

  await logActivity({
    adminEmail,
    action: 'Updated Header Navigation Menu',
    target: 'Header Menu',
  });
}

export async function createNavigationItem(
  data: Omit<NavigationItem, 'id'>,
  adminEmail = 'admin@alhamd.com'
): Promise<NavigationItem> {
  const items = getNavigation();
  const newItem: NavigationItem = {
    ...data,
    id: `nav-${Date.now()}`,
    visible: data.visible ?? true,
    displayOrder: data.displayOrder || items.length + 1,
  };
  const updated = [...items, newItem];
  await updateNavigation(updated, adminEmail);
  return newItem;
}

export async function deleteNavigationItem(id: string, adminEmail = 'admin@alhamd.com'): Promise<boolean> {
  const items = getNavigation();
  const filtered = items.filter((n) => n.id !== id);
  await updateNavigation(filtered, adminEmail);
  return true;
}
