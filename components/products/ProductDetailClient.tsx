'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  ShoppingBag,
  Zap,
  Truck,
  RotateCcw,
  ShieldCheck,
  Check,
  Star,
  Package,
  ZoomIn,
  ZoomOut,
  Play,
  ChevronLeft,
  ChevronRight,
  X,
  Minus,
  Plus,
  ArrowLeft,
  ChevronRight as BreadcrumbChevron,
} from 'lucide-react';
import { getProductBySlug, getProducts, fetchProductBySlug, syncProductsFromApi } from '@/lib/db/products';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { StarRating } from '@/components/ui/StarRating';
import { Badge } from '@/components/ui/Badge';
import { ProductCard } from '@/components/products/ProductCard';
import { formatPrice, DEFAULT_PRODUCT_IMAGE, getValidImageSrc } from '@/lib/utils';
import { Product, ProductModelVariant } from '@/types';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getProductEffectivePrice, getModelEffectivePrice } from '@/lib/wholesale';

function getProductMediaList(
  prod: Product | null,
  model?: ProductModelVariant | null
): { url: string; type: 'image' | 'video' }[] {
  if (!prod) return [];

  // 1. If selected model has specific images/videos, show model media
  if (model) {
    const modelMedia: { url: string; type: 'image' | 'video' }[] = [];
    if (Array.isArray(model.images)) {
      model.images.forEach((img) => {
        if (typeof img === 'string' && img.trim()) {
          modelMedia.push({ url: img.trim(), type: 'image' });
        }
      });
    }
    if (Array.isArray(model.videos)) {
      model.videos.forEach((vid) => {
        if (typeof vid === 'string' && vid.trim()) {
          modelMedia.push({ url: vid.trim(), type: 'video' });
        }
      });
    }
    if (modelMedia.length > 0) {
      return modelMedia;
    }
  }

  // 2. Fallback to main product media
  if (Array.isArray(prod.media) && prod.media.length > 0) {
    const list = (prod.media as any[])
      .filter((m) => m && ((typeof m === 'string' && m.trim()) || (typeof m === 'object' && m.url && m.url.trim())))
      .map((m) => ({
        url: (typeof m === 'string' ? m : m.url).trim(),
        type: (typeof m === 'object' && m.type === 'video' ? 'video' : 'image') as 'image' | 'video',
      }));
    if (list.length > 0) return list;
  }

  const list: { url: string; type: 'image' | 'video' }[] = [];
  if (Array.isArray(prod.images)) {
    prod.images.forEach((img) => {
      if (typeof img === 'string' && img.trim()) {
        list.push({ url: img.trim(), type: 'image' });
      }
    });
  }
  if (Array.isArray(prod.videos)) {
    prod.videos.forEach((vid) => {
      if (typeof vid === 'string' && vid.trim()) {
        list.push({ url: vid.trim(), type: 'video' });
      }
    });
  }
  if (list.length === 0) {
    list.push({ url: DEFAULT_PRODUCT_IMAGE, type: 'image' });
  }
  return list;
}

interface ProductDetailClientProps {
  initialProduct: Product;
  initialRelatedProducts?: Product[];
}

export function ProductDetailClient({
  initialProduct,
  initialRelatedProducts = [],
}: ProductDetailClientProps) {
  const router = useRouter();
  const { addToCart, buyNow } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isWholesale, isSuperWholesale } = useCustomerAuth();

  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>(initialRelatedProducts);

  // Variant selections
  const [selectedModel, setSelectedModel] = useState<string | undefined>(() => {
    if (initialProduct?.enableModelSelection && Array.isArray(initialProduct.models)) {
      const active = initialProduct.models.filter((m) => m.isActive !== false);
      return active[0]?.name || active[0]?.id || undefined;
    }
    return undefined;
  });
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    initialProduct?.variants?.sizes?.[0] || undefined
  );
  const [selectedColor, setSelectedColor] = useState<string | undefined>(() => {
    if (initialProduct?.enableColorSelection && Array.isArray(initialProduct.colors) && initialProduct.colors.length > 0) {
      const activeCols = initialProduct.colors.filter((c) => c.isActive !== false);
      return activeCols[0]?.name || undefined;
    }
    return initialProduct?.variants?.colors?.[0]?.name || undefined;
  });

  // Active models
  const isModelRequired = Boolean(
    product?.enableModelSelection &&
    Array.isArray(product.models) &&
    product.models.filter((m) => m.isActive !== false).length > 0
  );
  const activeModels = useMemo<any[]>(() => {
    if (!product?.enableModelSelection || !Array.isArray(product.models)) return [];
    return product.models.filter((m) => m.isActive !== false);
  }, [product]);

  const selectedModelObj = useMemo<any | null>(() => {
    if (!isModelRequired || !selectedModel) return null;
    return (
      activeModels.find(
        (m: any) => m.name.toLowerCase() === selectedModel.toLowerCase() || m.id === selectedModel
      ) || null
    );
  }, [isModelRequired, selectedModel, activeModels]);

  // Active colors
  const activeColors = useMemo<any[]>(() => {
    if (product?.enableColorSelection && Array.isArray(product.colors) && product.colors.length > 0) {
      return product.colors.filter((c) => c.isActive !== false);
    }
    if (Array.isArray(product?.variants?.colors) && product.variants.colors.length > 0) {
      return product.variants.colors.map((c) => ({ name: c.name, hex: c.hex, isActive: true }));
    }
    return [];
  }, [product]);

  // Media Gallery & Zoom Lightbox state
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const mediaList = useMemo(() => {
    return getProductMediaList(product, selectedModelObj);
  }, [product, selectedModelObj]);
  const activeMedia = mediaList[activeMediaIndex] || mediaList[0];
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [initialTouchZoom, setInitialTouchZoom] = useState(1);

  const handleZoomIn = () => {
    setLightboxZoom((prev) => Math.min(4, Number((prev + 0.5).toFixed(1))));
  };

  const handleZoomOut = () => {
    setLightboxZoom((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
      if (next === 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setLightboxZoom(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleToggleZoom = () => {
    if (lightboxZoom > 1) {
      handleResetZoom();
    } else {
      setLightboxZoom(2.5);
    }
  };

  const handlePrevMedia = () => {
    if (!product) return;
    setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
    handleResetZoom();
  };

  const handleNextMedia = () => {
    if (!product) return;
    setActiveMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
    handleResetZoom();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setLightboxZoom((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))));
    } else {
      setLightboxZoom((prev) => {
        const next = Math.max(1, Number((prev - 0.25).toFixed(2)));
        if (next === 1) setPanPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (lightboxZoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || lightboxZoom <= 1) return;
    setPanPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchStartDist(dist);
      setInitialTouchZoom(lightboxZoom);
    } else if (e.touches.length === 1 && lightboxZoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - panPosition.x,
        y: e.touches[0].clientY - panPosition.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = currentDist / touchStartDist;
      const newZoom = Math.min(4, Math.max(1, initialTouchZoom * scale));
      setLightboxZoom(Number(newZoom.toFixed(2)));
      if (newZoom === 1) setPanPosition({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging && lightboxZoom > 1) {
      setPanPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setTouchStartDist(null);
    setIsDragging(false);
  };

  useEffect(() => {
    if (!isLightboxOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
        handleResetZoom();
      } else if (e.key === 'ArrowLeft') {
        handlePrevMedia();
      } else if (e.key === 'ArrowRight') {
        handleNextMedia();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen, product, activeMediaIndex]);

  const [quantity, setQuantity] = useState(1);
  const [quantityInput, setQuantityInput] = useState('1');

  const updateQuantity = (val: number) => {
    if (!product) return;
    const clamped = Math.max(1, Math.round(val));
    setQuantity(clamped);
    setQuantityInput(String(clamped));
  };

  const handleQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (raw === '') {
      setQuantityInput('');
      return;
    }

    if (!/^\d+$/.test(raw)) {
      return;
    }

    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;

    if (!product) return;

    if (parsed === 0) {
      setQuantity(1);
      setQuantityInput('1');
      return;
    }

    setQuantity(parsed);
    setQuantityInput(String(parsed));
  };

  const handleQuantityInputBlur = () => {
    if (!product) return;
    if (!quantityInput || isNaN(parseInt(quantityInput, 10))) {
      setQuantity(1);
      setQuantityInput('1');
    } else {
      const parsed = parseInt(quantityInput, 10);
      const clamped = Math.max(1, parsed);
      setQuantity(clamped);
      setQuantityInput(String(clamped));
    }
  };

  const handleIncrement = () => {
    if (!product) return;
    updateQuantity(quantity + 1);
  };

  const handleDecrement = () => {
    updateQuantity(Math.max(1, quantity - 1));
  };

  // Interactive Tab State
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'reviews' | 'shipping'>('desc');

  // Review submission form state
  const [reviewName, setReviewName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewsList, setReviewsList] = useState<any[]>(initialProduct?.reviews || []);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Background sync for real-time price or review updates
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'products' && key !== 'reviews') return;
      const fresh = getProductBySlug(initialProduct.slug);
      if (fresh) {
        setProduct(fresh);
        setReviewsList(fresh.reviews || []);
      }
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [initialProduct.slug]);

  if (!product) {
    return null;
  }

  const isFavorited = isInWishlist(product.id);
  const canAddToCart = !isModelRequired || Boolean(selectedModel);

  // Pricing calculations
  const customerTier = isSuperWholesale
    ? 'SUPER_WHOLESALE'
    : isWholesale
    ? 'WHOLESALE'
    : 'RETAIL';

  const effectivePrice = selectedModelObj
    ? getModelEffectivePrice(product, selectedModelObj, customerTier)
    : getProductEffectivePrice(product, customerTier);

  const retailEffectivePrice = selectedModelObj
    ? selectedModelObj.price || product.price
    : product.price;

  const compareAt = product.compareAtPrice || 0;
  const isDiscounted = compareAt > effectivePrice;

  // Stock determination (Purchasing availability is unrestricted for all customers)
  const currentStock = selectedModelObj
    ? (selectedModelObj.shopStock ?? selectedModelObj.stock ?? 0)
    : (product.shopStock ?? product.stock ?? 0);
  const isOutOfStock = false;

  const handleAddToCart = () => {
    if (!product || !canAddToCart) return;
    const modelName = selectedModelObj?.name || selectedModel;
    const modelPrice = selectedModelObj?.price;
    const modelImage =
      selectedModelObj?.images?.[0] ||
      (product.images?.[0] ? getValidImageSrc(product.images) : undefined);

    addToCart(
      product,
      quantity,
      selectedSize,
      selectedColor,
      modelName,
      modelPrice,
      modelImage
    );
  };

  const handleBuyNow = () => {
    if (!product || !canAddToCart) return;
    const modelName = selectedModelObj?.name || selectedModel;
    const modelPrice = selectedModelObj?.price;
    const modelImage =
      selectedModelObj?.images?.[0] ||
      (product.images?.[0] ? getValidImageSrc(product.images) : undefined);

    buyNow(
      product,
      quantity,
      selectedSize,
      selectedColor,
      modelName,
      modelPrice,
      modelImage
    );
    router.push('/checkout?buyNow=1');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewComment.trim()) return;

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          author: reviewName.trim(),
          userName: reviewName.trim(),
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.review) {
          setReviewsList((prev) => [json.review, ...prev]);
        }
      }
    } catch {}

    setReviewSubmitted(true);
    setReviewName('');
    setReviewComment('');
    setReviewRating(5);
    setTimeout(() => setReviewSubmitted(false), 5000);
  };

  return (
    <div className="bg-white min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation & In-App Back Button */}
        <div className="flex items-center justify-between mb-8 pb-2 border-b border-neutral-100/80">
          <nav className="flex items-center gap-2 text-xs text-neutral-400 overflow-x-auto whitespace-nowrap">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/shop');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-colors mr-2 cursor-pointer shrink-0"
              title="Return to previous product list"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <Link href="/" className="hover:text-neutral-950 transition-colors">
              Home
            </Link>
            <BreadcrumbChevron className="w-3.5 h-3.5 shrink-0" />
            <Link href="/shop" className="hover:text-neutral-950 transition-colors">
              Shop
            </Link>
          {product.categorySlug && (
            <>
              <BreadcrumbChevron className="w-3.5 h-3.5 shrink-0" />
              <Link
                href={`/category/${product.categorySlug}`}
                className="hover:text-neutral-950 transition-colors"
              >
                {product.category || 'Accessories'}
              </Link>
            </>
          )}
          {product.brand && (
            <>
              <BreadcrumbChevron className="w-3.5 h-3.5 shrink-0" />
              <Link
                href={`/brand/${(product.brandSlug || product.brand).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                className="hover:text-neutral-950 transition-colors"
              >
                {product.brand}
              </Link>
            </>
          )}
          <BreadcrumbChevron className="w-3.5 h-3.5 shrink-0" />
          <span className="text-neutral-900 font-semibold truncate max-w-xs">{product.name}</span>
        </nav>
      </div>

        {/* Main Grid: Gallery on Left, Details on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Gallery Column */}
          <div className="space-y-4">
            {/* Main Stage */}
            <div className="relative aspect-square bg-neutral-50 rounded-3xl overflow-hidden border border-neutral-100 flex items-center justify-center group">
              {activeMedia?.type === 'video' ? (
                <div className="relative w-full h-full bg-black flex items-center justify-center">
                  <video
                    src={activeMedia.url}
                    controls
                    autoPlay
                    muted
                    loop
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="relative w-full h-full cursor-zoom-in"
                  onClick={() => {
                    setIsLightboxOpen(true);
                    setLightboxZoom(1);
                    setPanPosition({ x: 0, y: 0 });
                  }}
                >
                  <Image
                    src={activeMedia?.url || DEFAULT_PRODUCT_IMAGE}
                    alt={product.name}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain p-6 sm:p-10 transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-semibold text-neutral-800 shadow-sm flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Click to zoom</span>
                  </div>
                </div>
              )}

              {/* Prev/Next arrows on main view */}
              {mediaList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevMedia();
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-md text-neutral-800 flex items-center justify-center hover:bg-white hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextMedia();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-md text-neutral-800 flex items-center justify-center hover:bg-white hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {mediaList.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                {mediaList.map((m, idx) => (
                  <button
                    key={`${m.url}-${idx}`}
                    type="button"
                    onClick={() => {
                      setActiveMediaIndex(idx);
                      handleResetZoom();
                    }}
                    className={`relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      activeMediaIndex === idx
                        ? 'border-neutral-950 scale-95 shadow-sm'
                        : 'border-neutral-100 hover:border-neutral-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {m.type === 'video' ? (
                      <div className="relative w-full h-full bg-neutral-900 flex items-center justify-center text-white">
                        <Play className="w-6 h-6 fill-white" />
                      </div>
                    ) : (
                      <Image
                        src={m.url}
                        alt={`Thumbnail ${idx + 1}`}
                        fill
                        sizes="80px"
                        className="object-contain p-2"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Column */}
          <div className="space-y-6">
            {/* Header / Brand & Badges */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {product.brand && (
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    {product.brand}
                  </span>
                )}
                {product.isNewArrival && (
                  <Badge variant="new">
                    New Arrival
                  </Badge>
                )}
                {product.isBestSeller && (
                  <Badge variant="bestseller">
                    Best Seller
                  </Badge>
                )}
                {isDiscounted && (
                  <Badge variant="sale">
                    Sale
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
                {product.name}
              </h1>

              {product.tagline && (
                <p className="text-xs sm:text-sm text-neutral-500 font-medium">
                  {product.tagline}
                </p>
              )}

              {/* Rating */}
              <div className="flex items-center gap-3 pt-1">
                <StarRating rating={product.rating || 5} reviewCount={product.reviewCount || 1} />
                <span className="text-xs text-neutral-400">·</span>
                <span className="text-xs text-neutral-500 font-medium">
                  SKU: {product.sku || `ALH-${product.id}`}
                </span>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="p-5 rounded-3xl bg-neutral-50/70 border border-neutral-100/80 space-y-2">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-neutral-950">
                  {formatPrice(effectivePrice)}
                </span>
                {isDiscounted && (
                  <span className="text-sm sm:text-base text-neutral-400 line-through">
                    {formatPrice(compareAt)}
                  </span>
                )}
                {isDiscounted && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Save {Math.round(((compareAt - effectivePrice) / compareAt) * 100)}%
                  </span>
                )}
              </div>

              {/* Wholesale Tier Notice */}
              {(isWholesale || isSuperWholesale) && retailEffectivePrice > effectivePrice && (
                <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  <Zap className="w-3.5 h-3.5 fill-amber-500" />
                  <span>
                    Wholesale pricing unlocked (Retail: {formatPrice(retailEffectivePrice)})
                  </span>
                </div>
              )}

              {/* Stock Indicator */}
              <div className="pt-2 flex items-center gap-2 text-xs font-semibold">
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  In Stock · Ready for Immediate Dispatch
                </span>
              </div>
            </div>

            {/* Model / Device Selector */}
            {isModelRequired && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    Select Device Model <span className="text-rose-500">*</span>
                  </label>
                  {selectedModelObj && (
                    <span className="text-xs text-neutral-500 font-semibold">
                      {selectedModelObj.name}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1 border border-neutral-100 rounded-2xl">
                  {activeModels.map((m: any) => {
                    const isSelected =
                      selectedModel?.toLowerCase() === m.name.toLowerCase() ||
                      selectedModel === m.id;

                    return (
                      <button
                        key={m.id || m.name}
                        type="button"
                        onClick={() => setSelectedModel(m.name)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-neutral-950 bg-neutral-950 text-white shadow-xs'
                            : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300'
                        }`}
                      >
                        <div className="truncate">{m.name}</div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            isSelected ? 'text-neutral-300' : 'text-neutral-500'
                          }`}
                        >
                          {formatPrice(
                            getModelEffectivePrice(product, m, customerTier)
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Color Selector */}
            {activeColors.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    Color: <span className="text-neutral-500 font-normal">{selectedColor || 'Choose a color'}</span>
                  </label>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {activeColors.map((c) => {
                    const isSelected = selectedColor?.toLowerCase() === c.name.toLowerCase();
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedColor(c.name)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-neutral-950 bg-neutral-950 text-white shadow-xs'
                            : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300'
                        }`}
                      >
                        {c.hex && (
                          <span
                            className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                        )}
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {Array.isArray(product.variants?.sizes) && product.variants.sizes.length > 0 && (
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                  Size: <span className="text-neutral-500 font-normal">{selectedSize}</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {product.variants.sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        selectedSize === s
                          ? 'border-neutral-950 bg-neutral-950 text-white'
                          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity and Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                {/* Quantity Input */}
                <div className="inline-flex items-center border border-neutral-300 rounded-full p-1 bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={quantity <= 1}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantityInput}
                    onChange={handleQuantityInputChange}
                    onBlur={handleQuantityInputBlur}
                    className="w-12 text-center text-xs sm:text-sm font-bold text-neutral-900 bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleIncrement}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Add to Cart */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!canAddToCart}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold tracking-wider uppercase transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Cart</span>
                </button>

                {/* Wishlist Button */}
                <button
                  type="button"
                  onClick={() => product && toggleWishlist(product.id)}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    isFavorited
                      ? 'border-rose-200 bg-rose-50 text-rose-600'
                      : 'border-neutral-300 hover:border-neutral-400 text-neutral-700 bg-white'
                  }`}
                  aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart className={`w-5 h-5 ${isFavorited ? 'fill-rose-600' : ''}`} />
                </button>
              </div>

              {/* Buy Now Button */}
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!canAddToCart}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs sm:text-sm font-bold tracking-wider uppercase transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-neutral-950" />
                <span>Buy Now</span>
              </button>
            </div>

            {/* Trust Assurances */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-neutral-100">
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <Truck className="w-4 h-4 text-neutral-950 shrink-0" />
                <span>Cash on Delivery across Pakistan</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <RotateCcw className="w-4 h-4 text-neutral-950 shrink-0" />
                <span>7-Day Return / Replacement</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <ShieldCheck className="w-4 h-4 text-neutral-950 shrink-0" />
                <span>100% Verified Quality Guaranteed</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <Package className="w-4 h-4 text-neutral-950 shrink-0" />
                <span>Secure Bubble-Wrapped Packaging</span>
              </div>
            </div>
          </div>
        </div>

        {/* Informational Tabs: Description, Specs, Reviews, Shipping */}
        <div className="mt-16 sm:mt-24 pt-8 border-t border-neutral-100">
          <div className="flex items-center gap-2 sm:gap-4 border-b border-neutral-200 overflow-x-auto scrollbar-none pb-px">
            <button
              type="button"
              onClick={() => setActiveTab('desc')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold tracking-wider uppercase transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === 'desc'
                  ? 'border-neutral-950 text-neutral-950'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Description
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold tracking-wider uppercase transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === 'specs'
                  ? 'border-neutral-950 text-neutral-950'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Specifications
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold tracking-wider uppercase transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === 'reviews'
                  ? 'border-neutral-950 text-neutral-950'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Customer Reviews ({reviewsList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shipping')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold tracking-wider uppercase transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === 'shipping'
                  ? 'border-neutral-950 text-neutral-950'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Shipping & Returns
            </button>
          </div>

          <div className="py-8">
            {activeTab === 'desc' && (
              <div className="prose prose-neutral max-w-none text-xs sm:text-sm text-neutral-600 leading-relaxed space-y-4">
                <p>{product.description || 'No detailed description available for this product.'}</p>
                {Array.isArray(product.features) && product.features.length > 0 && (
                  <div className="pt-4">
                    <h4 className="text-sm font-bold text-neutral-950 mb-3">Key Features:</h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-none p-0">
                      {product.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="max-w-2xl">
                {product.specifications && typeof product.specifications === 'object' && Object.keys(product.specifications).length > 0 ? (
                  <dl className="divide-y divide-neutral-100 text-xs sm:text-sm">
                    {Object.entries(product.specifications).map(([k, v]) => (
                      <div key={k} className="py-2.5 grid grid-cols-3 gap-4">
                        <dt className="font-semibold text-neutral-950 capitalize">{k}</dt>
                        <dd className="col-span-2 text-neutral-600">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Standard technical specifications apply. Contact support for bulk technical sheets.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-8 max-w-3xl">
                {/* Submit Review */}
                <form onSubmit={handleReviewSubmit} className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100 space-y-4">
                  <h4 className="text-sm font-bold text-neutral-950">Write a Customer Review</h4>
                  {reviewSubmitted && (
                    <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                      Thank you! Your verified review has been submitted.
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-neutral-600">Your Name</label>
                      <input
                        type="text"
                        value={reviewName}
                        onChange={(e) => setReviewName(e.target.value)}
                        required
                        placeholder="e.g., Usman Tariq"
                        className="mt-1 w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase text-neutral-600">Rating</label>
                      <select
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                        className="mt-1 w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-900"
                      >
                        <option value={5}>5 Stars - Excellent</option>
                        <option value={4}>4 Stars - Very Good</option>
                        <option value={3}>3 Stars - Average</option>
                        <option value={2}>2 Stars - Below Average</option>
                        <option value={1}>1 Star - Poor</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-neutral-600">Review Feedback</label>
                    <textarea
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      required
                      placeholder="Share your experience with this accessory..."
                      className="mt-1 w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-900 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-full bg-neutral-950 text-white text-xs font-bold hover:bg-neutral-800 transition-colors"
                  >
                    Submit Review
                  </button>
                </form>

                {/* Review List */}
                <div className="space-y-4">
                  {reviewsList.length === 0 ? (
                    <p className="text-xs text-neutral-500">No reviews yet. Be the first to review this product!</p>
                  ) : (
                    reviewsList.map((rev, idx) => (
                      <div key={idx} className="p-4 rounded-2xl border border-neutral-100 bg-white space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-950">{rev.userName}</span>
                          <span className="text-[10px] text-neutral-400">{rev.date || 'Verified Buyer'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < (rev.rating || 5)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-neutral-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-neutral-600">{rev.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="max-w-2xl text-xs sm:text-sm text-neutral-600 space-y-3 leading-relaxed">
                <h4 className="text-sm font-bold text-neutral-950">Nationwide Delivery</h4>
                <p>
                  We deliver across all cities and districts of Pakistan via Leopard, TCS, and PostEx courier networks. Orders are typically processed within 24 hours. Delivery takes 2-4 business days.
                </p>
                <h4 className="text-sm font-bold text-neutral-950 pt-2">Easy 7-Day Returns</h4>
                <p>
                  If you receive a defective or incorrect item, contact our support helpline within 7 days of delivery for a hassle-free replacement or store credit refund.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 sm:mt-24 pt-12 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-950 tracking-tight">
                Related Accessories
              </h3>
              {product.categorySlug && (
                <Link
                  href={`/category/${product.categorySlug}`}
                  className="text-xs font-bold text-neutral-950 hover:underline flex items-center gap-1"
                >
                  <span>View All in Category</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Zoom Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none"
            onWheel={handleWheel}
          >
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-black/40 backdrop-blur-md z-10 text-white border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold tracking-wider uppercase text-neutral-300">
                  {product.name}
                </span>
                <span className="text-xs text-neutral-500">
                  ({activeMediaIndex + 1} / {mediaList.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={lightboxZoom <= 1}
                  className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono w-12 text-center text-neutral-400">
                  {Math.round(lightboxZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={lightboxZoom >= 4}
                  className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer ml-2"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stage */}
            <div
              className={`flex-1 relative flex items-center justify-center overflow-hidden ${
                lightboxZoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={(e) => {
                if (e.target === e.currentTarget && lightboxZoom === 1) {
                  handleToggleZoom();
                }
              }}
            >
              <div
                style={{
                  transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${lightboxZoom})`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                }}
                className="relative w-full h-full max-w-4xl max-h-[80vh] flex items-center justify-center"
              >
                <Image
                  src={activeMedia?.url || DEFAULT_PRODUCT_IMAGE}
                  alt={product.name}
                  fill
                  sizes="100vw"
                  className="object-contain p-4 select-none pointer-events-none"
                  priority
                />
              </div>

              {/* Prev / Next buttons in Lightbox */}
              {mediaList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevMedia();
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextMedia();
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
