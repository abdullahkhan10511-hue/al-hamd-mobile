import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';

const STORAGE_PREFIX = 'alhamd_store_';

// Check if window and localStorage are available
const isBrowser = typeof window !== 'undefined';

// Unified in-memory cache for SSR & client synchronization
const memoryCache: Record<string, any> = {};

export function getLocal<T>(key: string, fallback: T): T {
  if (memoryCache[key] !== undefined) {
    return memoryCache[key] as T;
  }
  if (!isBrowser) return fallback;

  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (item !== null) {
      const parsed = JSON.parse(item);
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
