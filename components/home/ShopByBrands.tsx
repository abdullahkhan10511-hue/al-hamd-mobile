'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { getActiveBrands, syncBrandsFromApi } from '@/lib/db/brands';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { Brand } from '@/types/admin';
import { Product } from '@/types';

export function ShopByBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isTouchingRef = useRef(false);

  const loadData = useCallback(async () => {
    const raw = getActiveBrands();
    setBrands(raw);

    const prods = getProducts().filter(
      (p) =>
        (p as any).status !== 'archived' &&
        (p as any).status !== 'inactive' &&
        (p as any).isActive !== false
    );
    setProducts(prods);
  }, []);

  useEffect(() => {
    loadData();
    syncBrandsFromApi().then(() => loadData()).catch(() => {});
    syncProductsFromApi().then(() => loadData()).catch(() => {});

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'brands' && key !== 'products') return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [loadData]);

  // Compute live product counts per brand
  const getProductCount = useCallback((brand: Brand): number => {
    const bName = brand.name.toLowerCase().trim();
    const bSlug = brand.slug.toLowerCase().trim();
    const bId = brand.id.toLowerCase().trim();

    const count = products.filter((p) => {
      const pBrand = (p.brand || '').trim().toLowerCase();
      const pSlug = (p.brandSlug || '').trim().toLowerCase();
      const pId = ((p as any).brandId || '').toString().trim().toLowerCase();
      return (
        pBrand === bName ||
        pSlug === bSlug ||
        pBrand === bSlug ||
        pSlug === bName ||
        (pId && (pId === bId || pId === bSlug || pId === bName))
      );
    }).length;

    return count > 0 ? count : (brand.productCount || 0);
  }, [products]);

  // Smooth relaxed auto-glide animation matching ShopByCategories
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || brands.length === 0) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    const speed = 25; // Smooth slow glide
    let direction: 'forward' | 'backward' = 'forward';

    const step = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (!isPaused && !isTouchingRef.current && container) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (maxScroll > 15) {
          if (direction === 'forward') {
            container.scrollLeft += speed * delta;
            if (container.scrollLeft >= maxScroll - 2) {
              direction = 'backward';
            }
          } else {
            container.scrollLeft -= speed * delta * 1.5;
            if (container.scrollLeft <= 2) {
              direction = 'forward';
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, brands.length]);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -280, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 280, behavior: 'smooth' });
    }
  };

  if (brands.length === 0) {
    return null;
  }

  return (
    <section id="brands" className="py-14 sm:py-18 bg-neutral-50/70 border-b border-neutral-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with Left / Right Navigation Controls */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950">
              Shop by Brand
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/brands"
              className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-950 transition-colors mr-2 hidden sm:inline-flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={scrollLeft}
              className="w-8 h-8 rounded-full border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center text-neutral-700 transition-colors cursor-pointer shadow-2xs"
              aria-label="Previous brands"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={scrollRight}
              className="w-8 h-8 rounded-full border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center text-neutral-700 transition-colors cursor-pointer shadow-2xs"
              aria-label="Next brands"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Strip Container */}
      <div className="relative w-full">
        {/* Left & Right gradient edge fade masks */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-r from-neutral-50/90 via-neutral-50/50 to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-l from-neutral-50/90 via-neutral-50/50 to-transparent z-10" />

        {/* Scrollable / Touch-drag container */}
        <div
          ref={scrollRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => {
            isTouchingRef.current = false;
            setIsPaused(false);
          }}
          onTouchStart={() => {
            isTouchingRef.current = true;
            setIsPaused(true);
          }}
          onTouchEnd={() => {
            isTouchingRef.current = false;
            setTimeout(() => setIsPaused(false), 600);
          }}
          className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none py-3 px-4 sm:px-8 cursor-grab active:cursor-grabbing select-none"
          style={{ scrollBehavior: 'smooth' }}
        >
          {brands.map((brand) => {
            const count = getProductCount(brand);
            return (
              <Link
                key={brand.id}
                href={`/brand/${brand.slug}`}
                className="group relative shrink-0 w-44 sm:w-56 md:w-60 rounded-2xl sm:rounded-3xl overflow-hidden bg-white border border-neutral-200/90 hover:border-neutral-900 shadow-xs hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 block text-neutral-900"
              >
                {/* Brand Showcase Area */}
                <div className="relative aspect-[16/10] w-full p-3 sm:p-4 flex items-center justify-center bg-gradient-to-b from-neutral-50/70 to-white overflow-hidden border-b border-neutral-100">
                  {brand.logo ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={brand.logo}
                        alt={brand.name}
                        loading="lazy"
                        className="w-auto h-auto max-h-[68px] sm:max-h-[84px] max-w-[82%] sm:max-w-[85%] object-contain transition-transform duration-500 ease-out group-hover:scale-105 filter drop-shadow-2xs"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-900 text-white font-extrabold text-xl sm:text-2xl tracking-tight shadow-sm group-hover:scale-105 transition-transform duration-500">
                      {brand.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Top Right Product Count Pill */}
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200/80 text-[10px] font-bold text-neutral-600 group-hover:bg-neutral-900 group-hover:text-white group-hover:border-neutral-900 transition-colors z-10 pointer-events-none">
                    {count} {count === 1 ? 'item' : 'items'}
                  </div>
                </div>

                {/* Text Content */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 group-hover:text-neutral-900 transition-colors block">
                      Brand
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      Verified
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold tracking-tight text-neutral-950 line-clamp-1 mt-0.5 group-hover:text-neutral-900">
                    {brand.name}
                  </h3>

                  <p className="text-[11px] text-neutral-500 line-clamp-1 mt-1 font-normal">
                    {brand.description || `Official ${brand.name} accessories`}
                  </p>

                  <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs font-semibold text-neutral-700 group-hover:text-neutral-950 transition-colors">
                    <span>Explore Products</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
