import { AnnouncementItem } from '@/types/admin';
import { seedAnnouncements } from './seed';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';
import { allowDevMockFallback } from '../env';

const COLLECTION_KEY = 'announcements';

export function getAnnouncements(): AnnouncementItem[] {
  const fallback = allowDevMockFallback() ? seedAnnouncements : [];
  const items = getStoredCollection(COLLECTION_KEY, fallback).map((a) => {
    if (a.text.includes('Worldwide Shipping') || a.text.includes('$50')) {
      return { ...a, text: 'Free Nationwide Delivery on Orders Over Rs. 5,000' };
    }
    return a;
  });
  return items.sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function updateAnnouncements(
  announcements: AnnouncementItem[],
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  await persistCollection(COLLECTION_KEY, announcements);
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
