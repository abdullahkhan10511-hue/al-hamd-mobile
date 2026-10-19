import { Deal, DealProductItem } from '@/types/admin';
import { getStoredCollection, persistCollection, getLocal, setLocal } from './storage';
import { logActivity } from './activity';
import { getAdminAuthHeaders } from './staff';

export const DEALS_STORAGE_KEY = 'store_deals';
const DELETED_DEALS_KEY = 'deleted_deal_ids';

export function getDeletedDealIds(): Set<string> {
  const ids = getLocal<string[]>(DELETED_DEALS_KEY, []);
  return new Set(Array.isArray(ids) ? ids : []);
}

export function getDeals(): Deal[] {
  const deletedIds = getDeletedDealIds();
  let data = getStoredCollection<Deal>(DEALS_STORAGE_KEY, []);
  if (typeof window === 'undefined' && data.length === 0) {
    try {
      const { getDevDeals } = require('./serverDevStorage');
      const devDeals = getDevDeals();
      if (Array.isArray(devDeals) && devDeals.length > 0) {
        data = devDeals;
      }
    } catch {}
  }
  const filtered = data.filter((d) => d && !deletedIds.has(d.id));
  return filtered.sort((a: Deal, b: Deal) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export async function getDealById(id: string): Promise<Deal | null> {
  const deals = getDeals();
  return deals.find((d) => d.id === id) || null;
}

export function getDealBySlug(slug: string): Deal | null {
  const deals = getDeals();
  const cleanSlug = decodeURIComponent(slug).toLowerCase().trim();
  return deals.find((d) => d && (d.slug?.toLowerCase().trim() === cleanSlug || d.id === slug)) || null;
}

export async function saveDeal(
  dealData: Partial<Deal> & { name: string },
  adminEmail: string = 'admin@alhamd.com'
): Promise<Deal> {
  const deals = getDeals();
  const id = dealData.id || `deal-${Date.now()}`;
  const existingIndex = deals.findIndex((d) => d.id === id);

  const deletedIds = getDeletedDealIds();
  if (deletedIds.has(id)) {
    deletedIds.delete(id);
    setLocal(DELETED_DEALS_KEY, Array.from(deletedIds));
  }

  const slug =
    dealData.slug ||
    `${dealData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}-${Date.now().toString(36)}`;

  const cleanProducts: DealProductItem[] = Array.isArray(dealData.products)
    ? dealData.products.map((p, idx) => ({
        id: p.id || `dp-${Date.now()}-${idx}`,
        dealId: id,
        productId: p.productId,
        modelId: p.modelId,
        productName: p.productName,
        modelName: p.modelName,
        sku: p.sku,
        image: p.image,
        category: p.category,
        brand: p.brand,
        price: Number(p.price || 0),
        shopStock: Number(p.shopStock || 0),
        sortOrder: p.sortOrder !== undefined ? p.sortOrder : idx + 1,
      }))
    : [];

  const newDeal: Deal = {
    id,
    name: dealData.name.trim(),
    slug,
    description: dealData.description || '',
    image: dealData.image || '',
    dealPrice: dealData.dealPrice !== undefined ? Number(dealData.dealPrice) : undefined,
    originalPrice: dealData.originalPrice !== undefined ? Number(dealData.originalPrice) : undefined,
    discountAmount: dealData.discountAmount !== undefined ? Number(dealData.discountAmount) : undefined,
    discountPercentage: dealData.discountPercentage !== undefined ? Number(dealData.discountPercentage) : undefined,
    startDate: dealData.startDate || '',
    endDate: dealData.endDate || '',
    status: dealData.status || 'active',
    showOnHomepage: dealData.showOnHomepage !== undefined ? Boolean(dealData.showOnHomepage) : true,
    displayOrder: dealData.displayOrder !== undefined ? Number(dealData.displayOrder) : deals.length + 1,
    products: cleanProducts,
    createdAt: dealData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let finalDeal = newDeal;
  if (typeof window !== 'undefined') {
    const authHeaders = {
      ...getAdminAuthHeaders(adminEmail),
      'Content-Type': 'application/json',
    };
    const endpoint = existingIndex >= 0 ? `/api/admin/deals/${encodeURIComponent(id)}` : '/api/admin/deals';
    const method = existingIndex >= 0 ? 'PUT' : 'POST';
    const res = await fetch(endpoint, {
      method,
      headers: authHeaders,
      body: JSON.stringify(newDeal),
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok || !resData.success) {
      throw new Error(resData.error || 'Failed to save deal to database.');
    }
    if (resData.deal) {
      finalDeal = resData.deal;
    }
  }

  let updatedList: Deal[];
  if (existingIndex >= 0) {
    updatedList = [...deals];
    updatedList[existingIndex] = finalDeal;
    await logActivity({
      adminEmail,
      action: 'UPDATE_DEAL',
      target: finalDeal.name,
      details: `Updated promotional deal "${finalDeal.name}" (${finalDeal.products.length} products)`,
    });
  } else {
    updatedList = [...deals, finalDeal];
    await logActivity({
      adminEmail,
      action: 'CREATE_DEAL',
      target: finalDeal.name,
      details: `Created new promotional deal "${finalDeal.name}" with ${finalDeal.products.length} products`,
    });
  }

  await persistCollection(DEALS_STORAGE_KEY, updatedList);

  if (typeof window === 'undefined') {
    try {
      const { insertDevDeal, updateDevDeal } = require('./serverDevStorage');
      if (existingIndex >= 0) {
        await updateDevDeal(id, finalDeal, adminEmail);
      } else {
        await insertDevDeal(finalDeal, adminEmail);
      }
    } catch {}
  }

  return finalDeal;
}

export async function deleteDeal(id: string, adminEmail: string = 'admin@alhamd.com'): Promise<boolean> {
  const deals = getDeals();
  const target = deals.find((d) => d.id === id);
  if (!target) return false;

  if (typeof window !== 'undefined') {
    const authHeaders = {
      ...getAdminAuthHeaders(adminEmail),
      'Content-Type': 'application/json',
    };
    const res = await fetch(`/api/admin/deals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok || !resData.success) {
      throw new Error(resData.error || 'Failed to delete deal from database.');
    }
  }

  const deletedIds = getDeletedDealIds();
  deletedIds.add(id);
  setLocal(DELETED_DEALS_KEY, Array.from(deletedIds));

  const filtered = deals.filter((d) => d.id !== id);
  await persistCollection(DEALS_STORAGE_KEY, filtered);

  if (typeof window === 'undefined') {
    try {
      const { deleteDevDeal } = require('./serverDevStorage');
      await deleteDevDeal(id, adminEmail);
    } catch {}
  }

  await logActivity({
    adminEmail,
    action: 'DELETE_DEAL',
    target: target.name,
    details: `Permanently removed promotional deal "${target.name}"`,
  });

  return true;
}

export async function toggleDealStatus(id: string, adminEmail: string = 'admin@alhamd.com'): Promise<Deal | null> {
  const deal = await getDealById(id);
  if (!deal) return null;

  const updated: Deal = {
    ...deal,
    status: deal.status === 'active' ? 'inactive' : 'active',
  };

  return saveDeal(updated, adminEmail);
}

export function toDateTimeLocalString(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseDateTimeInputToIso(localStr?: string): string | undefined {
  if (!localStr || !localStr.trim()) return undefined;
  const date = new Date(localStr);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

let inFlightDealsPromise: Promise<Deal[]> | null = null;

export async function syncDealsFromApi(): Promise<Deal[]> {
  if (typeof window === 'undefined') return getDeals();
  if (inFlightDealsPromise) return inFlightDealsPromise;

  inFlightDealsPromise = (async () => {
    try {
      const res = await fetch(`/api/deals?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.deals)) {
          await persistCollection(DEALS_STORAGE_KEY, data.deals, true);
          return data.deals;
        }
      }
    } catch (err) {
      console.warn('Could not sync deals from API:', err);
    } finally {
      inFlightDealsPromise = null;
    }
    return getDeals();
  })();

  return inFlightDealsPromise;
}

export function isDealExpired(deal: Deal): boolean {
  if (!deal || deal.status !== 'active') return true;
  if (!deal.endDate) return false;
  const end = new Date(deal.endDate).getTime();
  return !isNaN(end) && end <= Date.now();
}

export function isDealUpcoming(deal: Deal): boolean {
  if (!deal || deal.status !== 'active') return false;
  if (!deal.startDate) return false;
  const start = new Date(deal.startDate).getTime();
  return !isNaN(start) && start > Date.now();
}

export function isDealCurrentlyActive(deal: Deal): boolean {
  if (!deal || deal.status !== 'active') return false;
  if (isDealExpired(deal)) return false;
  if (isDealUpcoming(deal)) return false;
  return true;
}

export function getPublicDeals(): Deal[] {
  return getDeals().filter((d) => d && isDealCurrentlyActive(d));
}
