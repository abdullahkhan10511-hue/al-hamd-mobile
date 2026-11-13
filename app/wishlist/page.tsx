'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { ProductCard } from '@/components/products/ProductCard';
import { isStorefrontVisibleProduct } from '@/lib/utils';

export default function WishlistPage() {
  const { wishlistProducts } = useWishlist();
  const { addToCart } = useCart();

  const visibleWishlist = wishlistProducts.filter(isStorefrontVisibleProduct);

  const handleAddAll = () => {
    visibleWishlist.forEach((p) => addToCart(p, 1));
  };

  return (
    <div className="bg-white min-h-screen py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8 pb-4 border-b border-neutral-100">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Saved Items
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 mt-1">
              Your Wishlist ({visibleWishlist.length})
            </h1>
          </div>

          {visibleWishlist.length > 0 && (
            <button
              onClick={handleAddAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Add All to Bag</span>
            </button>
          )}
        </div>

        {visibleWishlist.length === 0 ? (
          <div className="py-24 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 stroke-1" />
            </div>
            <h2 className="text-lg font-bold text-neutral-900">Your wishlist is empty</h2>
            <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
              Save products by tapping the heart icon on any product card or detail page.
            </p>
            <div className="mt-6">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-neutral-950 text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
              >
                <span>Browse Products</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-5">
            {visibleWishlist.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
