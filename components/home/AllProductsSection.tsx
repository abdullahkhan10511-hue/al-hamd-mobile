'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Layers, Loader2 } from 'lucide-react';
import { getCanonicalCategories, deduplicateCategoriesById } from '@/lib/db/categories';
import { ProductCard } from '@/components/products/ProductCard';
import { Reveal3D } from '@/components/ui/motion/Reveal3D';
import { isStorefrontVisibleProduct } from '@/lib/utils';
import { Product, Category } from '@/types';
import {
  getSavedListingState,
  saveListingState,
} from '@/lib/scrollRestoration';

const PAGE_SIZE = 8;

interface AllProductsSectionProps {
  initialProducts?: Product[];
  initialTotal?: number;
  initialCategories?: Category[];
  excludedProductIds?: string[];
}

export function AllProductsSection({
  initialProducts,
  initialTotal,
  initialCategories,
  excludedProductIds = [],
}: AllProductsSectionProps) {
  const excludedSet = useMemo(() => new Set(excludedProductIds), [excludedProductIds]);

  const savedState = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getSavedListingState('/');
  }, []);

  const [products, setProducts] = useState<Product[]>(() => {
    if (Array.isArray(initialProducts)) {
      return initialProducts
        .filter((p) => isStorefrontVisibleProduct(p) && !excludedSet.has(p.id))
        .slice(0, PAGE_SIZE);
    }
    return [];
  });

  const [totalCount, setTotalCount] = useState<number>(() => {
    if (initialTotal !== undefined) return initialTotal;
    if (Array.isArray(initialProducts)) return initialProducts.length;
    return 0;
  });

  const [categories] = useState<Category[]>(() => {
    if (initialCategories && initialCategories.length > 0) {
      return deduplicateCategoriesById(initialCategories);
    }
    return getCanonicalCategories();
  });

  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => savedState?.selectedCategory || 'all'
  );
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isSwitchingCategory, setIsSwitchingCategory] = useState<boolean>(false);
  const initialShownCount = initialProducts?.length ?? 0;
  const initialTotalCount = initialTotal ?? initialShownCount;
  const apiPageRef = useRef<number>(1);
  const bufferRef = useRef<Product[]>([]);
  const exhaustedRef = useRef<boolean>(initialShownCount >= initialTotalCount);

  // Keep scroll/filter state saved
  useEffect(() => {
    saveListingState('/', {
      visibleCount: products.length,
      selectedCategory,
    });
  }, [products.length, selectedCategory]);

  const fetchFilteredChunk = async (
    slug: string,
    targetCount: number,
    startApiPage: number,
    alreadyShownIds: Set<string>,
    existingBuffer: Product[]
  ): Promise<{
    nextItems: Product[];
    remainingBuffer: Product[];
    lastApiPage: number;
    apiTotal: number;
    exhausted: boolean;
  }> => {
    const collected = [...existingBuffer];
    const seen = new Set(alreadyShownIds);
    for (const item of collected) seen.add(item.id);

    let currentPage = startApiPage;
    let apiTotal = totalCount;
    let exhausted = exhaustedRef.current;

    while (collected.length < targetCount && !exhausted) {
      const url =
        slug === 'all'
          ? `/api/products?page=${currentPage}&limit=24&minimal=true`
          : `/api/products?category=${encodeURIComponent(slug)}&page=${currentPage}&limit=24&minimal=true`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data || !Array.isArray(data.products)) {
        exhausted = true;
        break;
      }
      apiTotal = typeof data.total === 'number' ? data.total : data.products.length;
      if (data.products.length === 0) {
        exhausted = true;
        break;
      }
      for (const item of data.products as Product[]) {
        if (
          isStorefrontVisibleProduct(item) &&
          !excludedSet.has(item.id) &&
          !seen.has(item.id)
        ) {
          seen.add(item.id);
          collected.push(item);
        }
      }
      if (currentPage * 24 >= apiTotal || data.products.length < 24) {
        exhausted = true;
      } else {
        currentPage += 1;
      }
    }

    return {
      nextItems: collected.slice(0, targetCount),
      remainingBuffer: collected.slice(targetCount),
      lastApiPage: currentPage,
      apiTotal,
      exhausted,
    };
  };

  const handleSelectCategory = async (slug: string) => {
    setSelectedCategory(slug);
    setIsSwitchingCategory(true);
    apiPageRef.current = 1;
    bufferRef.current = [];
    exhaustedRef.current = false;

    try {
      const result = await fetchFilteredChunk(slug, PAGE_SIZE, 1, new Set(), []);
      setProducts(result.nextItems);
      bufferRef.current = result.remainingBuffer;
      apiPageRef.current = result.lastApiPage;
      exhaustedRef.current = result.exhausted;
      setTotalCount(
        slug === 'all'
          ? Math.max(result.nextItems.length, result.apiTotal - excludedSet.size)
          : Math.max(result.nextItems.length, result.apiTotal)
      );
    } catch {
      // ignore transient network errors
    } finally {
      setIsSwitchingCategory(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const shownIds = new Set(products.map((p) => p.id));
      const startPage = apiPageRef.current === 1 && bufferRef.current.length === 0 ? 1 : apiPageRef.current + 1;

      const result = await fetchFilteredChunk(
        selectedCategory,
        PAGE_SIZE,
        startPage,
        shownIds,
        bufferRef.current
      );
      if (result.nextItems.length > 0) {
        setProducts((prev) => {
          const prevIds = new Set(prev.map((p) => p.id));
          return [...prev, ...result.nextItems.filter((p) => !prevIds.has(p.id))];
        });
      }
      bufferRef.current = result.remainingBuffer;
      apiPageRef.current = result.lastApiPage;
      exhaustedRef.current = result.exhausted;
    } catch {
      // ignore transient errors
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasMore =
    bufferRef.current.length > 0 ||
    (!exhaustedRef.current &&
      (selectedCategory !== 'all' || products.length < totalCount));

  const filterPills = useMemo(() => {
    return [
      { id: 'all', name: 'All Products', slug: 'all' },
      ...categories.slice(0, 6),
    ];
  }, [categories]);

  if (selectedCategory === 'all' && products.length === 0 && !isSwitchingCategory) {
    return null;
  }

  return (
    <section className="py-12 sm:py-16 bg-neutral-50/50 border-b border-neutral-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <Reveal3D className="mb-6 sm:mb-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Explore Our Collection
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 mt-1">
                All Products
              </h2>
            </div>

            <Link
              href="/shop"
              className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors shrink-0"
            >
              <span>View all products</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </Reveal3D>

        {/* Quick Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 sm:mb-8 scrollbar-none no-scrollbar">
          {filterPills.map((pill) => {
            const isActive = selectedCategory === pill.slug;
            return (
              <button
                key={pill.id || pill.slug}
                type="button"
                onClick={() => handleSelectCategory(pill.slug)}
                className={`px-4 py-2 rounded-full text-xs font-semibold btn-motion-depth transition-all shrink-0 cursor-pointer border ${
                  isActive
                    ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs'
                    : 'bg-white text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100/80 border-neutral-200'
                }`}
              >
                {pill.name}
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid with 40ms stagger */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-5">
            {products.map((product, index) => (
              <Reveal3D key={product.id} delayMs={index * 40} className="h-full">
                <ProductCard product={product} />
              </Reveal3D>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center bg-white rounded-2xl border border-neutral-200/80 p-8">
            <p className="text-sm text-neutral-500">
              {isSwitchingCategory ? 'Loading products...' : 'No more products in this category.'}
            </p>
            {!isSwitchingCategory && (
              <button
                type="button"
                onClick={() => handleSelectCategory('all')}
                className="mt-3 text-xs font-semibold text-neutral-900 underline hover:text-neutral-600 cursor-pointer"
              >
                Show All Products
              </button>
            )}
          </div>
        )}

        {/* Load More Inside Section */}
        {hasMore && (
          <div className="mt-10 sm:mt-12 flex items-center justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 font-semibold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-xs hover:shadow-sm cursor-pointer active:scale-[0.99] w-full sm:w-auto disabled:opacity-50"
            >
              <span>{isLoadingMore ? 'Loading...' : 'Load More'}</span>
              {isLoadingMore ? (
                <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
              ) : (
                <Layers className="w-4 h-4 text-neutral-500" />
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
