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

const CategoryCard = React.memo(function CategoryCard({
  category,
  isFailed,
  onError,
  tabIndex,
  'aria-hidden': ariaHiddenAttr,
}: {
  category: Category;
  isFailed: boolean;
  onError: (id: string) => void;
  tabIndex?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
}) {
  const isAriaHidden = Boolean(ariaHiddenAttr === true || ariaHiddenAttr === 'true');
  const rawImage =
    !isFailed && category.image && typeof category.image === 'string' && category.image.trim()
      ? category.image.trim()
      : getCategoryPlaceholder(category.slug || category.name, category.name);

  return (
    <div className="shrink-0 w-44 sm:w-56 md:w-60" aria-hidden={isAriaHidden ? 'true' : undefined}>
      <Tilt3D maxTilt={4} perspective={800} glare={false} scaleOnHover={1.01}>
        <Link
          href={`/category/${category.slug}`}
          tabIndex={tabIndex}
          aria-hidden={isAriaHidden ? 'true' : undefined}
          className="group relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-200/80 hover:border-neutral-900 shadow-xs hover:shadow-xl transition-all duration-300 block"
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
      </Tilt3D>
    </div>
  );
});

export function ShopByCategories({ initialCategories }: { initialCategories?: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(() => {
    if (Array.isArray(initialCategories)) {
      return deduplicateCategoriesById(initialCategories.filter(isCategoryActive));
    }
    return deduplicateCategoriesById(getActiveCategories());
  });
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const applyCategories = useCallback((nextList: Category[]) => {
    const clean = deduplicateCategoriesById(nextList.filter(isCategoryActive));
    setCategories((prev) => {
      if (
        prev.length === clean.length &&
        prev.every(
          (c, i) =>
            c.id === clean[i].id &&
            c.name === clean[i].name &&
            c.slug === clean[i].slug &&
            c.image === clean[i].image &&
            c.status === clean[i].status
        )
      ) {
        return prev;
      }
      return clean;
    });
  }, []);

  const loadData = useCallback(() => {
    applyCategories(getActiveCategories());
  }, [applyCategories]);

  useEffect(() => {
    let mounted = true;
    if (!Array.isArray(initialCategories)) {
      loadData();
    }

    syncCategoriesFromApi()
      .then((synced) => {
        if (!mounted) return;
        if (hasCompletedCategoryApiSync()) {
          applyCategories(synced);
        } else if (!Array.isArray(initialCategories)) {
          loadData();
        }
      })
      .catch(() => {});

    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.key !== 'categories') return;
      if (Array.isArray(detail?.value)) {
        applyCategories(detail.value);
      } else {
        loadData();
      }
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('alhamd:data-updated', handleUpdate);
    };
  }, [initialCategories, applyCategories, loadData]);

  const handleImageError = useCallback((categoryId: string) => {
    setFailedImages((prev) => {
      if (prev.has(categoryId)) return prev;
      const next = new Set(prev);
      next.add(categoryId);
      return next;
    });
  }, []);

  if (categories.length === 0) {
    return null;
  }

  const categoryCards = categories.map((cat) => (
    <CategoryCard
      key={cat.id}
      category={cat}
      isFailed={failedImages.has(cat.id)}
      onError={handleImageError}
    />
  ));

  return (
    <section id="categories" className="py-12 sm:py-16 bg-white border-b border-neutral-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Browse Collections
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 mt-1">
              Shop by Category
            </h2>
          </div>
          <div>
            <Link
              href="/categories"
              className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-950 transition-colors inline-flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Continuous CSS Marquee Container (Right-to-Left) */}
      <div className="relative w-full">
        <Marquee
          items={categoryCards}
          direction="rtl"
          ariaLabel="Shop by Category list"
          className="py-2 px-4 sm:px-8"
          gapClassName="gap-4 sm:gap-5 pr-4 sm:pr-5"
        />
      </div>
    </section>
  );
}
