'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Heart,
  ShoppingBag,
  Check,
  MessageCircle,
} from 'lucide-react';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { StarRating } from '@/components/ui/StarRating';
import { Badge } from '@/components/ui/Badge';
import {
  formatPrice,
  getVerifiedReviewStats,
  getRealDiscountPercentage,
  isProductNewBadgeEligible,
  DEFAULT_PRODUCT_IMAGE,
} from '@/lib/utils';
import { getCategoryPlaceholder } from '@/lib/placeholders';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getProductEffectivePrice } from '@/lib/wholesale';
import { buildProductInquiryWhatsAppUrl } from '@/lib/whatsapp';
import { Tilt3D } from '@/components/ui/motion/Tilt3D';

interface ProductCardProps {
  product: Product;
  className?: string;
  priority?: boolean;
}

function resolveCardImageCandidates(product: Product): string[] {
  const urls: string[] = [];
  const pushValid = (src?: unknown) => {
    if (typeof src !== 'string') return;
    const trimmed = src.trim();
    if (!trimmed || trimmed === DEFAULT_PRODUCT_IMAGE) return;
    if (!urls.includes(trimmed)) urls.push(trimmed);
  };

  if (Array.isArray(product.images)) {
    product.images.forEach(pushValid);
  }
  if (Array.isArray(product.media)) {
    product.media.forEach((m: any) => {
      if (m && (m.type === 'image' || !m.type)) {
        pushValid(typeof m === 'string' ? m : m.url);
      }
    });
  }
  if (Array.isArray(product.models)) {
    product.models.forEach((mod: any) => {
      if (mod && Array.isArray(mod.images)) {
        mod.images.forEach(pushValid);
      }
    });
  }

  return urls;
}

export const ProductCard = React.memo(function ProductCard({
  product,
  className = '',
  priority = false,
}: ProductCardProps) {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isWholesale, isSuperWholesale } = useCustomerAuth();
  const [justAdded, setJustAdded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(() => new Set());

  const isFavorited = isInWishlist(product.id);

  const imageCandidates = useMemo(() => resolveCardImageCandidates(product), [product]);
  const activeImageSrc = useMemo(() => {
    const preferred = imageCandidates[imageIndex] || imageCandidates[0];
    if (preferred && !failedSrcs.has(preferred)) return preferred;
    const fallback = imageCandidates.find((src) => !failedSrcs.has(src));
    return fallback || null;
  }, [imageCandidates, imageIndex, failedSrcs]);

  const realDiscountPct = useMemo(() => getRealDiscountPercentage(product), [product]);
  const isNewEligible = useMemo(() => isProductNewBadgeEligible(product), [product]);
  const verifiedStats = useMemo(() => getVerifiedReviewStats(product), [product]);

  // At most ONE badge per card, priority: "-X%" discount > "Best Seller" > "New"
  const activeBadge = useMemo(() => {
    if (realDiscountPct > 0) {
      return { variant: 'sale' as const, label: `-${realDiscountPct}%` };
    }
    if (Boolean(product.isBestSeller)) {
      return { variant: 'bestseller' as const, label: 'Best Seller' };
    }
    if (isNewEligible) {
      return { variant: 'new' as const, label: 'New' };
    }
    return null;
  }, [realDiscountPct, product.isBestSeller, isNewEligible]);

  const placeholderSrc = useMemo(
    () => getCategoryPlaceholder(product.categorySlug || product.category, product.name),
    [product.categorySlug, product.category, product.name]
  );

  const customerTier = isSuperWholesale ? 'SUPER_WHOLESALE' : isWholesale ? 'WHOLESALE' : 'RETAIL';
  const effectivePrice = getProductEffectivePrice(product, customerTier);
  const isPriceOnRequest = effectivePrice <= 0;
  const inquiryWhatsAppUrl = useMemo(() => {
    return isPriceOnRequest ? buildProductInquiryWhatsAppUrl(product) : '';
  }, [isPriceOnRequest, product]);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPriceOnRequest) return;
    if (justAdded) return;

    addToCart(product, 1);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1800);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const handleImageError = (src: string) => {
    setFailedSrcs((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  };

  const brandSlug =
    product.brandSlug ||
    (product.brand
      ? product.brand
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : '');

  const showRetailStrikethrough =
    typeof product.compareAtPrice === 'number' &&
    Number(product.compareAtPrice) > Number(product.price) &&
    Number(product.price) > 0;

  return (
    <Tilt3D maxTilt={5} glare liftChild className="h-full">
      <div
        data-product-card="true"
        data-product-id={product.id}
        className={`group relative h-full bg-white rounded-2xl border border-neutral-200/80 p-3 sm:p-3.5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:border-neutral-300 min-w-0 ${className}`}
      >
        {/* Top Media / Single Badge / Wishlist */}
        <div className="relative">
          {activeBadge && (
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
              <Badge variant={activeBadge.variant}>{activeBadge.label}</Badge>
            </div>
          )}

          <button
            type="button"
            onClick={handleWishlist}
            className={`absolute top-2 right-2 z-30 w-8 h-8 rounded-full bg-white/95 border border-neutral-200/70 flex items-center justify-center transition-all duration-200 shadow-xs cursor-pointer ${
              isFavorited
                ? 'text-rose-600'
                : 'text-neutral-500 hover:text-rose-600 hover:scale-105'
            }`}
            aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <span
              className={`inline-flex items-center justify-center transition-transform duration-200 active:scale-80 ${
                isFavorited ? 'scale-110' : 'scale-100'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
            </span>
          </button>

          {/* Square 1/1 Product Image Area on light neutral #f5f5f5 */}
          <Link
            href={`/product/${product.slug}`}
            className="block relative aspect-square w-full rounded-xl overflow-hidden bg-[#f5f5f5] transition-transform duration-300 group-hover:[transform:translateZ(18px)]"
            onMouseEnter={() => imageCandidates[1] && setImageIndex(1)}
            onMouseLeave={() => setImageIndex(0)}
          >
          {activeImageSrc ? (
            <Image
              src={activeImageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1535px) 25vw, 20vw"
              priority={priority}
              unoptimized={
                activeImageSrc.startsWith('http://') ||
                activeImageSrc.startsWith('https://') ||
                activeImageSrc.toLowerCase().endsWith('.svg') ||
                activeImageSrc.startsWith('data:')
              }
              onError={() => handleImageError(activeImageSrc)}
              className="object-contain p-2 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <Image
              src={placeholderSrc}
              alt={product.name}
              fill
              sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1535px) 25vw, 20vw"
              unoptimized
              data-placeholder="true"
              className="object-contain p-2 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          )}
        </Link>
      </div>

      {/* Product Information */}
      <div className="pt-3 flex flex-col flex-1 justify-between min-w-0">
        <div className="min-w-0">
          {/* Brand & Category on ONE truncated line */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 uppercase tracking-wider mb-1 min-w-0">
            {product.brand ? (
              <Link
                href={`/brand/${brandSlug}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-neutral-900 transition-colors font-semibold truncate min-w-0 flex-1"
                title={product.brand}
              >
                {product.brand}
              </Link>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            {product.category ? (
              product.categorySlug ? (
                <Link
                  href={`/category/${product.categorySlug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-neutral-900 transition-colors truncate min-w-0 max-w-[52%] text-right shrink-0"
                  title={product.category}
                >
                  {product.category}
                </Link>
              ) : (
                <span className="truncate min-w-0 max-w-[52%] text-right shrink-0" title={product.category}>
                  {product.category}
                </span>
              )
            ) : null}
          </div>

          {/* Product Name: max 2 lines with fixed height for equal card alignment */}
          <Link href={`/product/${product.slug}`} className="block min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 line-clamp-2 leading-5 h-10 group-hover:text-neutral-600 transition-colors break-words">
              {product.name}
            </h3>
          </Link>

          {/* Ratings: strictly shown only when real approved reviews exist */}
          {verifiedStats.count > 0 && (
            <div className="mt-1.5 flex items-center">
              <StarRating
                rating={verifiedStats.rating}
                reviewCount={verifiedStats.count}
                size="sm"
                hideWhenEmpty
              />
            </div>
          )}
        </div>

        {/* Price Block + Full-Width Bottom Add / Inquire Button */}
        <div className="mt-3 pt-2.5 border-t border-neutral-100 flex flex-col gap-2.5 min-w-0">
          {isPriceOnRequest ? (
            <div className="flex flex-col min-w-0">
              <span
                data-product-price="true"
                className="text-base sm:text-[17px] font-bold text-amber-900 whitespace-nowrap leading-snug"
              >
                Price on request
              </span>
              <span className="text-[11px] text-neutral-500 mt-0.5">
                Contact us for best price
              </span>
            </div>
          ) : isSuperWholesale ? (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-base font-bold text-purple-950 whitespace-nowrap tabular-nums leading-snug">
                  {formatPrice(effectivePrice)}
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-700 text-white tracking-wider shrink-0">
                  Super Wholesale
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 line-through whitespace-nowrap tabular-nums mt-0.5">
                Retail: {Number(product.price) > 0 ? formatPrice(product.price) : 'Price on request'}
              </span>
            </div>
          ) : isWholesale && product.wholesalePrice && Number(product.wholesalePrice) > 0 ? (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-base font-bold text-neutral-950 whitespace-nowrap tabular-nums leading-snug">
                  {formatPrice(effectivePrice)}
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-neutral-900 text-white tracking-wider shrink-0">
                  Wholesale
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 line-through whitespace-nowrap tabular-nums mt-0.5">
                Retail: {Number(product.price) > 0 ? formatPrice(product.price) : 'Price on request'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col min-w-0">
              <span
                data-product-price="true"
                className="text-base sm:text-[17px] font-bold text-neutral-950 whitespace-nowrap tabular-nums leading-snug"
              >
                {formatPrice(product.price)}
              </span>
              {showRetailStrikethrough && (
                <span className="text-xs text-neutral-400 line-through whitespace-nowrap tabular-nums mt-0.5">
                  {formatPrice(Number(product.compareAtPrice))}
                </span>
              )}
            </div>
          )}

          {isPriceOnRequest ? (
            <a
              href={inquiryWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              data-product-inquire="true"
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-xs"
              aria-label={`Contact us for price of ${product.name} on WhatsApp`}
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Contact us for price</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={handleQuickAdd}
              data-product-add="true"
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                justAdded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-950 text-white hover:bg-neutral-800'
              }`}
              aria-label={`Quick add ${product.name} to cart`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  </Tilt3D>
  );
});
