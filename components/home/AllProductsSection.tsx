'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Layers } from 'lucide-react';
import { getProducts, getCanonicalProducts, syncProductsFromApi } from '@/lib/db/products';
import { getActiveCategories, getCanonicalCategories, syncCategoriesFromApi, deduplicateCategoriesById } from '@/lib/db/categories';
import { ProductCard } from '@/components/products/ProductCard';
import { Product, Category } from '@/types';

type ProductItem = Product & { status?: string; isActive?: boolean };

export function AllProductsSection() {
  const [products, setProducts] = useState<Product[]>(() => getCanonicalProducts());
  const [categories, setCategories] = useState<Category[]>(() => getCanonicalCategories());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(12);
  const [isLoaded, setIsLoaded] = useState(true);

  const loadData = React.useCallback(() => {
    const allProds = getProducts().filter((p) => {
      const item = p as ProductItem;
      return item.status !== 'archived' && item.status !== 'inactive' && item.isActive !== false;
    });
    setProducts(allProds);

    const cats = deduplicateCategoriesById(getActiveCategories());
    setCategories(cats);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    loadData();
    Promise.all([
      syncProductsFromApi().catch(() => {}),
      syncCategoriesFromApi().catch(() => {}),
    ]).then(() => {
      loadData();
    });

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && !['products', 'categories'].includes(key)) return;
      loadData();
    };

    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [loadData]);

  const handleSelectCategory = (slug: string) => {
    setSelectedCategory(slug);
    setVisibleCount(12);
  };

  // Filter products by selected category pill and sort Price: High to Low by default
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory !== 'all') {
      const target = selectedCategory.toLowerCase().trim();
      list = products.filter(
        (p) =>
          p.categorySlug?.toLowerCase() === target ||
          p.category?.toLowerCase() === target
      );
    }
    // Default sort: Price High to Low (numeric)
    return [...list].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  }, [products, selectedCategory]);

  // Show products up to visibleCount
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const hasMore = visibleCount < filteredProducts.length;

  // Top active categories for quick filter pills (categories with actual products)
  const filterPills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const key = p.categorySlug || p.category;
      if (key) {
        counts.set(key.toLowerCase(), (counts.get(key.toLowerCase()) || 0) + 1);
      }
    }

    const availableCats = categories.filter(
      (c) => (counts.get(c.slug.toLowerCase()) || 0) > 0 || (counts.get(c.name.toLowerCase()) || 0) > 0
    );

    return [
      { id: 'all', name: 'All Products', slug: 'all' },
      ...availableCats.slice(0, 6),
    ];
  }, [categories, products]);

  if (!isLoaded) {
    return (
      <section className="py-16 sm:py-20 bg-neutral-50/50 border-b border-neutral-100 min-h-[460px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8 sm:mb-10">
            <div>
              <div className="h-3 w-28 bg-neutral-200/80 rounded-full animate-pulse mb-2" />
              <div className="h-7 w-48 bg-neutral-200/80 rounded-lg animate-pulse" />
            </div>
            <div className="h-4 w-32 bg-neutral-200/60 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5 sm:gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-neutral-200/60 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-16 sm:py-20 bg-neutral-50/50 border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
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
            className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors self-start sm:self-auto"
          >
            <span>View All Products</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Quick Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 sm:mb-8 scrollbar-none no-scrollbar">
          {filterPills.map((pill) => {
            const isActive = selectedCategory === pill.slug;
            return (
              <button
                key={pill.id || pill.slug}
                type="button"
                onClick={() => handleSelectCategory(pill.slug)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
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

        {/* Product Cards Grid: 2 cols on mobile, 3 on tablet, 4 on desktop, 6 on extra-large screens */}
        {displayedProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5 sm:gap-5">
            {displayedProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '60px' }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.08) }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center bg-white rounded-2xl border border-neutral-200/80 p-8">
            <p className="text-sm text-neutral-500">No products found in this category.</p>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="mt-3 text-xs font-semibold text-neutral-900 underline hover:text-neutral-600"
            >
              Show All Products
            </button>
          </div>
        )}

        {/* Load More & Bottom CTA */}
        <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 12)}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 font-semibold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-xs hover:shadow-sm cursor-pointer active:scale-[0.99] w-full sm:w-auto"
            >
              <span>Load More Products</span>
              <Layers className="w-4 h-4 text-neutral-500" />
            </button>
          )}

          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99] w-full sm:w-auto"
          >
            <span>Browse Full Catalog ({products.length} Products)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
