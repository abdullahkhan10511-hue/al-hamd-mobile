'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Trash2, Minus, Plus, ShoppingBag, ShieldCheck, Tag, Package } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { FreeShippingBar } from '@/components/cart/FreeShippingBar';
import { formatPrice, getValidImageSrc } from '@/lib/utils';
import { getProductEffectivePrice, getModelEffectivePrice } from '@/lib/wholesale';

export default function CartPage() {
  const {
    cart,
    totalItems,
    subtotal,
    shipping,
    discount,
    total,
    updateQuantity,
    removeFromCart,
    promoCode,
    applyPromoCode,
    isWholesale,
    isSuperWholesale,
  } = useCart();

  const [inputCode, setInputCode] = useState('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    const res = await applyPromoCode(inputCode);
    if (res.success) {
      setPromoMessage({ text: res.message || `Code ${inputCode.toUpperCase()} applied!`, isError: false });
    } else {
      setPromoMessage({ text: res.message || 'Invalid promo code or requirements not met.', isError: true });
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-20 px-4 bg-white text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-950">Your bag is empty</h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-2">
            You haven&apos;t added any items to your shopping bag yet. Discover our latest collection.
          </p>
          <div className="mt-6">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-neutral-950 text-white font-semibold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors"
            >
              <span>Explore Products</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 pb-4 border-b border-neutral-100 flex items-end justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Shopping Bag
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 mt-1">
              Review Bag ({totalItems} items)
            </h1>
          </div>
          <Link
            href="/shop"
            className="text-xs font-semibold text-neutral-700 hover:text-neutral-950 underline"
          >
            Continue Shopping
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Table / List */}
          <div className="lg:col-span-8 space-y-6">
            <FreeShippingBar subtotal={subtotal} />

            <div className="border border-neutral-200/80 rounded-3xl overflow-hidden divide-y divide-neutral-100">
              {cart.map((item) => {
                const customerTier = isSuperWholesale ? 'SUPER_WHOLESALE' : isWholesale ? 'WHOLESALE' : 'RETAIL';
                let unitPrice: number;
                if (item.selectedModel && item.product.models && Array.isArray(item.product.models)) {
                  const modelObj = item.product.models.find(
                    (m) => m.name.toLowerCase() === item.selectedModel!.toLowerCase() || m.id === item.selectedModel
                  );
                  if (modelObj) {
                    unitPrice = getModelEffectivePrice(item.product, modelObj, customerTier);
                  } else {
                    unitPrice = item.selectedPrice ?? getProductEffectivePrice(item.product, customerTier);
                  }
                } else {
                  unitPrice = item.selectedPrice ?? getProductEffectivePrice(item.product, customerTier);
                }

                const lineTotal = unitPrice * item.quantity;
                const isWholesaleActive = (isWholesale || isSuperWholesale) && item.product.wholesalePrice && Number(item.product.wholesalePrice) > 0;
                const validImage = item.selectedImage || getValidImageSrc(item.product?.images);
                return (
                  <div
                    key={item.id}
                    className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/product/${item.product.slug}`}
                        className="relative w-20 h-24 rounded-2xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200/60 flex items-center justify-center"
                      >
                        {validImage ? (
                          <Image
                            src={validImage}
                            alt={item.product.name || 'Product'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100 text-neutral-400 p-2 text-center">
                            <Package className="w-6 h-6 stroke-1 text-neutral-400 mb-1" />
                            <span className="text-[9px] font-medium text-neutral-400 uppercase tracking-tighter">No Image</span>
                          </div>
                        )}
                      </Link>
                      <div>
                        <span className="text-[11px] font-semibold text-neutral-400 uppercase">
                          {item.product.brand}
                        </span>
                        <Link href={`/product/${item.product.slug}`}>
                          <h3 className="text-sm sm:text-base font-bold text-neutral-950 hover:text-neutral-600">
                            {item.product.name}
                          </h3>
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 mt-1">
                          {item.selectedModel && <span className="font-semibold text-neutral-800">Model: {item.selectedModel}</span>}
                          {item.selectedModel && (item.selectedColor || item.selectedSize) && <span>•</span>}
                          {item.selectedColor && <span>Color: {item.selectedColor}</span>}
                          {item.selectedColor && item.selectedSize && <span>•</span>}
                          {item.selectedSize && <span>Size: {item.selectedSize}</span>}
                        </div>
                        {isWholesaleActive && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-white uppercase tracking-wider">
                              Wholesale Price
                            </span>
                            <span className="text-xs text-neutral-400 line-through font-mono">
                              Retail: {formatPrice(item.product.price)}
                            </span>
                          </div>
                        )}
                        <p className="text-xs font-mono text-neutral-600 mt-1 sm:hidden">
                          {formatPrice(unitPrice)} each
                        </p>
                      </div>
                    </div>

                    {/* Controls & Price */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                      <div className="flex items-center border border-neutral-200 rounded-full bg-neutral-50 p-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-700 hover:bg-white transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-700 hover:bg-white transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right min-w-[100px]">
                        <span className="text-base font-extrabold font-mono text-neutral-950">
                          {formatPrice(lineTotal)}
                        </span>
                        <p className="text-[11px] text-neutral-500 font-mono hidden sm:block">
                          {formatPrice(unitPrice)} ea
                        </p>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 text-neutral-400 hover:text-rose-600 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Summary Sidebar */}
          <div className="lg:col-span-4 bg-neutral-50/70 p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-200/60 pb-3">
              Order Summary
            </h2>

            {/* Promo Code Form */}
            <form onSubmit={handleApplyPromo} className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="SUMMER70"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-neutral-200 uppercase font-mono focus:outline-none focus:border-neutral-950"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {promoMessage && (
                <p
                  className={`text-[11px] ${
                    promoMessage.isError ? 'text-rose-600' : 'text-emerald-600 font-semibold'
                  }`}
                >
                  {promoMessage.text}
                </p>
              )}
            </form>

            <div className="space-y-2.5 text-xs text-neutral-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono text-neutral-950 font-semibold">
                  {formatPrice(subtotal)}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount ({promoCode})</span>
                  <span className="font-mono">-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Estimated Shipping</span>
                <span className="font-mono text-neutral-950 font-semibold">
                  {shipping === 0 ? 'FREE' : formatPrice(shipping)}
                </span>
              </div>
              <div className="pt-3 border-t border-neutral-200 flex justify-between text-base font-extrabold text-neutral-950">
                <span>Estimated Total</span>
                <span className="font-mono text-lg">{formatPrice(total)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              className="w-full py-4 px-6 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>30-Day Money-Back Guarantee & Free Exchanges</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
