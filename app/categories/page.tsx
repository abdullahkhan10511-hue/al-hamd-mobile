'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, ArrowRight, Layers, Package } from 'lucide-react';
import { getActiveCategories, syncCategoriesFromApi, deduplicateCategoriesById } from '@/lib/db/categories';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { Category, Product } from '@/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    setCategories(deduplicateCategoriesById(getActiveCategories()));
    setProducts(
      getProducts().filter(
        (p) =>
          (p as any).status !== 'archived' &&
          (p as any).status !== 'inactive' &&
          (p as any).isActive !== false
      )
    );
  };

  useEffect(() => {
    loadData();
    syncCategoriesFromApi().then(() => loadData()).catch(() => {});
    syncProductsFromApi().then(() => loadData()).catch(() => {});

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Compute live product counts per category
  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((cat) => {
      const count = products.filter(
        (p) =>
          p.categorySlug?.toLowerCase() === cat.slug.toLowerCase() ||
          p.category?.toLowerCase() === cat.name.toLowerCase() ||
          (p as any).categoryId === cat.id
      ).length;
      map.set(cat.id, count > 0 ? count : (cat.productCount || 0));
    });
    return map;
  }, [categories, products]);

  // Filter categories by search input
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        (cat.description && cat.description.toLowerCase().includes(q)) ||
        cat.slug.toLowerCase().includes(q)
    );
  }, [categories, searchQuery]);

  return (
    <div className="bg-white min-h-screen">
      {/* Header Banner */}
      <section className="relative bg-neutral-950 text-white py-16 sm:py-24 border-b border-neutral-900 overflow-hidden">
        {/* Background ambient lighting */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-neutral-700 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neutral-800 rounded-full blur-3xl translate-y-1/2" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-neutral-300 text-xs font-semibold backdrop-blur-xs"
          >
            <Layers className="w-3.5 h-3.5 text-neutral-200" />
            <span>Curated Mobile Catalog</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white"
          >
            Explore All Categories
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed pt-1"
          >
            Find exactly what your device needs. Explore our complete range of certified fast chargers, impact drop cases, 9H tempered glass, and high-fidelity mobile audio.
          </motion.p>

          {/* Real-time Category Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="pt-6 max-w-md mx-auto"
          >
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories (e.g., Cases, Chargers, Audio)..."
                className="w-full pl-11 pr-4 py-3 bg-neutral-900/90 border border-neutral-800 rounded-full text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs font-semibold px-1"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories Grid Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Count Bar */}
        <div className="flex items-center justify-between pb-6 mb-8 border-b border-neutral-100">
          <p className="text-xs sm:text-sm font-semibold text-neutral-700">
            Showing <strong className="text-neutral-950 font-bold">{filteredCategories.length}</strong> categories
          </p>
          <Link
            href="/shop"
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-950 transition-colors flex items-center gap-1"
          >
            <span>View All Products</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="py-20 text-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/70 p-8 max-w-md mx-auto">
            <Package className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900">
              No categories found
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              No category matched &ldquo;{searchQuery}&rdquo;. Try another search term or view all categories.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-5 px-5 py-2 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Reset Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {filteredCategories.map((cat, index) => {
              const count = productCountMap.get(cat.id) ?? cat.productCount ?? 0;

              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
                >
                  <Link
                    href={`/category/${cat.slug}`}
                    className="group flex flex-col h-full rounded-3xl overflow-hidden bg-white border border-neutral-200/90 shadow-xs hover:shadow-xl hover:border-neutral-300 transition-all duration-300 transform hover:-translate-y-1.5"
                  >
                    {/* Category Image */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                      <Image
                        src={
                          cat.image && typeof cat.image === 'string' && cat.image.trim()
                            ? cat.image.trim()
                            : 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=800&auto=format&fit=crop'
                        }
                        alt={cat.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/70 via-neutral-950/10 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                      {/* Product Count Pill */}
                      <div className="absolute top-3.5 right-3.5 px-2.5 py-1 rounded-full bg-neutral-950/80 backdrop-blur-md text-[10px] font-bold text-white border border-white/10 shadow-xs">
                        {count} {count === 1 ? 'Item' : 'Items'}
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="p-5 flex flex-col flex-1 justify-between space-y-3">
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-neutral-950 tracking-tight group-hover:text-neutral-700 transition-colors">
                          {cat.name}
                        </h2>
                        {cat.description && (
                          <p className="text-xs text-neutral-500 line-clamp-2 mt-1.5 leading-relaxed">
                            {cat.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs font-semibold text-neutral-950 border-t border-neutral-100">
                        <span className="text-[11px] uppercase tracking-wider text-neutral-400 group-hover:text-neutral-950 transition-colors">
                          Explore Collection
                        </span>
                        <div className="w-7 h-7 rounded-full bg-neutral-100 group-hover:bg-neutral-950 group-hover:text-white flex items-center justify-center transition-colors">
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
