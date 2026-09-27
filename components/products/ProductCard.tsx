'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, Check, Loader2 } from 'lucide-react';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { StarRating } from '@/components/ui/StarRating';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, DEFAULT_PRODUCT_IMAGE, getProductImage } from '@/lib/utils';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getProductEffectivePrice } from '@/lib/wholesale';

interface ProductCardProps {
  product: Product;
  className?: string;
  priority?: boolean;
}

export function ProductCard({ product, className = '', priority = false }: ProductCardProps) {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isWholesale, isSuperWholesale } = useCustomerAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [outOfStockToast, setOutOfStockToast] = useState(false);

  const isFavorited = isInWishlist(product.id);
  const isOutOfStock = product.stock <= 0;


  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) {
      setOutOfStockToast(true);
      setTimeout(() => setOutOfStockToast(false), 2500);
      return;
    }

    if (isAdding || justAdded) return;

    setIsAdding(true);
    await new Promise((r) => setTimeout(r, 250));
    addToCart(product, 1);
    setIsAdding(false);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 2000);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <div
      className={`group relative bg-white rounded-2xl border border-neutral-200/80 p-3.5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:border-neutral-300 ${className}`}
    >
      {/* Top Media / Badges / Wishlist */}
      <div className="relative">
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
          {isOutOfStock ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white shadow-xs">
              Out of Stock
            </span>
          ) : (
            <>
              {product.isNew && <Badge variant="new">New</Badge>}
              {product.isSale && product.discountPercentage && (
                <Badge variant="sale">-{product.discountPercentage}%</Badge>
              )}
              {product.isBestSeller && <Badge variant="bestseller">Best Seller</Badge>}

            </>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlist}
          className={`absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center transition-all duration-200 shadow-xs cursor-pointer ${
            isFavorited
              ? 'text-rose-600'
              : 'text-neutral-500 hover:text-rose-600 hover:scale-105'
          }`}
          aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <motion.div
            whileTap={{ scale: 0.8 }}
            animate={isFavorited ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Heart
              className={`w-4 h-4 ${isFavorited ? 'fill-rose-500 text-rose-500' : ''}`}
            />
          </motion.div>
        </button>

        {/* Product Image Link */}
        <Link
          href={`/product/${product.slug}`}
          className="block relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-100"
          onMouseEnter={() => product.images?.[1] && setImageIndex(1)}
          onMouseLeave={() => setImageIndex(0)}
        >
          <Image
            src={
              (product.images?.[imageIndex] && typeof product.images[imageIndex] === 'string' && product.images[imageIndex].trim()) ||
              getProductImage(product)
            }
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            priority={priority}
            className={`object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] ${
              isOutOfStock ? 'grayscale opacity-75' : ''
            }`}
          />
        </Link>
      </div>

      {/* Product Information */}
      <div className="pt-3.5 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-400 uppercase tracking-wider mb-1">
            <span>{product.brand}</span>
            <span>{product.category}</span>
          </div>

          <Link href={`/product/${product.slug}`}>
            <h3 className="text-sm font-semibold text-neutral-900 line-clamp-1 group-hover:text-neutral-600 transition-colors">
              {product.name}
            </h3>
          </Link>

          {/* Rating */}
          <div className="mt-1.5 flex items-center">
            <StarRating rating={product.rating} reviewCount={product.reviewCount} size="sm" />
          </div>
        </div>

        {/* Price & Quick Add */}
        <div className="mt-3.5 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
          {isSuperWholesale ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-base font-bold font-mono text-purple-950">
                  {formatPrice(getProductEffectivePrice(product, 'SUPER_WHOLESALE'))}
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-700 text-white tracking-wider">
                  Super Wholesale
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 line-through font-mono">
                Retail: {formatPrice(product.price)}
              </span>
            </div>
          ) : isWholesale && product.wholesalePrice && Number(product.wholesalePrice) > 0 ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-base font-bold font-mono text-neutral-950">
                  {formatPrice(Number(product.wholesalePrice))}
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-neutral-900 text-white tracking-wider">
                  Wholesale
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 line-through font-mono">
                Retail: {formatPrice(product.price)}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold font-mono text-neutral-950">
                {formatPrice(product.price)}
              </span>
              {product.compareAtPrice && (
                <span className="text-xs text-neutral-400 line-through font-mono">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isAdding}
            aria-disabled={isOutOfStock}
            title={isOutOfStock ? 'This product is currently out of stock.' : undefined}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
              isOutOfStock
                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed border border-neutral-200'
                : justAdded
                ? 'bg-emerald-600 text-white cursor-pointer'
                : 'bg-neutral-950 text-white hover:bg-neutral-800 cursor-pointer'
            }`}
            aria-label={isOutOfStock ? `${product.name} is out of stock` : `Quick add ${product.name} to cart`}
          >
            {isOutOfStock ? (
              <span className="text-[11px] font-medium">Out of Stock</span>
            ) : isAdding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : justAdded ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden xs:inline">Added</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Animated Out of Stock Toast */}
      <AnimatePresence>
        {outOfStockToast && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
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
