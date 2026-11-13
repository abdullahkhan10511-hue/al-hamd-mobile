'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getActiveBrands, getCanonicalBrands, syncBrandsFromApi } from '@/lib/db/brands';
import { seedBrands } from '@/lib/db/seed';
import { Brand } from '@/types/admin';
import { Marquee } from '@/components/ui/Marquee';
import { Tilt3D } from '@/components/ui/motion/Tilt3D';
import {
  MarqueeSectionSettings,
  DEFAULT_HOMEPAGE_ANIMATIONS,
} from '@/lib/db/siteUiSettings';

const BrandCard = React.memo(function BrandCard({
  brand,
  isFailed,
  onError,
  tabIndex,
  ariaHidden,
  'aria-hidden': ariaHiddenAttr,
  hoverEffect = 'tilt',
}: {
  brand: Brand;
  isFailed: boolean;
  onError: (id: string) => void;
  tabIndex?: number;
  ariaHidden?: boolean | 'true' | 'false';
  'aria-hidden'?: boolean | 'true' | 'false';
  hoverEffect?: 'tilt' | 'lift' | 'none';
}) {
  const count = brand.productCount ?? 0;
  const hasValidLogo = Boolean(brand.logo && !isFailed);
  const isAriaHidden = Boolean(
    ariaHidden === true || ariaHidden === 'true' || ariaHiddenAttr === true || ariaHiddenAttr === 'true'
  );

  const cardLink = (
    <Link
      href={`/brand/${brand.slug}`}
      tabIndex={tabIndex}
      aria-hidden={isAriaHidden ? 'true' : undefined}
      className={`group relative w-full rounded-2xl overflow-hidden bg-white border border-neutral-200/90 hover:border-neutral-900 shadow-xs block text-neutral-900 ${
        hoverEffect === 'lift'
          ? 'hover:-translate-y-1 hover:shadow-lg transition-all duration-200'
          : hoverEffect === 'tilt'
          ? 'hover:shadow-lg transition-all duration-200'
          : 'transition-colors'
      }`}
    >
      {/* Brand Showcase Area */}
      <div className="relative aspect-[16/10] w-full p-3 sm:p-4 flex items-center justify-center bg-gradient-to-b from-neutral-50/70 to-white overflow-hidden border-b border-neutral-100">
        {hasValidLogo ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <Image
              src={brand.logo!}
              alt={brand.name}
              loading="lazy"
              unoptimized={
                brand.logo!.startsWith('http://') ||
                brand.logo!.startsWith('https://') ||
                brand.logo!.toLowerCase().endsWith('.svg') ||
                brand.logo!.startsWith('data:')
              }
              width={140}
              height={60}
              className="w-auto h-auto max-h-[60px] sm:max-h-[72px] max-w-[80%] object-contain transition-transform duration-300 ease-out group-hover:scale-105 filter drop-shadow-2xs"
              onError={() => onError(brand.id)}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-neutral-900 text-white font-extrabold text-lg sm:text-xl tracking-tight shadow-sm group-hover:scale-105 transition-transform duration-300">
            {brand.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Top Right Product Count Pill */}
        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200/80 text-[10px] font-bold text-neutral-600 group-hover:bg-neutral-900 group-hover:text-white group-hover:border-neutral-900 transition-colors z-10 pointer-events-none">
          {count} {count === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Text Content */}
      <div className="p-3.5 sm:p-4">
        <h3 className="text-sm sm:text-base font-bold tracking-tight text-neutral-950 line-clamp-1 group-hover:text-neutral-900">
          {brand.name}
        </h3>

        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-1 font-normal">
          {brand.description || `Official ${brand.name} accessories`}
        </p>

        <div className="mt-2.5 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs font-semibold text-neutral-700 group-hover:text-neutral-950 transition-colors">
          <span>Explore Products</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );

  return (
    <div className="shrink-0 w-44 sm:w-52 md:w-56" aria-hidden={isAriaHidden ? 'true' : undefined}>
      {hoverEffect === 'tilt' ? (
        <Tilt3D maxTilt={4} perspective={800} glare={false} scaleOnHover={1.01}>
          {cardLink}
        </Tilt3D>
      ) : (
        cardLink
      )}
    </div>
  );
});

export function ShopByBrands({
  settings: propSettings,
}: {
  settings?: MarqueeSectionSettings;
}) {
  const [brands, setBrands] = useState<Brand[]>(() => getCanonicalBrands());
  const [isLoaded, setIsLoaded] = useState(true);
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<MarqueeSectionSettings>(
    propSettings || DEFAULT_HOMEPAGE_ANIMATIONS.brands
  );

  useEffect(() => {
    if (propSettings) {
      setSettings(propSettings);
    }
  }, [propSettings]);

  const loadBrands = useCallback(() => {
    try {
      let loaded = getActiveBrands();
      if (!loaded || loaded.length === 0) {
        loaded = getCanonicalBrands();
      }
      setBrands(loaded);
    } catch {
      setBrands(seedBrands.filter((b) => b.status === 'active'));
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadBrands();
    syncBrandsFromApi()
      .then((apiBrands) => {
        if (Array.isArray(apiBrands) && apiBrands.length > 0) {
          const activeOnly = apiBrands.filter((b) => b.status === 'active');
          setBrands(activeOnly.length > 0 ? activeOnly : apiBrands);
        }
      })
      .catch(() => {});
  }, [loadBrands]);

  useEffect(() => {
    const handleStorageChange = () => {
      loadBrands();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadBrands]);

  const handleLogoError = useCallback((id: string) => {
    setFailedLogos((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  if (!isLoaded || brands.length === 0) {
    return null;
  }

  const brandCards = brands.map((brand) => (
    <BrandCard
      key={brand.id}
      brand={brand}
      isFailed={failedLogos.has(brand.id)}
      onError={handleLogoError}
      hoverEffect={settings.cardHover}
    />
  ));

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-white border-y border-neutral-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-400 block mb-1">
            Authorized Brands
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
            Shop by Brand
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-xl">
            Trusted global manufacturers backed by authentic warranty and full customer support.
          </p>
        </div>
        <Link
          href="/brands"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-neutral-900 hover:text-neutral-600 transition-colors group shrink-0"
        >
          <span>View All Brands</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <div className="w-full">
        <Marquee
          items={brandCards}
          style={settings.style}
          direction={settings.direction}
          speed={settings.speedSeconds}
          stepSeconds={settings.stepSeconds}
          pauseOnHover={settings.pauseOnHover}
          edgeFade={settings.edgeFade}
          ariaLabel="Featured manufacturer brands"
          gapClassName="gap-4 sm:gap-6 pr-4 sm:pr-6"
        />
      </div>
    </section>
  );
}
