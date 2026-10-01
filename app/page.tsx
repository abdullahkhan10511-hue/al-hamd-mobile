'use client';

import React, { useState, useEffect } from 'react';
import { HeroSection } from '@/components/home/HeroSection';
import { TrustBenefitsBar } from '@/components/home/TrustBenefitsBar';
import { ShopByCategories } from '@/components/home/ShopByCategories';
import { NewArrivals } from '@/components/home/NewArrivals';
import { BestSellers } from '@/components/home/BestSellers';
import { PromoBanners } from '@/components/home/PromoBanners';
import { FinalTrustBar } from '@/components/home/FinalTrustBar';
import { getHomepageSections } from '@/lib/db/homepage';
import { HomepageSection } from '@/types/admin';

export default function HomePage() {
  const [sections, setSections] = useState<HomepageSection[]>([]);

  const loadData = () => {
    const list = getHomepageSections()
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order);
    setSections(list);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const HOME_KEYS = ['homepage_sections', 'store_settings'];
      if (key && !HOME_KEYS.includes(key)) return;
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
      case 'new-arrivals':
        return <NewArrivals key="new-arrivals" />;
      case 'best-sellers':
        return <BestSellers key="best-sellers" />;
      case 'promo-banners':
        return <PromoBanners key="promo-banners" />;
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
          // Default fallback
          <>
            <HeroSection />
            <TrustBenefitsBar />
            <ShopByCategories />
            <NewArrivals />
            <BestSellers />
            <PromoBanners />
            <FinalTrustBar />
          </>
        )}
    </div>
  );
}
