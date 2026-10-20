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

export async function syncNavigationFromApi(): Promise<NavigationItem[]> {
  if (typeof window === 'undefined') return getNavigation();
  if (inFlightNavigationPromise) return inFlightNavigationPromise;

  inFlightNavigationPromise = (async () => {
    try {
      const res = await fetch(`/api/navigation?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          const normalized = normalizeNavigationList(data.items);
          await persistCollection(COLLECTION_KEY, normalized, true);
          window.dispatchEvent(
            new CustomEvent('alhamd:data-updated', {
              detail: { key: COLLECTION_KEY, value: normalized },
            })
          );
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
  const items = getStoredCollection(COLLECTION_KEY, seedNavigation);
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
