import { AdminNotification } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';

const COLLECTION_KEY = 'admin_notifications';

export function getNotifications(): AdminNotification[] {
  return getStoredCollection(COLLECTION_KEY, [
    {
      id: 'notif-1',
      title: 'Store Ready',
      message: 'Admin control center is live and synced with Firestore.',
      type: 'system',
      read: false,
      timestamp: new Date().toISOString(),
    },
  ]);
}

export async function addNotification(
  notif: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>
): Promise<AdminNotification> {
  const list = getNotifications();
  const newNotif: AdminNotification = {
    ...notif,
    id: `notif-${Date.now()}`,
    read: false,
    timestamp: new Date().toISOString(),
  };

  const updated = [newNotif, ...list].slice(0, 50);
  await persistCollection(COLLECTION_KEY, updated);
  return newNotif;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const list = getNotifications();
  const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
  await persistCollection(COLLECTION_KEY, updated);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const list = getNotifications();
  const updated = list.map((n) => ({ ...n, read: true }));
  await persistCollection(COLLECTION_KEY, updated);
}
