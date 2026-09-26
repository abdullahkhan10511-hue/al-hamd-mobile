'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, Recycle } from 'lucide-react';
import { getPageById } from '@/lib/db/pages';
import { PageContent } from '@/types/admin';

export default function AboutPage() {
  const [aboutPage, setAboutPage] = useState<PageContent | null>(null);

  const loadData = async () => {
    const found = await getPageById('about');
    setAboutPage(found);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  return (
    <div className="bg-white">
      {/* 1. Hero Section */}
      <section className="py-20 sm:py-28 bg-neutral-50/60 border-b border-neutral-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-bold uppercase tracking-widest text-neutral-400"
          >
            Our Heritage & Philosophy
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-950 leading-[1.1]"
          >
            {aboutPage?.title || 'Engineered Mobile Accessories for Modern Devices.'}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed pt-2"
          >
            We curate and engineer high-performance mobile essentials—from GaN fast chargers and Kevlar-reinforced cables to military-grade drop cases and studio-grade wireless audio—built for enduring durability.
          </motion.p>
        </div>
      </section>

      {/* 2. Core Pillars */}
      <section className="py-16 sm:py-24 bg-neutral-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-amber-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Uncompromising Quality</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                We stress test every charger, cable, and phone case to failure. If an accessory cannot endure 10,000+ bends or withstand 10ft drops, it is never released.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-emerald-400">
                <Recycle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Certified Safe Charging</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                MultiProtect IC chips, GaN III thermal efficiency, and Qi2 wireless certification to safeguard smartphone battery health and prevent overheating.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">100% Genuine Brands</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Direct authorized partnerships with leading global mobile accessory manufacturers (Apple, Samsung, Anker, Baseus, UGREEN). Zero knockoffs, guaranteed.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
