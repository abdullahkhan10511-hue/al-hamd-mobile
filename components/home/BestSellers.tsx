'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, Check, Loader2, ArrowRight } from 'lucide-react';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { StarRating } from '@/components/ui/StarRating';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, getProductImage } from '@/lib/utils';

export function BestSellers() {
  const [products, setProducts] = useState<Product[]>([]);

  const loadData = () => {
    const list = getProducts()
      .filter(
        (p) =>
          (p as any).status !== 'archived' &&
          (p as any).status !== 'inactive' &&
          (p as any).isActive !== false &&
          p.isBestSeller
      )
      .slice(0, 3);
    setProducts(list);
  };

  useEffect(() => {
    loadData();
    syncProductsFromApi().then(() => loadData()).catch(() => {});

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-16 sm:py-20 bg-white border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8 sm:mb-12">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Customer Favorites
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 mt-1">
              Best Sellers
            </h2>
          </div>

          <Link
            href="/best-sellers"
            className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors"
          >
            <span>View All Best Sellers</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Large Product Cards Grid (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <LargeBestSellerCard product={product} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LargeBestSellerCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [outOfStockToast, setOutOfStockToast] = useState(false);
  const isFavorited = isInWishlist(product.id);
  const isOutOfStock = (product.shopStock ?? 0) <= 0 || product.isShopActive === false;

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
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
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="group relative bg-white rounded-3xl border border-neutral-200/90 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-full p-5">
      {/* Media with Badges */}
      <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-neutral-100">
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 items-start">
          {isOutOfStock ? (
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white shadow-xs">
              Out of Stock
            </span>
          ) : (
            <Badge variant="bestseller">BESTSELLER</Badge>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
          className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center transition-all shadow-xs cursor-pointer ${
            isFavorited ? 'text-rose-600' : 'text-neutral-500 hover:text-rose-600 hover:scale-105'
          }`}
          aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        <Link href={`/product/${product.slug}`} className="relative block w-full h-full">
          <Image
            src={getProductImage(product)}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className={`object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
              isOutOfStock ? 'grayscale opacity-75' : ''
            }`}
          />
        </Link>
      </div>

      {/* Product Information */}
      <div className="pt-5 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-400 uppercase tracking-wider mb-1.5">
            {product.brand ? (
              <Link
                href={`/brand/${product.brandSlug || product.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`}
                className="hover:text-neutral-900 transition-colors font-semibold truncate max-w-[150px]"
                title={`View ${product.brand} products`}
              >
                {product.brand}
              </Link>
            ) : (
              <span />
            )}
            <StarRating rating={product.rating} reviewCount={product.reviewCount} size="sm" />
          </div>

          <Link href={`/product/${product.slug}`}>
            <h3 className="text-lg font-bold text-neutral-950 group-hover:text-neutral-600 transition-colors">
              {product.name}
            </h3>
          </Link>

          <p className="text-xs sm:text-sm text-neutral-500 mt-2 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Price & Action */}
        <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-neutral-950">
              {formatPrice(product.price)}
            </span>
            {product.compareAtPrice && (
              <span className="text-xs text-neutral-400 line-through font-mono">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isAdding}
            aria-disabled={isOutOfStock}
            title={isOutOfStock ? 'This product is currently out of stock.' : undefined}
            className={`px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              isOutOfStock
                ? 'bg-neutral-200 text-neutral-400 border border-neutral-300 cursor-not-allowed select-none'
                : justAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-950 text-white hover:bg-neutral-800'
            }`}
          >
            {isOutOfStock ? (
              <span>Out of Stock</span>
            ) : isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : justAdded ? (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>Quick Add</span>
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
            className="absolute inset-x-4 bottom-20 z-30 p-2.5 bg-neutral-950 text-white text-xs font-semibold rounded-xl shadow-xl text-center border border-neutral-800 flex items-center justify-center gap-1.5 pointer-events-none"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span>This product is currently out of stock.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
