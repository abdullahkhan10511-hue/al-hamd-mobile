'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
  PackageX,
  ChevronDown,
  Sparkles,
  X,
  Filter,
} from 'lucide-react';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { getActiveCategories, syncCategoriesFromApi, deduplicateCategoriesById } from '@/lib/db/categories';
import { getBrands, syncBrandsFromApi } from '@/lib/db/brands';
import { ProductCard } from '@/components/products/ProductCard';
import { formatPrice, getProductImage, DEFAULT_PRODUCT_IMAGE, normalizeSearchText } from '@/lib/utils';
import { Product, Category } from '@/types';

const POPULAR_SEARCH_CHIPS = [
  'Samsung',
  'iPhone',
  'Xiaomi',
  'Redmi',
  'Oppo',
  'Vivo',
  'Tecno',
  'Infinix',
  'Realme',
  'AirPods',
  'TWS',
  'Fast Charger',
  'Power Bank',
  'Phone Case',
  'USB-C Cable',
];

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-neutral-400">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawQuery = searchParams.get('q') || '';

  const [inputQuery, setInputQuery] = useState(rawQuery);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [brandsList, setBrandsList] = useState<{ id: string; name: string }[]>([]);

  // Filter & Sort States
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  const loadData = async () => {
    let prods = getProducts();
    if (prods.length === 0) {
      prods = await syncProductsFromApi().catch(() => []);
    }
    const all = prods.filter(
      (p) =>
        (p as any).status !== 'archived' &&
        (p as any).status !== 'inactive' &&
        (p as any).isActive !== false
    );
    setProductsList(all);

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

  useEffect(() => {
    setInputQuery(rawQuery);
  }, [rawQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = inputQuery.trim();
    if (term) {
      router.push(`/search?q=${encodeURIComponent(term)}`);
    } else {
      router.push('/search');
    }
  };

  const handleChipClick = (term: string) => {
    setInputQuery(term);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrand('all');
    setMaxPrice(100000);
    setInStockOnly(false);
    setSortBy('featured');
  };

  const cleanQuery = rawQuery.toLowerCase().trim();

  // Multi-term space-safe and field-safe matching
  const matchingProducts = useMemo(() => {
    if (!cleanQuery) return [];

    const normalizedQuery = normalizeSearchText(cleanQuery);
    const searchTerms = normalizedQuery.split(' ').filter(Boolean);

    let result = productsList.filter((p) => {
      const nameNorm = normalizeSearchText(p.name);
      const brandNorm = normalizeSearchText(p.brand);
      const categoryNorm = normalizeSearchText(p.category);
      const categorySlugNorm = normalizeSearchText(p.categorySlug);
      const skuNorm = normalizeSearchText((p as any).sku);
      const descNorm = normalizeSearchText(p.description);
      const taglineNorm = normalizeSearchText(p.tagline);
      const tagsNorm = Array.isArray(p.tags)
        ? normalizeSearchText(p.tags.join(' '))
        : normalizeSearchText(p.tags);
      const featuresNorm = Array.isArray(p.features)
        ? normalizeSearchText(p.features.join(' '))
        : '';

      const combined = `${nameNorm} ${brandNorm} ${categoryNorm} ${categorySlugNorm} ${skuNorm} ${descNorm} ${taglineNorm} ${tagsNorm} ${featuresNorm}`;
      return searchTerms.every((term) => combined.includes(term));
    });

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(
        (p) =>
          p.categorySlug === selectedCategory ||
          p.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Brand filter
    if (selectedBrand !== 'all') {
      result = result.filter(
        (p) => p.brand?.toLowerCase() === selectedBrand.toLowerCase()
      );
    }

    // Price filter
    result = result.filter((p) => p.price <= maxPrice);

    // In Stock filter (Customer availability uses Shop Stock + Shop Active)
    if (inStockOnly) {
      result = result.filter((p) => (p.shopStock ?? 0) > 0 && p.isShopActive !== false);
    }

    // Sorting
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case 'bestselling':
        result.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        break;
      case 'featured':
      default:
        result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
    }

    return result;
  }, [cleanQuery, productsList, selectedCategory, selectedBrand, maxPrice, inStockOnly, sortBy]);

  // Trending fallback products
  const trendingProducts = useMemo(() => {
    return productsList
      .filter((p) => (p as any).trending || (p as any).isBestSeller || p.isNew)
      .slice(0, 6);
  }, [productsList]);

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedBrand !== 'all' ? 1 : 0) +
    (maxPrice < 100000 ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  return (
    <div className="bg-white min-h-screen py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header & Input Form */}
        <div className="max-w-3xl mx-auto text-center mb-8 sm:mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Store Catalog Search
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-neutral-950 mt-1">
            {rawQuery ? `Search results for "${rawQuery}"` : 'Search our catalog'}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1.5">
            Instant search across genuine mobile accessories, chargers, cases, and audio gear.
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-6 flex items-center gap-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Search Samsung, iPhone, AirPods, Chargers, Cases, Cables, SKU..."
                className="w-full pl-12 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-full text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 font-medium"
              />
              {inputQuery && (
                <button
                  type="button"
                  onClick={() => setInputQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-6 py-3.5 bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs uppercase tracking-wider rounded-full transition-colors cursor-pointer shrink-0"
            >
              Search
            </button>
          </form>

          {/* Popular Search Chips */}
          <div className="mt-4 flex items-center justify-center flex-wrap gap-2">
            <span className="text-xs text-neutral-400 font-medium">Popular:</span>
            {POPULAR_SEARCH_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="text-xs px-3 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar & Controls (When a query is present) */}
        {cleanQuery && (
          <div className="mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-neutral-950 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  All Categories
                </button>
                {categoriesList.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === cat.slug
                        ? 'bg-neutral-950 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Sorting & Filter toggle */}
              <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    activeFilterCount > 0
                      ? 'bg-neutral-950 text-white border-neutral-950'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
                </button>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-900 py-1.5 pl-3 pr-7 rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer"
                  >
                    <option value="featured">Featured (Relevance)</option>
                    <option value="newest">Newest Arrivals</option>
                    <option value="bestselling">Best Selling</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Extended Filters Drawer */}
            {showMobileFilters && (
              <div className="p-4 sm:p-5 bg-neutral-50 rounded-2xl border border-neutral-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Brand Filter */}
                <div>
                  <label className="block font-bold text-neutral-800 mb-1.5">Brand</label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-neutral-900 font-medium"
                  >
                    <option value="all">All Brands</option>
                    {brandsList.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="font-bold text-neutral-800">Max Price (PKR)</label>
                    <span className="font-mono font-bold text-neutral-900">{formatPrice(maxPrice)}</span>
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
                </div>

                {/* Stock & Reset */}
                <div className="flex flex-col justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="w-4 h-4 accent-neutral-950 rounded"
                    />
                    <span className="font-semibold text-neutral-800">In Stock Items Only</span>
                  </label>

                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-left text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer mt-2"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search Results Display */}
        {!cleanQuery ? (
          /* Empty Search Landing: Trending products & tips */
          <div className="space-y-10 py-6 max-w-5xl mx-auto">
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-neutral-900">Explore Trending Items</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Popular mobile accessories, high-speed chargers, and protective cases.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {trendingProducts.map((prod) => (
                <Link
                  key={prod.id}
                  href={`/product/${prod.slug}`}
                  className="group bg-neutral-50 hover:bg-neutral-100/80 p-3 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition-all text-center flex flex-col items-center"
                >
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white mb-2.5 shadow-2xs border border-neutral-100 flex items-center justify-center">
                    <img
                      src={getProductImage(prod)}
                      alt={prod.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <h4 className="text-xs font-semibold text-neutral-900 line-clamp-1 group-hover:text-neutral-700">
                    {prod.name}
                  </h4>
                  <p className="text-xs font-mono font-bold text-neutral-950 mt-1">
                    {formatPrice(prod.price)}
                  </p>
                </Link>
              ))}
            </div>

            <div className="text-center pt-4">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors"
              >
                <span>Browse Entire Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : matchingProducts.length === 0 ? (
          /* Zero Results State */
          <div className="py-16 text-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/70 p-8 max-w-lg mx-auto">
            <PackageX className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-neutral-900">
              No products found
            </h3>
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              Search for something else or browse our products.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors"
              >
                <span>View All Products</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* Results Grid */
          <div>
            <div className="flex items-center justify-between mb-6 text-xs text-neutral-500 font-mono">
              <span>
                Showing {matchingProducts.length} product{matchingProducts.length !== 1 ? 's' : ''} for &ldquo;{rawQuery}&rdquo;
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {matchingProducts.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
