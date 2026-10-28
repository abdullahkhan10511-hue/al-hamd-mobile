'use client';

import React, { useState, useEffect } from 'react';
import { HeroSection } from '@/components/home/HeroSection';
import { TrustBenefitsBar } from '@/components/home/TrustBenefitsBar';
import { ShopByCategories } from '@/components/home/ShopByCategories';
import { ShopByBrands } from '@/components/home/ShopByBrands';
import { NewArrivals } from '@/components/home/NewArrivals';
import { BestSellers } from '@/components/home/BestSellers';
import { DealsSection } from '@/components/home/DealsSection';
import { AllProductsSection } from '@/components/home/AllProductsSection';
import { FinalTrustBar } from '@/components/home/FinalTrustBar';
import { getHomepageSections, getCanonicalHomepageSections, syncHomepageSettingsFromApi } from '@/lib/db/homepage';
import { HomepageSection } from '@/types/admin';
import {
  getSavedListingState,
  restoreScrollPosition,
  clearListingReturnFlag,
} from '@/lib/scrollRestoration';

export default function HomePage() {
  const savedState = React.useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getSavedListingState('/');
  }, []);

  const [sections, setSections] = useState<HomepageSection[]>(() => {
    return getCanonicalHomepageSections()
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order);
  });

  const hasRestoredScroll = React.useRef(false);
  useEffect(() => {
    if (!hasRestoredScroll.current && savedState && savedState.scrollY > 0) {
      hasRestoredScroll.current = true;
      restoreScrollPosition(savedState.scrollY, () => {
        clearListingReturnFlag();
      });
    }
  }, [savedState]);

  const loadData = () => {
    const list = getHomepageSections()
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order);
    setSections(list);
  };

  useEffect(() => {
    // Sync any custom stored order and fetch latest API settings post-hydration
    loadData();
    syncHomepageSettingsFromApi().then(() => {
      loadData();
    }).catch(() => {});

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'homepage_sections') return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'hero':
        return <HeroSection key="hero" />;
      case 'trust':
        return <TrustBenefitsBar key="trust" />;
      case 'categories':
        return <ShopByCategories key="categories" />;
      case 'brands':
        return <ShopByBrands key="brands" />;
      case 'new-arrivals':
        return <NewArrivals key="new-arrivals" />;
      case 'best-sellers':
        return <BestSellers key="best-sellers" />;
      case 'deals':
      case 'promo-banners':
        return <DealsSection key="deals" />;
      case 'all-products':
        return <AllProductsSection key="all-products" />;
      case 'final-trust':
        return <FinalTrustBar key="final-trust" />;
      default:
        return null;
    }
  };

  return (
    <div>
      {sections.length > 0
        ? sections.map((s) => renderSection(s.id))
        : (
          // Default fallback matching canonical enabled sections configuration
          getCanonicalHomepageSections()
            .filter((s) => s.enabled)
            .sort((a, b) => a.order - b.order)
            .map((s) => renderSection(s.id))
        )}
    </div>
  );
}
