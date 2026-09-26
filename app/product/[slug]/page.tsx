'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
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
  Sparkles,
  ChevronRight as BreadcrumbChevron,
} from 'lucide-react';
import { getProductBySlug, getProducts } from '@/lib/db/products';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { StarRating } from '@/components/ui/StarRating';
import { Badge } from '@/components/ui/Badge';
import { ProductCard } from '@/components/products/ProductCard';
import { formatPrice, DEFAULT_PRODUCT_IMAGE } from '@/lib/utils';
import { Product, ProductModelVariant, ProductColorVariant } from '@/types';
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

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isWholesale } = useCustomerAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  // Variant selections
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);

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

  const maxStock = Math.max(
    0,
    selectedModelObj
      ? (selectedModelObj.stock !== undefined ? selectedModelObj.stock : (product?.stock ?? 0))
      : (product?.stock ?? 0)
  );

  const updateQuantity = (val: number) => {
    if (!product) return;
    const maxAvailable = Math.max(1, maxStock);
    const clamped = Math.min(maxAvailable, Math.max(1, Math.round(val)));
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
    const maxAvailable = Math.max(1, maxStock);

    if (parsed === 0) {
      setQuantity(1);
      setQuantityInput('1');
      return;
    }

    if (parsed > maxAvailable) {
      setQuantity(maxAvailable);
      setQuantityInput(String(maxAvailable));
      return;
    }

    setQuantity(parsed);
    setQuantityInput(String(parsed));
  };

  const handleQuantityInputBlur = () => {
    if (!product) return;
    const maxAvailable = Math.max(1, maxStock);
    if (!quantityInput || isNaN(parseInt(quantityInput, 10))) {
      setQuantity(1);
      setQuantityInput('1');
    } else {
      const parsed = parseInt(quantityInput, 10);
      const clamped = Math.min(maxAvailable, Math.max(1, parsed));
      setQuantity(clamped);
      setQuantityInput(String(clamped));
    }
  };

  const handleIncrement = () => {
    if (!product) return;
    const maxAvailable = Math.max(1, maxStock);
    updateQuantity(Math.min(maxAvailable, quantity + 1));
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
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const loadData = () => {
    const found = getProductBySlug(resolvedParams.slug);
    if (found && (found as any).status !== 'archived' && (found as any).isActive !== false) {
      setProduct(found);
      if (!selectedSize && found.variants?.sizes?.[0]) {
        setSelectedSize(found.variants.sizes[0]);
      }
      if (found.enableColorSelection && Array.isArray(found.colors) && found.colors.length > 0) {
        const activeCols = found.colors.filter((c) => c.isActive !== false);
        if (activeCols.length > 0) {
          setSelectedColor((prev) => prev || activeCols[0].name);
        }
      } else if (found.variants?.colors?.[0]?.name) {
        setSelectedColor((prev) => prev || found.variants?.colors?.[0]?.name);
      }
      setReviewsList(found.reviews || []);

      const all = getProducts().filter(
        (p) =>
          (p as any).status !== 'archived' &&
          (p as any).status !== 'inactive' &&
          (p as any).isActive !== false &&
          p.id !== found.id &&
          p.categorySlug === found.categorySlug
      );
      setRelatedProducts(all.slice(0, 4));
    } else {
      setProduct(null);
    }
    setIsReady(true);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [resolvedParams.slug]);

  if (!isReady) {
    return (
      <div className="py-24 text-center text-neutral-400 min-h-[50vh] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-20 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4 shadow-inner">
          <Package className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-neutral-950 mb-2">Product Not Available</h1>
        <p className="text-xs text-neutral-500 max-w-sm mb-6 leading-relaxed">
          This product is no longer available in our catalog or has been permanently removed.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-sm"
        >
          <span>Explore All Products</span>
        </Link>
      </div>
    );
  }

  const isFavorited = isInWishlist(product.id);
  const isOutOfStock = maxStock <= 0;
  const canAddToCart = !isOutOfStock && (!isModelRequired || Boolean(selectedModel));

  // Pricing calculations
  let effectivePrice: number;
  let isWholesaleActive = false;
  let comparePrice: number | undefined;

  if (selectedModelObj) {
    if (isWholesale) {
      effectivePrice = getModelEffectivePrice(product, selectedModelObj, 'WHOLESALE');
      isWholesaleActive =
        Boolean(selectedModelObj.wholesalePrice && Number(selectedModelObj.wholesalePrice) > 0) ||
        Boolean(product.wholesalePrice && Number(product.wholesalePrice) > 0);
    } else {
      effectivePrice = Number(selectedModelObj.price) || 0;
    }
    comparePrice = selectedModelObj.compareAtPrice;
  } else {
    effectivePrice = getProductEffectivePrice(product, isWholesale ? 'WHOLESALE' : 'RETAIL');
    isWholesaleActive = Boolean(isWholesale && product.wholesalePrice && Number(product.wholesalePrice) > 0);
    comparePrice = product.compareAtPrice;
  }

  const hasDiscount =
    !isWholesaleActive && comparePrice !== undefined && comparePrice > effectivePrice;
  const discountPercentage =
    hasDiscount && comparePrice
      ? Math.round(((comparePrice - effectivePrice) / comparePrice) * 100)
      : undefined;

  const handleAddToCart = () => {
    if (!canAddToCart) return;
    const mediaForModel = getProductMediaList(product, selectedModelObj);
    const selectedImg = mediaForModel[0]?.url;
    addToCart(
      product,
      quantity,
      selectedSize,
      selectedColor,
      selectedModelObj?.name,
      effectivePrice,
      selectedImg
    );
  };

  const handleBuyNow = () => {
    if (!canAddToCart) return;
    const mediaForModel = getProductMediaList(product, selectedModelObj);
    const selectedImg = mediaForModel[0]?.url;
    addToCart(
      product,
      quantity,
      selectedSize,
      selectedColor,
      selectedModelObj?.name,
      effectivePrice,
      selectedImg
    );
    router.push('/checkout');
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewComment.trim()) return;

    const newRev = {
      id: `rev-${Date.now()}`,
      author: reviewName,
      rating: reviewRating,
      date: 'Just now',
      title: 'Verified Customer Feedback',
      comment: reviewComment,
      verified: true,
    };

    setReviewsList([newRev, ...reviewsList]);
    setReviewSubmitted(true);
    setReviewName('');
    setReviewComment('');
  };

  return (
    <div className="bg-white py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-8 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-neutral-900 transition-colors">
            Home
          </Link>
          <BreadcrumbChevron className="w-3 h-3 text-neutral-300 shrink-0" />
          <Link href="/shop" className="hover:text-neutral-900 transition-colors">
            Shop
          </Link>
          <BreadcrumbChevron className="w-3 h-3 text-neutral-300 shrink-0" />
          <Link
            href={`/shop?category=${product.categorySlug}`}
            className="hover:text-neutral-900 transition-colors"
          >
            {product.category}
          </Link>
          <BreadcrumbChevron className="w-3 h-3 text-neutral-300 shrink-0" />
          <span className="text-neutral-900 font-semibold truncate max-w-[220px]">
            {product.name}
          </span>
        </nav>

        {/* Top Product Section: Left Media + Right Buy Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* LEFT: Product Media Gallery */}
          <div className="lg:col-span-7 flex flex-col-reverse md:flex-row gap-4">
            {/* Thumbnails */}
            {mediaList.length > 1 && (
              <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto shrink-0 py-1 max-h-[540px]">
                {mediaList.map((item: any, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveMediaIndex(idx);
                      handleResetZoom();
                    }}
                    className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-neutral-50 border-2 transition-all cursor-pointer shrink-0 ${
                      activeMediaIndex === idx
                        ? 'border-neutral-950 shadow-md ring-2 ring-neutral-950/10'
                        : 'border-neutral-200/80 hover:border-neutral-400 opacity-70 hover:opacity-100'
                    }`}
                    title={item.type === 'video' ? `Product Video ${idx + 1}` : `Product Image ${idx + 1}`}
                  >
                    {item.type === 'video' ? (
                      <div className="w-full h-full relative bg-neutral-900 flex items-center justify-center">
                        <video
                          src={item.url}
                          muted
                          preload="metadata"
                          className="w-full h-full object-cover opacity-85"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="w-6 h-6 rounded-full bg-white/95 flex items-center justify-center text-neutral-950 shadow-sm">
                            <Play className="w-3 h-3 fill-neutral-950 ml-0.5" />
                          </div>
                        </div>
                        <span className="absolute bottom-1 right-1 bg-neutral-950/80 text-white text-[8px] font-bold uppercase px-1 rounded-sm">
                          Video
                        </span>
                      </div>
                    ) : (
                      <Image
                        src={item.url}
                        alt={`${product.name} thumbnail ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Main Stage Media */}
            <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-neutral-50/80 border border-neutral-200/80 shadow-xs group select-none">
              {activeMedia.type === 'video' ? (
                <div className="w-full h-full bg-neutral-950 flex items-center justify-center relative">
                  <video
                    key={activeMedia.url}
                    src={activeMedia.url}
                    controls
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="w-full h-full relative cursor-zoom-in"
                  onClick={() => {
                    setIsLightboxOpen(true);
                    setLightboxZoom(1);
                    setPanPosition({ x: 0, y: 0 });
                  }}
                  title="Click to zoom image"
                >
                  <Image
                    src={activeMedia.url}
                    alt={product.name}
                    fill
                    priority
                    className="object-cover transition-transform duration-500 group-hover:scale-103"
                  />
                  {/* Subtle Zoom Hint */}
                  <span className="absolute bottom-4 right-4 z-10 hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-950/75 hover:bg-neutral-950 text-white text-[11px] font-semibold backdrop-blur-sm shadow-sm transition-all">
                    <ZoomIn className="w-3.5 h-3.5" /> Tap to zoom
                  </span>
                </div>
              )}

              {/* Promotional Marketing Badges (Only New, Sale, Best Seller - No Stock Status) */}
              <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10 pointer-events-none">
                {product.isNew && <Badge variant="new">New</Badge>}
                {hasDiscount && product.discountPercentage && (
                  <Badge variant="sale">-{product.discountPercentage}% Off</Badge>
                )}
                {product.isBestSeller && <Badge variant="bestseller">Best Seller</Badge>}
              </div>

              {/* Wishlist Heart */}
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center transition-all hover:scale-105 shadow-sm cursor-pointer border border-neutral-100 ${
                  isFavorited ? 'text-rose-500' : 'text-neutral-600 hover:text-rose-500'
                }`}
                aria-label="Wishlist"
              >
                <Heart className={`w-5 h-5 ${isFavorited ? 'fill-rose-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* RIGHT: Product Buy Box */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              {/* Brand Tag (No stock status or stock quantity) */}
              {product.brand && (
                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">
                  {product.brand}
                </div>
              )}

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-950 leading-tight">
                {product.name}
              </h1>

              {/* Star Rating & Reviews */}
              <div className="mt-2.5 flex items-center gap-3">
                <StarRating rating={product.rating} reviewCount={product.reviewCount} size="md" />
                <span className="text-neutral-300">•</span>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  {reviewsList.length} reviews
                </button>
              </div>
            </div>

            {/* Clean Price Section (No Standard Rate, No Rate/pc, No Total) */}
            <div className="py-4 border-y border-neutral-100">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono text-neutral-950 tracking-tight">
                  {formatPrice(effectivePrice)}
                </span>
                {isWholesaleActive && (
                  <span className="px-3 py-1 rounded-full bg-neutral-950 text-white font-bold text-xs uppercase tracking-wider">
                    Wholesale Price
                  </span>
                )}
                {isWholesaleActive ? (
                  <span className="text-base text-neutral-400 line-through font-mono">
                    Retail: {formatPrice(product.price)}
                  </span>
                ) : hasDiscount ? (
                  <>
                    {comparePrice ? (
                      <span className="text-lg text-neutral-400 line-through font-mono">
                        {formatPrice(comparePrice)}
                      </span>
                    ) : null}
                    {discountPercentage ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 font-bold text-xs uppercase tracking-wider border border-rose-100">
                        Save {discountPercentage}%
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {/* Short Description */}
            {product.description && (
              <p className="text-sm text-neutral-600 leading-relaxed font-normal">
                {product.description}
              </p>
            )}

            {/* Mobile Model Selector */}
            {isModelRequired && activeModels.length > 0 && (
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-neutral-800 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span>Select Model:</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </div>
                  <span className="text-neutral-500 font-normal">
                    {selectedModel || 'Please choose a model'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeModels.map((m: any) => {
                    const isSelected = selectedModel === m.name;
                    const isModelOut = m.stock !== undefined && m.stock <= 0;
                    return (
                      <button
                        key={m.id || m.name}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.name);
                          setActiveMediaIndex(0);
                          handleResetZoom();
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border ${
                          isSelected
                            ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs ring-2 ring-neutral-950/10'
                            : 'bg-neutral-50 text-neutral-800 hover:bg-neutral-100 hover:border-neutral-300 border-neutral-200'
                        } ${isModelOut ? 'opacity-60' : ''}`}
                      >
                        <span>{m.name}</span>
                        <span
                          className={`text-[10px] font-mono font-normal ${
                            isSelected ? 'text-neutral-300' : 'text-neutral-500'
                          }`}
                        >
                          Rs. {Number(m.price).toLocaleString('en-PK')}
                        </span>
                        {isModelOut && (
                          <span className="text-[10px] text-rose-500 font-normal ml-0.5">
                            (Out of stock)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Color Variant Selector */}
            {activeColors.length > 0 && (
              <div>
                <div className="flex justify-between text-xs font-semibold text-neutral-800 mb-2">
                  <span>Color:</span>
                  <span className="text-neutral-500 font-normal">{selectedColor || 'Select a color'}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {activeColors.map((c: any) => {
                    const isSelected = selectedColor === c.name;
                    const hasValidHex = Boolean(c.hex && c.hex.startsWith('#'));
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedColor(c.name)}
                        className={`relative group px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs ring-2 ring-neutral-950/10'
                            : 'bg-neutral-50 text-neutral-800 hover:bg-neutral-100 border-neutral-200'
                        }`}
                        title={c.name}
                      >
                        {hasValidHex && (
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-2xs inline-block shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                        )}
                        <span>{c.name}</span>
                        {isSelected && (
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Variant Selector */}
            {product.variants?.sizes && product.variants.sizes.length > 0 && (
              <div>
                <div className="flex justify-between text-xs font-semibold text-neutral-800 mb-2">
                  <span>Size:</span>
                  <span className="text-neutral-500 font-normal">{selectedSize}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.variants.sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        selectedSize === s
                          ? 'bg-neutral-950 text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border border-neutral-200/60'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Warning Notice */}
            {isOutOfStock ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>
                  {selectedModelObj ? `${selectedModelObj.name} is currently out of stock.` : 'Currently out of stock.'}
                </span>
              </div>
            ) : maxStock > 0 && maxStock <= 5 ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>
                  Only {maxStock} left in stock - order soon!
                </span>
              </div>
            ) : null}

            {/* Quantity Stepper & Add to Bag / Buy Now Buttons */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                {/* Minimalist Quantity Stepper */}
                <div className="flex items-center border border-neutral-200 rounded-full bg-neutral-50/80 p-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={isOutOfStock || quantity <= 1}
                    aria-label="Decrease quantity"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-700 hover:bg-white hover:text-neutral-950 transition-colors cursor-pointer disabled:opacity-30 select-none"
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
                    disabled={isOutOfStock}
                    aria-label="Product quantity"
                    className="w-12 text-center font-mono text-sm font-bold text-neutral-950 bg-transparent border-none outline-none focus:ring-0 select-all p-0"
                  >
                  </input>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={isOutOfStock || quantity >= maxStock}
                    aria-label="Increase quantity"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-700 hover:bg-white hover:text-neutral-950 transition-colors cursor-pointer disabled:opacity-30 select-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Add to Cart Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!canAddToCart}
                  className={`flex-1 py-4 px-6 rounded-full font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm ${
                    !canAddToCart
                      ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed select-none'
                      : 'bg-neutral-950 text-white hover:bg-neutral-800 cursor-pointer active:scale-[0.99]'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>
                    {isOutOfStock
                      ? 'Unavailable'
                      : isModelRequired && !selectedModel
                      ? 'Select a Model'
                      : 'Add to Bag'}
                  </span>
                </button>
              </div>

              {/* Buy Now Button */}
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!canAddToCart}
                className={`w-full py-4 px-6 rounded-full font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm ${
                  !canAddToCart
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed select-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-[0.99]'
                }`}
              >
                <Zap className={`w-4 h-4 ${!canAddToCart ? 'fill-neutral-400' : 'fill-white'}`} />
                <span>
                  {isOutOfStock
                    ? 'Unavailable'
                    : isModelRequired && !selectedModel
                    ? 'Select a Model'
                    : 'Buy It Now'}
                </span>
              </button>
            </div>

            {/* Value & Trust Guarantees */}
            <div className="pt-5 border-t border-neutral-100 grid grid-cols-2 gap-3.5 text-xs text-neutral-600">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-neutral-900 shrink-0" />
                <span>Free delivery over Rs. 5,000</span>
              </div>
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4 text-neutral-900 shrink-0" />
                <span>Easy 7-day replacement warranty</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-neutral-900 shrink-0" />
                <span>Official brand warranty</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Genuine Guaranteed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Information Tabs */}
        <div className="mt-16 sm:mt-24 pt-10 border-t border-neutral-100">
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-neutral-200 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('desc')}
              className={`pb-4 px-4 text-sm font-semibold whitespace-nowrap transition-colors relative cursor-pointer ${
                activeTab === 'desc' ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Description & Details
              {activeTab === 'desc' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950"
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab('specs')}
              className={`pb-4 px-4 text-sm font-semibold whitespace-nowrap transition-colors relative cursor-pointer ${
                activeTab === 'specs' ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Specifications
              {activeTab === 'specs' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950"
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`pb-4 px-4 text-sm font-semibold whitespace-nowrap transition-colors relative cursor-pointer ${
                activeTab === 'reviews' ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Reviews ({reviewsList.length})
              {activeTab === 'reviews' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950"
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab('shipping')}
              className={`pb-4 px-4 text-sm font-semibold whitespace-nowrap transition-colors relative cursor-pointer ${
                activeTab === 'shipping' ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Shipping & Delivery
              {activeTab === 'shipping' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-950"
                />
              )}
            </button>
          </div>

          {/* Tab Panels */}
          <div className="py-8 max-w-4xl">
            {activeTab === 'desc' && (
              <div className="prose prose-neutral max-w-none text-neutral-600 text-sm leading-relaxed space-y-4">
                <p>{product.longDescription || product.description}</p>
                {product.features && product.features.length > 0 && (
                  <div className="pt-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-950 mb-3">
                      Key Highlights & Features
                    </h4>
                    <ul className="space-y-2 list-none p-0">
                      {product.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-neutral-700">
                          <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="pt-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-950 mb-1">
                    Authenticity & Guarantee
                  </h4>
                  <p>
                    Every accessory sourced by Al-Hamd Mobile is 100% genuine and verified. Dispatched in original sealed retail packaging with standard manufacturer warranty.
                  </p>
                </div>
              </div>
            )}

            {/* Specifications Tab - Clean key-value list with NO SKU */}
            {activeTab === 'specs' && (
              <div className="border border-neutral-200/80 rounded-2xl overflow-hidden divide-y divide-neutral-100 text-xs sm:text-sm">
                {product.brand && (
                  <div className="grid grid-cols-3 p-3.5 bg-neutral-50/50">
                    <span className="font-semibold text-neutral-500">Brand</span>
                    <span className="col-span-2 text-neutral-900 font-medium">{product.brand}</span>
                  </div>
                )}
                {product.category && (
                  <div className="grid grid-cols-3 p-3.5">
                    <span className="font-semibold text-neutral-500">Category</span>
                    <span className="col-span-2 text-neutral-900 font-medium">{product.category}</span>
                  </div>
                )}
                {product.specifications &&
                  Object.entries(product.specifications).map(([key, val], idx) => (
                    <div
                      key={key}
                      className={`grid grid-cols-3 p-3.5 ${idx % 2 === 0 ? 'bg-neutral-50/50' : ''}`}
                    >
                      <span className="font-semibold text-neutral-500">{key}</span>
                      <span className="col-span-2 text-neutral-900 font-medium">{val}</span>
                    </div>
                  ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-8">
                {/* Submit review */}
                <form
                  onSubmit={handleSubmitReview}
                  className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200/80 space-y-4"
                >
                  <h4 className="text-sm font-bold text-neutral-950">Leave a Verified Review</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      placeholder="Your name..."
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                    />
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer"
                    >
                      <option value="5">★★★★★ (5 Stars - Exceptional)</option>
                      <option value="4">★★★★☆ (4 Stars - Great)</option>
                      <option value="3">★★★☆☆ (3 Stars - Average)</option>
                      <option value="2">★★☆☆☆ (2 Stars - Below Expectation)</option>
                      <option value="1">★☆☆☆☆ (1 Star - Poor)</option>
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    required
                    placeholder="Share your experience with the build quality, fast charging, or audio performance..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-neutral-950 text-white rounded-full text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      Submit Review
                    </button>
                    {reviewSubmitted && (
                      <span className="text-xs text-emerald-600 font-semibold">
                        ✓ Thank you! Your review has been added.
                      </span>
                    )}
                  </div>
                </form>

                {/* Reviews List */}
                <div className="space-y-4 divide-y divide-neutral-100">
                  {reviewsList.map((rev) => (
                    <div key={rev.id} className="pt-4 first:pt-0 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-900">{rev.author}</span>
                          {rev.verified && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                              Verified Buyer
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400">{rev.date}</span>
                      </div>
                      <div className="flex items-center text-amber-500">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="text-xs text-neutral-600 space-y-3 leading-relaxed">
                <p>
                  <strong>Standard Delivery:</strong> 3-5 business days nationwide. Free delivery on orders over Rs. 5,000.
                </p>
                <p>
                  <strong>Express Courier:</strong> 1-2 business days with direct tracking number provided via SMS and email.
                </p>
                <p>
                  Cash on Delivery (COD) available across Pakistan. All accessories are shipped in protective, tamper-evident shockproof packaging.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Related Products Grid */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 pt-16 border-t border-neutral-100">
            <h3 className="text-xl font-bold text-neutral-950 mb-6">Complete The Look</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox / Zoom Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsLightboxOpen(false);
                handleResetZoom();
              }
            }}
          >
            {/* Lightbox Header */}
            <div className="p-4 sm:px-6 flex items-center justify-between border-b border-neutral-800 text-white z-20">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-neutral-400 font-mono tracking-wider">
                  {activeMediaIndex + 1} / {mediaList.length}
                </span>
                <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full bg-neutral-800 uppercase tracking-wider text-[10px]">
                  {activeMedia?.type === 'video' ? 'Video' : 'Image'}
                </span>
                <span className="text-xs font-semibold text-neutral-200 truncate max-w-[200px] sm:max-w-md hidden sm:inline">
                  {product?.name}
                </span>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {activeMedia?.type === 'image' && (
                  <div className="flex items-center gap-1 bg-neutral-900/90 rounded-full p-1 border border-neutral-800 text-xs">
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      disabled={lightboxZoom <= 1}
                      className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Zoom Out (-)"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleZoom}
                      className="px-2.5 py-1 text-[11px] font-mono font-bold text-neutral-200 hover:text-white transition-colors cursor-pointer"
                      title="Toggle 1x / 2.5x Zoom"
                    >
                      {Math.round(lightboxZoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      disabled={lightboxZoom >= 4}
                      className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Zoom In (+)"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                      title="Reset Zoom (0)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsLightboxOpen(false);
                    handleResetZoom();
                  }}
                  className="p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-neutral-800"
                  title="Close (Esc)"
                  aria-label="Close Lightbox"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewport */}
            <div
              className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6"
              onWheel={activeMedia?.type === 'image' ? handleWheel : undefined}
              onMouseDown={activeMedia?.type === 'image' ? handleMouseDown : undefined}
              onMouseMove={activeMedia?.type === 'image' ? handleMouseMove : undefined}
              onMouseUp={activeMedia?.type === 'image' ? handleMouseUp : undefined}
              onTouchStart={activeMedia?.type === 'image' ? handleTouchStart : undefined}
              onTouchMove={activeMedia?.type === 'image' ? handleTouchMove : undefined}
              onTouchEnd={activeMedia?.type === 'image' ? handleTouchEnd : undefined}
              style={{
                cursor:
                  activeMedia?.type === 'image'
                    ? lightboxZoom > 1
                      ? isDragging
                        ? 'grabbing'
                        : 'grab'
                      : 'zoom-in'
                    : 'default',
              }}
            >
              {/* Prev / Next navigation arrows */}
              {mediaList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevMedia();
                    }}
                    className="absolute left-3 sm:left-6 z-30 p-3 rounded-full bg-neutral-900/70 hover:bg-neutral-800 text-white transition-colors shadow-lg border border-neutral-800 cursor-pointer"
                    title="Previous Media (Left Arrow)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextMedia();
                    }}
                    className="absolute right-3 sm:right-6 z-30 p-3 rounded-full bg-neutral-900/70 hover:bg-neutral-800 text-white transition-colors shadow-lg border border-neutral-800 cursor-pointer"
                    title="Next Media (Right Arrow)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Media Content */}
              {activeMedia?.type === 'video' ? (
                <div className="max-w-4xl w-full max-h-[75vh] flex items-center justify-center">
                  <video
                    key={activeMedia.url}
                    src={activeMedia.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[75vh] w-auto max-w-full rounded-2xl shadow-2xl"
                  />
                </div>
              ) : (
                <div
                  className="relative transition-transform duration-75 ease-out select-none"
                  style={{
                    transform: `scale(${lightboxZoom}) translate(${panPosition.x / lightboxZoom}px, ${panPosition.y / lightboxZoom}px)`,
                    transformOrigin: 'center center',
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleToggleZoom();
                  }}
                >
                  <img
                    src={activeMedia?.url}
                    alt={product?.name || 'Product Image'}
                    draggable={false}
                    className="max-h-[75vh] w-auto max-w-[90vw] object-contain rounded-xl shadow-2xl pointer-events-none"
                  />
                </div>
              )}
            </div>

            {/* Bottom Filmstrip Thumbnails */}
            {mediaList.length > 1 && (
              <div className="p-3 sm:p-4 border-t border-neutral-900 bg-neutral-950/80 backdrop-blur-sm flex justify-center z-20">
                <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1 px-2">
                  {mediaList.map((item: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setActiveMediaIndex(idx);
                        handleResetZoom();
                      }}
                      className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-neutral-900 border-2 transition-all shrink-0 cursor-pointer ${
                        activeMediaIndex === idx
                          ? 'border-white scale-105 shadow-md ring-2 ring-white/20'
                          : 'border-neutral-700/60 opacity-60 hover:opacity-100'
                      }`}
                      title={item.type === 'video' ? `Video ${idx + 1}` : `Image ${idx + 1}`}
                    >
                      {item.type === 'video' ? (
                        <div className="w-full h-full relative flex items-center justify-center bg-neutral-950">
                          <video
                            src={item.url}
                            muted
                            preload="metadata"
                            className="w-full h-full object-cover opacity-75"
                          />
                          <Play className="w-3 h-3 fill-white text-white absolute" />
                        </div>
                      ) : (
                        <img
                          src={item.url}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
