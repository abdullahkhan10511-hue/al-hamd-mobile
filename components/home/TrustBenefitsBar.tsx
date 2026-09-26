'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, ShieldCheck, RotateCcw, Headphones, Sparkles, CheckCircle2 } from 'lucide-react';
import { getTrustBenefits } from '@/lib/db/homepage';
import { TrustBenefitItem } from '@/types/admin';

const iconMap: Record<string, any> = {
  Truck,
  ShieldCheck,
  RotateCcw,
  Headphones,
  Sparkles,
  CheckCircle2,
};

export function TrustBenefitsBar() {
  const [benefits, setBenefits] = useState<TrustBenefitItem[]>([]);

  const loadData = () => {
    const list = getTrustBenefits().filter((b) => b.visible);
    setBenefits(list);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  if (benefits.length === 0) return null;

  return (
    <section className="bg-white border-b border-neutral-200/80 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {benefits.map((benefit, index) => {
            const Icon = iconMap[benefit.icon] || ShieldCheck;
            return (
              <motion.div
                key={benefit.id || benefit.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex items-start gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-neutral-950 group-hover:text-white text-neutral-900 flex items-center justify-center shrink-0 transition-colors duration-300">
                  <Icon className="w-5 h-5 stroke-[1.75]" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-neutral-950 tracking-tight">
                    {benefit.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5 leading-normal">
                    {benefit.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
