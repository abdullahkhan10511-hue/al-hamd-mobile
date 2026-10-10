'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
import { getDeals, syncDealsFromApi, isDealCurrentlyActive } from '@/lib/db/deals';
import { Deal } from '@/types/admin';
import { DealCard } from '@/components/deals/DealCard';
import { DealModal } from '@/components/deals/DealModal';

const HOMEPAGE_DEALS_LIMIT = 2;

export function DealsSection() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedDealForModal, setSelectedDealForModal] = useState<Deal | null>(null);

  const loadData = () => {
    // Show only active deals within start/end timing enabled for homepage, sorted by displayOrder / priority
    const list = getDeals()
      .filter((d) => d && d.status === 'active' && d.showOnHomepage && isDealCurrentlyActive(d))
      .sort((a, b) => (a.displayOrder || 1) - (b.displayOrder || 1));
    setDeals(list);
    setIsLoaded(true);
  };

  useEffect(() => {
    loadData();

    // Fetch fresh active deals from public API
    fetch('/api/deals?homepage=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.deals)) {
          const activeList = data.deals
            .filter((d: Deal) => d && d.status === 'active' && d.showOnHomepage && isDealCurrentlyActive(d))
            .sort((a: Deal, b: Deal) => (a.displayOrder || 1) - (b.displayOrder || 1));
          if (activeList.length > 0) {
            setDeals(activeList);
          }
        }
        setIsLoaded(true);
      })
      .catch(() => {
        setIsLoaded(true);
      });

    syncDealsFromApi().then(() => loadData());

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'store_deals') return;
      loadData();
    };

    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  if (!isLoaded) {
    return (
      <section id="deals" className="py-12 sm:py-16 bg-neutral-950 text-white relative overflow-hidden min-h-[360px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-neutral-900">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-800 animate-pulse" />
              <div className="h-6 w-32 bg-neutral-800 rounded-md animate-pulse" />
            </div>
            <div className="h-8 w-24 bg-neutral-800 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-64 bg-neutral-900/80 rounded-3xl border border-neutral-800 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (deals.length === 0) {
    return null;
  }

  // Strictly maximum 2 deals on homepage according to priority
  const displayedDeals = deals.slice(0, HOMEPAGE_DEALS_LIMIT);

  return (
    <section id="deals" className="py-12 sm:py-16 bg-neutral-950 text-white relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-neutral-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4 text-amber-400" />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Deals
            </h2>
          </div>

          <div className="shrink-0">
            <Link
              href="/deals"
              className="group inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold backdrop-blur-md border border-white/15 hover:border-white/30 transition-all shadow-xs cursor-pointer"
            >
              <span>More Deals</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Deals Cards Grid — Maximum 2 Deals with normal product card proportions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {displayedDeals.map((deal, idx) => (
            <DealCard
              key={deal.id}
              deal={deal}
              index={idx}
              onViewDetails={(d) => setSelectedDealForModal(d)}
            />
          ))}
        </div>
      </div>

      {/* Deal Details Modal */}
      <DealModal
        deal={selectedDealForModal}
        onClose={() => setSelectedDealForModal(null)}
      />
    </section>
  );
}
