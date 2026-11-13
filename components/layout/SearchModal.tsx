'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Loader2,
  PackageX,
  Package,
  History,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearch } from '@/context/SearchContext';
import {
  formatPrice,
  getProductImage,
  DEFAULT_PRODUCT_IMAGE,
} from '@/lib/utils';
import { getCategoryPlaceholder } from '@/lib/placeholders';
import { Product } from '@/types';

const POPULAR_SEARCH_CHIPS = [
  'Samsung',
  'iPhone',
  'Anker',
  'Baseus',
  'UGREEN',
  'AirPods',
  'Fast Charger',
  'Power Bank',
  'Phone Case',
  'USB-C Cable',
  'MagSafe',
  'Wireless Charger',
  'Spigen',
  'Audio',
];

function SearchProductImage({
  src,
  alt,
  category,
  sizeClass = 'w-16 h-16 sm:w-20 sm:h-20',
}: {
  src?: string | null;
  alt: string;
  category?: string | null;
  sizeClass?: string;
}) {
  const placeholderUrl = useMemo(() => getCategoryPlaceholder(category, alt), [category, alt]);
  const resolvedInitial = useMemo(() => {
    const raw = getProductImage(src);
    return raw && raw !== DEFAULT_PRODUCT_IMAGE ? raw : placeholderUrl;
  }, [src, placeholderUrl]);
  const [imgUrl, setImgUrl] = useState<string>(resolvedInitial);

  useEffect(() => {
    const raw = getProductImage(src);
    setImgUrl(raw && raw !== DEFAULT_PRODUCT_IMAGE ? raw : placeholderUrl);
  }, [src, placeholderUrl]);

  return (
    <div
      className={`relative ${sizeClass} rounded-2xl overflow-hidden bg-[#f5f5f5] border border-neutral-200/80 shrink-0 shadow-2xs group-hover:border-neutral-300 transition-colors flex items-center justify-center`}
    >
      <Image
        src={imgUrl}
        alt={alt || 'Product thumbnail'}
        fill
        unoptimized={
          imgUrl.startsWith('http://') ||
          imgUrl.startsWith('https://') ||
          imgUrl.toLowerCase().endsWith('.svg') ||
          imgUrl.startsWith('data:')
        }
        sizes="(max-width: 640px) 64px, 80px"
        onError={() => {
          if (imgUrl !== placeholderUrl) {
            setImgUrl(placeholderUrl);
          }
        }}
        className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
      />
    </div>
  );
}

export function SearchModal() {
  const router = useRouter();
  const {
    isSearchOpen,
    closeSearch,
    searchQuery,
    setSearchQuery,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  } = useSearch();

  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync debounce & search query (250ms)
  useEffect(() => {
    setIsSearching(true);
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Server endpoint search: min 2 characters, max 12 results, minimal fields
  useEffect(() => {
    const clean = debouncedQuery.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }

    let isMounted = true;
    setIsSearching(true);
    fetch(`/api/products?search=${encodeURIComponent(clean)}&limit=12&minimal=true`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data.products)) {
          setSearchResults(data.products.slice(0, 12));
        } else {
          setSearchResults([]);
        }
      })
      .catch(() => {
        if (isMounted) setSearchResults([]);
      })
      .finally(() => {
        if (isMounted) setIsSearching(false);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  // Load trending products on modal open
  useEffect(() => {
    if (isSearchOpen && trendingProducts.length === 0) {
      fetch('/api/products?isBestSeller=true&limit=6&minimal=true')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.products)) {
            setTrendingProducts(data.products.slice(0, 6));
          }
        })
        .catch(() => {});
    }
  }, [isSearchOpen, trendingProducts.length]);

  // Handle modal open, autofocus, body scroll lock
  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'unset';
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isSearchOpen]);

  // Close on ESC key or shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        closeSearch();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isSearchOpen) {
          closeSearch();
        } else {
          // Open handled by context if available
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, closeSearch]);

  const filteredProducts = searchResults;

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = searchQuery.trim();
      if (term) {
        addRecentSearch(term);
        closeSearch();
        router.push(`/search?q=${encodeURIComponent(term)}`);
      }
    }
  };

  const handleChipClick = (chip: string) => {
    setSearchQuery(chip);
    inputRef.current?.focus();
  };

  const handleSelectProduct = (slug: string) => {
    if (searchQuery.trim()) {
      addRecentSearch(searchQuery.trim());
    }
    closeSearch();
    router.push(`/product/${slug}`);
  };

  const handleViewAllResults = () => {
    const term = searchQuery.trim();
    if (term) {
      addRecentSearch(term);
      closeSearch();
      router.push(`/search?q=${encodeURIComponent(term)}`);
    } else {
      closeSearch();
      router.push('/shop');
    }
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop: Must stay below the modal dialog in stacking order */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeSearch}
            className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm -z-10 cursor-pointer"
            aria-hidden="true"
          />

          {/* Modal Container: Higher stacking level to guarantee 100% solid opacity */}
          <div className="relative z-10 min-h-full flex items-start justify-center p-3 pt-6 sm:p-6 sm:pt-16 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-200/90 overflow-hidden pointer-events-auto flex flex-col max-h-[88vh]"
              role="dialog"
              aria-modal="true"
              aria-label="Product Search"
            >
              {/* Top Search Input Bar (100% Solid White) */}
              <div className="p-3.5 sm:p-5 border-b border-neutral-100 flex items-center gap-3 bg-white sticky top-0 z-20">
                <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-700">
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-900" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleEnterKey}
                    placeholder="Search Samsung, iPhone, AirPods, Chargers, Cables, SKU..."
                    className="w-full text-base sm:text-lg font-bold text-neutral-950 placeholder-neutral-400 bg-transparent focus:outline-none pr-8"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        inputRef.current?.focus();
                      }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                      aria-label="Clear search input"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={closeSearch}
                  className="w-9 h-9 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  aria-label="Close search overlay"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Content (Solid White, Scrollable) */}
              <div className="bg-white overflow-y-auto p-4 sm:p-6 space-y-6 flex-1">
                {/* 1. If user typed query */}
                {searchQuery.trim() ? (
                  <div>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100">
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                        Search Results {filteredProducts.length > 0 && `(${filteredProducts.length})`}
                      </p>
                      {filteredProducts.length > 0 && (
                        <button
                          type="button"
                          onClick={handleViewAllResults}
                          className="text-xs font-bold text-neutral-900 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          View all in shop →
                        </button>
                      )}
                    </div>

                    {filteredProducts.length > 0 ? (
                      <div className="divide-y divide-neutral-100">
                        {filteredProducts.slice(0, 8).map((product) => (
                          <div
                            key={product.id}
                            onClick={() => handleSelectProduct(product.slug)}
                            className="flex items-center gap-3.5 sm:gap-4 py-3 sm:py-3.5 px-2.5 rounded-2xl hover:bg-neutral-50 transition-all cursor-pointer group border border-transparent hover:border-neutral-200/80"
                          >
                            {/* Controlled Thumbnail */}
                            <SearchProductImage
                              src={getProductImage(product)}
                              alt={product.name}
                              category={product.categorySlug || product.category}
                              sizeClass="w-16 h-16 sm:w-20 sm:h-20"
                            />

                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                                  {product.brand}
                                </span>
                                {product.category && (
                                  <>
                                    <span className="text-neutral-300 text-xs">•</span>
                                    <span className="text-[11px] font-medium text-neutral-500">
                                      {product.category}
                                    </span>
                                  </>
                                )}
                              </div>

                              <h4 className="text-sm sm:text-base font-bold text-neutral-950 truncate group-hover:text-neutral-700 transition-colors">
                                {product.name}
                              </h4>

                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm sm:text-base font-bold font-mono text-neutral-950">
                                  {formatPrice(product.price)}
                                </span>
                                {product.compareAtPrice && product.compareAtPrice > product.price && (
                                  <>
                                    <span className="text-xs text-neutral-400 line-through font-mono">
                                      {formatPrice(product.compareAtPrice)}
                                    </span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600">
                                      {Math.round(
                                        ((product.compareAtPrice - product.price) / product.compareAtPrice) *
                                          100
                                      )}
                                      % OFF
                                    </span>
                                  </>
                                )}
                                {product.sku && (
                                  <span className="hidden sm:inline-block ml-auto text-[10px] font-mono text-neutral-400">
                                    SKU: {product.sku}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-neutral-100 group-hover:bg-neutral-950 text-neutral-500 group-hover:text-white transition-all shrink-0">
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* No Results State */
                      <div className="py-12 text-center space-y-3">
                        <PackageX className="w-12 h-12 text-neutral-300 mx-auto stroke-[1.5]" />
                        <h3 className="text-base sm:text-lg font-bold text-neutral-950">
                          No products found for &ldquo;{searchQuery}&rdquo;
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
                          Try searching by brand (Apple, Samsung, Anker), product category (Chargers, Earbuds, Cases), or SKU.
                        </p>
                        <div className="pt-3 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="px-4 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                          >
                            Clear Search
                          </button>
                          <Link
                            href="/shop"
                            onClick={closeSearch}
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
                          >
                            <span>Browse All Products</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Bottom Link to full search page */}
                    {filteredProducts.length > 0 && (
                      <div className="pt-4 border-t border-neutral-100 text-center">
                        <button
                          type="button"
                          onClick={handleViewAllResults}
                          className="w-full py-3 text-xs sm:text-sm font-bold text-neutral-900 hover:text-white bg-neutral-100 hover:bg-neutral-950 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                        >
                          <span>View all {filteredProducts.length} results</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 2. Empty State: Popular Searches, Recent Searches & Trending Now */
                  <div className="space-y-6">
                    {/* Recent Searches (if any) */}
                    {recentSearches && recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-1.5 text-neutral-500">
                            <History className="w-3.5 h-3.5 text-neutral-500" />
                            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                              Recent Searches
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={clearRecentSearches}
                            className="text-[11px] font-semibold text-neutral-400 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {recentSearches.map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() => handleChipClick(term)}
                              className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-neutral-50 border border-neutral-200/70 hover:border-neutral-400 hover:bg-white text-neutral-800 transition-all cursor-pointer shadow-2xs"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Popular Searches Chips */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2.5 text-neutral-500">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                          Popular Categories & Brands
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {POPULAR_SEARCH_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => handleChipClick(chip)}
                            className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-950 hover:text-white text-neutral-800 transition-all cursor-pointer shadow-2xs"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Trending Now Section */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-neutral-500">
                        <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                          Trending Accessories
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {trendingProducts.map((product) => (
                          <div
                            key={product.id}
                            onClick={() => handleSelectProduct(product.slug)}
                            className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-100 hover:border-neutral-300 hover:bg-neutral-50 transition-all cursor-pointer group bg-neutral-50/50"
                          >
                            <SearchProductImage
                              src={getProductImage(product)}
                              alt={product.name}
                              category={product.categorySlug || product.category}
                              sizeClass="w-14 h-14"
                            />

                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                {product.brand}
                              </span>
                              <h5 className="text-xs sm:text-sm font-bold text-neutral-950 truncate group-hover:text-neutral-700">
                                {product.name}
                              </h5>
                              <p className="text-xs font-mono font-bold text-neutral-950 mt-0.5">
                                {formatPrice(product.price)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Quick Keyboard Info */}
              <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                <span>
                  Press <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded font-mono text-neutral-700 shadow-2xs">Enter</kbd> to search full catalog
                </span>
                <span className="hidden sm:inline">
                  Press <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded font-mono text-neutral-700 shadow-2xs">ESC</kbd> to exit
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
