'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  Search,
  Star,
  Check,
  RotateCcw,
  PackageX,
} from 'lucide-react';
import { ProductCard } from '@/components/products/ProductCard';
import { formatPrice } from '@/lib/utils';
import { Product, Category } from '@/types';
import { useGridBatchLimit } from '@/lib/useGridBatchLimit';
import {
  getSavedListingState,
  saveListingState,
  restoreScrollPosition,
  clearListingReturnFlag,
} from '@/lib/scrollRestoration';

export default function BestSellersPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-neutral-400">Loading best sellers...</div>}>
      <BestSellersContent />
    </Suspense>
  );
}

function BestSellersContent() {
  const savedState = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getSavedListingState('/best-sellers');
  }, []);

  const batchLimit = useGridBatchLimit(4);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  const [productsList, setProductsList] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>(() => savedState?.selectedCategory || 'all');
  const [selectedBrands, setSelectedBrands] = useState<string[]>(() => savedState?.selectedBrands || []);
  const [maxPrice, setMaxPrice] = useState<number>(() => savedState?.maxPrice ?? 1000000);
  const [minRating, setMinRating] = useState<number | null>(() => savedState?.minRating ?? null);
  const [inStockOnly, setInStockOnly] = useState<boolean>(() => savedState?.inStockOnly ?? false);
  const [sortBy, setSortBy] = useState<string>(() => savedState?.sortBy || 'best-selling');
  const [searchQuery, setSearchQuery] = useState<string>(() => savedState?.searchQuery || '');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Pagination & Loading States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Category Horizontal Scrolling & Drag State
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  // Save listing state
  useEffect(() => {
    saveListingState('/best-sellers', {
      visibleCount: productsList.length || 16,
      selectedCategory,
      selectedBrands,
      maxPrice,
      minRating,
      inStockOnly,
      sortBy,
      searchQuery,
    });
  }, [productsList.length, selectedCategory, selectedBrands, maxPrice, minRating, inStockOnly, sortBy, searchQuery]);

  // Restore scroll position when returning from product detail page
  const hasRestoredScroll = useRef(false);
  useEffect(() => {
    if (!hasRestoredScroll.current && savedState && savedState.scrollY > 0) {
      hasRestoredScroll.current = true;
      restoreScrollPosition(savedState.scrollY, () => {
        clearListingReturnFlag();
      });
    }
  }, [savedState]);

  // Fetch Best Sellers collection categories
  const fetchCollectionCategories = async () => {
    try {
      const res = await fetch('/api/categories?isBestSeller=true');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
          setCategoriesList(data.categories);
        }
      }
    } catch (err) {
      console.error('[BestSellers] Error fetching categories:', err);
    }
  };

  // Fetch available brands
  const fetchAvailableBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.brands)) {
          const names = data.brands.map((b: any) => b.name).filter(Boolean);
          setAvailableBrands(names);
        }
      }
    } catch {
      // ignore
    }
  };

  // Fetch paginated products from API with SQL filtering
  const fetchBestSellers = async (pageToFetch: number, isAppending = false) => {
    inFlightAbortRef.current?.abort();
    const controller = new AbortController();
    inFlightAbortRef.current = controller;

    if (isAppending) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);

    try {
      const params = new URLSearchParams();
      params.set('isBestSeller', 'true');
      params.set('page', String(pageToFetch));
      params.set('limit', String(batchLimit));
      params.set('minimal', 'true');

      if (selectedCategory && selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      if (selectedBrands.length > 0) {
        params.set('brand', selectedBrands.join(','));
      }
      if (maxPrice < 1000000) {
        params.set('maxPrice', String(maxPrice));
      }
      if (inStockOnly) {
        params.set('inStock', 'true');
      }
      if (sortBy) {
        params.set('sort', sortBy);
      }
      if (searchQuery.trim().length >= 2) {
        params.set('q', searchQuery.trim());
      }

      const res = await fetch(`/api/products?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        let items: Product[] = data.products;
        if (minRating !== null) {
          items = items.filter((p) => (p.rating || 0) >= minRating);
        }

        if (isAppending) {
          setProductsList((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const fresh = items.filter((p) => !seen.has(p.id));
            return [...prev, ...fresh];
          });
        } else {
          setProductsList(items);
        }

        if (typeof data.total === 'number') {
          setTotalCount(data.total);
        }
        setHasMore(Boolean(data.hasMore));
        setCurrentPage(pageToFetch);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[BestSellers] Fetch error:', err);
      setLoadError('Failed to load best sellers. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchCollectionCategories();
    fetchAvailableBrands();
  }, []);

  // Fetch when filters or batchLimit change
  useEffect(() => {
    fetchBestSellers(1, false);
  }, [batchLimit, selectedCategory, selectedBrands, maxPrice, minRating, inStockOnly, sortBy, searchQuery]);

  // Keep live sync with background updates
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const SHOP_KEYS = ['products', 'categories', 'brands'];
      if (key && !SHOP_KEYS.includes(key)) return;
      fetchCollectionCategories();
      fetchBestSellers(1, false);
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [batchLimit, selectedCategory, selectedBrands, maxPrice, minRating, inStockOnly, sortBy, searchQuery]);

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

  const toggleBrand = (brandName: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandName) ? prev.filter((b) => b !== brandName) : [...prev, brandName]
    );
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrands([]);
    setMaxPrice(1000000);
    setMinRating(null);
    setInStockOnly(false);
    setSortBy('best-selling');
    setSearchQuery('');
  };

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    selectedBrands.length +
    (maxPrice < 1000000 ? 1 : 0) +
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
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Best Sellers
            </h1>
            <p className="mt-3 text-sm sm:text-base text-neutral-400">
              Our most popular, customer-proven tech accessories engineered for durability and peak performance.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-neutral-900">
              Showing <span className="font-mono">{productsList.length}</span> of{' '}
              <span className="font-mono">{totalCount}</span> Best Sellers
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
            All Best Sellers ({totalCount})
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
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat.slug
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-950'
              }`}
            >
              <span>{cat.name}</span>
              {typeof cat.productCount === 'number' && cat.productCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCategory === cat.slug
                      ? 'bg-neutral-800 text-neutral-300'
                      : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {cat.productCount}
                </span>
              )}
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
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* In-Stock Filter */}
            <div className="pt-4 border-t border-neutral-100">
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-xs font-semibold text-neutral-800">
                  In-Stock Only
                </span>
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-neutral-950 focus:ring-neutral-950 cursor-pointer"
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
                max="1000000"
                step="5000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-neutral-950 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-neutral-400 font-mono mt-1">
                <span>Rs. 1,000</span>
                <span>Rs. 1,000,000</span>
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
                        className="w-3.5 h-3.5 rounded text-neutral-950 focus:ring-neutral-950 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Rating Filter */}
            <div className="pt-4 border-t border-neutral-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-2.5">
                Rating
              </h3>
              <div className="space-y-1">
                {[4, 3, 2].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setMinRating(minRating === rating ? null : rating)}
                    className={`flex items-center justify-between w-full text-xs py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                      minRating === rating
                        ? 'bg-neutral-100 font-bold text-neutral-950'
                        : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span>& Up</span>
                    </div>
                    {minRating === rating && <Check className="w-3.5 h-3.5 text-neutral-950" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Products Listing Area */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="py-24 text-center">
                <div className="inline-block w-8 h-8 border-2 border-neutral-300 border-t-neutral-950 rounded-full animate-spin mb-4" />
                <p className="text-xs font-semibold text-neutral-500">Loading best sellers...</p>
              </div>
            ) : productsList.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-neutral-200 rounded-2xl p-8 bg-neutral-50">
                <PackageX className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-neutral-900">No matching best sellers</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  We couldn&apos;t find any best sellers matching your selected filters. Try broadening your criteria.
                </p>
                <div className="mt-6">
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-5">
                  {productsList.map((prod) => (
                    <ProductCard key={prod.id} product={prod} />
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-12 text-center flex flex-col items-center gap-2">
                    <button
                      type="button"
                      disabled={isLoadingMore}
                      aria-busy={isLoadingMore}
                      onClick={() => fetchBestSellers(currentPage + 1, true)}
                      className="px-8 py-3.5 rounded-full border border-neutral-900 text-neutral-900 font-semibold text-xs tracking-wider uppercase hover:bg-neutral-900 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingMore ? 'Loading More Products...' : `Load More Products (${Math.max(0, totalCount - productsList.length)} remaining)`}
                    </button>
                    {loadError && (
                      <div className="flex items-center gap-2 text-xs text-rose-600 mt-2">
                        <span>{loadError}</span>
                        <button
                          type="button"
                          onClick={() => fetchBestSellers(currentPage + 1, true)}
                          className="font-bold underline hover:text-rose-700 cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    )}
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
                      max="1000000"
                      step="5000"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(Number(e.target.value))}
                      className="w-full accent-neutral-950 mt-2 cursor-pointer"
                    />
                  </div>

                  <div className="pt-4 border-t border-neutral-100">
                    <label className="flex items-center justify-between text-xs font-semibold text-neutral-800 cursor-pointer">
                      <span>In-Stock Only</span>
                      <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                        className="w-4 h-4 rounded text-neutral-950 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-6 border-t border-neutral-100 space-y-2">
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-full py-3 rounded-full bg-neutral-950 text-white font-bold text-xs uppercase cursor-pointer"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={resetFilters}
                    className="w-full py-2.5 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 cursor-pointer"
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
