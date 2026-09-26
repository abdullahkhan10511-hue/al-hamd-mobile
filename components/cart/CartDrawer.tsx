'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ArrowRight, Tag, ShieldCheck } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { FreeShippingBar } from './FreeShippingBar';
import { CartItemRow } from './CartItemRow';
import { formatPrice } from '@/lib/utils';

export function CartDrawer() {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    totalItems,
    subtotal,
    shipping,
    discount,
    total,
    promoCode,
    appliedPromo,
    applyPromoCode,
    removePromoCode,
    appliedDiscountPercentage,
  } = useCart();

  const [inputCode, setInputCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isCartOpen]);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setIsApplying(true);
    setPromoMessage(null);
    const res = await applyPromoCode(inputCode);
    setIsApplying(false);
    if (res.success) {
      setPromoMessage({ text: res.message, isError: false });
      setInputCode('');
    } else {
      setPromoMessage({ text: res.message, isError: true });
    }
  };

  const handleRemovePromo = () => {
    removePromoCode();
    setPromoMessage({ text: 'Promo code removed.', isError: false });
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between"
            >
              {/* Header */}
              <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-neutral-900" />
                  <h2 className="text-base font-bold tracking-tight text-neutral-900 uppercase">
                    Your Bag ({totalItems})
                  </h2>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                  aria-label="Close cart"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cart.length > 0 && <FreeShippingBar subtotal={subtotal} />}

                {cart.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center mb-4">
                      <ShoppingBag className="w-8 h-8 stroke-1" />
                    </div>
                    <h3 className="text-base font-semibold text-neutral-900">
                      Your shopping bag is empty
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                      Discover our new arrivals, fast chargers, and premium mobile accessories.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => setIsCartOpen(false)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <Link href="/shop">Start Shopping</Link>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {cart.map((item) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        onItemClick={() => setIsCartOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer / Summary */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-neutral-100 bg-neutral-50/50 space-y-4">
                  {/* Promo Input or Applied Badge */}
                  {!appliedPromo ? (
                    <form onSubmit={handleApplyPromo} className="space-y-1">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={inputCode}
                            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                            placeholder="Enter promo code"
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-neutral-200 uppercase tracking-wider text-neutral-900 placeholder:normal-case placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isApplying || !inputCode.trim()}
                          className="px-4 py-2 rounded-xl bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                        >
                          {isApplying ? '...' : 'Apply'}
                        </button>
                      </div>
                      {promoMessage && (
                        <p
                          className={`text-[11px] pl-1 font-medium ${
                            promoMessage.isError ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {promoMessage.text}
                        </p>
                      )}
                    </form>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold uppercase font-mono text-emerald-950">
                            {appliedPromo.code}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            {appliedPromo.discountType === 'percentage'
                              ? `-${appliedPromo.discountValue}%`
                              : 'Fixed OFF'}
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                          Discount: -Rs. {discount.toLocaleString('en-PK')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Calculations */}
                  <div className="space-y-2 text-xs text-neutral-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-mono text-neutral-900 font-semibold">
                        {formatPrice(subtotal)}
                      </span>
                    </div>

                    {appliedDiscountPercentage > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Discount ({promoCode})</span>
                        <span className="font-mono">-{formatPrice(discount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Estimated Shipping</span>
                      <span className="font-mono text-neutral-900 font-semibold">
                        {shipping === 0 ? (
                          <span className="text-emerald-600 uppercase text-[10px] tracking-wider">
                            Free
                          </span>
                        ) : (
                          formatPrice(shipping)
                        )}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-neutral-200 flex justify-between text-sm font-bold text-neutral-950">
                      <span>Total</span>
                      <span className="font-mono text-base">{formatPrice(total)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Link
                      href="/checkout"
                      onClick={() => setIsCartOpen(false)}
                      className="w-full py-3.5 px-6 rounded-full bg-neutral-950 text-white font-semibold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <span>Checkout Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>End-to-end encrypted 256-bit SSL checkout</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
