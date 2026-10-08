'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Sparkles, ChevronRight, PackageX } from 'lucide-react';
import { getDeals, syncDealsFromApi, isDealCurrentlyActive } from '@/lib/db/deals';
import { Deal } from '@/types/admin';
import { DealCard } from '@/components/deals/DealCard';
import { DealModal } from '@/components/deals/DealModal';

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealForModal, setSelectedDealForModal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    // Only show active deals currently within timing window
    const list = getDeals().filter((d) => d && d.status === 'active' && isDealCurrentlyActive(d));
    setDeals(list);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();

    // Fetch fresh active deals from public API route
    fetch('/api/deals', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.deals)) {
          const active = data.deals.filter((d: Deal) => d && d.status === 'active' && isDealCurrentlyActive(d));
          setDeals(active);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    syncDealsFromApi().then(() => loadData());

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'store_deals') return;
      loadData();
    };

    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Breadcrumb Navigation */}
      <div className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-2 text-xs text-neutral-400">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
          <span className="text-white font-medium">Deals</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Clean Page Title Header */}
        <div className="flex items-center justify-between pb-6 sm:pb-8 border-b border-neutral-800 mb-8 sm:mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <span>Deals</span>
                {deals.length > 0 && (
                  <span className="text-xs sm:text-sm font-bold bg-neutral-800 text-neutral-300 px-2.5 py-0.5 rounded-full font-mono border border-neutral-700">
                    {deals.length}
                  </span>
                )}
              </h1>
            </div>
          </div>
        </div>

        {/* Deals Listing Grid */}
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-2 border-neutral-700 border-t-amber-400 rounded-full animate-spin mb-4" />
            <p className="text-xs text-neutral-400">Loading active deals...</p>
          </div>
        ) : deals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {deals.map((deal, idx) => (
              <DealCard
                key={deal.id}
                deal={deal}
                index={idx}
                onViewDetails={(d) => setSelectedDealForModal(d)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 px-4 bg-neutral-900/50 rounded-3xl border border-neutral-800/80 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-neutral-800/80 flex items-center justify-center mx-auto mb-4 text-neutral-500 border border-neutral-700">
              <PackageX className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">No Active Deals Right Now</h2>
            <p className="text-xs text-neutral-400 mb-6 max-w-sm mx-auto">
              Check back soon for new promotional deals.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-neutral-950 font-bold text-xs hover:bg-neutral-200 transition-colors"
            >
              <span>Browse Catalog</span>
            </Link>
          </div>
        )}
      </div>

      {/* Deal Details Modal */}
      <DealModal
        deal={selectedDealForModal}
        onClose={() => setSelectedDealForModal(null)}
      />
    </div>
  );
}
