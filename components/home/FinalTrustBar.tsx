'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Award, Truck, Lock, ThumbsUp } from 'lucide-react';
import { ShopLocationCard } from '@/components/ui/ShopLocationCard';

const trustItems = [
  {
    icon: Award,
    title: 'Premium Build Quality',
    description: 'Impact-tested drop armor, aerospace aluminum & Kevlar braided construction',
  },
  {
    icon: Truck,
    title: 'Fast Nationwide Delivery',
    description: 'Dispatched within 24 hours with live courier tracking across Pakistan',
  },
  {
    icon: Lock,
    title: 'Safe & Secure Checkout',
    description: 'Cash on Delivery, Bank Transfer & verified payment options',
  },
  {
    icon: ThumbsUp,
    title: 'Customer Satisfaction',
    description: 'Rated 4.9/5 by 50,000+ discerning customers across Pakistan',
  },
];

export function FinalTrustBar() {
  return (
    <section className="py-14 sm:py-16 bg-white border-b border-neutral-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {trustItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="flex items-start gap-4 p-4 rounded-2xl bg-neutral-50/70 border border-neutral-200/60"
              >
                <div className="w-11 h-11 rounded-xl bg-neutral-950 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Icon className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-950">
                    {item.title}
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Location Banner (shown only if store location is configured & active) */}
        <ShopLocationCard variant="banner" />
      </div>
    </section>
  );
}
