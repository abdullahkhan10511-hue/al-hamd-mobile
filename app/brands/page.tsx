'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, ArrowRight, Tag, Package } from 'lucide-react';
import { getActiveBrands, syncBrandsFromApi } from '@/lib/db/brands';
import { getProducts } from '@/lib/db/products';
import { Brand } from '@/types/admin';
import { Product } from '@/types';

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const activeBrands = await syncBrandsFromApi().catch(() => getActiveBrands());
      setBrands(activeBrands.filter((b) => b.status === 'active'));

      const activeProds = getProducts().filter(
        (p) =>
          (p as any).status !== 'archived' &&
          (p as any).status !== 'inactive' &&
          (p as any).isActive !== false
      );
      setProducts(activeProds);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshFromCache = () => {
    const activeBrands = getActiveBrands();
    setBrands(activeBrands.filter((b) => b.status === 'active'));
    const activeProds = getProducts().filter(
      (p) =>
        (p as any).status !== 'archived' &&
        (p as any).status !== 'inactive' &&
        (p as any).isActive !== false
    );
    setProducts(activeProds);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const BRAND_KEYS = ['brands', 'products'];
      if (key && !BRAND_KEYS.includes(key)) return;
      refreshFromCache();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Compute live product counts per brand
  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    brands.forEach((brand) => {
      const bName = brand.name.toLowerCase();
      const bSlug = brand.slug.toLowerCase();
      const bId = brand.id.toLowerCase();

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

      map.set(brand.id, count > 0 ? count : (brand.productCount || 0));
    });
    return map;
  }, [brands, products]);

  // Filter brands by search input
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase().trim();
    return brands.filter(
      (brand) =>
        brand.name.toLowerCase().includes(q) ||
        (brand.description && brand.description.toLowerCase().includes(q)) ||
        brand.slug.toLowerCase().includes(q)
    );
  }, [brands, searchQuery]);

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
            <Tag className="w-3.5 h-3.5 text-neutral-200" />
            <span>Authorized & Certified Partners</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white"
          >
            Featured Brands
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed pt-1"
          >
            Shop premium original accessories from leading global manufacturers. 100% authentic products backed by official warranties and fast nationwide shipping.
          </motion.p>

          {/* Real-time Brand Search Bar */}
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
                placeholder="Search brands (e.g., Apple, Samsung, Anker)..."
                className="w-full pl-11 pr-4 py-3 bg-neutral-900/90 border border-neutral-800 rounded-full text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs font-semibold px-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Brands Grid Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Count Bar */}
        <div className="flex items-center justify-between pb-6 mb-8 border-b border-neutral-100">
          <p className="text-xs sm:text-sm font-semibold text-neutral-700">
            Showing <strong className="text-neutral-950 font-bold">{filteredBrands.length}</strong> brands
          </p>
          <Link
            href="/shop"
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-950 transition-colors flex items-center gap-1"
          >
            <span>View All Products</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {filteredBrands.length === 0 ? (
          <div className="py-20 text-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/70 p-8 max-w-md mx-auto">
            <Package className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900">
              No brands found
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              No brand matched &ldquo;{searchQuery}&rdquo;. Try another search term or explore all products.
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
            {filteredBrands.map((brand, index) => {
              const count = productCountMap.get(brand.id) ?? brand.productCount ?? 0;

              return (
                <motion.div
                  key={brand.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
                >
                  <Link
                    href={`/brand/${brand.slug}`}
                    className="group flex flex-col h-full rounded-3xl overflow-hidden bg-white border border-neutral-200/90 shadow-xs hover:shadow-xl hover:border-neutral-300 transition-all duration-300 transform hover:-translate-y-1.5"
                  >
                    {/* Brand Logo Box */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-50 border-b border-neutral-100 flex items-center justify-center p-6">
                      {brand.logo ? (
                        <img
                          src={brand.logo}
                          alt={brand.name}
                          className="max-h-16 max-w-[70%] object-contain transition-transform duration-500 group-hover:scale-108"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-neutral-950 text-white font-black text-2xl flex items-center justify-center shadow-sm">
                          {brand.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Product Count Pill */}
                      <div className="absolute top-3.5 right-3.5 px-2.5 py-1 rounded-full bg-neutral-950 text-[10px] font-bold text-white shadow-xs">
                        {count} {count === 1 ? 'Item' : 'Items'}
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="p-5 flex flex-col flex-1 justify-between space-y-3">
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-neutral-950 tracking-tight group-hover:text-neutral-700 transition-colors">
                          {brand.name}
                        </h2>
                        {brand.description && (
                          <p className="text-xs text-neutral-500 line-clamp-2 mt-1.5 leading-relaxed">
                            {brand.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs font-semibold text-neutral-950 border-t border-neutral-100">
                        <span className="text-[11px] uppercase tracking-wider text-neutral-400 group-hover:text-neutral-950 transition-colors">
                          Shop Brand
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
