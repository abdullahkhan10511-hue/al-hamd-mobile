import { Product } from '@/types';
import { Order } from '@/types/admin';
import { seedProducts, seedOrders } from './seed';
import { getStoredCollection, persistCollection, getLocal, setLocal } from './storage';
import { logActivity } from './activity';
import { recordInventoryLog } from './inventory';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFlashSaleConfig, getHeroConfig } from './homepage';
import { getMediaItems } from './media';

const COLLECTION_KEY = 'products';
const DELETED_PRODUCT_IDS_KEY = 'deleted_product_ids';

export function getDeletedProductIds(): Set<string> {
  const ids = getLocal<string[]>(DELETED_PRODUCT_IDS_KEY, []);
  return new Set(Array.isArray(ids) ? ids : []);
}

export function hasProductOrderHistory(productId: string): boolean {
  try {
    const orders = getStoredCollection<Order>('orders', seedOrders);
    return orders.some((o) => o.items && o.items.some((item) => item.productId === productId));
  } catch {
    return false;
  }
}

const OBSOLETE_NON_MOBILE_IDS = new Set([
  'prod-5', // bottle
  'prod-6', // sunglasses
  'prod-7', // hoodie 2
  'prod-9', // ceramic vase
  'prod-10', // serum
  'prod-11', // yoga mat
  'prod-12', // cardholder
  'prod-13', // phone handset
  'prod-14', // phone handset
]);

export function getProducts(): (Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean })[] {
  let list = getStoredCollection(COLLECTION_KEY, seedProducts);
  let modified = false;
  const deletedIds = getDeletedProductIds();

  // 1. Purge non-accessory items and permanently deleted IDs
  const filtered = list.filter((p) => !OBSOLETE_NON_MOBILE_IDS.has(p.id) && !deletedIds.has(p.id));
  if (filtered.length !== list.length) {
    list = filtered;
    modified = true;
  }

  // 2. Ensure historical products with existing order history are deactivated
  list = list.map((p) => {
    if (p.id === 'prod-1' || p.id === 'prod-2') {
      if ((p as any).isActive !== false || p.status !== 'inactive') {
        modified = true;
        return {
          ...p,
          isActive: false,
          status: 'inactive' as const,
          category: 'Other Mobile Accessories',
          categorySlug: 'other-mobile-accessories',
        };
      }
    }
    return p;
  });

  if (modified) {
    persistCollection(COLLECTION_KEY, list);
  }

  if (typeof window !== 'undefined' && !hasSyncedProductsFromApi) {
    hasSyncedProductsFromApi = true;
    syncProductsFromApi().catch(() => {});
  }

  return list;
}

let hasSyncedProductsFromApi = false;
export async function syncProductsFromApi(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/products', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        await persistCollection(COLLECTION_KEY, data.products);
        window.dispatchEvent(
          new CustomEvent('alhamd:data-updated', {
            detail: { key: COLLECTION_KEY, value: data.products },
          })
        );
      }
    }
  } catch {}
}

export function getProductById(id: string) {
  const products = getProducts();
  return products.find((p) => p.id === id);
}

export function getProductBySlug(slug: string) {
  const products = getProducts();
  return products.find((p) => p.slug === slug);
}

export async function createProduct(
  data: Partial<Product> & { sku?: string; lowStockThreshold?: number; trending?: boolean },
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; product?: Product; error?: string }> {
  const products = getProducts();

  // Validate unique SKU only if provided (including against all existing model SKUs)
  const cleanSku = (data.sku || '').trim().toUpperCase();
  if (cleanSku) {
    const existingSku = products.find(
      (p) =>
        (p.sku && p.sku.toLowerCase() === cleanSku.toLowerCase()) ||
        (Array.isArray(p.models) && p.models.some((m) => m.sku && m.sku.toLowerCase() === cleanSku.toLowerCase()))
    );
    if (existingSku) {
      return { success: false, error: `SKU "${cleanSku}" already exists. Each product and model SKU must be unique.` };
    }
  }

  // Validate model SKUs uniqueness within this product and globally
  if (data.models && Array.isArray(data.models)) {
    const seenModelSkus = new Set<string>();
    if (cleanSku) seenModelSkus.add(cleanSku.toLowerCase());

    for (const m of data.models) {
      const mSku = (m.sku || '').trim().toUpperCase();
      if (mSku) {
        const lower = mSku.toLowerCase();
        if (seenModelSkus.has(lower)) {
          return { success: false, error: `Model SKU "${mSku}" is duplicated within this product.` };
        }
        seenModelSkus.add(lower);
        const existing = products.find(
          (p) =>
            (p.sku && p.sku.toLowerCase() === lower) ||
            (Array.isArray(p.models) && p.models.some((pm) => pm.sku && pm.sku.toLowerCase() === lower))
        );
        if (existing) {
          return { success: false, error: `Model SKU "${mSku}" already exists in the catalog.` };
        }
      }
    }
  }

  // Generate or validate unique slug
  let baseSlug = (data.slug || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!baseSlug && data.name && data.name.trim()) {
    baseSlug = data.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (!baseSlug) {
    baseSlug = `product-${Date.now()}`;
  } else {
    const existingSlug = products.find((p) => p.slug && p.slug.toLowerCase() === baseSlug);
    if (existingSlug) {
      baseSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }
  }

  // Calculate default price and stock if model selection is ON
  let finalPrice = data.price !== undefined && data.price !== null ? Number(data.price) : 0;
  let finalStock = data.stock !== undefined && data.stock !== null ? Number(data.stock) : 0;
  if (data.enableModelSelection && Array.isArray(data.models) && data.models.length > 0) {
    const activeModels = data.models.filter((m) => m.isActive !== false);
    if (activeModels.length > 0 && (!finalPrice || finalPrice <= 0)) {
      finalPrice = activeModels[0].price;
    }
    const totalModelStock = activeModels.reduce((acc, m) => acc + (m.stock ?? 0), 0);
    if (totalModelStock > 0 && (!finalStock || finalStock <= 0)) {
      finalStock = totalModelStock;
    }
  }

  const newProduct = {
    ...data,
    id: `prod-${Date.now()}`,
    name: data.name || '',
    slug: baseSlug,
    sku: cleanSku,
    brand: data.brand || '',
    category: data.category || '',
    price: finalPrice,
    compareAtPrice: data.compareAtPrice !== undefined && data.compareAtPrice !== null ? Number(data.compareAtPrice) : undefined,
    wholesalePrice:
      data.wholesalePrice !== undefined &&
      data.wholesalePrice !== null &&
      !isNaN(Number(data.wholesalePrice)) &&
      Number(data.wholesalePrice) > 0
        ? Number(data.wholesalePrice)
        : undefined,
    superWholesalePrice:
      data.superWholesalePrice !== undefined &&
      data.superWholesalePrice !== null &&
      !isNaN(Number(data.superWholesalePrice)) &&
      Number(data.superWholesalePrice) > 0
        ? Number(data.superWholesalePrice)
        : undefined,
    stock: finalStock,
    lowStockThreshold: data.lowStockThreshold !== undefined && data.lowStockThreshold !== null ? Number(data.lowStockThreshold) : 0,
    description: data.description || '',
    longDescription: data.longDescription || '',
    images: data.images || [],
    videos: data.videos || [],
    media: data.media || [],
    enableModelSelection: Boolean(data.enableModelSelection),
    models: Array.isArray(data.models) ? data.models : [],
    enableColorSelection: Boolean(data.enableColorSelection),
    colors: Array.isArray(data.colors) ? data.colors : [],
    variants: data.variants || {
      colors: Array.isArray(data.colors)
        ? data.colors.filter((c) => c.isActive !== false).map((c) => ({ name: c.name, hex: c.hex || '#000000' }))
        : undefined,
    },
    trending: !!data.trending,
    reviews: data.reviews || [],
    rating: (data as any).rating || 5.0,
    reviewCount: (data as any).reviewCount || 0,
    status: data.status || 'active',
  } as Product & { sku: string; lowStockThreshold: number; trending?: boolean };

  const updated = [newProduct, ...products];
  await persistCollection(COLLECTION_KEY, updated);

  if (typeof window !== 'undefined') {
    fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct),
    }).catch(() => {});
  }

  // Direct Firestore doc sync
  if (db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'products', newProduct.id);
      await setDoc(docRef, newProduct, { merge: true });
    } catch (err) {
      console.warn('Firestore create product notice:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: updated },
      })
    );
  }

  await logActivity({
    adminEmail,
    action: 'Created Product',
    target: newProduct.name || 'Untitled Product',
    details: `SKU: ${newProduct.sku || 'N/A'}, Price: Rs. ${newProduct.price}, Stock: ${newProduct.stock}`,
  });

  return { success: true, product: newProduct };
}

export async function updateProduct(
  id: string,
  updates: Partial<Product & { sku?: string; lowStockThreshold?: number; trending?: boolean }>,
  adminEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  const products = getProducts();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) {
    return { success: false, error: 'Product not found.' };
  }

  const current = products[index];

  // If SKU is changing and provided, validate uniqueness (against all products and model SKUs)
  if (updates.sku && updates.sku.trim() && updates.sku.toLowerCase() !== (current.sku || '').toLowerCase()) {
    const cleanUpdateSku = updates.sku.trim().toLowerCase();
    const existingSku = products.find(
      (p) =>
        p.id !== id &&
        ((p.sku && p.sku.toLowerCase() === cleanUpdateSku) ||
          (Array.isArray(p.models) && p.models.some((m) => m.sku && m.sku.toLowerCase() === cleanUpdateSku)))
    );
    if (existingSku) {
      return { success: false, error: `SKU "${updates.sku}" already exists on another product or model.` };
    }
  }

  // Validate model SKUs uniqueness on update
  if (updates.models && Array.isArray(updates.models)) {
    const seenModelSkus = new Set<string>();
    const parentSku = (updates.sku || current.sku || '').trim().toLowerCase();
    if (parentSku) seenModelSkus.add(parentSku);

    for (const m of updates.models) {
      const mSku = (m.sku || '').trim().toUpperCase();
      if (mSku) {
        const lower = mSku.toLowerCase();
        if (seenModelSkus.has(lower)) {
          return { success: false, error: `Model SKU "${mSku}" is duplicated within this product.` };
        }
        seenModelSkus.add(lower);
        const existing = products.find(
          (p) =>
            p.id !== id &&
            ((p.sku && p.sku.toLowerCase() === lower) ||
              (Array.isArray(p.models) && p.models.some((pm) => pm.sku && pm.sku.toLowerCase() === lower)))
        );
        if (existing) {
          return { success: false, error: `Model SKU "${mSku}" already exists on another product or model.` };
        }
      }
    }
  }

  // Track stock change if applicable
  if (updates.stock !== undefined && updates.stock !== current.stock) {
    const diff = updates.stock - current.stock;
    await recordInventoryLog({
      productId: current.id,
      productName: current.name,
      sku: updates.sku || current.sku,
      previousStock: current.stock,
      changeAmount: diff,
      newStock: updates.stock,
      reason: 'Manual edit in product form',
      adminEmail,
    });
  }

  const updatedProduct = {
    ...current,
    ...updates,
    enableModelSelection:
      updates.enableModelSelection !== undefined
        ? Boolean(updates.enableModelSelection)
        : current.enableModelSelection,
    models: updates.models !== undefined ? updates.models : current.models,
    enableColorSelection:
      updates.enableColorSelection !== undefined
        ? Boolean(updates.enableColorSelection)
        : current.enableColorSelection,
    colors: updates.colors !== undefined ? updates.colors : current.colors,
  };

  // Keep legacy variants in sync if colors updated
  if (updates.colors && Array.isArray(updates.colors)) {
    updatedProduct.variants = {
      ...updatedProduct.variants,
      colors: updates.colors
        .filter((c) => c.isActive !== false)
        .map((c) => ({ name: c.name, hex: c.hex || '#000000' })),
    };
  }

  products[index] = updatedProduct;
  await persistCollection(COLLECTION_KEY, products);

  if (typeof window !== 'undefined') {
    fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});
  }

  // Direct Firestore doc sync
  if (db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'products', id);
      await setDoc(docRef, updatedProduct, { merge: true });
    } catch (err) {
      console.warn('Firestore update product notice:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: products },
      })
    );
  }

  await logActivity({
    adminEmail,
    action: 'Updated Product',
    target: updatedProduct.name,
    details: `Updated fields: ${Object.keys(updates).join(', ')}`,
  });

  return { success: true };
}

export interface DeleteProductResponse {
  success: boolean;
  action: 'deleted' | 'not_found';
  message: string;
  error?: string;
}

export async function deleteProduct(
  id: string,
  adminEmail = 'admin@alhamd.com'
): Promise<DeleteProductResponse> {
  const products = getProducts();
  const target = products.find((p) => p.id === id);
  if (!target) {
    return { success: false, action: 'not_found', message: 'Product not found.' };
  }

  // 1. Permanently remove from product database collection
  const filtered = products.filter((p) => p.id !== id);
  await persistCollection(COLLECTION_KEY, filtered);

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('API error deleting product:', err);
    }
  }

  // 2. Blacklist deleted ID so getProducts() seed rehydration never resurrects it
  const deletedIds = getLocal<string[]>(DELETED_PRODUCT_IDS_KEY, []);
  if (!deletedIds.includes(id)) {
    setLocal(DELETED_PRODUCT_IDS_KEY, [...deletedIds, id]);
  }

  // 3. Clean up active promotions / homepage flash sale references
  try {
    const flashConfig = getFlashSaleConfig();
    if (flashConfig.productIds && flashConfig.productIds.includes(id)) {
      setLocal('homepage_flash_sale', {
        ...flashConfig,
        productIds: flashConfig.productIds.filter((pId) => pId !== id),
      });
    }
  } catch {}

  // 4. Clean up homepage hero floating product cards
  try {
    const heroConfig = getHeroConfig();
    if (heroConfig.floatingProducts && heroConfig.floatingProducts.some((fp) => fp.productId === id)) {
      setLocal('homepage_hero', {
        ...heroConfig,
        floatingProducts: heroConfig.floatingProducts.filter((fp) => fp.productId !== id),
      });
    }
  } catch {}

  // 5. Clean up active cart & wishlist from browser storage
  if (typeof window !== 'undefined') {
    try {
      const savedCart = localStorage.getItem('al_hamd_cart');
      if (savedCart) {
        const cart = JSON.parse(savedCart);
        if (Array.isArray(cart)) {
          const cleanedCart = cart.filter((item: any) => item.id !== id && item.productId !== id);
          localStorage.setItem('al_hamd_cart', JSON.stringify(cleanedCart));
        }
      }
    } catch {}

    try {
      const savedWish = localStorage.getItem('al_hamd_wishlist');
      if (savedWish) {
        const wish = JSON.parse(savedWish);
        if (Array.isArray(wish)) {
          const cleanedWish = wish.filter((wId: string) => wId !== id);
          localStorage.setItem('al_hamd_wishlist', JSON.stringify(cleanedWish));
        }
      }
    } catch {}
  }

  // 6. Clean up media library references if images are not shared by other products
  try {
    const usedImages = new Set<string>();
    filtered.forEach((p) => {
      if (p.images) p.images.forEach((img) => usedImages.add(img));
    });

    if (target.images && target.images.length > 0) {
      const currentMedia = getMediaItems();
      const toRemoveMediaIds: string[] = [];

      target.images.forEach((imgUrl) => {
        if (!usedImages.has(imgUrl)) {
          const media = currentMedia.find((m) => m.url === imgUrl);
          if (
            media &&
            !media.id.startsWith('med-1') &&
            !media.id.startsWith('med-2') &&
            !media.id.startsWith('med-3') &&
            !media.id.startsWith('med-4')
          ) {
            toRemoveMediaIds.push(media.id);
          }
        }
      });

      if (toRemoveMediaIds.length > 0) {
        const filteredMedia = currentMedia.filter((m) => !toRemoveMediaIds.includes(m.id));
        persistCollection('media_library', filteredMedia);
      }
    }
  } catch {}

  // 7. Delete Firestore document directly only if real credentials exist
  const hasRealFirebase =
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key-placeholder';

  if (hasRealFirebase && db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'products', id);
      await Promise.race([
        deleteDoc(docRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500)),
      ]);
    } catch (err) {
      console.warn('Firestore product deletion notice:', err);
    }
  }

  // 8. Dispatch real-time update event so all listeners update immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: filtered },
      })
    );
  }

  // 9. Audit log entry
  await logActivity({
    adminEmail,
    action: 'Deleted Product',
    target: target.name,
    details: `SKU: ${target.sku || 'N/A'} (Permanent database deletion)`,
  });

  return {
    success: true,
    action: 'deleted',
    message: 'Product deleted successfully.',
  };
}

export async function adjustStock(
  productId: string,
  quantityChange: number,
  reason: string,
  adminEmail = 'admin@alhamd.com',
  modelName?: string
): Promise<boolean> {
  const products = getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return false;

  let modelAdjusted = false;
  let modelSku = product.sku;
  let loggedName = product.name;
  let previousStock = product.stock;
  let newModelStock = 0;

  if (modelName && product.models && Array.isArray(product.models)) {
    const model = product.models.find(
      (m) => m.name.toLowerCase() === modelName.toLowerCase() || m.id === modelName
    );
    if (model) {
      const prevModelStock = model.stock !== undefined ? model.stock : product.stock;
      model.stock = Math.max(0, prevModelStock + quantityChange);
      newModelStock = model.stock;
      modelAdjusted = true;
      modelSku = model.sku || product.sku;
      loggedName = `${product.name} (${model.name})`;
      previousStock = prevModelStock;

      // Also sync total parent product stock
      const totalModelStock = product.models.reduce((sum, m) => sum + (m.stock ?? 0), 0);
      product.stock = totalModelStock;
    }
  }

  if (!modelAdjusted) {
    const prevStock = product.stock;
    product.stock = Math.max(0, prevStock + quantityChange);
  }

  await persistCollection(COLLECTION_KEY, products);

  if (typeof window !== 'undefined') {
    fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: product.stock, models: product.models }),
    }).catch(() => {});
  }

  // Direct Firestore doc sync
  if (db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'products', productId);
      await setDoc(docRef, { stock: product.stock, models: product.models }, { merge: true });
    } catch (err) {
      console.warn('Firestore stock sync notice:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: products },
      })
    );
  }

  await recordInventoryLog({
    productId: product.id,
    productName: loggedName,
    sku: modelSku,
    previousStock,
    changeAmount: quantityChange,
    newStock: modelAdjusted ? newModelStock : product.stock,
    reason,
    adminEmail,
  });

  await logActivity({
    adminEmail,
    action: 'Adjusted Stock',
    target: loggedName,
    details: `${quantityChange >= 0 ? '+' : ''}${quantityChange} units (${reason}). New stock: ${modelAdjusted ? newModelStock : product.stock}`,
  });

  return true;
}

export async function setModelStock(
  productId: string,
  modelIdOrName: string,
  newStock: number,
  reason = 'Manual adjustment in Stock Management',
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const products = getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product || !product.models || !Array.isArray(product.models)) return false;

  const model = product.models.find(
    (m) => m.id === modelIdOrName || m.name.toLowerCase() === modelIdOrName.toLowerCase()
  );
  if (!model) return false;

  const previousStock = model.stock ?? 0;
  const safeStock = Math.max(0, Math.round(newStock));
  const quantityChange = safeStock - previousStock;
  model.stock = safeStock;

  // Recalculate parent product stock
  const totalModelStock = product.models.reduce((sum, m) => sum + (m.stock ?? 0), 0);
  product.stock = totalModelStock;

  await persistCollection(COLLECTION_KEY, products);

  if (db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'products', productId);
      await setDoc(docRef, { stock: product.stock, models: product.models }, { merge: true });
    } catch (err) {
      console.warn('Firestore model stock sync notice:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: products },
      })
    );
  }

  await recordInventoryLog({
    productId: product.id,
    productName: `${product.name} (${model.name})`,
    sku: model.sku || product.sku,
    previousStock,
    changeAmount: quantityChange,
    newStock: safeStock,
    reason,
    adminEmail,
  });

  await logActivity({
    adminEmail,
    action: 'Adjusted Model Stock',
    target: `${product.name} - ${model.name}`,
    details: `Stock updated to ${safeStock} (previous: ${previousStock}). Reason: ${reason}`,
  });

  return true;
}

export async function setProductStock(
  productId: string,
  newStock: number,
  reason = 'Manual adjustment in Stock Management',
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const products = getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return false;

  const previousStock = product.stock;
  const safeStock = Math.max(0, Math.round(newStock));
  const quantityChange = safeStock - previousStock;
  product.stock = safeStock;

  await persistCollection(COLLECTION_KEY, products);

  // Direct Firestore doc sync
  if (db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'products', productId);
      await setDoc(docRef, { stock: safeStock }, { merge: true });
    } catch (err) {
      console.warn('Firestore stock sync notice:', err);
    }
  }

  if (typeof window !== 'undefined') {
    fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: safeStock }),
    }).catch(() => {});
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: products },
      })
    );
  }

  await recordInventoryLog({
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    previousStock,
    changeAmount: quantityChange,
    newStock: safeStock,
    reason,
    adminEmail,
  });

  await logActivity({
    adminEmail,
    action: 'Adjusted Stock',
    target: product.name,
    details: `Stock updated to ${safeStock} (previous: ${previousStock}). Reason: ${reason}`,
  });

  return true;
}

export function getWarningThreshold(product?: { lowStockThreshold?: number | null }): number {
  if (!product || product.lowStockThreshold === undefined || product.lowStockThreshold === null) {
    return 10;
  }
  return Math.max(0, Math.round(Number(product.lowStockThreshold)));
}

export async function setProductLowStockThreshold(
  productId: string,
  newThreshold: number,
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const products = getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return false;

  const previousThreshold = getWarningThreshold(product);
  const safeThreshold = Math.max(0, Math.round(Number(newThreshold) || 0));
  product.lowStockThreshold = safeThreshold;

  await persistCollection(COLLECTION_KEY, products);

  // Direct Firestore doc sync
  if (db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'products', productId);
      await setDoc(docRef, { lowStockThreshold: safeThreshold }, { merge: true });
    } catch (err) {
      console.warn('Firestore lowStockThreshold sync notice:', err);
    }
  }

  if (typeof window !== 'undefined') {
    fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lowStockThreshold: safeThreshold }),
    }).catch(() => {});
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: products },
      })
    );
  }

  await logActivity({
    adminEmail,
    action: 'Updated Stock Warning',
    target: product.name,
    details: `Stock warning threshold set to ${safeThreshold} (previous: ${previousThreshold})`,
  });

  return true;
}

export function getLowStockProducts() {
  const products = getProducts();
  return products.filter((p) => p.stock > 0 && p.stock <= getWarningThreshold(p));
}

export function getOutOfStockProducts() {
  const products = getProducts();
  return products.filter((p) => p.stock <= 0);
}
