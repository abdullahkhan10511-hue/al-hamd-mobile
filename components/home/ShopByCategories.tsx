'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  getActiveCategories,
  isCategoryActive,
  syncCategoriesFromApi,
  hasCompletedCategoryApiSync,
  deduplicateCategoriesById,
} from '@/lib/db/categories';
import { Category } from '@/types';
import { getCategoryPlaceholder } from '@/lib/placeholders';
import { Marquee } from '@/components/ui/Marquee';
import { Tilt3D } from '@/components/ui/motion/Tilt3D';
import {
  MarqueeSectionSettings,
  DEFAULT_HOMEPAGE_ANIMATIONS,
} from '@/lib/db/siteUiSettings';

const CategoryCard = React.memo(function CategoryCard({
  category,
  isFailed,
  onError,
  tabIndex,
  'aria-hidden': ariaHiddenAttr,
  hoverEffect = 'tilt',
}: {
  category: Category;
  isFailed: boolean;
  onError: (id: string) => void;
  tabIndex?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
  hoverEffect?: 'tilt' | 'lift' | 'none';
}) {
  const isAriaHidden = Boolean(ariaHiddenAttr === true || ariaHiddenAttr === 'true');
  const rawImage =
    !isFailed && category.image && typeof category.image === 'string' && category.image.trim()
      ? category.image.trim()
      : getCategoryPlaceholder(category.slug || category.name, category.name);

  const cardLink = (
    <Link
      href={`/category/${category.slug}`}
      tabIndex={tabIndex}
      aria-hidden={isAriaHidden ? 'true' : undefined}
      className={`group relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-200/80 hover:border-neutral-900 shadow-xs block ${
        hoverEffect === 'lift'
          ? 'hover:-translate-y-1 hover:shadow-xl transition-all duration-300'
          : hoverEffect === 'tilt'
          ? 'hover:shadow-xl transition-all duration-300'
          : 'transition-colors'
      }`}
    >
      {/* Category Image */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
        <Image
          src={rawImage}
          alt={category.name}
          fill
          unoptimized={
            rawImage.startsWith('http://') ||
            rawImage.startsWith('https://') ||
            rawImage.toLowerCase().endsWith('.svg') ||
            rawImage.startsWith('data:')
          }
          sizes="(max-width: 640px) 176px, (max-width: 768px) 224px, 240px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          onError={() => onError(category.id)}
        />
        {/* Gradient Shading */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/30 to-transparent transition-opacity group-hover:opacity-95" />

        {/* Text Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 group-hover:text-amber-400 transition-colors block">
            Category
          </span>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-white line-clamp-1 mt-0.5">
            {category.name}
          </h3>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-300 font-semibold group-hover:text-white transition-colors">
            <span>Shop Collection</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="shrink-0 w-44 sm:w-56 md:w-60" aria-hidden={isAriaHidden ? 'true' : undefined}>
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

export function ShopByCategories({
  initialCategories,
  settings: propSettings,
}: {
  initialCategories?: Category[];
  settings?: MarqueeSectionSettings;
}) {
  const [categories, setCategories] = useState<Category[]>(() => {
    if (Array.isArray(initialCategories)) {
      return deduplicateCategoriesById(initialCategories.filter(isCategoryActive));
    }
    return deduplicateCategoriesById(getActiveCategories());
  });
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<MarqueeSectionSettings>(
    propSettings || DEFAULT_HOMEPAGE_ANIMATIONS.categories
  );

  useEffect(() => {
    if (propSettings) {
      setSettings(propSettings);
    }
  }, [propSettings]);

  const applyCategories = useCallback((nextList: Category[]) => {
    const clean = deduplicateCategoriesById(nextList.filter(isCategoryActive));
    setCategories((prev) => {
      if (
        prev.length === clean.length &&
        prev.every((p, i) => p.id === clean[i]?.id && p.name === clean[i]?.name)
      ) {
        return prev;
      }
      return clean;
    });
  }, []);

  useEffect(() => {
    if (!hasCompletedCategoryApiSync()) {
      syncCategoriesFromApi()
        .then((fetched) => {
          if (Array.isArray(fetched) && fetched.length > 0) {
            applyCategories(fetched);
          }
        })
        .catch(() => {});
    }
  }, [applyCategories]);

  useEffect(() => {
    const handleStorageChange = () => {
      applyCategories(getActiveCategories());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [applyCategories]);

  const handleImageError = useCallback((id: string) => {
    setFailedImages((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  if (!categories || categories.length === 0) {
    return null;
  }

  const categoryCards = categories.map((cat) => (
    <CategoryCard
      key={cat.id}
      category={cat}
      isFailed={failedImages.has(cat.id)}
      onError={handleImageError}
      hoverEffect={settings.cardHover}
    />
  ));

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-neutral-50/60 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-400 block mb-1">
            Collections
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
            Shop by Category
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-xl">
            Explore premium equipment, genuine spare parts, and tools tailored for every project.
          </p>
        </div>
        <Link
          href="/categories"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-neutral-900 hover:text-neutral-600 transition-colors group shrink-0"
        >
          <span>View All Categories</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <div className="w-full">
        <Marquee
          items={categoryCards}
          style={settings.style}
          direction={settings.direction}
          speed={settings.speedSeconds}
          stepSeconds={settings.stepSeconds}
          pauseOnHover={settings.pauseOnHover}
          edgeFade={settings.edgeFade}
          ariaLabel="Featured product categories"
          gapClassName="gap-4 sm:gap-6 pr-4 sm:pr-6"
        />
      </div>
    </section>
  );
}
