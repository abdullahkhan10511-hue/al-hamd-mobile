import fs from 'fs';
import path from 'path';
import { Product, Category, ProductMediaItem, ProductModelVariant } from '@/types';
import { Brand, ShopBill, ShopBillItem, Deal, DealProductItem } from '@/types/admin';
import { seedProducts, seedBrands } from './seed';
import { categories as initialCategories } from '@/data/categories';
import { ensureSafeMediaUrl, ensureSafeMediaUrls } from './serverMedia';
import { logActivity } from './activity';
import { deduplicateCategoriesById } from '@/lib/utils';
import { isDbConfigured } from './mysql';

/**
 * Strict Security Guard:
 * Ensures development JSON storage functions can NEVER execute in production,
 * and NEVER execute if MySQL is configured.
 */
function assertDevOnly(operationName: string) {
  if (process.env.NODE_ENV === 'production' || isDbConfigured()) {
    throw new Error(
      `CRITICAL SECURITY VIOLATION: Operation "${operationName}" in serverDevStorage.ts is strictly restricted to local offline development without database connection. Production environments must exclusively use MySQL repositories.`
    );
  }
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DEV_PRODUCTS_FILE = path.join(DATA_DIR, 'dev-products.json');
const DEV_CATEGORIES_FILE = path.join(DATA_DIR, 'dev-categories.json');
const DEV_BRANDS_FILE = path.join(DATA_DIR, 'dev-brands.json');
const DEV_DEALS_FILE = path.join(DATA_DIR, 'dev-deals.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    ensureDataDir();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed as T;
      }
    }
  } catch (err) {
    console.warn(`Error reading dev storage file ${filePath}:`, err);
  }
  // Initialize file with fallback only if missing or unreadable
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
  } catch (err) {
    console.warn(`Error initializing dev storage file ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing dev storage file ${filePath}:`, err);
  }
}

// ==========================================
// CATEGORIES DEV STORAGE
// ==========================================

export function getDevCategories(): Category[] {
  assertDevOnly('getDevCategories');
  const cats = readJsonFile<Category[]>(DEV_CATEGORIES_FILE, deduplicateCategoriesById(initialCategories));
  return deduplicateCategoriesById(cats);
}

export function getDevCategoryById(id: string): Category | null {
  assertDevOnly('getDevCategoryById');
  const cats = getDevCategories();
  return cats.find((c) => c.id === id || c.slug === id) || null;
}

export async function insertDevCategory(
  data: Partial<Category>,
  adminEmail = 'admin@alhamd.com'
): Promise<Category> {
  assertDevOnly('insertDevCategory');
  const cats = getDevCategories();
  const safeImage = await ensureSafeMediaUrl(data.image, 'categories');
  const cleanName = (data.name || '').trim();
  const cleanSlug = (data.slug || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();

  const newCat: Category = {
    id: data.id || `cat-${Date.now()}`,
    name: cleanName,
    slug: cleanSlug,
    description: (data.description || '').trim(),
    image: safeImage || 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=800&auto=format&fit=crop',
    status: data.status || 'active',
    productCount: data.productCount || 0,
    featured: Boolean(data.featured),
  };

  const updated = deduplicateCategoriesById([newCat, ...cats]);
  writeJsonFile(DEV_CATEGORIES_FILE, updated);

  await logActivity({
    adminEmail,
    action: 'Created Category (Local Dev)',
    target: newCat.name,
    details: `Slug: ${newCat.slug}`,
  }).catch(() => {});

  return newCat;
}

export async function updateDevCategory(
  id: string,
  updates: Partial<Category>,
  adminEmail = 'admin@alhamd.com'
): Promise<Category> {
  assertDevOnly('updateDevCategory');
  const cats = getDevCategories();
  const index = cats.findIndex((c) => c.id === id || c.slug === id);
  if (index === -1) {
    throw new Error(`Category with ID "${id}" not found.`);
  }

  const existing = cats[index];
  const safeImage = updates.image !== undefined ? await ensureSafeMediaUrl(updates.image, 'categories') : existing.image;

  const updatedCat: Category = {
    ...existing,
    ...updates,
    image: safeImage || existing.image,
  };

  cats[index] = updatedCat;
  writeJsonFile(DEV_CATEGORIES_FILE, cats);

  await logActivity({
    adminEmail,
    action: 'Updated Category (Local Dev)',
    target: updatedCat.name,
    details: `Fields: ${Object.keys(updates).join(', ')}`,
  }).catch(() => {});

  return updatedCat;
}

export async function deleteDevCategory(id: string, adminEmail = 'admin@alhamd.com'): Promise<boolean> {
  assertDevOnly('deleteDevCategory');
  const cats = getDevCategories();
  const filtered = cats.filter((c) => c.id !== id && c.slug !== id);
  if (filtered.length === cats.length) {
    return false;
  }
  writeJsonFile(DEV_CATEGORIES_FILE, filtered);

  await logActivity({
    adminEmail,
    action: 'Deleted Category (Local Dev)',
    target: id,
    details: `Category ID ${id} deleted`,
  }).catch(() => {});

  return true;
}

// ==========================================
// PRODUCTS DEV STORAGE
// ==========================================

export function getDevProducts(): (Product & { sku: string; lowStockThreshold: number; trending?: boolean; isActive?: boolean })[] {
  assertDevOnly('getDevProducts');
  return readJsonFile<any[]>(DEV_PRODUCTS_FILE, seedProducts);
}

export function getDevProductById(id: string): any | null {
  assertDevOnly('getDevProductById');
  const products = getDevProducts();
  return products.find((p) => p.id === id || p.slug === id) || null;
}

export async function insertDevProduct(
  data: any,
  adminEmail = 'admin@alhamd.com'
): Promise<any> {
  assertDevOnly('insertDevProduct');
  const products = getDevProducts();
  const id = data.id || `prod-${Date.now()}`;
  const cleanName = (data.name || '').trim();
  const cleanSlug = (data.slug || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();

  // Handle media safely
  const rawImages = Array.isArray(data.images) && data.images.length > 0
    ? data.images
    : Array.isArray(data.media)
    ? data.media.filter((m: any) => m && (m.type === 'image' || !m.type)).map((m: any) => typeof m === 'string' ? m : m.url)
    : [];

  const rawVideos = Array.isArray(data.videos) && data.videos.length > 0
    ? data.videos
    : Array.isArray(data.media)
    ? data.media.filter((m: any) => m && m.type === 'video').map((m: any) => typeof m === 'string' ? m : m.url)
    : [];

  const safeImages = await ensureSafeMediaUrls(rawImages, 'products');
  const safeVideos = await ensureSafeMediaUrls(rawVideos, 'products');

  const mediaItems: ProductMediaItem[] = [
    ...safeImages.map((u, i) => ({ id: `med-${id}-${i}`, url: u, type: 'image' as const })),
    ...safeVideos.map((u, i) => ({ id: `med-vid-${id}-${i}`, url: u, type: 'video' as const })),
  ];

  // Handle models safely
  const models: ProductModelVariant[] = [];
  if (Array.isArray(data.models)) {
    for (let i = 0; i < data.models.length; i++) {
      const m = data.models[i];
      const mImgs = await ensureSafeMediaUrls(Array.isArray(m.images) ? m.images : [], 'products');
      const mVids = await ensureSafeMediaUrls(Array.isArray(m.videos) ? m.videos : [], 'products');
      models.push({
        ...m,
        id: m.id || `mod-${id}-${i}`,
        name: (m.name || '').trim(),
        price: Number(m.price) || 0,
        stock: Number(m.stock) || 0,
        shopStock: Number(m.shopStock) || 0,
        sku: m.sku || undefined,
        isActive: m.isActive !== false,
        images: mImgs,
        videos: mVids,
      });
    }
  }

  const newProd = {
    ...data,
    id,
    name: cleanName,
    slug: cleanSlug,
    sku: (data.sku || `SKU-${Date.now()}`).trim().toUpperCase(),
    price: Number(data.price) || 0,
    compareAtPrice: data.compareAtPrice !== undefined ? Number(data.compareAtPrice) : undefined,
    wholesalePrice: data.wholesalePrice !== undefined ? Number(data.wholesalePrice) : undefined,
    superWholesalePrice: data.superWholesalePrice !== undefined ? Number(data.superWholesalePrice) : undefined,
    stock: Number(data.stock) || 0,
    shopStock: Number(data.shopStock) || 0,
    lowStockThreshold: Number(data.lowStockThreshold) || 5,
    images: safeImages,
    videos: safeVideos,
    media: mediaItems,
    models,
    status: data.status || 'active',
    isActive: data.isActive !== false,
  };

  const updated = [newProd, ...products];
  writeJsonFile(DEV_PRODUCTS_FILE, updated);

  await logActivity({
    adminEmail,
    action: 'Created Product (Local Dev)',
    target: newProd.name,
    details: `SKU: ${newProd.sku}, Price: Rs. ${newProd.price}`,
  }).catch(() => {});

  return newProd;
}

export async function updateDevProduct(
  id: string,
  updates: any,
  adminEmail = 'admin@alhamd.com'
): Promise<any> {
  assertDevOnly('updateDevProduct');
  const products = getDevProducts();
  const index = products.findIndex((p) => p.id === id || p.slug === id);
  if (index === -1) {
    throw new Error(`Product with ID "${id}" not found.`);
  }

  const existing = products[index];

  // Process media if provided
  let safeImages = existing.images || [];
  let safeVideos = existing.videos || [];
  if (updates.images !== undefined || updates.videos !== undefined || updates.media !== undefined) {
    const rawImages = updates.images !== undefined
      ? updates.images
      : Array.isArray(updates.media)
      ? updates.media.filter((m: any) => m && (m.type === 'image' || !m.type)).map((m: any) => typeof m === 'string' ? m : m.url)
      : existing.images || [];

    const rawVideos = updates.videos !== undefined
      ? updates.videos
      : Array.isArray(updates.media)
      ? updates.media.filter((m: any) => m && m.type === 'video').map((m: any) => typeof m === 'string' ? m : m.url)
      : existing.videos || [];

    safeImages = await ensureSafeMediaUrls(rawImages, 'products');
    safeVideos = await ensureSafeMediaUrls(rawVideos, 'products');
  }

  // Process models if provided
  let models = existing.models;
  if (updates.models !== undefined && Array.isArray(updates.models)) {
    models = [];
    for (let i = 0; i < updates.models.length; i++) {
      const m = updates.models[i];
      const mImgs = await ensureSafeMediaUrls(Array.isArray(m.images) ? m.images : [], 'products');
      const mVids = await ensureSafeMediaUrls(Array.isArray(m.videos) ? m.videos : [], 'products');
      models.push({
        ...m,
        id: m.id || `mod-${id}-${i}`,
        shopStock: m.shopStock !== undefined ? Number(m.shopStock) : (existing.models?.find((em: any) => em.id === m.id)?.shopStock ?? 0),
        images: mImgs,
        videos: mVids,
      });
    }
  }

  const updatedProd = {
    ...existing,
    ...updates,
    shopStock: updates.shopStock !== undefined ? Number(updates.shopStock) : (existing.shopStock ?? 0),
    isShopActive: updates.isShopActive !== undefined ? Boolean(updates.isShopActive) : (existing.isShopActive !== undefined ? existing.isShopActive : true),
    shopLowStockThreshold: updates.shopLowStockThreshold !== undefined ? Number(updates.shopLowStockThreshold) : (existing.shopLowStockThreshold ?? 5),
    inShopInventory: updates.inShopInventory !== undefined ? Boolean(updates.inShopInventory) : (existing.inShopInventory !== undefined ? existing.inShopInventory : true),
    images: safeImages,
    videos: safeVideos,
    media: [
      ...safeImages.map((u: string, i: number) => ({ id: `med-${id}-${i}`, url: u, type: 'image' as const })),
      ...safeVideos.map((u: string, i: number) => ({ id: `med-vid-${id}-${i}`, url: u, type: 'video' as const })),
    ],
    models,
  };

  products[index] = updatedProd;
  writeJsonFile(DEV_PRODUCTS_FILE, products);

  await logActivity({
    adminEmail,
    action: 'Updated Product (Local Dev)',
    target: updatedProd.name,
    details: `Fields: ${Object.keys(updates).join(', ')}`,
  }).catch(() => {});

  return updatedProd;
}

export async function deleteDevProduct(id: string, adminEmail = 'admin@alhamd.com'): Promise<boolean> {
  assertDevOnly('deleteDevProduct');
  const products = getDevProducts();
  const filtered = products.filter((p) => p.id !== id && p.slug !== id);
  if (filtered.length === products.length) {
    return false;
  }
  writeJsonFile(DEV_PRODUCTS_FILE, filtered);

  await logActivity({
    adminEmail,
    action: 'Deleted Product (Local Dev)',
    target: id,
    details: `Product ID ${id} deleted`,
  }).catch(() => {});

  return true;
}

// ==========================================
// BRANDS DEV STORAGE
// ==========================================

export function getDevBrands(activeOnly = false): Brand[] {
  assertDevOnly('getDevBrands');
  const brands = readJsonFile<Brand[]>(DEV_BRANDS_FILE, seedBrands);
  return activeOnly ? brands.filter((b) => b.status === 'active') : brands;
}

export function getDevBrandByIdOrSlug(idOrSlug: string): Brand | null {
  assertDevOnly('getDevBrandByIdOrSlug');
  const brands = getDevBrands();
  const clean = idOrSlug.trim().toLowerCase();
  return brands.find((b) => b.id.toLowerCase() === clean || b.slug.toLowerCase() === clean) || null;
}

export async function insertDevBrand(
  data: Partial<Brand>,
  adminEmail = 'admin@alhamd.com'
): Promise<Brand> {
  assertDevOnly('insertDevBrand');
  const brands = getDevBrands();
  const safeLogo = await ensureSafeMediaUrl(data.logo, 'brands');
  const cleanName = (data.name || '').trim();
  const cleanSlug = (data.slug || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();

  const newBrand: Brand = {
    id: data.id || `brand-${Date.now()}`,
    name: cleanName,
    slug: cleanSlug,
    description: (data.description || '').trim(),
    logo: safeLogo || '',
    status: data.status || 'active',
    productCount: data.productCount || 0,
    sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : brands.length,
    isFeatured: Boolean(data.isFeatured),
  };

  const updated = [newBrand, ...brands];
  writeJsonFile(DEV_BRANDS_FILE, updated);

  await logActivity({
    adminEmail,
    action: 'Created Brand (Local Dev)',
    target: newBrand.name,
    details: `Slug: ${newBrand.slug}`,
  }).catch(() => {});

  return newBrand;
}

export async function updateDevBrand(
  id: string,
  updates: Partial<Brand>,
  adminEmail = 'admin@alhamd.com'
): Promise<Brand> {
  assertDevOnly('updateDevBrand');
  const brands = getDevBrands();
  const index = brands.findIndex((b) => b.id === id || b.slug === id);
  if (index === -1) {
    throw new Error(`Brand with ID "${id}" not found.`);
  }

  const existing = brands[index];
  const safeLogo = updates.logo !== undefined ? await ensureSafeMediaUrl(updates.logo, 'brands') : existing.logo;

  const updatedBrand: Brand = {
    ...existing,
    ...updates,
    logo: safeLogo || existing.logo,
    sortOrder: updates.sortOrder !== undefined ? Number(updates.sortOrder) : (existing.sortOrder ?? 0),
    isFeatured: updates.isFeatured !== undefined ? Boolean(updates.isFeatured) : Boolean(existing.isFeatured),
  };

  brands[index] = updatedBrand;
  writeJsonFile(DEV_BRANDS_FILE, brands);

  await logActivity({
    adminEmail,
    action: 'Updated Brand (Local Dev)',
    target: updatedBrand.name,
    details: `Fields: ${Object.keys(updates).join(', ')}`,
  }).catch(() => {});

  return updatedBrand;
}

export async function reorderDevBrands(
  orderedIds: string[],
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  assertDevOnly('reorderDevBrands');
  const brands = getDevBrands();
  const map = new Map(brands.map((b) => [b.id, b]));
  const reordered: Brand[] = [];

  orderedIds.forEach((id, index) => {
    const item = map.get(id) || brands.find((b) => b.slug === id);
    if (item) {
      reordered.push({ ...item, sortOrder: index });
      map.delete(item.id);
    }
  });

  // Append any remainder
  map.forEach((item) => {
    reordered.push({ ...item, sortOrder: reordered.length });
  });

  writeJsonFile(DEV_BRANDS_FILE, reordered);

  await logActivity({
    adminEmail,
    action: 'Reordered Brands (Local Dev)',
    target: 'Brands list',
    details: `Reordered ${orderedIds.length} brands`,
  }).catch(() => {});

  return true;
}

export async function deleteDevBrand(id: string, adminEmail = 'admin@alhamd.com'): Promise<boolean> {
  assertDevOnly('deleteDevBrand');
  const brands = getDevBrands();
  const filtered = brands.filter((b) => b.id !== id && b.slug !== id);
  if (filtered.length === brands.length) {
    return false;
  }
  writeJsonFile(DEV_BRANDS_FILE, filtered);

  await logActivity({
    adminEmail,
    action: 'Deleted Brand (Local Dev)',
    target: id,
    details: `Brand ID ${id} deleted`,
  }).catch(() => {});

  return true;
}

// ==========================================
// SHOP BILLS DEV STORAGE (Local Dev Offline)
// ==========================================

const DEV_SHOP_BILLS_FILE = path.join(DATA_DIR, 'dev-shop-bills.json');

export function getDevShopBills(limit = 100): ShopBill[] {
  assertDevOnly('getDevShopBills');
  const bills = readJsonFile<ShopBill[]>(DEV_SHOP_BILLS_FILE, []);
  return bills
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function getDevShopBillById(id: string): ShopBill | null {
  assertDevOnly('getDevShopBillById');
  const bills = readJsonFile<ShopBill[]>(DEV_SHOP_BILLS_FILE, []);
  return bills.find((b) => b.id === id || b.billNumber === id) || null;
}

export async function createDevShopBill(params: {
  items: Array<{
    productId: string;
    productName: string;
    sku?: string;
    modelId?: string;
    modelName?: string;
    transferQuantity: number;
  }>;
  notes?: string;
  createdBy: string;
}): Promise<ShopBill> {
  assertDevOnly('createDevShopBill');
  const bills = readJsonFile<ShopBill[]>(DEV_SHOP_BILLS_FILE, []);
  const year = new Date().getFullYear();

  let maxSeq = 0;
  for (const b of bills) {
    if (b.billNumber && b.billNumber.startsWith(`SB-${year}-`)) {
      const parts = b.billNumber.split('-');
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  }
  const billNumber = `SB-${year}-${(maxSeq + 1).toString().padStart(5, '0')}`;
  const billId = `sb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newBill: ShopBill = {
    id: billId,
    billNumber,
    status: 'draft',
    notes: params.notes || undefined,
    items: params.items.map((it, idx) => ({
      id: idx + 1,
      shopBillId: billId,
      productId: it.productId,
      productName: it.productName,
      sku: it.sku,
      modelId: it.modelId,
      modelName: it.modelName,
      transferQuantity: Number(it.transferQuantity),
      warehouseStockBefore: 0,
      warehouseStockAfter: 0,
      shopStockBefore: 0,
      shopStockAfter: 0,
    })),
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const updatedBills = [newBill, ...bills];
  writeJsonFile(DEV_SHOP_BILLS_FILE, updatedBills);

  await logActivity({
    adminEmail: params.createdBy,
    action: 'Created Shop Bill (Local Dev)',
    target: billNumber,
    details: `Draft Shop Bill with ${params.items.length} item(s)`,
  }).catch(() => {});

  return newBill;
}

export async function finalizeDevShopBill(
  billId: string,
  finalizedBy: string
): Promise<ShopBill> {
  assertDevOnly('finalizeDevShopBill');
  const bills = readJsonFile<ShopBill[]>(DEV_SHOP_BILLS_FILE, []);
  const billIndex = bills.findIndex((b) => b.id === billId || b.billNumber === billId);
  if (billIndex === -1) {
    throw new Error('Shop Bill not found.');
  }

  const bill = bills[billIndex];
  if (bill.status !== 'draft') {
    throw new Error(`Shop Bill is already ${bill.status}. Only draft bills can be finalized.`);
  }

  if (!bill.items || bill.items.length === 0) {
    throw new Error('Shop Bill has no items.');
  }

  const products = getDevProducts();

  // ATOMIC VALIDATION PASS:
  // Validate warehouse stock for ALL items before making any modifications.
  // If ANY item has insufficient warehouse stock, throw an error immediately
  // and do NOT mutate or save anything (ensures zero partial transfer).
  for (const item of bill.items) {
    const qty = Number(item.transferQuantity);
    if (qty <= 0) {
      throw new Error(`Transfer quantity for "${item.productName}" must be greater than 0.`);
    }

    const prod = products.find((p) => p.id === item.productId);
    if (!prod) {
      throw new Error(`Product "${item.productName}" (ID: ${item.productId}) was not found.`);
    }

    if (item.modelId) {
      const model = prod.models?.find((m: any) => m.id === item.modelId);
      if (!model) {
        throw new Error(`Model "${item.modelName || item.modelId}" for "${item.productName}" was not found.`);
      }
      const warehouseStock = Number(model.stock ?? 0);
      if (warehouseStock < qty) {
        throw new Error(
          `Insufficient warehouse stock for "${item.productName} (${item.modelName || model.name})". Warehouse: ${warehouseStock}, Requested transfer: ${qty}.`
        );
      }
    } else {
      const warehouseStock = Number(prod.stock ?? 0);
      if (warehouseStock < qty) {
        throw new Error(
          `Insufficient warehouse stock for "${item.productName}". Warehouse: ${warehouseStock}, Requested transfer: ${qty}.`
        );
      }
    }
  }

  // UPDATE PASS: Apply warehouse deduction and shop addition
  for (const item of bill.items) {
    const qty = Number(item.transferQuantity);
    const prod = products.find((p) => p.id === item.productId)!;

    if (item.modelId) {
      const model = prod.models!.find((m: any) => m.id === item.modelId)!;
      const whBefore = Number(model.stock ?? 0);
      const shopBefore = Number(model.shopStock ?? 0);
      const whAfter = whBefore - qty;
      const shopAfter = shopBefore + qty;

      model.stock = whAfter;
      model.shopStock = shopAfter;

      prod.stock = prod.models!.reduce((sum: number, m: any) => sum + (m.stock ?? 0), 0);
      prod.shopStock = prod.models!.reduce((sum: number, m: any) => sum + (m.shopStock ?? 0), 0);
      prod.inShopInventory = true;
      prod.isShopActive = true;

      item.warehouseStockBefore = whBefore;
      item.warehouseStockAfter = whAfter;
      item.shopStockBefore = shopBefore;
      item.shopStockAfter = shopAfter;
    } else {
      const whBefore = Number(prod.stock ?? 0);
      const shopBefore = Number(prod.shopStock ?? 0);
      const whAfter = whBefore - qty;
      const shopAfter = shopBefore + qty;

      prod.stock = whAfter;
      prod.shopStock = shopAfter;
      prod.inShopInventory = true;
      prod.isShopActive = true;

      item.warehouseStockBefore = whBefore;
      item.warehouseStockAfter = whAfter;
      item.shopStockBefore = shopBefore;
      item.shopStockAfter = shopAfter;
    }
  }

  bill.status = 'finalized';
  bill.finalizedBy = finalizedBy;
  bill.updatedAt = new Date().toISOString();

  writeJsonFile(DEV_PRODUCTS_FILE, products);
  writeJsonFile(DEV_SHOP_BILLS_FILE, bills);

  await logActivity({
    adminEmail: finalizedBy,
    action: 'Finalized Shop Bill (Local Dev)',
    target: bill.billNumber,
    details: `Transferred stock for ${bill.items.length} product(s) from warehouse to shop.`,
  }).catch(() => {});

  return bill;
}

export async function voidDevShopBill(
  billId: string,
  voidedBy: string,
  voidReason: string
): Promise<ShopBill> {
  assertDevOnly('voidDevShopBill');
  const bills = readJsonFile<ShopBill[]>(DEV_SHOP_BILLS_FILE, []);
  const billIndex = bills.findIndex((b) => b.id === billId || b.billNumber === billId);
  if (billIndex === -1) {
    throw new Error('Shop Bill not found.');
  }

  const bill = bills[billIndex];
  if (bill.status !== 'finalized') {
    throw new Error(`Only finalized bills can be voided. Current status is ${bill.status}.`);
  }

  const products = getDevProducts();

  // Validate shop stock is available to reverse
  for (const item of bill.items) {
    const qty = Number(item.transferQuantity);
    const prod = products.find((p) => p.id === item.productId);
    if (!prod) continue;

    if (item.modelId) {
      const model = prod.models?.find((m: any) => m.id === item.modelId);
      if (model && (model.shopStock ?? 0) < qty) {
        throw new Error(
          `Cannot void bill: Shop stock for "${item.productName} (${item.modelName || model.name})" is lower than transfer quantity.`
        );
      }
    } else {
      if ((prod.shopStock ?? 0) < qty) {
        throw new Error(
          `Cannot void bill: Shop stock for "${item.productName}" is lower than transfer quantity.`
        );
      }
    }
  }

  // Reverse stock transfer
  for (const item of bill.items) {
    const qty = Number(item.transferQuantity);
    const prod = products.find((p) => p.id === item.productId);
    if (!prod) continue;

    if (item.modelId) {
      const model = prod.models?.find((m: any) => m.id === item.modelId);
      if (model) {
        model.stock = (model.stock ?? 0) + qty;
        model.shopStock = Math.max(0, (model.shopStock ?? 0) - qty);
        prod.stock = prod.models!.reduce((sum: number, m: any) => sum + (m.stock ?? 0), 0);
        prod.shopStock = prod.models!.reduce((sum: number, m: any) => sum + (m.shopStock ?? 0), 0);
      }
    } else {
      prod.stock = (prod.stock ?? 0) + qty;
      prod.shopStock = Math.max(0, (prod.shopStock ?? 0) - qty);
    }
  }

  bill.status = 'voided';
  bill.voidedBy = voidedBy;
  bill.voidedAt = new Date().toISOString();
  bill.voidReason = voidReason;
  bill.updatedAt = new Date().toISOString();

  writeJsonFile(DEV_PRODUCTS_FILE, products);
  writeJsonFile(DEV_SHOP_BILLS_FILE, bills);

  await logActivity({
    adminEmail: voidedBy,
    action: 'Voided Shop Bill (Local Dev)',
    target: bill.billNumber,
    details: `Void reason: ${voidReason}`,
  }).catch(() => {});

  return bill;
}

// ==========================================
// DEALS DEV STORAGE
// ==========================================

export function getDevDeals(): Deal[] {
  assertDevOnly('getDevDeals');
  const deals = readJsonFile<Deal[]>(DEV_DEALS_FILE, []);
  return deals.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export function getDevDealById(id: string): Deal | null {
  assertDevOnly('getDevDealById');
  const deals = getDevDeals();
  return deals.find((d) => d.id === id || d.slug === id) || null;
}

export async function insertDevDeal(
  data: Partial<Deal>,
  adminEmail = 'admin@alhamd.com'
): Promise<Deal> {
  assertDevOnly('insertDevDeal');
  const deals = getDevDeals();
  const name = (data.name || '').trim();
  if (!name) throw new Error('Deal Name is required.');

  const id = data.id || `deal-${Date.now()}`;
  const slug =
    data.slug ||
    `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}-${Date.now().toString(36)}`;

  const cleanProducts: DealProductItem[] = Array.isArray(data.products)
    ? data.products.map((p, idx) => ({
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
    name,
    slug,
    description: (data.description || '').trim(),
    image: data.image || '',
    dealPrice: data.dealPrice !== undefined ? Number(data.dealPrice) : undefined,
    originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : undefined,
    discountAmount: data.discountAmount !== undefined ? Number(data.discountAmount) : undefined,
    discountPercentage: data.discountPercentage !== undefined ? Number(data.discountPercentage) : undefined,
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    status: data.status || 'active',
    showOnHomepage: data.showOnHomepage !== undefined ? Boolean(data.showOnHomepage) : true,
    displayOrder: data.displayOrder !== undefined ? Number(data.displayOrder) : deals.length + 1,
    products: cleanProducts,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = deals.findIndex((d) => d.id === id);
  if (existingIndex >= 0) {
    deals[existingIndex] = newDeal;
  } else {
    deals.push(newDeal);
  }

  writeJsonFile(DEV_DEALS_FILE, deals);

  await logActivity({
    adminEmail,
    action: 'CREATE_DEAL',
    target: newDeal.name,
    details: `Created promotional deal "${newDeal.name}" (${newDeal.products.length} products)`,
  }).catch(() => {});

  return newDeal;
}

export async function updateDevDeal(
  id: string,
  data: Partial<Deal>,
  adminEmail = 'admin@alhamd.com'
): Promise<Deal> {
  assertDevOnly('updateDevDeal');
  const deals = getDevDeals();
  const existing = deals.find((d) => d.id === id);
  if (!existing) {
    throw new Error(`Deal with ID "${id}" not found.`);
  }

  const name = (data.name !== undefined ? data.name : existing.name).trim();
  const slug = data.slug || existing.slug;
  const description = data.description !== undefined ? data.description : existing.description;
  const image = data.image !== undefined ? data.image : existing.image;
  const dealPrice = data.dealPrice !== undefined ? data.dealPrice : existing.dealPrice;
  const originalPrice = data.originalPrice !== undefined ? data.originalPrice : existing.originalPrice;
  const discountAmount = data.discountAmount !== undefined ? data.discountAmount : existing.discountAmount;
  const discountPercentage = data.discountPercentage !== undefined ? data.discountPercentage : existing.discountPercentage;
  const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
  const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
  const status = data.status || existing.status;
  const showOnHomepage = data.showOnHomepage !== undefined ? data.showOnHomepage : existing.showOnHomepage;
  const displayOrder = data.displayOrder !== undefined ? data.displayOrder : existing.displayOrder;

  let products = existing.products;
  if (Array.isArray(data.products)) {
    products = data.products.map((p, idx) => ({
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
    }));
  }

  const updatedDeal: Deal = {
    ...existing,
    name,
    slug,
    description,
    image,
    dealPrice,
    originalPrice,
    discountAmount,
    discountPercentage,
    startDate,
    endDate,
    status,
    showOnHomepage,
    displayOrder,
    products,
    updatedAt: new Date().toISOString(),
  };

  const idx = deals.findIndex((d) => d.id === id);
  deals[idx] = updatedDeal;
  writeJsonFile(DEV_DEALS_FILE, deals);

  await logActivity({
    adminEmail,
    action: 'UPDATE_DEAL',
    target: updatedDeal.name,
    details: `Updated promotional deal "${updatedDeal.name}"`,
  }).catch(() => {});

  return updatedDeal;
}

export async function deleteDevDeal(
  id: string,
  adminEmail = 'admin@alhamd.com'
): Promise<boolean> {
  assertDevOnly('deleteDevDeal');
  const deals = getDevDeals();
  const existing = deals.find((d) => d.id === id);
  if (!existing) return false;

  const filtered = deals.filter((d) => d.id !== id);
  writeJsonFile(DEV_DEALS_FILE, filtered);

  await logActivity({
    adminEmail,
    action: 'DELETE_DEAL',
    target: existing.name,
    details: `Deleted promotional deal "${existing.name}"`,
  }).catch(() => {});

  return true;
}
