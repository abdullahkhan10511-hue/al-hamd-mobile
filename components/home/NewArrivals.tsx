'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { ProductCard } from '@/components/products/ProductCard';
import { Product } from '@/types';

export function NewArrivals() {
  const [products, setProducts] = useState<Product[]>([]);

  const loadData = () => {
    const list = getProducts()
      .filter(
        (p) =>
          (p as any).status !== 'archived' &&
          (p as any).status !== 'inactive' &&
          (p as any).isActive !== false &&
          (p.isNew || (p as any).isNewArrival)
      )
      .slice(0, 6);
    setProducts(list);
  };

  useEffect(() => {
    loadData();
    syncProductsFromApi().then(() => loadData()).catch(() => {});

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'products') return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-16 sm:py-20 bg-neutral-50/50 border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8 sm:mb-10">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Fresh Drops
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 mt-1">
              New Arrivals
            </h2>
          </div>

          <Link
            href="/new-arrivals"
            className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors"
          >
            <span>View All New Arrivals</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Responsive Grid: 2 cols on mobile, 3 on tablet, 6 on large desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-5">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
