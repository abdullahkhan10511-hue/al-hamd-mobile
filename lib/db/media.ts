import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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

export function getMediaItems(): MediaItem[] {
  return getStoredCollection(COLLECTION_KEY, defaultMedia);
}

export async function uploadMediaFile(
  file: File,
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; item?: MediaItem; error?: string }> {
  try {
    let downloadUrl = '';

    // Attempt Firebase Storage upload
    if (storage && typeof storage.app === 'object' && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      try {
        const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        downloadUrl = await getDownloadURL(snapshot.ref);
      } catch (err) {
        console.warn('Firebase Storage upload failed, falling back to local base64/object URL:', err);
      }
    }

    // Fallback if Firebase Storage is in demo mode or restricted
    if (!downloadUrl) {
      downloadUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    const newItem: MediaItem = {
      id: `med-${Date.now()}`,
      name: file.name,
      url: downloadUrl,
      size: file.size,
      type: file.type,
      createdAt: new Date().toISOString(),
    };

    const current = getMediaItems();
    const updated = [newItem, ...current];
    await persistCollection(COLLECTION_KEY, updated);

    await logActivity({
      adminEmail,
      action: 'Uploaded Image',
      target: file.name,
    });

    return { success: true, item: newItem };
  } catch (err: any) {
    return { success: false, error: err.message || 'Image upload failed.' };
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
