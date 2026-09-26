import { NavigationItem } from '@/types/admin';
import { seedNavigation } from './seed';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';

const COLLECTION_KEY = 'navigation';

export function getNavigation(): NavigationItem[] {
  const items = getStoredCollection(COLLECTION_KEY, seedNavigation)
    .filter((n) => n.href !== '/blog' && n.label.toLowerCase() !== 'blog')
    .map((n) => {
      if (n.label.toLowerCase() === 'new arrivals' && n.href !== '/new-arrivals') return { ...n, href: '/new-arrivals' };
      if (n.label.toLowerCase() === 'best sellers' && n.href !== '/best-sellers') return { ...n, href: '/best-sellers' };
      if ((n.label.toLowerCase() === 'categories' || n.href === '/#categories') && n.href !== '/categories') return { ...n, href: '/categories' };
      return n;
    });
  return items.sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function updateNavigation(
  items: NavigationItem[],
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  await persistCollection(COLLECTION_KEY, items);
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
