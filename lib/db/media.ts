import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';

export interface MediaItem {
  id: string;
  url: string;
  name: string;
  size?: number;
  type?: string;
  createdAt: string;
}

const COLLECTION_KEY = 'media_library';

const defaultMedia: MediaItem[] = [
  {
    id: 'med-1',
    name: 'Hero Mobile Accessories Flatlay.jpg',
    url: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=1200&auto=format&fit=crop',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'med-2',
    name: 'GaN Fast Wall Charger.jpg',
    url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1000&auto=format&fit=crop',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'med-3',
    name: '20000mAh Power Bank.jpg',
    url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=1000&auto=format&fit=crop',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'med-4',
    name: 'AirPods Pro TWS Earbuds.jpg',
    url: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?q=80&w=1000&auto=format&fit=crop',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'med-5',
    name: 'Smart Watch Titanium.jpg',
    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'med-6',
    name: 'Braided USB-C Cable.jpg',
    url: 'https://images.unsplash.com/photo-1588515724527-074a7a56616c?q=80&w=1000&auto=format&fit=crop',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
];

import { allowDevMockFallback } from '../env';

export function getMediaItems(): MediaItem[] {
  const fallback = allowDevMockFallback() ? defaultMedia : [];
  return getStoredCollection(COLLECTION_KEY, fallback);
}

export async function uploadMediaFile(
  file: File,
  targetFolderOrEmail = 'products'
): Promise<{ success: boolean; item?: MediaItem; error?: string }> {
  try {
    const isCategory = targetFolderOrEmail === 'categories' || targetFolderOrEmail === 'category';
    const isBrand = targetFolderOrEmail === 'brands' || targetFolderOrEmail === 'brand';

    let uploadEndpoint = '/api/admin/products/upload';
    if (isCategory) uploadEndpoint = '/api/admin/categories/upload';
    else if (isBrand) uploadEndpoint = '/api/admin/brands/upload';

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok || !data.success || !data.url) {
      throw new Error(data.error || 'Server failed to save media file.');
    }

    const newItem: MediaItem = {
      id: data.items?.[0]?.id || `med-${Date.now()}`,
      name: file.name,
      url: data.url,
      size: file.size,
      type: file.type,
      createdAt: new Date().toISOString(),
    };

    const current = getMediaItems();
    const updated = [newItem, ...current];
    await persistCollection(COLLECTION_KEY, updated);

    return { success: true, item: newItem };
  } catch (err: any) {
    console.error('Error in uploadMediaFile:', err);
    return { success: false, error: err?.message || 'Media upload failed.' };
  }
}

export async function deleteMediaItem(id: string, adminEmail = 'admin@alhamd.com'): Promise<boolean> {
  const current = getMediaItems();
  const target = current.find((m) => m.id === id);
  if (!target) return false;

  const filtered = current.filter((m) => m.id !== id);
  await persistCollection(COLLECTION_KEY, filtered);

  await logActivity({
    adminEmail,
    action: 'Deleted Media Item',
    target: target.name,
  });

  return true;
}

export async function uploadImage(file: File, folder = 'general'): Promise<string> {
  const result = await uploadMediaFile(file);
  if (result.success && result.item?.url) {
    return result.item.url;
  }
  throw new Error(result.error || 'Failed to upload image');
}
