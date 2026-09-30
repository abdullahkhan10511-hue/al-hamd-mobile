'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  Search,
  Star,
  Check,
  RotateCcw,
  Flame,
  ArrowRight,
  PackageX,
} from 'lucide-react';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { getActiveCategories, syncCategoriesFromApi, deduplicateCategoriesById } from '@/lib/db/categories';
import { getBrands, syncBrandsFromApi } from '@/lib/db/brands';
import { ProductCard } from '@/components/products/ProductCard';
import { formatPrice } from '@/lib/utils';
import { Product, Category } from '@/types';
import { Brand } from '@/types/admin';

export default function BestSellersPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-neutral-400">Loading best sellers...</div>}>
      <BestSellersContent />
    </Suspense>
  );
}

function BestSellersContent() {
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [brandsList, setBrandsList] = useState<Brand[]>([]);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('best-selling');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(12);

  // Category Horizontal Scrolling & Drag State
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  const loadData = async () => {
    // Only fetch non-archived products that are marked as bestSeller
    let all = getProducts();
    if (all.length === 0) {
      all = await syncProductsFromApi().catch(() => []);
    }
    const bestSellerItems = all.filter(
      (p) =>
        (p as any).status !== 'archived' &&
        (p as any).status !== 'inactive' &&
        (p as any).isActive !== false &&
        (p.isBestSeller || (p.reviewCount && p.reviewCount >= 200))
    );
    setProductsList(bestSellerItems);

    syncProductsFromApi().then((fresh) => {
      if (fresh && fresh.length > 0) {
        const freshBestSellerItems = fresh.filter(
          (p) =>
            (p as any).status !== 'archived' &&
            (p as any).status !== 'inactive' &&
            (p as any).isActive !== false &&
            (p.isBestSeller || (p.reviewCount && p.reviewCount >= 200))
        );
        setProductsList(freshBestSellerItems);
      }
    }).catch(() => {});

    let cats = deduplicateCategoriesById(getActiveCategories());
    setCategoriesList(cats);
    syncCategoriesFromApi().then(() => {
      setCategoriesList(deduplicateCategoriesById(getActiveCategories()));
    }).catch(() => {});

    const freshBrands = await syncBrandsFromApi().catch(() => getBrands());
    setBrandsList(freshBrands.filter((b) => b.status === 'active'));
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Desktop mouse wheel horizontal scroll translation
  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const canScrollRightNow = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
        const canScrollLeftNow = el.scrollLeft > 1;
        if ((e.deltaY > 0 && canScrollRightNow) || (e.deltaY < 0 && canScrollLeftNow)) {
          e.preventDefault();
          el.scrollLeft += e.deltaY * 0.9;
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = categoryScrollRef.current;
    if (!el) return;
    setIsMouseDown(true);
    setStartX(e.pageX - el.offsetLeft);
    setScrollLeftState(el.scrollLeft);
    setHasDragged(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown) return;
    const el = categoryScrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.2;
    if (Math.abs(walk) > 5) {
      setHasDragged(true);
    }
    el.scrollLeft = scrollLeftState - walk;
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    setTimeout(() => setHasDragged(false), 50);
  };

  const availableBrands = useMemo(() => {
    return Array.from(new Set(productsList.map((p) => p.brand).filter(Boolean)));
  }, [productsList]);

  const toggleBrand = (brandName: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandName) ? prev.filter((b) => b !== brandName) : [...prev, brandName]
    );
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrands([]);
    setMaxPrice(100000);
    setMinRating(null);
    setInStockOnly(false);
    setSortBy('best-selling');
    setSearchQuery('');
  };

  const filteredProducts = useMemo(() => {
    let result = [...productsList];

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(
        (p) =>
          p.categorySlug === selectedCategory ||
          p.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Brand filter
    if (selectedBrands.length > 0) {
      result = result.filter((p) => selectedBrands.includes(p.brand));
    }

    // Price ceiling filter
    result = result.filter((p) => p.price <= maxPrice);

    // Rating filter
    if (minRating !== null) {
      result = result.filter((p) => p.rating >= minRating);
    }

    // In-Stock only filter (Customer availability uses Shop Stock + Shop Active)
    if (inStockOnly) {
      result = result.filter((p) => (p.shopStock ?? 0) > 0 && p.isShopActive !== false);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    // Sorting
    switch (sortBy) {
      case 'best-selling':
        result.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
        break;
      case 'newest':
        result.sort((a, b) => ((b as any).createdAt || 0) - ((a as any).createdAt || 0));
        break;
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'featured':
      default:
        result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
    }

    return result;
  }, [
    productsList,
    selectedCategory,
    selectedBrands,
    maxPrice,
    minRating,
    inStockOnly,
    sortBy,
    searchQuery,
  ]);

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    selectedBrands.length +
    (maxPrice < 100000 ? 1 : 0) +
    (minRating !== null ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (searchQuery ? 1 : 0);

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Header */}
      <div className="relative bg-neutral-950 text-white py-16 sm:py-20 overflow-hidden border-b border-neutral-900">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 backdrop-blur-md border border-rose-500/20 text-xs font-semibold uppercase tracking-widest text-rose-400 mb-4">
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>Customer Favorites</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Best Sellers
            </h1>
            <p className="mt-3 text-sm sm:text-base text-neutral-400 leading-relaxed">
              Our most-loved and highest-rated pieces trusted by thousands of customers nationwide. Verified 5-star ratings, exceptional build quality, and immediate dispatch.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-neutral-900">
              Showing <span className="font-mono">{filteredProducts.length}</span> Best Sellers
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset all
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Mobile filter toggle */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
            </button>

            {/* Sorting */}
            <div className="relative flex items-center gap-2">
              <span className="text-xs text-neutral-500 hidden sm:inline">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-900 py-2 pl-3 pr-8 rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer"
              >
                <option value="best-selling">Best Selling</option>
                <option value="rating">Highest Rated</option>
                <option value="featured">Featured</option>
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Category Quick Pills */}
        <div
          ref={categoryScrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="flex items-center gap-2 overflow-x-auto flex-nowrap pb-4 mb-8 scroll-smooth select-none cursor-grab active:cursor-grabbing scrollbar-none"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y pinch-zoom pan-x',
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              if (hasDragged) {
                e.preventDefault();
                return;
              }
              setSelectedCategory('all');
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-neutral-950 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-950'
            }`}
          >
            All Best Sellers
          </button>
          {categoriesList.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={(e) => {
                if (hasDragged) {
                  e.preventDefault();
                  return;
                }
                setSelectedCategory(cat.slug);
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95 cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-950'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Main Content Grid: Sidebar + Products */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <div className="hidden lg:block lg:col-span-1 space-y-6 select-none pr-4 border-r border-neutral-100">
            {/* Search within catalog */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-2.5">
                Search Best Sellers
              </h3>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Keywords, brand..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* In-Stock Filter */}
            <div className="pt-4 border-t border-neutral-100">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs font-semibold text-neutral-800 group-hover:text-neutral-950">
                  In-Stock Only
                </span>
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-neutral-950 focus:ring-neutral-950"
                />
              </label>
            </div>

            {/* Price Range Filter */}
            <div className="pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Price Ceiling
                </h3>
                <span className="text-xs font-mono font-bold text-neutral-900">
                  {formatPrice(maxPrice)}
                </span>
              </div>
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-neutral-950 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-neutral-400 font-mono mt-1">
                <span>Rs. 1,000</span>
                <span>Rs. 100,000</span>
              </div>
            </div>

            {/* Brand Filter */}
            {availableBrands.length > 0 && (
              <div className="pt-4 border-t border-neutral-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-2.5">
                  Brands
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                  {availableBrands.map((brand) => (
                    <label
                      key={brand}
                      className="flex items-center justify-between text-xs text-neutral-700 hover:text-neutral-950 cursor-pointer py-1"
                    >
                      <span>{brand}</span>
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand)}
                        onChange={() => toggleBrand(brand)}
                        className="w-3.5 h-3.5 rounded text-neutral-950 focus:ring-neutral-950"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Rating Filter */}
            <div className="pt-4 border-t border-neutral-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-2.5">
                Customer Rating
              </h3>
              <div className="space-y-1">
                {[4.8, 4.5, 4.0].map((stars) => (
                  <button
                    key={stars}
                    type="button"
                    onClick={() => setMinRating(minRating === stars ? null : stars)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      minRating === stars
                        ? 'bg-neutral-100 font-bold text-neutral-950'
                        : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{stars} Stars & Up</span>
                    </div>
                    {minRating === stars && <Check className="w-3.5 h-3.5 text-neutral-950" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Products Grid Area */}
          <div className="lg:col-span-3">
            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-8">
                <PackageX className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-neutral-900">
                  No Best Sellers Found
                </h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Try adjusting your filters or price ceiling to explore more items.
                </p>
                <div className="mt-6">
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                  {filteredProducts.slice(0, visibleCount).map((prod) => (
                    <ProductCard key={prod.id} product={prod} />
                  ))}
                </div>

                {visibleCount < filteredProducts.length && (
                  <div className="mt-12 text-center">
                    <button
                      onClick={() => setVisibleCount((prev) => prev + 12)}
                      className="px-8 py-3 rounded-full border border-neutral-900 text-neutral-900 font-semibold text-xs tracking-wider uppercase hover:bg-neutral-900 hover:text-white transition-all cursor-pointer"
                    >
                      Load More ({filteredProducts.length - visibleCount} Remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileFiltersOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-screen max-w-xs bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto"
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                    <h3 className="font-bold text-sm text-neutral-950">Filters</h3>
                    <button
                      onClick={() => setMobileFiltersOpen(false)}
                      className="p-1 rounded-full text-neutral-400 hover:text-neutral-900"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase text-neutral-900 mb-2">Price Ceiling</h4>
                    <span className="text-xs font-mono font-bold text-neutral-900">{formatPrice(maxPrice)}</span>
                    <input
                      type="range"
                      min="1000"
                      max="100000"
                      step="1000"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(Number(e.target.value))}
                      className="w-full accent-neutral-950 mt-2"
                    />
                  </div>

                  <div className="pt-4 border-t border-neutral-100">
                    <label className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                      <span>In-Stock Only</span>
                      <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                        className="w-4 h-4 rounded text-neutral-950"
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-6 border-t border-neutral-100 space-y-2">
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-full py-3 rounded-full bg-neutral-950 text-white font-bold text-xs uppercase"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={resetFilters}
                    className="w-full py-2.5 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700"
                  >
                    Reset
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
