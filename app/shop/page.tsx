'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  Search,
  Star,
  Check,
  RotateCcw,
} from 'lucide-react';
import { getProducts } from '@/lib/db/products';
import { getActiveCategories } from '@/lib/db/categories';
import { getBrands } from '@/lib/db/brands';
import { ProductCard } from '@/components/products/ProductCard';
import { formatPrice } from '@/lib/utils';
import { Product, Category } from '@/types';
import { Brand } from '@/types/admin';

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center">Loading collection...</div>}>
      <ShopContent />
    </Suspense>
  );
}

function ShopContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialFilter = searchParams.get('filter') || '';
  const initialSearch = searchParams.get('search') || '';

  const [productsList, setProductsList] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [brandsList, setBrandsList] = useState<Brand[]>([]);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>(
    initialFilter === 'new'
      ? 'newest'
      : initialFilter === 'bestseller'
      ? 'best-selling'
      : 'featured'
  );
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(12);

  // Category Horizontal Scrolling & Drag State
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  const loadData = () => {
    // Only fetch active, non-archived mobile accessories for storefront
    const activeProds = getProducts().filter(
      (p) =>
        (p as any).status !== 'archived' &&
        (p as any).status !== 'inactive' &&
        (p as any).isActive !== false
    );
    setProductsList(activeProds);
    setCategoriesList(getActiveCategories());
    setBrandsList(getBrands().filter((b) => b.status === 'active'));
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

  // Update selected category when query parameter changes
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setSelectedCategory(cat);
  }, [searchParams]);

  // Extract available brands
  const availableBrands = useMemo(() => {
    if (brandsList.length > 0) {
      return brandsList.map((b) => b.name);
    }
    return Array.from(new Set(productsList.map((p) => p.brand)));
  }, [brandsList, productsList]);

  // Filter logic (ALL ITEMS automatically contains every active product)
  const filteredProducts = useMemo(() => {
    return productsList.filter((product) => {
      // Category filter: 'all' shows ALL items automatically
      if (selectedCategory !== 'all') {
        const matchesCat =
          product.categorySlug === selectedCategory ||
          product.category.toLowerCase() === selectedCategory.toLowerCase();
        if (!matchesCat) return false;
      }

      // Brand filter
      if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) {
        return false;
      }

      // Price filter
      if (product.price > maxPrice) {
        return false;
      }

      // Rating filter
      if (minRating !== null && product.rating < minRating) {
        return false;
      }

      // In stock only filter
      if (inStockOnly && product.stock <= 0) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          product.name.toLowerCase().includes(q) ||
          product.description.toLowerCase().includes(q) ||
          product.brand.toLowerCase().includes(q) ||
          product.category.toLowerCase().includes(q) ||
          (product.sku && product.sku.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [productsList, selectedCategory, selectedBrands, maxPrice, minRating, inStockOnly, searchQuery]);

  // Sort logic
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    switch (sortBy) {
      case 'newest':
        return list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
      case 'best-selling':
        return list.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
      case 'price-low':
        return list.sort((a, b) => a.price - b.price);
      case 'price-high':
        return list.sort((a, b) => b.price - a.price);
      case 'rating':
        return list.sort((a, b) => b.rating - a.rating);
      case 'featured':
      default:
        return list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }
  }, [filteredProducts, sortBy]);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrands([]);
    setMaxPrice(500);
    setMinRating(null);
    setInStockOnly(false);
    setSearchQuery('');
    setSortBy('featured');
  };

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    selectedBrands.length +
    (maxPrice < 500 ? 1 : 0) +
    (minRating !== null ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (searchQuery ? 1 : 0);

  return (
    <div className="bg-white min-h-screen py-8 sm:py-12 border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb & Title */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-wider text-neutral-400 uppercase">
            Catalog & Essentials
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-1">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950">
                {selectedCategory === 'all'
                  ? 'All Items'
                  : categoriesList.find((c) => c.slug === selectedCategory)?.name || 'Catalog'}
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Showing {sortedProducts.length} curated products
              </p>
            </div>

            {/* Mobile Filter Trigger & Sort */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
              </button>

              {/* Sort Dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-neutral-50 border border-neutral-200/80 rounded-full text-xs font-semibold text-neutral-900 py-2.5 pl-4 pr-9 focus:outline-none cursor-pointer"
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="newest">Sort: Newest</option>
                  <option value="best-selling">Sort: Best Selling</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Category Quick Pills */}
          <div className="mt-6 pt-4 border-t border-neutral-100">
            <div
              ref={categoryScrollRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="flex items-center gap-2 overflow-x-auto flex-nowrap pb-2 scroll-smooth select-none cursor-grab active:cursor-grabbing scrollbar-none"
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
                All Items ({productsList.length})
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
          </div>

          {/* Active Filters Pills */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-neutral-100">
              <span className="text-xs text-neutral-400 mr-1">Active filters:</span>
              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium">
                  Category: {selectedCategory}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                    onClick={() => setSelectedCategory('all')}
                  />
                </span>
              )}
              {selectedBrands.map((brand) => (
                <span
                  key={brand}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium"
                >
                  Brand: {brand}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                    onClick={() => toggleBrand(brand)}
                  />
                </span>
              ))}
              {maxPrice < 100000 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium">
                  Under {formatPrice(maxPrice)}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                    onClick={() => setMaxPrice(100000)}
                  />
                </span>
              )}
              {inStockOnly && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium">
                  In Stock Only
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                    onClick={() => setInStockOnly(false)}
                  />
                </span>
              )}
              <button
                onClick={resetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold ml-2 underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Main Grid: Filters Sidebar + Products Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <div className="hidden lg:block lg:col-span-1 space-y-6 select-none pr-4 border-r border-neutral-100">
            {/* Search within catalog */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-2.5">
                Search Products
              </h3>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Keywords, SKU, brand..."
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
                <span className="text-xs font-mono font-bold text-neutral-900">{formatPrice(maxPrice)}</span>
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
            <div className="pt-4 border-t border-neutral-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-2.5">
                Brands
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {availableBrands.map((brand) => (
                  <label
                    key={brand}
                    className="flex items-center gap-2.5 text-xs text-neutral-700 hover:text-neutral-950 cursor-pointer py-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand)}
                      onChange={() => toggleBrand(brand)}
                      className="w-3.5 h-3.5 rounded text-neutral-950 focus:ring-neutral-950"
                    />
                    <span className="truncate">{brand}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Reset Filter Button */}
            <div className="pt-4 border-t border-neutral-100">
              <button
                onClick={resetFilters}
                className="w-full py-2 px-3 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            </div>
          </div>

          {/* Product Grid Area (lg:col-span-3) */}
          <div className="lg:col-span-3">
            {sortedProducts.length === 0 ? (
              <div className="py-24 text-center bg-neutral-50 rounded-3xl border border-neutral-100 p-8">
                <h3 className="text-lg font-bold text-neutral-900">No products found</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  We couldn't find any items matching your selected filters. Try broadening your criteria or reset filters.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-4 px-5 py-2.5 bg-neutral-950 text-white rounded-full text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-5">
                {sortedProducts.slice(0, visibleCount).map((product, idx) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: (idx % 6) * 0.05 }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Load More Button */}
            {visibleCount < sortedProducts.length && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 12)}
                  className="px-8 py-3.5 rounded-full border border-neutral-950 text-xs sm:text-sm font-semibold text-neutral-950 hover:bg-neutral-950 hover:text-white transition-all shadow-xs cursor-pointer"
                >
                  Load More Products ({sortedProducts.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
