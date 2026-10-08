'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Package,
  Clock,
  Calendar,
  ShoppingBag,
  Zap,
} from 'lucide-react';
import { Deal } from '@/types/admin';
import { isDealUpcoming, isDealExpired } from '@/lib/db/deals';
import { useCart } from '@/context/CartContext';

export function DealTimingBadge({ deal }: { deal: Deal }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
  }>({
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
  });
  const [timingState, setTimingState] = useState<'upcoming' | 'active' | 'expired' | 'none'>('none');

  useEffect(() => {
    const updateTiming = () => {
      const now = Date.now();

      // Check upcoming state
      if (deal.startDate) {
        const start = new Date(deal.startDate).getTime();
        if (!isNaN(start) && start > now) {
          setTimingState('upcoming');
          const diff = start - now;
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft({
            days: days < 10 ? `0${days}` : `${days}`,
            hours: hours < 10 ? `0${hours}` : `${hours}`,
            minutes: minutes < 10 ? `0${minutes}` : `${minutes}`,
            seconds: seconds < 10 ? `0${seconds}` : `${seconds}`,
          });
          return;
        }
      }

      // Check active / ending state
      if (deal.endDate) {
        const end = new Date(deal.endDate).getTime();
        if (!isNaN(end)) {
          if (end <= now) {
            setTimingState('expired');
            return;
          }
          setTimingState('active');
          const diff = end - now;
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft({
            days: days < 10 ? `0${days}` : `${days}`,
            hours: hours < 10 ? `0${hours}` : `${hours}`,
            minutes: minutes < 10 ? `0${minutes}` : `${minutes}`,
            seconds: seconds < 10 ? `0${seconds}` : `${seconds}`,
          });
          return;
        }
      }

      setTimingState('none');
    };

    updateTiming();
    const interval = setInterval(updateTiming, 1000);
    return () => clearInterval(interval);
  }, [deal.startDate, deal.endDate]);

  if (timingState === 'expired') {
    return (
      <span className="text-[11px] font-semibold text-neutral-400 bg-neutral-900/90 px-2.5 py-1 rounded-full border border-neutral-700">
        Deal Ended
      </span>
    );
  }

  if (timingState === 'upcoming') {
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 font-mono text-[11px] sm:text-xs bg-neutral-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-neutral-700">
        <span className="text-[10px] uppercase font-sans font-semibold text-sky-400 mr-1 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-sky-400" />
          <span>Starts in:</span>
        </span>
        <span className="bg-neutral-900 text-white px-1.5 py-0.5 rounded border border-neutral-700 font-bold">
          {timeLeft.days}d
        </span>
        <span className="text-neutral-500">:</span>
        <span className="bg-neutral-900 text-white px-1.5 py-0.5 rounded border border-neutral-700 font-bold">
          {timeLeft.hours}h
        </span>
        <span className="text-neutral-500">:</span>
        <span className="bg-neutral-900 text-white px-1.5 py-0.5 rounded border border-neutral-700 font-bold">
          {timeLeft.minutes}m
        </span>
      </div>
    );
  }

  if (timingState === 'active') {
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 font-mono text-[11px] sm:text-xs bg-neutral-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-neutral-700">
        <span className="text-[10px] uppercase font-sans font-semibold text-amber-400 mr-1 flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Ends in:</span>
        </span>
        <span className="bg-neutral-900 text-white px-1.5 py-0.5 rounded border border-neutral-700 font-bold">
          {timeLeft.days}d
        </span>
        <span className="text-neutral-500">:</span>
        <span className="bg-neutral-900 text-white px-1.5 py-0.5 rounded border border-neutral-700 font-bold">
          {timeLeft.hours}h
        </span>
        <span className="text-neutral-500">:</span>
        <span className="bg-neutral-900 text-white px-1.5 py-0.5 rounded border border-neutral-700 font-bold">
          {timeLeft.minutes}m
        </span>
        <span className="text-neutral-500">:</span>
        <span className="bg-neutral-900 text-rose-400 px-1.5 py-0.5 rounded border border-neutral-700 font-bold">
          {timeLeft.seconds}s
        </span>
      </div>
    );
  }

  return null;
}

export interface DealCardProps {
  deal: Deal;
  onViewDetails?: (deal: Deal) => void;
  index?: number;
}

export function DealCard({ deal, onViewDetails, index = 0 }: DealCardProps) {
  const { addDealToCart } = useCart();
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const savings =
    deal.discountAmount ||
    (deal.originalPrice && deal.dealPrice ? deal.originalPrice - deal.dealPrice : 0);

  const upcoming = isDealUpcoming(deal);
  const expired = isDealExpired(deal);

  // Validate shop inventory across all included products
  const isOutOfStock =
    !Array.isArray(deal.products) ||
    deal.products.length === 0 ||
    deal.products.some((p) => (p.shopStock ?? 0) <= 0);

  const canPurchase = !upcoming && !expired && !isOutOfStock;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canPurchase) {
      if (isOutOfStock) {
        setErrorToast('Deal is currently unavailable because one or more included products are out of stock.');
        setTimeout(() => setErrorToast(null), 3500);
      }
      return;
    }

    if (isAdding || justAdded) return;

    setIsAdding(true);
    const res = addDealToCart(deal, 1);
    setIsAdding(false);

    if (res.success) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    } else if (res.error) {
      setErrorToast(res.error);
      setTimeout(() => setErrorToast(null), 3500);
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canPurchase) {
      if (isOutOfStock) {
        setErrorToast('Deal is currently unavailable because one or more included products are out of stock.');
        setTimeout(() => setErrorToast(null), 3500);
      }
      return;
    }

    const res = addDealToCart(deal, 1);
    if (res.success) {
      router.push('/checkout');
    } else if (res.error) {
      setErrorToast(res.error);
      setTimeout(() => setErrorToast(null), 3500);
    }
  };

  // Build summary of included products
  const includedSummary = Array.isArray(deal.products)
    ? deal.products
        .map((p) => `${p.productName}${p.modelName ? ` (${p.modelName})` : ''}`)
        .join(' + ')
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="group relative rounded-2xl bg-neutral-900/90 border border-neutral-800 p-4 flex flex-col justify-between shadow-xl hover:border-neutral-700 hover:shadow-2xl transition-all duration-300"
    >
      {/* Top Media & Badges */}
      <div className="relative">
        <Link
          href={`/deals/${deal.slug}`}
          className="block relative aspect-4/3 sm:aspect-16/10 w-full rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800/80 group-hover:border-neutral-700 transition-colors"
        >
          {deal.image ? (
            <img
              src={deal.image}
              alt={deal.name}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-90"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-neutral-900 to-neutral-950 text-neutral-500 text-center">
              <Package className="w-8 h-8 text-neutral-600 mb-1.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Promotional Bundle
              </span>
            </div>
          )}
        </Link>

        {/* Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1.5 pointer-events-none">
          <div className="flex flex-col gap-1 items-start">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white shadow-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Bundle Deal</span>
            </span>
            {deal.discountPercentage ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-neutral-950 shadow-xs">
                {deal.discountPercentage}% OFF
              </span>
            ) : null}
          </div>

          <div className="pointer-events-auto">
            <DealTimingBadge deal={deal} />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-3.5 flex flex-col flex-1 justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="font-semibold text-amber-400/90 uppercase tracking-wider">
              {deal.products?.length || 0} Items Bundle
            </span>
            {isOutOfStock ? (
              <span className="text-rose-400 font-bold uppercase tracking-wider text-[10px]">
                Out of Stock
              </span>
            ) : (
              <span className="text-emerald-400 font-medium flex items-center gap-1 text-[10px]">
                <CheckCircle2 className="w-3 h-3" />
                <span>In Stock</span>
              </span>
            )}
          </div>

          <Link href={`/deals/${deal.slug}`} className="block">
            <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1 leading-snug">
              {deal.name}
            </h3>
          </Link>

          {/* Included Items Snippet */}
          {includedSummary && (
            <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed bg-neutral-950/60 p-2 rounded-lg border border-neutral-800/60">
              <span className="font-semibold text-neutral-300">Includes: </span>
              {includedSummary}
            </p>
          )}
        </div>

        {/* Pricing Row */}
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg sm:text-xl font-black text-amber-400 font-mono">
              Rs. {(deal.dealPrice || 0).toLocaleString()}
            </span>
            {deal.originalPrice ? (
              <span className="text-xs font-semibold text-neutral-500 line-through font-mono">
                Rs. {deal.originalPrice.toLocaleString()}
              </span>
            ) : null}
            {savings > 0 && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                Save Rs. {savings.toLocaleString()}
              </span>
            )}
          </div>

          {errorToast && (
            <div className="mt-2 p-2 rounded-lg bg-rose-950/80 border border-rose-800 text-[11px] text-rose-300 leading-tight">
              {errorToast}
            </div>
          )}
        </div>

        {/* Actions — Add to Cart & Buy Now */}
        <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canPurchase || isAdding}
            className={`py-2.5 px-3 rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-xs ${
              !canPurchase
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                : justAdded
                ? 'bg-emerald-600 text-white cursor-pointer'
                : 'bg-white hover:bg-neutral-200 text-neutral-950 cursor-pointer active:scale-95'
            }`}
          >
            {justAdded ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Add to Bag</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!canPurchase}
            className={`py-2.5 px-3 rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-xs ${
              !canPurchase
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 cursor-pointer active:scale-95'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-neutral-950" />
            <span>Buy Now</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
