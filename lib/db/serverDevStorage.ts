import fs from 'fs';
import path from 'path';
import { Product, Category, ProductMediaItem, ProductModelVariant } from '@/types';
import { Brand } from '@/types/admin';
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
  let models: ProductModelVariant[] = [];
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
        images: mImgs,
        videos: mVids,
      });
    }
  }

  const updatedProd = {
    ...existing,
    ...updates,
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
