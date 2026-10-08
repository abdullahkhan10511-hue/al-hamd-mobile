'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Sparkles,
  ShoppingBag,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Package,
  ShieldCheck,
  Truck,
  RotateCcw,
  Minus,
  Plus,
  Tag,
} from 'lucide-react';
import { Deal } from '@/types/admin';
import { getDealBySlug, syncDealsFromApi, isDealCurrentlyActive, isDealUpcoming, isDealExpired } from '@/lib/db/deals';
import { useCart } from '@/context/CartContext';
import { DealTimingBadge } from '@/components/deals/DealCard';

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  const { addDealToCart } = useCart();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = () => {
    if (!slug) return;
    const local = getDealBySlug(slug);
    if (local) {
      setDeal(local);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (slug) {
      fetch(`/api/deals/${encodeURIComponent(slug)}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.deal) {
            setDeal(data.deal);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }

    syncDealsFromApi().then(() => loadData());

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'store_deals') return;
      loadData();
    };

    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] bg-neutral-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-neutral-700 border-t-amber-400 rounded-full animate-spin mb-3" />
          <p className="text-xs text-neutral-400">Loading deal details...</p>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-[70vh] bg-neutral-950 flex items-center justify-center text-white p-4">
        <div className="max-w-md text-center p-8 rounded-3xl bg-neutral-900 border border-neutral-800">
          <div className="w-14 h-14 rounded-2xl bg-neutral-800 flex items-center justify-center mx-auto mb-4 text-neutral-500">
            <Package className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Deal Not Found</h1>
          <p className="text-xs text-neutral-400 mb-6">
            The promotional bundle deal you are looking for may have expired or been removed.
          </p>
          <Link
            href="/deals"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-neutral-950 font-bold text-xs hover:bg-neutral-200 transition-colors"
          >
            <span>View All Deals</span>
          </Link>
        </div>
      </div>
    );
  }

  const upcoming = isDealUpcoming(deal);
  const expired = isDealExpired(deal);

  // Validate shop stock across all included items
  const minShopStock = Array.isArray(deal.products) && deal.products.length > 0
    ? Math.min(...deal.products.map((p) => p.shopStock ?? 0))
    : 0;

  const isOutOfStock = minShopStock <= 0;
  const canPurchase = !upcoming && !expired && !isOutOfStock;

  const savings =
    deal.discountAmount ||
    (deal.originalPrice && deal.dealPrice ? deal.originalPrice - deal.dealPrice : 0);

  const handleAddToCart = () => {
    if (!canPurchase) {
      if (isOutOfStock) {
        setErrorMsg('Deal is currently unavailable because one or more included products are out of stock in Shop Inventory.');
      }
      return;
    }

    if (isAdding || justAdded) return;

    setIsAdding(true);
    const res = addDealToCart(deal, quantity);
    setIsAdding(false);

    if (res.success) {
      setJustAdded(true);
      setErrorMsg(null);
      setTimeout(() => setJustAdded(false), 2000);
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  const handleBuyNow = () => {
    if (!canPurchase) {
      if (isOutOfStock) {
        setErrorMsg('Deal is currently unavailable because one or more included products are out of stock in Shop Inventory.');
      }
      return;
    }

    const res = addDealToCart(deal, quantity);
    if (res.success) {
      router.push('/checkout');
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Breadcrumb Navigation */}
      <div className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-2 text-xs text-neutral-400">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
          <Link href="/deals" className="hover:text-white transition-colors">
            Deals
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
          <span className="text-white font-medium truncate max-w-xs">{deal.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left Column: Media & Badges */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square sm:aspect-4/3 w-full rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl flex items-center justify-center">
              {deal.image ? (
                <img
                  src={deal.image}
                  alt={deal.name}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-neutral-900 to-neutral-950 text-center">
                  <Package className="w-16 h-16 text-neutral-600 mb-3" />
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Promotional Bundle Deal
                  </span>
                </div>
              )}

              {/* Badges on image */}
              <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2 pointer-events-none">
                <div className="flex flex-col gap-1.5 items-start">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-600 text-white shadow-md flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Bundle Deal</span>
                  </span>
                  {deal.discountPercentage ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-neutral-950 shadow-md">
                      {deal.discountPercentage}% OFF
                    </span>
                  ) : null}
                </div>

                <div className="pointer-events-auto">
                  <DealTimingBadge deal={deal} />
                </div>
              </div>
            </div>

            {/* Shop Guarantee Bar */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="flex flex-col items-center gap-1 text-neutral-300">
                <Truck className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-semibold">Nationwide Delivery</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-neutral-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-semibold">100% Genuine Shop Stock</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-neutral-300">
                <RotateCcw className="w-4 h-4 text-sky-400" />
                <span className="text-[11px] font-semibold">Instant Dispatch</span>
              </div>
            </div>
          </div>

          {/* Right Column: Pricing, Product Breakdown, Buy Actions */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Special Promotion</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {deal.name}
              </h1>

              {deal.description && (
                <p className="text-sm text-neutral-400 mt-2.5 leading-relaxed">
                  {deal.description}
                </p>
              )}
            </div>

            {/* Pricing Section */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold block">
                Promotional Bundle Price
              </span>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">
                  Rs. {(deal.dealPrice || 0).toLocaleString()}
                </span>
                {deal.originalPrice ? (
                  <span className="text-base sm:text-lg font-semibold text-neutral-500 line-through font-mono">
                    Rs. {deal.originalPrice.toLocaleString()}
                  </span>
                ) : null}
                {savings > 0 && (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-full">
                    Save Rs. {savings.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Availability Banner */}
            <div>
              {isOutOfStock ? (
                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    <strong>Out of Stock:</strong> One or more included products are currently unavailable in Shop Inventory.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>
                    <strong>In Stock:</strong> Ready for immediate dispatch.
                  </span>
                </div>
              )}
            </div>

            {/* Included Products List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Included Products ({deal.products?.length || 0})
                </h2>
                <span className="text-[11px] font-mono text-neutral-400">
                  Bundled as 1 Complete Package
                </span>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {deal.products?.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-neutral-950 border border-neutral-800 shrink-0 overflow-hidden flex items-center justify-center">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-neutral-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {item.productName}
                        </p>
                        {item.modelName && (
                          <p className="text-[11px] text-amber-400 font-mono truncate">
                            Model: {item.modelName}
                          </p>
                        )}
                        <div className="flex items-center gap-2.5 text-[10px] text-neutral-500 font-mono mt-0.5">
                          {item.sku && <span>SKU: {item.sku}</span>}
                          {item.shopStock !== undefined && item.shopStock > 0 ? (
                            <span className="text-emerald-400">
                              • In Stock
                            </span>
                          ) : (
                            <span className="text-rose-400">• Out of stock</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-neutral-200 font-mono block">
                        Rs. {item.price.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-neutral-500 block">
                        Qty: 1
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Quantity Selector & Purchase Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-neutral-400">Quantity:</span>
                <div className="flex items-center border border-neutral-800 rounded-full bg-neutral-900 p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || !canPurchase}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-white disabled:opacity-40 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-9 text-center font-mono font-bold text-xs text-white">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={!canPurchase}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-white disabled:opacity-40 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!canPurchase || isAdding}
                  className={`py-4 px-6 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm ${
                    !canPurchase
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                      : justAdded
                      ? 'bg-emerald-600 text-white cursor-pointer'
                      : 'bg-white hover:bg-neutral-200 text-neutral-950 cursor-pointer active:scale-95'
                  }`}
                >
                  {justAdded ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Added to Bag</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Bag</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!canPurchase}
                  className={`py-4 px-6 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm ${
                    !canPurchase
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                      : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 cursor-pointer active:scale-95'
                  }`}
                >
                  <Zap className="w-4 h-4 fill-neutral-950" />
                  <span>Buy It Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
