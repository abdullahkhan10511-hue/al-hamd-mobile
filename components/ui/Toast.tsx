'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowRight, Package } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice, getValidImageSrc } from '@/lib/utils';

export function CartToast() {
  const { lastAddedProduct, showAddedToast, dismissToast, setIsCartOpen } = useCart();

  useEffect(() => {
    if (showAddedToast) {
      const timer = setTimeout(() => {
        dismissToast();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showAddedToast, dismissToast]);

  if (!lastAddedProduct) return null;

  const validImage = getValidImageSrc(lastAddedProduct.images);

  return (
    <AnimatePresence>
      {showAddedToast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white rounded-2xl shadow-xl border border-neutral-200 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-700 tracking-wide uppercase">
                Added to Bag
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200/60 flex items-center justify-center">
                  {validImage ? (
                    <Image
                      src={validImage}
                      alt={lastAddedProduct.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <Package className="w-5 h-5 stroke-1 text-neutral-400" />
                  )}
                </div>
                <div className="truncate">
                  <h4 className="text-sm font-semibold text-neutral-900 truncate">
                    {lastAddedProduct.name}
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {formatPrice(lastAddedProduct.price)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    dismissToast();
                    setIsCartOpen(true);
                  }}
                  className="text-xs font-semibold text-neutral-900 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
                >
                  View Cart <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <button
              onClick={dismissToast}
              className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
