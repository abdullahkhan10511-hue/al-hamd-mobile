import { HomepageVideo } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';
import { getAdminAuthHeaders } from './staff';

const COLLECTION_KEY = 'homepage_videos';
const ACTIVE_COLLECTION_KEY = 'homepage_active_videos';

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
export async function syncHomepageVideosFromApi(): Promise<HomepageVideo[]> {
  if (typeof window === 'undefined') return [];
  try {
    const res = await fetch(`/api/homepage-videos?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        const list: HomepageVideo[] = Array.isArray(data.videos)
          ? data.videos
          : Array.isArray(data.activeVideos)
          ? data.activeVideos
          : Array.isArray(data.items)
          ? data.items
          : [];

        // Strictly active videos with non-empty URLs
        const validActive = list
          .filter((v) => {
            if (!v) return false;
            const isActive =
              (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') &&
              v.active !== false &&
              (v.active as any) !== 0 &&
              (v.active as any) !== '0' &&
              (v.active as any) !== 'false';
            const hasUrl = typeof v.url === 'string' && v.url.trim().length > 0;
            return Boolean(isActive && hasUrl);
          })
          .sort((a, b) => {
            const orderA = typeof a.displayOrder === 'number' && !isNaN(a.displayOrder) ? a.displayOrder : 0;
            const orderB = typeof b.displayOrder === 'number' && !isNaN(b.displayOrder) ? b.displayOrder : 0;
            if (orderA !== orderB) return orderA - orderB;
            return (a.id || '').localeCompare(b.id || '');
          });

        await persistCollection(ACTIVE_COLLECTION_KEY, validActive, true);
        window.dispatchEvent(
          new CustomEvent('alhamd:data-updated', {
            detail: { key: ACTIVE_COLLECTION_KEY, value: validActive },
          })
        );
        return validActive;
      }
    }
  } catch (err) {
    console.warn('Failed to sync homepage videos from API:', err);
  }
  return [];
}

/**
 * Get all homepage videos ordered deterministically by displayOrder ASC, then id ASC
 */
export function getHomepageVideos(): HomepageVideo[] {
  const items = getStoredCollection<HomepageVideo>(COLLECTION_KEY, seedHomepageVideos);
  return items.sort((a, b) => {
    const orderA = typeof a.displayOrder === 'number' && !isNaN(a.displayOrder) ? a.displayOrder : 0;
    const orderB = typeof b.displayOrder === 'number' && !isNaN(b.displayOrder) ? b.displayOrder : 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Get only ACTIVE homepage videos for the live storefront sequence
 */
export function getActiveHomepageVideos(): HomepageVideo[] {
  const items = getStoredCollection<HomepageVideo>(ACTIVE_COLLECTION_KEY, []);
  return items
    .filter((v) => {
      if (!v) return false;
      const isActive =
        (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') &&
        v.active !== false &&
        (v.active as any) !== 0 &&
        (v.active as any) !== '0' &&
        (v.active as any) !== 'false';
      const hasUrl = typeof v.url === 'string' && v.url.trim().length > 0;
      return Boolean(isActive && hasUrl);
    })
    .sort((a, b) => {
      const orderA = typeof a.displayOrder === 'number' && !isNaN(a.displayOrder) ? a.displayOrder : 0;
      const orderB = typeof b.displayOrder === 'number' && !isNaN(b.displayOrder) ? b.displayOrder : 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.id || '').localeCompare(b.id || '');
    });
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

  let targetItem: HomepageVideo;

  if (videoData.id) {
    const index = current.findIndex((v) => v.id === videoData.id);
    if (index !== -1) {
      targetItem = {
        ...current[index],
        ...videoData,
        updatedAt: now,
      };
      current[index] = targetItem;
    } else {
      targetItem = {
        id: videoData.id,
        title: videoData.title || 'Untitled Homepage Video',
        url: videoData.url || '',
        thumbnailUrl: videoData.thumbnailUrl || '',
        active: videoData.active !== undefined ? videoData.active : true,
        displayOrder: videoData.displayOrder !== undefined ? videoData.displayOrder : current.length + 1,
        duration: videoData.duration,
        size: videoData.size,
        mimeType: videoData.mimeType,
        createdAt: now,
        updatedAt: now,
      };
      current.push(targetItem);
    }
  } else {
    const nextOrder =
      videoData.displayOrder !== undefined
        ? videoData.displayOrder
        : current.length > 0
        ? Math.max(...current.map((v) => v.displayOrder || 0)) + 1
        : 1;

    targetItem = {
      id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
    current.push(targetItem);
  }

  current.sort((a, b) => {
    const orderA = typeof a.displayOrder === 'number' && !isNaN(a.displayOrder) ? a.displayOrder : 0;
    const orderB = typeof b.displayOrder === 'number' && !isNaN(b.displayOrder) ? b.displayOrder : 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.id || '').localeCompare(b.id || '');
  });
  await persistCollection(COLLECTION_KEY, current);

  // Synchronize active collection for public hero
  const activeSubset = current.filter((v) => {
    const isActive = v && (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') && v.active !== false && (v.active as any) !== 0 && (v.active as any) !== '0';
    return Boolean(isActive && v.url && v.url.trim());
  });
  await persistCollection(ACTIVE_COLLECTION_KEY, activeSubset, true);
  window.dispatchEvent(
    new CustomEvent('alhamd:data-updated', {
      detail: { key: ACTIVE_COLLECTION_KEY, value: activeSubset },
    })
  );

  if (typeof window !== 'undefined') {
    const payload = videoData.id
      ? { action: 'update', id: videoData.id, updates: targetItem }
      : { action: 'add', item: targetItem };

    const authHeaders = {
      ...getAdminAuthHeaders(adminEmail),
      'Content-Type': 'application/json',
    };

    const res = await fetch('/api/admin/homepage-videos', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save homepage video to database.');
    }
    if (data.success && Array.isArray(data.items)) {
      await persistCollection(COLLECTION_KEY, data.items);
      const serverActive = data.items.filter((v: HomepageVideo) => {
        const isActive = v && (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') && v.active !== false && (v.active as any) !== 0 && (v.active as any) !== '0';
        return Boolean(isActive && v.url && v.url.trim());
      });
      await persistCollection(ACTIVE_COLLECTION_KEY, serverActive, true);
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: ACTIVE_COLLECTION_KEY, value: serverActive },
        })
      );
    }
  }

  await logActivity({
    adminEmail,
    action: videoData.id ? 'Updated Homepage Video' : 'Added Homepage Video',
    target: targetItem.title,
  });

  return targetItem;
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

  // Immediately update public active sequence
  const activeSubset = current.filter((v) => {
    const isActive = v && (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') && v.active !== false && (v.active as any) !== 0 && (v.active as any) !== '0';
    return Boolean(isActive && v.url && v.url.trim());
  });
  await persistCollection(ACTIVE_COLLECTION_KEY, activeSubset, true);
  window.dispatchEvent(
    new CustomEvent('alhamd:data-updated', {
      detail: { key: ACTIVE_COLLECTION_KEY, value: activeSubset },
    })
  );

  if (typeof window !== 'undefined') {
    const authHeaders = {
      ...getAdminAuthHeaders(adminEmail),
      'Content-Type': 'application/json',
    };
    const res = await fetch('/api/admin/homepage-videos', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action: 'update', id, updates: { ...item, active } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update video status in database.');
    }
    if (data.success && Array.isArray(data.items)) {
      await persistCollection(COLLECTION_KEY, data.items);
      const serverActive = data.items.filter((v: HomepageVideo) => {
        const isActive = v && (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') && v.active !== false && (v.active as any) !== 0 && (v.active as any) !== '0';
        return Boolean(isActive && v.url && v.url.trim());
      });
      await persistCollection(ACTIVE_COLLECTION_KEY, serverActive, true);
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: ACTIVE_COLLECTION_KEY, value: serverActive },
        })
      );
    }
  }

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

  // Immediately update public active sequence
  const activeSubset = reordered.filter((v) => {
    const isActive = v && (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') && v.active !== false && (v.active as any) !== 0 && (v.active as any) !== '0';
    return Boolean(isActive && v.url && v.url.trim());
  });
  await persistCollection(ACTIVE_COLLECTION_KEY, activeSubset, true);
  window.dispatchEvent(
    new CustomEvent('alhamd:data-updated', {
      detail: { key: ACTIVE_COLLECTION_KEY, value: activeSubset },
    })
  );

  if (typeof window !== 'undefined') {
    const authHeaders = {
      ...getAdminAuthHeaders(adminEmail),
      'Content-Type': 'application/json',
    };
    const res = await fetch('/api/admin/homepage-videos', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action: 'reorder', orderedIds, items: reordered }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update video order in database.');
    }
    if (data.success && Array.isArray(data.items)) {
      await persistCollection(COLLECTION_KEY, data.items);
      const serverActive = data.items.filter((v: HomepageVideo) => {
        const isActive = v && (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') && v.active !== false && (v.active as any) !== 0 && (v.active as any) !== '0';
        return Boolean(isActive && v.url && v.url.trim());
      });
      await persistCollection(ACTIVE_COLLECTION_KEY, serverActive, true);
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: ACTIVE_COLLECTION_KEY, value: serverActive },
        })
      );
      return data.items;
    }
  }

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

  // Update active collection
  const activeSubset = filtered.filter((v) => {
    const isActive = v && (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') && v.active !== false && (v.active as any) !== 0 && (v.active as any) !== '0';
    return Boolean(isActive && v.url && v.url.trim());
  });
  await persistCollection(ACTIVE_COLLECTION_KEY, activeSubset, true);
  window.dispatchEvent(
    new CustomEvent('alhamd:data-updated', {
      detail: { key: ACTIVE_COLLECTION_KEY, value: activeSubset },
    })
  );

  if (typeof window !== 'undefined') {
    const authHeaders = {
      ...getAdminAuthHeaders(adminEmail),
      'Content-Type': 'application/json',
    };
    const res = await fetch('/api/admin/homepage-videos', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action: 'delete', id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete homepage video from database.');
    }
    if (data.success && Array.isArray(data.items)) {
      await persistCollection(COLLECTION_KEY, data.items);
    }
  }

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
