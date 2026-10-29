import { NavigationItem } from '@/types/admin';
import { seedNavigation } from './seed';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';
import { getAdminAuthHeaders } from './staff';

const COLLECTION_KEY = 'navigation';

function normalizeNavigationList(items: NavigationItem[]): NavigationItem[] {
  const filtered = (items || [])
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

  return filtered.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

let inFlightNavigationPromise: Promise<NavigationItem[]> | null = null;
let lastNavigationSyncTimestamp = 0;
const NAVIGATION_SYNC_DEBOUNCE_MS = 5000; // 5s client-side sync debounce

export function resetNavigationSyncTimestamp(): void {
  lastNavigationSyncTimestamp = 0;
}

export async function fetchAuthoritativeNavigation(): Promise<NavigationItem[]> {
  if (typeof window === 'undefined') return getNavigation();
  try {
    const res = await fetch('/api/admin/navigation?t=' + Date.now(), {
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        const normalized = normalizeNavigationList(data.items);
        await persistCollection(COLLECTION_KEY, normalized, false);
        lastNavigationSyncTimestamp = Date.now();
        window.dispatchEvent(
          new CustomEvent('alhamd:data-updated', {
            detail: { key: COLLECTION_KEY, value: normalized },
          })
        );
        return normalized;
      }
    }
  } catch (err) {
    console.warn('Error fetching authoritative navigation:', err);
  }
  return syncNavigationFromApi(true);
}

export async function syncNavigationFromApi(forceFresh = false): Promise<NavigationItem[]> {
  if (typeof window === 'undefined') return getNavigation();
  if (inFlightNavigationPromise && !forceFresh) return inFlightNavigationPromise;
  if (!forceFresh && Date.now() - lastNavigationSyncTimestamp < NAVIGATION_SYNC_DEBOUNCE_MS) {
    return getNavigation();
  }

  inFlightNavigationPromise = (async () => {
    try {
      const url = `/api/navigation?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          const normalized = normalizeNavigationList(data.items);
          const current = getNavigation();
          const hasChanged = JSON.stringify(current) !== JSON.stringify(normalized);
          await persistCollection(COLLECTION_KEY, normalized, !hasChanged);
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
  adminEmail = 'admin@alhamdmobile.com'
): Promise<NavigationItem[]> {
  const normalized = normalizeNavigationList(items);

  let serverItems = normalized;
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/admin/navigation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeaders(adminEmail),
      },
      credentials: 'include',
      body: JSON.stringify({ items: normalized }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Failed to save navigation menu (Server status: ${res.status})`);
    }
    if (Array.isArray(data.items)) {
      serverItems = normalizeNavigationList(data.items);
    }
  }

  // Update storage & invalidate in-flight cache
  await persistCollection(COLLECTION_KEY, serverItems, false);
  lastNavigationSyncTimestamp = Date.now();

  window.dispatchEvent(
    new CustomEvent('alhamd:data-updated', {
      detail: { key: COLLECTION_KEY, value: serverItems },
    })
  );

  await logActivity({
    adminEmail,
    action: 'Updated Header Navigation Menu',
    target: 'Header Menu',
  });

  return serverItems;
}

export async function createNavigationItem(
  data: Omit<NavigationItem, 'id'>,
  adminEmail = 'admin@alhamdmobile.com'
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

export async function deleteNavigationItem(
  id: string,
  adminEmail = 'admin@alhamdmobile.com'
): Promise<boolean> {
  const items = getNavigation();
  const filtered = items.filter((n) => n.id !== id);
  await updateNavigation(filtered, adminEmail);
  return true;
}
