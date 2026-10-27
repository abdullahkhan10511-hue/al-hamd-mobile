import {
  HomepageSection,
  AllProductsConfig,
  HeroConfig,
  FlashSaleConfig,
  TrustBenefitItem,
  FloatingProductConfig,
} from '@/types/admin';
import {
  seedHomepageSections,
  seedAllProductsConfig,
  seedHeroConfig,
  seedFlashSaleConfig,
  seedTrustBenefits,
} from './seed';
import { getStoredCollection, getLocal, setLocal, persistCollection } from './storage';
import { logActivity } from './activity';
import { allowDevMockFallback } from '../env';

import { getAdminAuthHeaders } from './staff';

const SECTIONS_KEY = 'homepage_sections';
const HERO_KEY = 'homepage_hero';
const FLASH_SALE_KEY = 'homepage_flash_sale';
const TRUST_BENEFITS_KEY = 'homepage_trust_benefits';
const ALL_PRODUCTS_CONFIG_KEY = 'homepage_all_products_config';

let inFlightHomepageSettingsPromise: Promise<boolean> | null = null;

export async function syncHomepageSettingsFromApi(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (inFlightHomepageSettingsPromise) return inFlightHomepageSettingsPromise;

  inFlightHomepageSettingsPromise = (async () => {
    try {
      const res = await fetch('/api/homepage-settings?t=' + Date.now(), {
        cache: 'no-store',
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.success || !data.settings) return false;

      const { sections, hero, flashSale, trustBenefits, allProducts } = data.settings;
      if (Array.isArray(sections)) {
        await persistCollection(SECTIONS_KEY, sections);
      }
      if (hero) {
        setLocal(HERO_KEY, hero);
      }
      if (flashSale) {
        setLocal(FLASH_SALE_KEY, flashSale);
      }
      if (Array.isArray(trustBenefits)) {
        await persistCollection(TRUST_BENEFITS_KEY, trustBenefits);
      }
      if (allProducts) {
        setLocal(ALL_PRODUCTS_CONFIG_KEY, allProducts);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('alhamd:data-updated', { detail: { key: 'homepage_sections' } }));
        window.dispatchEvent(new CustomEvent('alhamd:data-updated', { detail: { key: 'homepage_hero' } }));
        window.dispatchEvent(new CustomEvent('alhamd:data-updated', { detail: { key: 'homepage_flash_sale' } }));
        window.dispatchEvent(new CustomEvent('alhamd:data-updated', { detail: { key: 'homepage_trust_benefits' } }));
        window.dispatchEvent(new CustomEvent('alhamd:data-updated', { detail: { key: 'homepage_all_products_config' } }));
      }
      return true;
    } catch {
      return false;
    } finally {
      inFlightHomepageSettingsPromise = null;
    }
  })();

  return inFlightHomepageSettingsPromise;
}

export async function updateAllHomepageSettings(
  payload: {
    sections?: HomepageSection[];
    hero?: HeroConfig;
    flashSale?: FlashSaleConfig;
    allProducts?: AllProductsConfig;
    trustBenefits?: TrustBenefitItem[];
  },
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  if (payload.sections) await persistCollection(SECTIONS_KEY, payload.sections);
  if (payload.hero) setLocal(HERO_KEY, payload.hero);
  if (payload.flashSale) setLocal(FLASH_SALE_KEY, payload.flashSale);
  if (payload.allProducts) setLocal(ALL_PRODUCTS_CONFIG_KEY, payload.allProducts);
  if (payload.trustBenefits) await persistCollection(TRUST_BENEFITS_KEY, payload.trustBenefits);

  await saveHomepageSettingsToServer(payload);
  await logActivity({
    adminEmail,
    action: 'Updated Homepage Settings',
    target: 'Homepage Layout',
  });
}

async function saveHomepageSettingsToServer(payload: Record<string, unknown>): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/admin/homepage-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Network error while saving homepage settings to server:', err);
  }
}

// Canonical Homepage Sections for SSR & initial client hydration (pure, deterministic)
export function getCanonicalHomepageSections(): HomepageSection[] {
  const list = [...seedHomepageSections].map((s) => {
    if (s.id === 'hero') return { ...s, name: 'Full-Screen Video Hero' };
    if (s.id === 'promo-banners') return { ...s, id: 'deals', name: 'Special Deals & Bundles' };
    return s;
  });

  if (!list.some((s) => s.id === 'categories')) {
    list.push({ id: 'categories', name: 'Shop by Categories', enabled: true, order: 3 });
  }
  if (!list.some((s) => s.id === 'brands')) {
    list.push({ id: 'brands', name: 'Shop by Brands', enabled: true, order: 4 });
  }
  if (!list.some((s) => s.id === 'all-products')) {
    list.push({ id: 'all-products', name: 'All Products Showcase', enabled: true, order: 5 });
  }
  if (!list.some((s) => s.id === 'deals')) {
    list.push({ id: 'deals', name: 'Special Deals & Bundles', enabled: false, order: 8 });
  }
  if (!list.some((s) => s.id === 'final-trust')) {
    list.push({ id: 'final-trust', name: 'Final Assurance Bar', enabled: true, order: 9 });
  }

  return list.sort((a, b) => a.order - b.order);
}

// Homepage Sections & Order (includes persistent/localStorage overrides)
export function getHomepageSections(): HomepageSection[] {
  const canonical = getCanonicalHomepageSections();
  const rawList = getStoredCollection(SECTIONS_KEY, canonical)
    .map((s) => {
      if (s.id === 'hero') return { ...s, name: 'Full-Screen Video Hero' };
      if (s.id === 'promo-banners') return { ...s, id: 'deals', name: 'Special Deals & Bundles' };
      return s;
    });

  // Ensure 'categories' section is present if upgrading an existing cached collection
  if (!rawList.some((s) => s.id === 'categories')) {
    rawList.push({ id: 'categories', name: 'Shop by Categories', enabled: true, order: 3 });
  }

  // Ensure 'brands' section is present if upgrading an existing cached collection
  if (!rawList.some((s) => s.id === 'brands')) {
    const catSection = rawList.find((s) => s.id === 'categories');
    const brandOrder = catSection ? catSection.order + 0.5 : 3.5;
    rawList.push({ id: 'brands', name: 'Shop by Brands', enabled: true, order: brandOrder });
  }

  // Ensure 'deals' section is present if upgrading an existing cached collection
  if (!rawList.some((s) => s.id === 'deals')) {
    const bsSection = rawList.find((s) => s.id === 'best-sellers');
    const dealsOrder = bsSection ? bsSection.order + 0.5 : 6.5;
    rawList.push({ id: 'deals', name: 'Special Deals & Bundles', enabled: true, order: dealsOrder });
  }

  // Ensure 'all-products' section is present if upgrading an existing cached collection
  if (!rawList.some((s) => s.id === 'all-products')) {
    const dealsSection = rawList.find((s) => s.id === 'deals');
    const allProdOrder = dealsSection ? dealsSection.order + 0.5 : 7.5;
    rawList.push({ id: 'all-products', name: 'All Products Showcase', enabled: true, order: allProdOrder });
  }

  return rawList.sort((a, b) => a.order - b.order);
}

export async function updateHomepageSections(
  sections: HomepageSection[],
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  await persistCollection(SECTIONS_KEY, sections);
  await saveHomepageSettingsToServer({ sections });
  await logActivity({
    adminEmail,
    action: 'Updated Homepage Sections Order/Visibility',
    target: 'Homepage Layout',
  });
}

// Hero Config
export function getHeroConfig(): HeroConfig {
  let fallbackHero: HeroConfig = allowDevMockFallback()
    ? seedHeroConfig
    : {
        ...seedHeroConfig,
        floatingProducts: [],
      };

  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readPersistentHomepageSettings } = require('./homepageSettingsStorage');
      const saved = readPersistentHomepageSettings();
      if (saved.hero && typeof saved.hero === 'object') {
        fallbackHero = { ...fallbackHero, ...saved.hero };
      }
    } catch {}
  }

  const hero = getLocal<HeroConfig>(HERO_KEY, fallbackHero);
  let changed = false;

  // Migrate old non-mobile hero image or floating cards
  if (hero.desktopImage && hero.desktopImage.includes('photo-1483985988355-763728e1935b')) {
    hero.desktopImage = seedHeroConfig.desktopImage;
    hero.mobileImage = seedHeroConfig.mobileImage;
    hero.eyebrowText = seedHeroConfig.eyebrowText;
    hero.mainHeading = seedHeroConfig.mainHeading;
    hero.headingHighlight = seedHeroConfig.headingHighlight;
    hero.description = seedHeroConfig.description;
    changed = true;
  }

  if (!allowDevMockFallback()) {
    // In production, strictly purge fake demo products from floating cards
    if (hero.floatingProducts && Array.isArray(hero.floatingProducts)) {
      const cleanFloating = hero.floatingProducts.filter(
        (fp) =>
          fp.productId !== 'prod-15' &&
          fp.productId !== 'prod-16' &&
          fp.productId !== 'prod-case-01' &&
          fp.productId !== 'prod-1' &&
          fp.productId !== 'prod-2'
      );
      if (cleanFloating.length !== hero.floatingProducts.length) {
        hero.floatingProducts = cleanFloating;
        changed = true;
      }
    }
  } else if (hero.floatingProducts) {
    const hasOldFloating = hero.floatingProducts.some(
      (fp) => fp.productId === 'prod-2' || fp.productId === 'prod-5' || fp.productId === 'prod-1'
    );
    if (hasOldFloating) {
      hero.floatingProducts = seedHeroConfig.floatingProducts;
      changed = true;
    }
  }

  if (changed) {
    setLocal(HERO_KEY, hero);
  }

  return hero;
}

export async function updateHeroConfig(
  config: Partial<HeroConfig>,
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  const current = getHeroConfig();
  const updated = { ...current, ...config };
  setLocal(HERO_KEY, updated);
  await saveHomepageSettingsToServer({ hero: updated });
  await logActivity({
    adminEmail,
    action: 'Updated Hero Section Config',
    target: 'Hero Banner',
  });
}

// Floating Product Cards
export function getFloatingProducts(): FloatingProductConfig[] {
  const heroFloating = getHeroConfig().floatingProducts;
  if (heroFloating && heroFloating.length > 0) return heroFloating;
  return allowDevMockFallback() ? seedHeroConfig.floatingProducts : [];
}

export async function updateFloatingProducts(
  cards: FloatingProductConfig[],
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  const hero = getHeroConfig();
  hero.floatingProducts = cards.slice(0, 4);
  await updateHeroConfig(hero, adminEmail);
}

// Flash Sale Config
export function getFlashSaleConfig(): FlashSaleConfig {
  let fallbackFlash: FlashSaleConfig = allowDevMockFallback()
    ? seedFlashSaleConfig
    : {
        ...seedFlashSaleConfig,
        productIds: [],
      };

  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readPersistentHomepageSettings } = require('./homepageSettingsStorage');
      const saved = readPersistentHomepageSettings();
      if (saved.flashSale && typeof saved.flashSale === 'object') {
        fallbackFlash = { ...fallbackFlash, ...saved.flashSale };
      }
    } catch {}
  }

  const flash = getLocal<FlashSaleConfig>(FLASH_SALE_KEY, fallbackFlash);
  let changed = false;

  if (flash.bannerImage && flash.bannerImage.includes('photo-1556905055-8f358a7a47b2')) {
    flash.bannerImage = seedFlashSaleConfig.bannerImage;
    flash.subtitle = seedFlashSaleConfig.subtitle;
    flash.title = seedFlashSaleConfig.title;
    flash.productIds = allowDevMockFallback() ? seedFlashSaleConfig.productIds : [];
    changed = true;
  }

  if (!allowDevMockFallback()) {
    // In production, strictly purge fake demo products from flash sale
    if (flash.productIds && Array.isArray(flash.productIds)) {
      const cleanIds = flash.productIds.filter(
        (id) =>
          id !== 'prod-15' &&
          id !== 'prod-16' &&
          id !== 'prod-case-01' &&
          id !== 'prod-chg-01' &&
          id !== 'prod-1' &&
          id !== 'prod-2'
      );
      if (cleanIds.length !== flash.productIds.length) {
        flash.productIds = cleanIds;
        changed = true;
      }
    }
  } else if (flash.productIds && (flash.productIds.includes('prod-1') || flash.productIds.includes('prod-2'))) {
    flash.productIds = seedFlashSaleConfig.productIds;
    changed = true;
  }

  if (changed) {
    setLocal(FLASH_SALE_KEY, flash);
  }

  return flash;
}

export async function updateFlashSaleConfig(
  config: Partial<FlashSaleConfig>,
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  const current = getFlashSaleConfig();
  const updated = { ...current, ...config };
  setLocal(FLASH_SALE_KEY, updated);
  await saveHomepageSettingsToServer({ flashSale: updated });
  await logActivity({
    adminEmail,
    action: 'Updated Flash Sale Config & Timer',
    target: 'Flash Sale Banner',
  });
}

export function getTrustBenefits(): TrustBenefitItem[] {
  let baseBenefits = seedTrustBenefits;
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readPersistentHomepageSettings } = require('./homepageSettingsStorage');
      const saved = readPersistentHomepageSettings();
      if (Array.isArray(saved.trustBenefits) && saved.trustBenefits.length > 0) {
        baseBenefits = saved.trustBenefits;
      }
    } catch {}
  }
  const items = getStoredCollection(TRUST_BENEFITS_KEY, baseBenefits).map((tb) => {
    // Migrate legacy or exaggerated claims to truthful copy if detected
    if (
      tb.title.includes('Worldwide') ||
      tb.description.includes('$50') ||
      tb.description.includes('aerospace') ||
      tb.description.includes('50,000+') ||
      tb.description.includes('Kevlar') ||
      tb.description.includes('Impact-tested')
    ) {
      if (tb.id === 'tb-1' || tb.title.toLowerCase().includes('quality') || tb.title.toLowerCase().includes('build')) {
        return {
          id: tb.id || 'tb-1',
          icon: 'Award',
          title: 'Quality You Can Trust',
          description: 'Shop carefully selected mobile accessories for everyday use.',
          displayOrder: 1,
          visible: tb.visible ?? true,
        };
      }
      if (tb.id === 'tb-2' || tb.title.toLowerCase().includes('delivery')) {
        return {
          id: tb.id || 'tb-2',
          icon: 'Truck',
          title: 'Delivery Across Pakistan',
          description: 'Convenient delivery options for customers across Pakistan.',
          displayOrder: 2,
          visible: tb.visible ?? true,
        };
      }
      if (tb.id === 'tb-3' || tb.title.toLowerCase().includes('secure') || tb.title.toLowerCase().includes('checkout')) {
        return {
          id: tb.id || 'tb-3',
          icon: 'Lock',
          title: 'Secure Shopping Experience',
          description: 'A straightforward checkout experience with the payment options currently supported by the store.',
          displayOrder: 3,
          visible: tb.visible ?? true,
        };
      }
      if (tb.id === 'tb-4' || tb.title.toLowerCase().includes('support') || tb.title.toLowerCase().includes('satisfaction')) {
        return {
          id: tb.id || 'tb-4',
          icon: 'Headphones',
          title: 'Customer Support',
          description: 'Get help with your questions, orders and product information.',
          displayOrder: 4,
          visible: tb.visible ?? true,
        };
      }
    }
    return tb;
  });
  return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export async function updateTrustBenefits(
  items: TrustBenefitItem[],
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  await persistCollection(TRUST_BENEFITS_KEY, items);
  await saveHomepageSettingsToServer({ trustBenefits: items });
  await logActivity({
    adminEmail,
    action: 'Updated Trust & Benefits Pillars',
    target: 'Benefits Section',
  });
}

// All Products Section Config
export function getAllProductsConfig(): AllProductsConfig {
  let baseConfig = seedAllProductsConfig;
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { readPersistentHomepageSettings } = require('./homepageSettingsStorage');
      const saved = readPersistentHomepageSettings();
      if (saved.allProducts) {
        baseConfig = saved.allProducts;
      }
    } catch {}
  }
  return getLocal<AllProductsConfig>(ALL_PRODUCTS_CONFIG_KEY, baseConfig);
}

export async function updateAllProductsConfig(
  config: Partial<AllProductsConfig>,
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  const current = getAllProductsConfig();
  const updated = { ...current, ...config };
  setLocal(ALL_PRODUCTS_CONFIG_KEY, updated);
  await saveHomepageSettingsToServer({ allProducts: updated });
  await logActivity({
    adminEmail,
    action: 'Updated All Products Section Config',
    target: 'All Products Showcase',
  });
}

// Promotional Deals - Re-exported from unified deals DB module
export { getDeals, saveDeal, deleteDeal, toggleDealStatus } from './deals';

