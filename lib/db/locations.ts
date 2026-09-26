import { ShopLocation } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';
import { logActivity } from './activity';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

const COLLECTION_KEY = 'shopLocations';

/**
 * Strictly validates that a string is a valid, safe Google Maps link.
 * Rejects javascript:, data:, and non-Google Maps URLs.
 */
export function isValidGoogleMapsUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Valid Google Maps hosts and patterns:
    // 1. maps.app.goo.gl (Standard mobile share links)
    if (host === 'maps.app.goo.gl') {
      return true;
    }

    // 2. goo.gl/maps/...
    if (host === 'goo.gl' && pathname.startsWith('/maps')) {
      return true;
    }

    // 3. maps.google.com / maps.google.com.pk / etc.
    if (host.startsWith('maps.google.')) {
      return true;
    }

    // 4. google.com/maps / www.google.com/maps / google.com.pk/maps
    if (/(^|\.)google\.[a-z.]+$/.test(host) && (pathname.startsWith('/maps') || parsed.searchParams.has('q'))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Retrieve all shop locations from local storage / cache.
 */
export function getShopLocations(): ShopLocation[] {
  const list = getStoredCollection<ShopLocation>(COLLECTION_KEY, []);
  return list.sort((a, b) => (a.displayOrder || 1) - (b.displayOrder || 1));
}

/**
 * Retrieve the active primary shop location.
 */
export function getActiveShopLocation(): ShopLocation | null {
  const locations = getShopLocations();
  return locations.find((l) => l.isActive) || null;
}

/**
 * Retrieve a shop location by ID.
 */
export function getShopLocationById(id: string): ShopLocation | null {
  const locations = getShopLocations();
  return locations.find((l) => l.id === id) || null;
}

/**
 * Save (create or update) a shop location.
 */
export async function saveShopLocation(
  data: {
    id?: string;
    shopName: string;
    googleMapsUrl: string;
    isActive?: boolean;
    displayOrder?: number;
  },
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; data?: ShopLocation; error?: string }> {
  try {
    const shopName = data.shopName?.trim();
    if (!shopName) {
      return { success: false, error: 'Please enter a shop name.' };
    }

    const googleMapsUrl = data.googleMapsUrl?.trim();
    if (!googleMapsUrl || !isValidGoogleMapsUrl(googleMapsUrl)) {
      return { success: false, error: 'Please enter a valid Google Maps location link.' };
    }

    const locations = getShopLocations();
    const isEdit = Boolean(data.id && locations.some((l) => l.id === data.id));
    const locationId = data.id || `loc-${Date.now()}`;
    const now = new Date().toISOString();

    const existing = locations.find((l) => l.id === locationId);

    const locationRecord: ShopLocation = {
      id: locationId,
      shopName,
      googleMapsUrl,
      isActive: data.isActive !== undefined ? data.isActive : true,
      displayOrder: data.displayOrder ?? (existing?.displayOrder || 1),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    let updatedList: ShopLocation[];
    if (isEdit) {
      updatedList = locations.map((l) => (l.id === locationId ? locationRecord : l));
    } else {
      updatedList = [...locations, locationRecord];
    }

    // Persist to local cache and system sync
    await persistCollection(COLLECTION_KEY, updatedList);

    // Direct Firestore document sync if Firestore is available
    if (db && typeof (db as any).type === 'string') {
      try {
        const docRef = doc(db, 'shopLocations', locationId);
        await setDoc(docRef, locationRecord, { merge: true });
      } catch (err) {
        console.warn('Firestore shopLocations direct sync notice:', err);
      }
    }

    // Broadcast update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: COLLECTION_KEY, value: updatedList },
        })
      );
    }

    await logActivity({
      adminEmail,
      action: isEdit ? 'Updated Shop Location' : 'Created Shop Location',
      target: shopName,
      details: `Google Maps URL: ${googleMapsUrl}, Status: ${locationRecord.isActive ? 'ACTIVE' : 'INACTIVE'}`,
    });

    return { success: true, data: locationRecord };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save shop location.' };
  }
}

/**
 * Permanently delete a shop location.
 */
export async function deleteShopLocation(
  id: string,
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  try {
    const locations = getShopLocations();
    const target = locations.find((l) => l.id === id);
    if (!target) {
      return { success: false, error: 'Shop location not found.' };
    }

    const filtered = locations.filter((l) => l.id !== id);
    await persistCollection(COLLECTION_KEY, filtered);

    // Direct Firestore document deletion if available and real credentials exist
    const hasRealFirebase =
      Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key-placeholder';

    if (hasRealFirebase && db && typeof (db as any).type === 'string') {
      try {
        const docRef = doc(db, 'shopLocations', id);
        await Promise.race([
          deleteDoc(docRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500)),
        ]);
      } catch (err) {
        console.warn('Firestore shopLocations direct deletion notice:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('alhamd:data-updated', {
          detail: { key: COLLECTION_KEY, value: filtered },
        })
      );
    }

    await logActivity({
      adminEmail,
      action: 'Deleted Shop Location',
      target: target.shopName,
      details: `Deleted location ID: ${id}`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete shop location.' };
  }
}

/**
 * Quickly toggle the active/inactive status of a shop location.
 */
export async function toggleShopLocationStatus(
  id: string,
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; data?: ShopLocation; error?: string }> {
  const target = getShopLocationById(id);
  if (!target) {
    return { success: false, error: 'Shop location not found.' };
  }

  const updatedStatus = !target.isActive;
  return saveShopLocation(
    {
      ...target,
      isActive: updatedStatus,
    },
    adminEmail
  );
}
