import React from 'react';
import { HeroSection } from '@/components/home/HeroSection';
import { TrustBenefitsBar } from '@/components/home/TrustBenefitsBar';
import { ShopByCategories } from '@/components/home/ShopByCategories';
import { ShopByBrands } from '@/components/home/ShopByBrands';
import { NewArrivals } from '@/components/home/NewArrivals';
import { BestSellers } from '@/components/home/BestSellers';
import { DealsSection } from '@/components/home/DealsSection';
import { AllProductsSection } from '@/components/home/AllProductsSection';
import { FinalTrustBar } from '@/components/home/FinalTrustBar';
import { isDbConfigured } from '@/lib/db/mysql';
import { getActiveHomepageVideosFromDb } from '@/lib/db/repositories/homepageVideos';
import { readPersistentHomepageVideos } from '@/lib/db/homepageVideosStorage';
import { getCanonicalHomepageSections } from '@/lib/db/homepage';
import { getMergedHomepageSettings } from '@/lib/db/homepageSettingsStorage';
import { DEFAULT_HERO_BLUR_DATA_URL } from '@/lib/heroMedia';
import { HomepageVideo } from '@/types/admin';
import { HomePageClientSync } from '@/components/home/HomePageClientSync';
import {
  getServerBestSellers,
  getServerNewArrivals,
  getServerHomepageProducts,
  getServerAllCategories,
  getServerAllBrands,
} from '@/lib/db/serverCatalog';
import { getHomepageAnimationsSettings } from '@/lib/db/repositories/siteUiSettings';
import { getActiveDealsFromDb } from '@/lib/db/repositories/deals';
import { getDeals, isDealCurrentlyActive } from '@/lib/db/deals';
import { readPersistentLocations } from '@/lib/db/locationStorage';

export const revalidate = 60; // 60-second ISR safety net for admin updates

export default async function HomePage() {
  const [heroVideosRes, newArrivals, allCategories, allBrands, homepageDeals, animSettingsRes, activeLocation] = await Promise.all([
    (async () => {
      let list: HomepageVideo[] = [];
      if (isDbConfigured()) {
        try {
          list = await getActiveHomepageVideosFromDb();
        } catch (err) {
          console.error('[HomePage] getActiveHomepageVideosFromDb error:', err);
          list = readPersistentHomepageVideos();
        }
      } else {
        list = readPersistentHomepageVideos();
      }
      return Array.isArray(list) ? list : [];
    })(),
    getServerNewArrivals(8),
    getServerAllCategories(),
    getServerAllBrands(true),
    (async () => {
      if (isDbConfigured()) {
        try {
          const dbDeals = await getActiveDealsFromDb();
          return dbDeals.filter((d) => d && d.showOnHomepage);
        } catch (err: any) {
          if (!err?.message?.includes("doesn't exist") && err?.code !== 'ER_NO_SUCH_TABLE') {
            console.warn('[HomePage] DB deals error:', err);
          }
        }
      }
      return getDeals().filter((d) => d && d.status === 'active' && d.showOnHomepage && isDealCurrentlyActive(d));
    })(),
    getHomepageAnimationsSettings().catch((err) => {
      console.error('[HomePage] getHomepageAnimationsSettings error:', err);
      return null;
    }),
    (async () => {
      try {
        const locations = readPersistentLocations();
        return locations.find((l) => l.isActive) || null;
      } catch {
        return null;
      }
    })(),
  ]);

  const newArrivalIds = newArrivals.map((p) => p.id);
  const bestSellers = await getServerBestSellers(8, newArrivalIds);
  const excludedProductIds = [...newArrivalIds, ...bestSellers.map((p) => p.id)];
  const homepageData = await getServerHomepageProducts(8, excludedProductIds);

  const activeHeroVideos = heroVideosRes
    .filter((v) => {
      if (!v) return false;
      const isActive =
        (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') &&
        v.active !== false &&
        (v.active as any) !== 0 &&
        (v.active as any) !== '0';
      return Boolean(isActive && v.url && v.url.trim());
    })
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
    .map((v) => ({
      ...v,
      blurDataUrl: v.blurDataUrl || DEFAULT_HERO_BLUR_DATA_URL,
      mobileBlurDataUrl: v.mobileBlurDataUrl || v.blurDataUrl || DEFAULT_HERO_BLUR_DATA_URL,
    }));

  const homepageSettings = getMergedHomepageSettings();
  const heroSettings = homepageSettings.hero;
  const showHeroText = Boolean(heroSettings?.showText === true);

  const sections = (homepageSettings.sections && homepageSettings.sections.length > 0
    ? homepageSettings.sections
    : getCanonicalHomepageSections())
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'hero':
        return <HeroSection key="hero" initialVideos={activeHeroVideos} showText={showHeroText} />;
      case 'trust':
        return <TrustBenefitsBar key="trust" initialBenefits={homepageSettings.trustBenefits} />;
      case 'categories':
        return (
          <ShopByCategories
            key="categories"
            initialCategories={allCategories}
            settings={animSettingsRes?.settings?.categories}
          />
        );
      case 'brands':
        return (
          <ShopByBrands
            key="brands"
            initialBrands={allBrands}
            settings={animSettingsRes?.settings?.brands}
          />
        );
      case 'new-arrivals':
        if (!newArrivals || newArrivals.length === 0) return null;
        return <NewArrivals key="new-arrivals" initialProducts={newArrivals} />;
      case 'best-sellers':
        if (!bestSellers || bestSellers.length === 0) return null;
        return <BestSellers key="best-sellers" initialProducts={bestSellers} />;
      case 'deals':
      case 'promo-banners':
        if (homepageDeals.length === 0) return null;
        return <DealsSection key="deals" initialDeals={homepageDeals} />;
      case 'all-products':
        return (
          <AllProductsSection
            key="all-products"
            initialProducts={homepageData.products}
            initialTotal={homepageData.total}
            initialCategories={allCategories}
            excludedProductIds={excludedProductIds}
          />
        );
      case 'final-trust':
        return <FinalTrustBar key="final-trust" initialLocation={activeLocation} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <HomePageClientSync />
      {sections.map((s) => renderSection(s.id))}
    </div>
  );
}
