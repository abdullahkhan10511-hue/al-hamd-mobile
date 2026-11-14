'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/products/ProductCard';
import { Reveal3D } from '@/components/ui/motion/Reveal3D';
import { isStorefrontVisibleProduct } from '@/lib/utils';
import { Product } from '@/types';

export function NewArrivals({ initialProducts }: { initialProducts?: Product[] }) {
  const [products] = useState<Product[]>(() => {
    if (Array.isArray(initialProducts)) {
      return initialProducts
        .filter((p) => isStorefrontVisibleProduct(p) && Boolean((p as any).isNewArrival))
        .slice(0, 8);
    }
    return [];
  });

  if (products.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 bg-neutral-50/50 border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Reveal3D className="mb-8 sm:mb-10">
          <div className="flex items-end justify-between">
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
        </Reveal3D>

        {/* Responsive Grid: 2 cols mobile, 3 tablet, 4 desktop, 5 ultra-wide with 40ms stagger */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-5">
          {products.map((product, index) => (
            <Reveal3D key={product.id} delayMs={index * 40} className="h-full">
              <ProductCard product={product} />
            </Reveal3D>
          ))}
        </div>
      </div>
    </section>
  );
}
