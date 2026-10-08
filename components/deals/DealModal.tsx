'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, CheckCircle2, ShoppingBag, Zap } from 'lucide-react';
import { Deal } from '@/types/admin';
import { useCart } from '@/context/CartContext';
import { isDealUpcoming, isDealExpired } from '@/lib/db/deals';

export interface DealModalProps {
  deal: Deal | null;
  onClose: () => void;
}

export function DealModal({ deal, onClose }: DealModalProps) {
  const { addDealToCart } = useCart();
  const router = useRouter();
  const [justAdded, setJustAdded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!deal) return null;

  const upcoming = isDealUpcoming(deal);
  const expired = isDealExpired(deal);
  const isOutOfStock =
    !Array.isArray(deal.products) ||
    deal.products.length === 0 ||
    deal.products.some((p) => (p.shopStock ?? 0) <= 0);

  const canPurchase = !upcoming && !expired && !isOutOfStock;

  const handleAddToCart = () => {
    if (!canPurchase) {
      if (isOutOfStock) {
        setErrorMsg('Deal is currently unavailable because one or more included products are out of stock.');
        setTimeout(() => setErrorMsg(null), 3500);
      }
      return;
    }
    const res = addDealToCart(deal, 1);
    if (res.success) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    } else if (res.error) {
      setErrorMsg(res.error);
      setTimeout(() => setErrorMsg(null), 3500);
    }
  };

  const handleBuyNow = () => {
    if (!canPurchase) {
      if (isOutOfStock) {
        setErrorMsg('Deal is currently unavailable because one or more included products are out of stock.');
        setTimeout(() => setErrorMsg(null), 3500);
      }
      return;
    }
    const res = addDealToCart(deal, 1);
    if (res.success) {
      onClose();
      router.push('/checkout');
    } else if (res.error) {
      setErrorMsg(res.error);
      setTimeout(() => setErrorMsg(null), 3500);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-white"
        >
          {/* Modal Header */}
          <div className="p-6 border-b border-neutral-800 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded-full">
                Deal Details
              </span>
              <h3 className="text-xl sm:text-2xl font-black mt-2 text-white">
                {deal.name}
              </h3>
              {deal.description && (
                <p className="text-xs text-neutral-400 mt-1 max-w-lg leading-relaxed">
                  {deal.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Price summary card */}
            <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-neutral-400">Total Promotional Deal Price:</span>
                <p className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-0.5">
                  Rs. {(deal.dealPrice || 0).toLocaleString()}
                </p>
              </div>
              {deal.originalPrice ? (
                <div className="text-right">
                  <span className="text-xs text-neutral-500">Regular Total:</span>
                  <p className="text-sm font-semibold line-through text-neutral-500 font-mono">
                    Rs. {deal.originalPrice.toLocaleString()}
                  </p>
                  {deal.discountPercentage ? (
                    <span className="text-xs font-bold text-emerald-400">
                      {deal.discountPercentage}% Discount
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Items in deal */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Included Items ({deal.products.length})
                </h4>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>In Stock</span>
                </span>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {deal.products.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-neutral-950 border border-neutral-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 shrink-0 overflow-hidden flex items-center justify-center">
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
                        <span className="text-xs font-bold text-white block truncate">
                          {item.productName}
                        </span>
                        {item.modelName && (
                          <span className="text-[11px] text-amber-400 font-mono block truncate">
                            Model: {item.modelName}
                          </span>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-neutral-400 font-mono mt-0.5">
                          {item.sku && <span>SKU: {item.sku}</span>}
                          {item.shopStock !== undefined && item.shopStock > 0 ? (
                            <span className="text-emerald-400">
                              • In Stock
                            </span>
                          ) : item.shopStock !== undefined ? (
                            <span className="text-rose-400">
                              • Out of Stock
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-neutral-200 font-mono block">
                        Rs. {item.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-6 border-t border-neutral-800 bg-neutral-950 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-neutral-700 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canPurchase}
              className={`px-6 py-2.5 rounded-full font-bold text-xs transition-all flex items-center gap-1.5 ${
                !canPurchase
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : justAdded
                  ? 'bg-emerald-600 text-white cursor-pointer'
                  : 'bg-white hover:bg-neutral-200 text-neutral-950 cursor-pointer'
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
              className={`px-6 py-2.5 rounded-full font-bold text-xs transition-all flex items-center gap-1.5 ${
                !canPurchase
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 cursor-pointer'
              }`}
            >
              <Zap className="w-4 h-4 fill-neutral-950" />
              <span>Buy Now</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
