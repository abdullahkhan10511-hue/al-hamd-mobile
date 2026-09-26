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

  // 3. Ensure all mobile accessories from seedProducts exist in list ONLY if not explicitly deleted
  const existingIds = new Set(list.map((p) => p.id));
  const missingSeeds = seedProducts.filter(
    (sp) => !existingIds.has(sp.id) && !OBSOLETE_NON_MOBILE_IDS.has(sp.id) && !deletedIds.has(sp.id)
  );
  if (missingSeeds.length > 0) {
    list = [...list, ...missingSeeds];
    modified = true;
  }

  // 4. Update existing products with fresh mobile accessory metadata
  if (list && list.length > 0) {
    list = list.map((p) => {
      const seedMatch = seedProducts.find((sp) => sp.id === p.id);
      if (seedMatch && p.id !== 'prod-1' && p.id !== 'prod-2') {
        let changed = false;
        let pCat = p.category;
        let pCatSlug = p.categorySlug;
        let pImages = p.images;
        let pIsActive = (p as any).isActive;

        if (pCat !== seedMatch.category || pCatSlug !== seedMatch.categorySlug) {
          pCat = seedMatch.category;
          pCatSlug = seedMatch.categorySlug;
          changed = true;
        }

        if (pIsActive === undefined) {
          pIsActive = true;
          changed = true;
        }

        // Migrate any leftover fashion or broken/warehouse images
        if (
          pImages &&
          (pImages[0]?.includes('photo-1483985988355-763728e1935b') ||
            pImages.some(
              (img) =>
                img.includes('photo-1609592426867') ||
                img.includes('photo-1622445262464') ||
                img.includes('photo-1616401784845')
            ))
        ) {
          pImages = seedMatch.images;
          changed = true;
        }

        if (changed) {
          modified = true;
          return {
            ...p,
            category: pCat,
            categorySlug: pCatSlug,
            images: pImages,
            isActive: pIsActive,
            tags: p.tags || seedMatch.tags,
            isNewArrival: p.isNewArrival ?? seedMatch.isNewArrival,
            isBestSeller: p.isBestSeller ?? seedMatch.isBestSeller,
          };
        }
      }
      return p;
    });
  }

  if (modified) {
    persistCollection(COLLECTION_KEY, list);
  }

  return list;
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

  // Validate unique SKU only if provided
  const cleanSku = (data.sku || '').trim().toUpperCase();
  if (cleanSku) {
    const existingSku = products.find(
      (p) => p.sku && p.sku.toLowerCase() === cleanSku.toLowerCase()
    );
    if (existingSku) {
      return { success: false, error: `SKU "${cleanSku}" already exists. Each product SKU must be unique.` };
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

  const newProduct = {
    ...data,
    id: `prod-${Date.now()}`,
    name: data.name || '',
    slug: baseSlug,
    sku: cleanSku,
    brand: data.brand || '',
    category: data.category || '',
    price: data.price !== undefined && data.price !== null ? Number(data.price) : 0,
    compareAtPrice: data.compareAtPrice !== undefined && data.compareAtPrice !== null ? Number(data.compareAtPrice) : undefined,
    wholesalePrice:
      data.wholesalePrice !== undefined &&
      data.wholesalePrice !== null &&
      !isNaN(Number(data.wholesalePrice)) &&
      Number(data.wholesalePrice) > 0
        ? Number(data.wholesalePrice)
        : undefined,
    stock: data.stock !== undefined && data.stock !== null ? Number(data.stock) : 0,
    lowStockThreshold: data.lowStockThreshold !== undefined && data.lowStockThreshold !== null ? Number(data.lowStockThreshold) : 0,
    description: data.description || '',
    longDescription: data.longDescription || '',
    images: data.images || [],
    videos: data.videos || [],
    media: data.media || [],
    trending: !!data.trending,
    reviews: data.reviews || [],
    rating: (data as any).rating || 5.0,
    reviewCount: (data as any).reviewCount || 0,
    status: data.status || 'active',
  } as Product & { sku: string; lowStockThreshold: number; trending?: boolean };

  const updated = [newProduct, ...products];
  await persistCollection(COLLECTION_KEY, updated);

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

  // If SKU is changing and provided, validate uniqueness
  if (updates.sku && updates.sku.trim() && updates.sku.toLowerCase() !== (current.sku || '').toLowerCase()) {
    const existingSku = products.find((p) => p.id !== id && p.sku && p.sku.toLowerCase() === updates.sku!.toLowerCase());
    if (existingSku) {
      return { success: false, error: `SKU "${updates.sku}" already exists on another product.` };
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
  };

  products[index] = updatedProduct;
  await persistCollection(COLLECTION_KEY, products);

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
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const products = getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return false;

  const previousStock = product.stock;
  const newStock = Math.max(0, previousStock + quantityChange);
  product.stock = newStock;

  await persistCollection(COLLECTION_KEY, products);

  // Direct Firestore doc sync
  if (db && typeof (db as any).type === 'string') {
    try {
      const docRef = doc(db, 'products', productId);
      await setDoc(docRef, { stock: newStock }, { merge: true });
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
    productName: product.name,
    sku: product.sku,
    previousStock,
    changeAmount: quantityChange,
    newStock,
    reason,
    adminEmail,
  });

  await logActivity({
    adminEmail,
    action: 'Adjusted Stock',
    target: product.name,
    details: `${quantityChange >= 0 ? '+' : ''}${quantityChange} units (${reason}). New stock: ${newStock}`,
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
