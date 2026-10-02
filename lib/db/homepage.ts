import {
  HomepageSection,
  HeroConfig,
  FlashSaleConfig,
  TrustBenefitItem,
  Banner,
  FloatingProductConfig,
} from '@/types/admin';
import {
  seedHomepageSections,
  seedHeroConfig,
  seedFlashSaleConfig,
  seedTrustBenefits,
} from './seed';
import { getStoredCollection, getLocal, setLocal, persistCollection } from './storage';
import { logActivity } from './activity';
import { allowDevMockFallback } from '../env';

const SECTIONS_KEY = 'homepage_sections';
const HERO_KEY = 'homepage_hero';
const FLASH_SALE_KEY = 'homepage_flash_sale';
const TRUST_BENEFITS_KEY = 'homepage_trust_benefits';
const BANNERS_KEY = 'homepage_banners';

// Homepage Sections & Order
export function getHomepageSections(): HomepageSection[] {
  const rawList = getStoredCollection(SECTIONS_KEY, seedHomepageSections)
    .map((s) => (s.id === 'hero' ? { ...s, name: 'Full-Screen Video Hero' } : s));

  // Ensure 'brands' section is present if upgrading an existing cached collection
  if (!rawList.some((s) => s.id === 'brands')) {
    const catSection = rawList.find((s) => s.id === 'categories');
    const brandOrder = catSection ? catSection.order + 0.5 : 3.5;
    rawList.push({ id: 'brands', name: 'Shop by Brands', enabled: true, order: brandOrder });
  }

  return rawList.sort((a, b) => a.order - b.order);
}

export async function updateHomepageSections(
  sections: HomepageSection[],
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  await persistCollection(SECTIONS_KEY, sections);
  await logActivity({
    adminEmail,
    action: 'Updated Homepage Sections Order/Visibility',
    target: 'Homepage Layout',
  });
}

// Hero Config
export function getHeroConfig(): HeroConfig {
  const fallbackHero: HeroConfig = allowDevMockFallback()
    ? seedHeroConfig
    : {
        ...seedHeroConfig,
        floatingProducts: [],
      };

  let hero = getLocal<HeroConfig>(HERO_KEY, fallbackHero);
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
  const fallbackFlash: FlashSaleConfig = allowDevMockFallback()
    ? seedFlashSaleConfig
    : {
        ...seedFlashSaleConfig,
        productIds: [],
      };

  let flash = getLocal<FlashSaleConfig>(FLASH_SALE_KEY, fallbackFlash);
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
  await logActivity({
    adminEmail,
    action: 'Updated Flash Sale Config & Timer',
    target: 'Flash Sale Banner',
  });
}

export function getTrustBenefits(): TrustBenefitItem[] {
  const items = getStoredCollection(TRUST_BENEFITS_KEY, seedTrustBenefits).map((tb) => {
    if (tb.title.includes('Worldwide') || tb.description.includes('$50')) {
      return {
        ...tb,
        title: 'Nationwide Delivery',
        description: 'Free delivery on mobile accessories over Rs. 5,000 across Pakistan',
      };
    }
    return tb;
  });
  return items.sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function updateTrustBenefits(
  items: TrustBenefitItem[],
  adminEmail = 'admin@alhamd.com'
): Promise<void> {
  await persistCollection(TRUST_BENEFITS_KEY, items);
  await logActivity({
    adminEmail,
    action: 'Updated Trust & Benefits Pillars',
    target: 'Benefits Section',
  });
}

// Promotional Banners - Re-exported from unified banners DB module
export { getBanners, saveBanner, deleteBanner, toggleBannerStatus } from './banners';
export async function updateBanners(banners: Banner[], adminEmail = 'admin@alhamd.com'): Promise<void> {
  await persistCollection(BANNERS_KEY, banners);
  await logActivity({
    adminEmail,
    action: 'Updated Promotional Banners',
    target: 'Banners Collection',
  });
}

