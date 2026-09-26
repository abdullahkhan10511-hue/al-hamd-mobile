'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';
import { getActiveShopLocation } from '@/lib/db/locations';
import { ShopLocation } from '@/types/admin';

interface ShopLocationCardProps {
  className?: string;
  variant?: 'card' | 'compact' | 'banner';
}

export function ShopLocationCard({ className = '', variant = 'card' }: ShopLocationCardProps) {
  const [activeLocation, setActiveLocation] = useState<ShopLocation | null>(null);

  const loadLocation = () => {
    const loc = getActiveShopLocation();
    setActiveLocation(loc);
  };

  useEffect(() => {
    loadLocation();

    const handleUpdate = () => loadLocation();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Only render if location exists AND isActive === true
  if (!activeLocation || !activeLocation.isActive || !activeLocation.googleMapsUrl) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <a
        href={activeLocation.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-semibold transition-all shadow-xs group ${className}`}
      >
        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="truncate">Visit Our Store</span>
        <ExternalLink className="w-3 h-3 opacity-70" />
      </a>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        className={`bg-neutral-900 text-white rounded-2xl p-4 sm:p-5 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-800 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
              📍 OUR STORE
            </span>
            <h4 className="text-sm font-bold text-white mt-0.5">{activeLocation.shopName}</h4>
            <p className="text-xs text-neutral-400">Visit our physical store</p>
          </div>
        </div>

        <a
          href={activeLocation.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-neutral-950 hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer shadow-sm"
        >
          <span>View on Google Maps</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  // Default: Premium Card
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-linear-to-br from-neutral-900 via-neutral-950 to-black text-white p-6 sm:p-8 border border-neutral-800/80 shadow-xl ${className}`}
    >
      {/* Decorative ambient glow */}
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800/90 border border-neutral-700/80 text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
            <MapPin className="w-3 h-3 text-amber-400" />
            <span>OUR STORE</span>
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Physical Outlet
          </span>
        </div>

        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {activeLocation.shopName}
          </h3>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Visit our physical store to experience our mobile accessories, fast charging tech, and device protection hands-on.
          </p>
        </div>

        <div className="pt-2">
          <a
            href={activeLocation.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3 rounded-full bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-md hover:shadow-lg active:scale-98 cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-neutral-950" />
            <span>VIEW ON GOOGLE MAPS</span>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
          </a>
        </div>
      </div>
    </div>
  );
}
