import { HomepageVideo } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';

const COLLECTION_KEY = 'homepage_videos';

export const seedHomepageVideos: HomepageVideo[] = [
  {
    id: 'video-1',
    title: 'AL-HAMD Mobile Ecosystem Showcase',
    url: '/uploads/videos/alhamd_hero_showcase_1.mp4',
    thumbnailUrl: '',
    active: true,
    displayOrder: 1,
    duration: 5,
    size: 1128375,
    mimeType: 'video/mp4',
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-25T10:00:00.000Z',
  },
  {
    id: 'video-2',
    title: 'GaN Fast Charging & Premium Accessories',
    url: '/uploads/videos/alhamd_hero_showcase_2.mp4',
    thumbnailUrl: '',
    active: true,
    displayOrder: 2,
    duration: 52,
    size: 4372373,
    mimeType: 'video/mp4',
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-25T10:00:00.000Z',
  },
];

let hasSyncedHomepageVideosFromApi = false;
export async function syncHomepageVideosFromApi(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/admin/homepage-videos', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.videos) && data.videos.length > 0) {
        await persistCollection(COLLECTION_KEY, data.videos);
        window.dispatchEvent(
          new CustomEvent('alhamd:data-updated', {
            detail: { key: COLLECTION_KEY, value: data.videos },
          })
        );
      }
    }
  } catch {}
}

/**
 * Get all homepage videos ordered by displayOrder
 */
export function getHomepageVideos(): HomepageVideo[] {
  if (typeof window !== 'undefined' && !hasSyncedHomepageVideosFromApi) {
    hasSyncedHomepageVideosFromApi = true;
    syncHomepageVideosFromApi().catch(() => {});
  }
  const items = getStoredCollection<HomepageVideo>(COLLECTION_KEY, seedHomepageVideos);
  return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

/**
 * Get only ACTIVE homepage videos for the live storefront sequence
 */
export function getActiveHomepageVideos(): HomepageVideo[] {
  return getHomepageVideos().filter((v) => v.active);
}

/**
 * Save or update a homepage video
 */
export async function saveHomepageVideo(
  videoData: Partial<HomepageVideo>,
  adminEmail = 'admin@alhamd.com'
): Promise<HomepageVideo> {
  const current = getHomepageVideos();
  const now = new Date().toISOString();

  if (videoData.id) {
    const index = current.findIndex((v) => v.id === videoData.id);
    if (index !== -1) {
      const updatedItem: HomepageVideo = {
        ...current[index],
        ...videoData,
        updatedAt: now,
      };
      current[index] = updatedItem;
      current.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      await persistCollection(COLLECTION_KEY, current);
      await syncWithServer(current);
      await logActivity({
        adminEmail,
        action: 'Updated Homepage Video',
        target: updatedItem.title,
      });
      return updatedItem;
    }
  }

  // Create new video item
  const nextOrder =
    videoData.displayOrder !== undefined
      ? videoData.displayOrder
      : current.length > 0
      ? Math.max(...current.map((v) => v.displayOrder || 0)) + 1
      : 1;

  const newItem: HomepageVideo = {
    id: videoData.id || `video-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: videoData.title || 'Untitled Homepage Video',
    url: videoData.url || '',
    thumbnailUrl: videoData.thumbnailUrl || '',
    active: videoData.active !== undefined ? videoData.active : true,
    displayOrder: nextOrder,
    duration: videoData.duration,
    size: videoData.size,
    mimeType: videoData.mimeType,
    createdAt: now,
    updatedAt: now,
  };

  const updatedList = [...current, newItem].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  await persistCollection(COLLECTION_KEY, updatedList);
  await syncWithServer(updatedList);

  await logActivity({
    adminEmail,
    action: 'Added Homepage Video',
    target: newItem.title,
  });

  return newItem;
}

/**
 * Toggle Active / Inactive status of a video
 */
export async function toggleHomepageVideoStatus(
  id: string,
  active: boolean,
  adminEmail = 'admin@alhamd.com'
): Promise<HomepageVideo | null> {
  const current = getHomepageVideos();
  const item = current.find((v) => v.id === id);
  if (!item) return null;

  item.active = active;
  item.updatedAt = new Date().toISOString();
  await persistCollection(COLLECTION_KEY, current);
  await syncWithServer(current);

  await logActivity({
    adminEmail,
    action: active ? 'Activated Homepage Video' : 'Deactivated Homepage Video',
    target: item.title,
  });

  return item;
}

/**
 * Persistently reorder homepage videos by ordered list of IDs
 */
export async function reorderHomepageVideos(
  orderedIds: string[],
  adminEmail = 'admin@alhamd.com'
): Promise<HomepageVideo[]> {
  const current = getHomepageVideos();
  const map = new Map(current.map((v) => [v.id, v]));
  const reordered: HomepageVideo[] = [];

  orderedIds.forEach((id, index) => {
    const item = map.get(id);
    if (item) {
      item.displayOrder = index + 1;
      item.updatedAt = new Date().toISOString();
      reordered.push(item);
      map.delete(id);
    }
  });

  // Append any remaining items that were not explicitly included
  map.forEach((item) => {
    item.displayOrder = reordered.length + 1;
    reordered.push(item);
  });

  await persistCollection(COLLECTION_KEY, reordered);
  await syncWithServer(reordered);

  await logActivity({
    adminEmail,
    action: 'Reordered Homepage Videos',
    target: `${reordered.length} videos arranged`,
  });

  return reordered;
}

/**
 * Delete a homepage video by ID and clean up local media if applicable
 */
export async function deleteHomepageVideo(
  id: string,
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const current = getHomepageVideos();
  const target = current.find((v) => v.id === id);
  if (!target) return false;

  const filtered = current.filter((v) => v.id !== id);
  // Re-index remaining order
  filtered.forEach((v, idx) => {
    v.displayOrder = idx + 1;
  });

  await persistCollection(COLLECTION_KEY, filtered);
  await syncWithServer(filtered);

  // If local uploaded video, call server cleanup
  if (target.url && target.url.startsWith('/uploads/videos/')) {
    try {
      await fetch('/api/admin/homepage-videos/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.url }),
      });
    } catch (e) {
      console.warn('Failed to delete physical video file:', e);
    }
  }

  await logActivity({
    adminEmail,
    action: 'Deleted Homepage Video',
    target: target.title,
  });

  return true;
}

/**
 * Background sync helper with server-side JSON storage
 */
async function syncWithServer(items: HomepageVideo[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/admin/homepage-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', items }),
    });
  } catch (err) {
    // Local persistence is already guaranteed
  }
}
