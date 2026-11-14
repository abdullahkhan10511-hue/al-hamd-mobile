'use client';

import React from 'react';
import { Banknote, Truck, ShieldCheck, RotateCcw } from 'lucide-react';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { ShopLocationCard } from '@/components/ui/ShopLocationCard';

import { ShopLocation } from '@/types/admin';

const trustItems = [
  {
    icon: Banknote,
    title: 'Cash on Delivery',
    description: 'Pay conveniently at your doorstep on orders delivered across Pakistan',
  },
  {
    icon: Truck,
    title: 'Fast Delivery Across Pakistan',
    description: 'Dispatched within 24 hours with live courier tracking nationwide',
  },
  {
    icon: ShieldCheck,
    title: 'Original Products',
    description: 'Genuine chargers, cables, cases, audio gear & power banks you can trust',
  },
  {
    icon: RotateCcw,
    title: 'Easy Returns',
    description: 'Hassle-free replacement or return support from our Mandi Bahauddin store',
  },
];

export function FinalTrustBar({ initialLocation }: { initialLocation?: ShopLocation | null }) {
  return (
    <section className="py-12 sm:py-16 bg-white border-b border-neutral-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {trustItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <ScrollReveal
                key={item.title}
                delayMs={Math.min(index * 40, 120)}
                className="h-full"
              >
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-neutral-50/70 border border-neutral-200/60 h-full">
                  <div className="w-11 h-11 rounded-xl bg-neutral-950 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Icon className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-neutral-950 break-words">
                      {item.title}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed break-words">
                      {item.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Physical Shop Verification Card */}
        <ShopLocationCard initialLocation={initialLocation} />
      </div>
    </section>
  );
}
