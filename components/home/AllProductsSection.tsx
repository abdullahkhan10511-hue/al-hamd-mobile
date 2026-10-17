'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Layers } from 'lucide-react';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { getAllProductsConfig } from '@/lib/db/homepage';
import { ProductCard } from '@/components/products/ProductCard';
import { Product } from '@/types';
import { AllProductsConfig } from '@/types/admin';

export function AllProductsSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<AllProductsConfig>(getAllProductsConfig());
  const [isLoaded, setIsLoaded] = useState(false);

  const loadData = () => {
    const currentConfig = getAllProductsConfig();
    setConfig(currentConfig);

    const all = getProducts().filter(
      (p) =>
        (p as any).status !== 'archived' &&
        (p as any).status !== 'inactive' &&
        (p as any).isActive !== false
    );

    // Apply category filter if configured
    let filtered = all;
    if (currentConfig.categoryFilter && currentConfig.categoryFilter !== 'all') {
      const cat = currentConfig.categoryFilter.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.categorySlug?.toLowerCase() === cat ||
          p.category?.toLowerCase() === cat
      );
    }

    // Apply sort order
    const sorted = [...filtered].sort((a, b) => {
      switch (currentConfig.sortBy) {
        case 'newest': {
          const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
          const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
          return dateB - dateA;
        }
        case 'price-asc':
          return (Number(a.price) || 0) - (Number(b.price) || 0);
        case 'price-desc':
          return (Number(b.price) || 0) - (Number(a.price) || 0);
        case 'best-selling':
          return ((b as any).isBestSeller ? 1 : 0) - ((a as any).isBestSeller ? 1 : 0);
        case 'featured':
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      }
    });

    const displayLimit = Math.max(1, currentConfig.limit || 12);
    setProducts(sorted.slice(0, displayLimit));
    setIsLoaded(true);
  };

  useEffect(() => {
    loadData();
    syncProductsFromApi()
      .then(() => loadData())
      .catch(() => {
        setIsLoaded(true);
      });

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const RELEVANT_KEYS = ['products', 'homepage_all_products_config', 'homepage_sections'];
      if (key && !RELEVANT_KEYS.includes(key)) return;
      loadData();
    };

    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  if (!isLoaded) {
    return (
      <section className="py-16 sm:py-20 bg-white border-b border-neutral-100 min-h-[460px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8 sm:mb-10">
            <div>
              <div className="h-3.5 w-24 bg-neutral-200/80 rounded-full animate-pulse mb-2.5" />
              <div className="h-8 w-48 bg-neutral-200/80 rounded-lg animate-pulse" />
            </div>
            <div className="h-4 w-32 bg-neutral-200/60 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-neutral-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  const title = config.title?.trim() || 'All Products';
  const subtitle = config.subtitle?.trim() || 'Explore our complete catalog of mobile accessories';
  const viewAllLink = config.viewAllLink?.trim() || '/shop';
  const viewAllText = config.viewAllText?.trim() || 'View All Products';
  const showViewAll = config.showViewAllButton !== false;

  return (
    <section className="py-16 sm:py-20 bg-white border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1">
              <Layers className="w-3.5 h-3.5 text-neutral-500" />
              <span>Full Collection</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-xl">
                {subtitle}
              </p>
            )}
          </div>

          {showViewAll && (
            <Link
              href={viewAllLink}
              className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors self-start sm:self-auto shrink-0"
            >
              <span>{viewAllText}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        {/* Responsive Grid: 2 cols on mobile, 3 on tablet, 6 on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-5">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4) }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
