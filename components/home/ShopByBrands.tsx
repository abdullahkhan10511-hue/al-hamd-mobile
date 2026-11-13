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

const BrandCard = React.memo(function BrandCard({
  brand,
  isFailed,
  onError,
  tabIndex,
  ariaHidden,
  'aria-hidden': ariaHiddenAttr,
}: {
  brand: Brand;
  isFailed: boolean;
  onError: (id: string) => void;
  tabIndex?: number;
  ariaHidden?: boolean | 'true' | 'false';
  'aria-hidden'?: boolean | 'true' | 'false';
}) {
  const count = brand.productCount ?? 0;
  const hasValidLogo = Boolean(brand.logo && !isFailed);
  const isAriaHidden = Boolean(
    ariaHidden === true || ariaHidden === 'true' || ariaHiddenAttr === true || ariaHiddenAttr === 'true'
  );

  return (
    <div className="shrink-0 w-44 sm:w-52 md:w-56" aria-hidden={isAriaHidden ? 'true' : undefined}>
      <Tilt3D maxTilt={4} perspective={800} glare={false} scaleOnHover={1.01}>
        <Link
          href={`/brand/${brand.slug}`}
          tabIndex={tabIndex}
          aria-hidden={isAriaHidden ? 'true' : undefined}
          className="group relative w-full rounded-2xl overflow-hidden bg-white border border-neutral-200/90 hover:border-neutral-900 shadow-xs hover:shadow-lg transition-all duration-200 block text-neutral-900"
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
      </Tilt3D>
    </div>
  );
});

export function ShopByBrands() {
  const [brands, setBrands] = useState<Brand[]>(() => getCanonicalBrands());
  const [isLoaded, setIsLoaded] = useState(true);
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());

  const loadData = useCallback(() => {
    const raw = getActiveBrands();
    setBrands((prev) => {
      if (
        prev.length === raw.length &&
        prev.every(
          (b, i) =>
            b.id === raw[i].id &&
            b.productCount === raw[i].productCount &&
            b.name === raw[i].name &&
            b.logo === raw[i].logo
        )
      ) {
        return prev;
      }
      return raw;
    });
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    loadData();
    syncBrandsFromApi().then(() => loadData()).catch(() => {});

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'brands') return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [loadData]);

  const handleLogoError = useCallback((brandId: string) => {
    setFailedLogos((prev) => {
      if (prev.has(brandId)) return prev;
      const next = new Set(prev);
      next.add(brandId);
      return next;
    });
  }, []);

  if (!isLoaded) {
    return (
      <section
        id="brands"
        className="py-12 sm:py-16 bg-neutral-50/70 border-b border-neutral-100 overflow-hidden min-h-[280px]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="h-7 w-48 bg-neutral-200/80 rounded-lg animate-pulse" />
            <div className="h-4 w-20 bg-neutral-200/60 rounded-full animate-pulse" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-[160px] sm:w-[200px] h-[220px] shrink-0 bg-neutral-200/60 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const rawBrandList = brands.length > 0 ? brands : seedBrands.filter((b) => b.status === 'active');
  const nonZeroBrands = rawBrandList.filter((b) => (b.productCount ?? 0) > 0);
  const displayBrands = nonZeroBrands.length > 0 ? nonZeroBrands : rawBrandList;

  if (displayBrands.length === 0) {
    return null;
  }

  const brandCards = displayBrands.map((brand) => (
    <BrandCard
      key={brand.id}
      brand={brand}
      isFailed={failedLogos.has(brand.id)}
      onError={handleLogoError}
    />
  ));

  return (
    <section id="brands" className="py-12 sm:py-16 bg-neutral-50/70 border-b border-neutral-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Popular Brands
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 mt-1">
              Shop by Brand
            </h2>
          </div>
          <div>
            <Link
              href="/brands"
              className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-950 transition-colors inline-flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Continuous CSS Marquee Container */}
      <div className="relative w-full">
        <Marquee
          items={brandCards}
          direction="ltr"
          ariaLabel="Shop by Brand list"
          className="py-2 px-4 sm:px-8"
          gapClassName="gap-4 sm:gap-5 pr-4 sm:pr-5"
        />
      </div>
    </section>
  );
}
