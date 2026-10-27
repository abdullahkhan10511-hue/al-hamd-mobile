import { AnnouncementItem } from '@/types/admin';
import { seedAnnouncements } from './seed';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';
import { getAdminAuthHeaders } from './staff';

const COLLECTION_KEY = 'announcements';

function normalizeAnnouncementsList(items: AnnouncementItem[]): AnnouncementItem[] {
  return (items || []).map((a) => {
    if (a.text?.includes('Worldwide Shipping') || a.text?.includes('$50')) {
      return { ...a, text: 'Free Nationwide Delivery on Orders Over Rs. 5,000' };
    }
    return a;
  }).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

let inFlightAnnouncementsPromise: Promise<AnnouncementItem[]> | null = null;

export async function syncAnnouncementsFromApi(): Promise<AnnouncementItem[]> {
  if (typeof window === 'undefined') return getAnnouncements();
  if (inFlightAnnouncementsPromise) return inFlightAnnouncementsPromise;

  inFlightAnnouncementsPromise = (async () => {
    try {
      const res = await fetch(`/api/announcements?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          const normalized = normalizeAnnouncementsList(data.items);
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
      console.warn('Could not sync announcements from API:', err);
    } finally {
      inFlightAnnouncementsPromise = null;
    }
    return getAnnouncements();
  })();

  return inFlightAnnouncementsPromise;
}

export function getAnnouncements(): AnnouncementItem[] {
  let fallback = seedAnnouncements;
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readPersistentAnnouncements } = require('./announcementsStorage');
      const saved = readPersistentAnnouncements();
      if (Array.isArray(saved) && saved.length > 0) {
        fallback = saved;
      }
    } catch {}
  }
  const items = getStoredCollection(COLLECTION_KEY, fallback);
  return normalizeAnnouncementsList(items);
}

export async function updateAnnouncements(
  announcements: AnnouncementItem[],
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  const normalized = normalizeAnnouncementsList(announcements);
  await persistCollection(COLLECTION_KEY, normalized);

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders(adminEmail),
        },
        body: JSON.stringify({ items: normalized }),
      });
      if (!res.ok) {
        console.warn('Failed to sync announcements to server API, status:', res.status);
      }
    } catch (err) {
      console.warn('Network error saving announcements to server:', err);
    }
  }

  await logActivity({
    adminEmail,
    action: 'Updated Announcements Bar',
    target: 'Top Bar',
  });
}

export async function createAnnouncement(
  data: Omit<AnnouncementItem, 'id'>,
  adminEmail = 'admin@alhamd.com'
): Promise<AnnouncementItem> {
  const list = getAnnouncements();
  const newItem: AnnouncementItem = {
    ...data,
    id: `ann-${Date.now()}`,
    active: data.active ?? true,
    displayOrder: data.displayOrder || list.length + 1,
  };
  const updated = [...list, newItem];
  await updateAnnouncements(updated, adminEmail);
  return newItem;
}

export async function deleteAnnouncement(id: string, adminEmail = 'admin@alhamd.com'): Promise<boolean> {
  const list = getAnnouncements();
  const filtered = list.filter((a) => a.id !== id);
  await updateAnnouncements(filtered, adminEmail);
  return true;
}
