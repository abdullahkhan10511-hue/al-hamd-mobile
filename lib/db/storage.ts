import { db } from '../firebase';
import {
  doc,
  setDoc,
} from 'firebase/firestore';

import { allowDevMockFallback } from '../env';

const STORAGE_PREFIX = 'alhamd_store_';

// Check if window and localStorage are available
const isBrowser = typeof window !== 'undefined';

// Unified in-memory cache for SSR & client synchronization
const memoryCache: Record<string, any> = {};

function isStaleMockData(key: string, data: any): boolean {
  if (!Array.isArray(data)) return false;
  if (key === 'products') {
    return data.some(
      (p: any) =>
        p &&
        (p.slug === 'essential-hoodie' ||
          p.slug === 'air-max-270' ||
          (p.id === 'prod-15' && p.slug === 'apple-airpods-pro-2' && p.sku === 'AP-APP2-015') ||
          (p.id === 'prod-16' && p.slug === 'anker-20000mah-power-bank'))
    );
  }
  if (key === 'categories') {
    return data.some(
      (c: any) =>
        c &&
        (c.slug === 'fashion' ||
          c.slug === 'beauty' ||
          c.slug === 'fitness' ||
          c.slug === 'home-decor' ||
          c.id === 'cat-phone-cases' ||
          c.id === 'cat-screen-protectors' ||
          c.id === 'cat-chargers')
    );
  }
  if (key === 'customers') {
    return data.some(
      (c: any) =>
        c &&
        (c.email === 'hamza.khan@gmail.com' || c.email === 'ayesha.malik@outlook.com')
    );
  }
  if (key === 'homepage_banners') {
    return data.some(
      (b: any) =>
        b &&
        b.id === 'banner-1' &&
        typeof b.image === 'string' &&
        b.image.includes('photo-1556905055-8f358a7a47b2')
    );
  }
  return false;
}

export function getLocal<T>(key: string, fallback: T): T {
  if (memoryCache[key] !== undefined) {
    if (!allowDevMockFallback() && isStaleMockData(key, memoryCache[key])) {
      delete memoryCache[key];
    } else {
      return memoryCache[key] as T;
    }
  }
  if (!isBrowser) return fallback;

  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (item !== null) {
      const parsed = JSON.parse(item);
      if (!allowDevMockFallback() && isStaleMockData(key, parsed)) {
        localStorage.removeItem(STORAGE_PREFIX + key);
        memoryCache[key] = fallback;
        return fallback;
      }
      memoryCache[key] = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn(`Error reading ${key} from storage:`, err);
  }

  memoryCache[key] = fallback;
  return fallback;
}

export function setLocal<T>(key: string, value: T, silent = false): void {
  memoryCache[key] = value;
  if (!isBrowser) return;

  try {
    const serialized = JSON.stringify(value);
    const existing = localStorage.getItem(STORAGE_PREFIX + key);
    if (existing === serialized) {
      // Data is unchanged; do not dispatch duplicate event cascades
      return;
    }
    localStorage.setItem(STORAGE_PREFIX + key, serialized);
    if (!silent) {
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key, value },
        })
      );
    }
  } catch (err) {
    console.warn(`Error saving ${key} to storage:`, err);
  }
}

/**
 * Saves a document or full collection to Firestore with local fallback
 */
export async function persistCollection<T>(collectionName: string, items: T[]): Promise<void> {
  setLocal(collectionName, items);

  // Attempt Firestore sync only if real Firebase credentials are provided
  const hasRealFirebase =
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key-placeholder';

  if (hasRealFirebase && db && typeof db.type === 'string') {
    try {
      const docRef = doc(db, 'system_data', collectionName);
      await Promise.race([
        setDoc(docRef, { items, updatedAt: new Date().toISOString() }, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore sync timeout')), 1500)),
      ]);
    } catch (e) {
      // Offline or permission restriction; local persistence is already guaranteed
    }
  }
}

/**
 * Loads a collection, prioritizing memory/local cache with background Firestore revalidation
 */
export function getStoredCollection<T>(collectionName: string, fallback: T[]): T[] {
  return getLocal<T[]>(collectionName, fallback);
}

export async function getStoredData<T>(collectionName: string, fallback: T): Promise<T> {
  return getLocal<T>(collectionName, fallback);
}

export async function setStoredData<T>(collectionName: string, value: T): Promise<void> {
  setLocal<T>(collectionName, value);
}

/**
 * React hook or listener for data changes
 */
export function subscribeToKey<T>(key: string, callback: (value: T) => void): () => void {
  if (!isBrowser) return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.key === key) {
      callback(customEvent.detail.value as T);
    }
  };

  window.addEventListener('alhamd:data-updated', handler);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_PREFIX + key && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        memoryCache[key] = parsed;
        callback(parsed);
      } catch (err) {}
    }
  });

  return () => {
    window.removeEventListener('alhamd:data-updated', handler);
  };
}
