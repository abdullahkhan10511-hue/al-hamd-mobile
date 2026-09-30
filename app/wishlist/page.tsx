'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { StarRating } from '@/components/ui/StarRating';
import { formatPrice, getProductImage } from '@/lib/utils';
import { Product } from '@/types';

function WishlistItemCard({
  product,
  onRemove,
  onAddToCart,
}: {
  product: Product;
  onRemove: () => void;
  onAddToCart: () => void;
}) {
  const [outOfStockToast, setOutOfStockToast] = useState(false);
  const isOutOfStock = (product.shopStock ?? 0) <= 0 || product.isShopActive === false;

  const handleAction = () => {
    if (isOutOfStock) {
      setOutOfStockToast(true);
      setTimeout(() => setOutOfStockToast(false), 2500);
      return;
    }
    onAddToCart();
  };

  return (
    <div className="group relative bg-white rounded-2xl border border-neutral-200/80 p-4 flex flex-col justify-between hover:shadow-lg transition-all">
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-100">
        {isOutOfStock && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white shadow-xs">
              Out of Stock
            </span>
          </div>
        )}
        <Image
          src={getProductImage(product)}
          alt={product.name}
          fill
          className={`object-cover group-hover:scale-104 transition-transform duration-300 ${
            isOutOfStock ? 'grayscale opacity-75' : ''
          }`}
        />
        <button
          onClick={onRemove}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs text-rose-500 flex items-center justify-center hover:scale-105 transition-transform shadow-xs cursor-pointer z-10"
          aria-label="Remove from wishlist"
        >
          <Trash2 className="w-4 h-4 text-neutral-500 hover:text-rose-600" />
        </button>
      </div>

      <div className="pt-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span>{product.brand}</span>
            <StarRating rating={product.rating} reviewCount={product.reviewCount} size="sm" />
          </div>
          <Link href={`/product/${product.slug}`}>
            <h3 className="text-sm font-semibold text-neutral-900 line-clamp-1 hover:text-neutral-600">
              {product.name}
            </h3>
          </Link>
          <p className="text-sm font-bold font-mono text-neutral-950 mt-1">
            {formatPrice(product.price)}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleAction}
            aria-disabled={isOutOfStock}
            title={isOutOfStock ? 'This product is currently out of stock.' : undefined}
            className={`w-full py-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isOutOfStock
                ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed select-none'
                : 'bg-neutral-950 hover:bg-neutral-800 text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{isOutOfStock ? 'Out of Stock' : 'Move to Bag'}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {outOfStockToast && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-3 bottom-14 z-30 p-2.5 bg-neutral-950 text-white text-xs font-semibold rounded-xl shadow-xl text-center border border-neutral-800 flex items-center justify-center gap-1.5 pointer-events-none"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span>This product is currently out of stock.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WishlistPage() {
  const { wishlistProducts, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleAddAll = () => {
    wishlistProducts.filter((p) => (p.shopStock ?? 0) > 0).forEach((p) => addToCart(p, 1));
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
              Your Wishlist ({wishlistProducts.length})
            </h1>
          </div>

          {wishlistProducts.length > 0 && (
            <button
              onClick={handleAddAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Add All to Bag</span>
            </button>
          )}
        </div>

        {wishlistProducts.length === 0 ? (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlistProducts.map((product) => (
              <WishlistItemCard
                key={product.id}
                product={product}
                onRemove={() => toggleWishlist(product.id)}
                onAddToCart={() => addToCart(product, 1)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
