'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, PackageX, ChevronDown, Tag, RotateCcw } from 'lucide-react';
import { ProductCard } from '@/components/products/ProductCard';
import { Category, Product } from '@/types';
import { Brand } from '@/types/admin';
import {
  getSavedListingState,
  saveListingState,
  restoreScrollPosition,
  clearListingReturnFlag,
} from '@/lib/scrollRestoration';

interface CategoryPageClientProps {
  category: Category;
  initialProducts: Product[];
  allBrands: Brand[];
  allCategories: Category[];
}

export function CategoryPageClient({
  category,
  initialProducts,
  allBrands,
  allCategories,
}: CategoryPageClientProps) {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-xs font-semibold text-neutral-500">Loading collection...</div>}>
      <CategoryPageContent
        category={category}
        initialProducts={initialProducts}
        allBrands={allBrands}
        allCategories={allCategories}
      />
    </Suspense>
  );
}

function CategoryPageContent({
  category,
  initialProducts,
  allBrands,
  allCategories: _allCategories,
}: CategoryPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentUrl = useMemo(() => {
    const qs = searchParams.toString();
    return `${pathname}${qs ? `?${qs}` : ''}`;
  }, [pathname, searchParams]);

  const savedState = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getSavedListingState(currentUrl);
  }, [currentUrl]);

  const selectedBrandParam = searchParams.get('brand') || '';

  const [categoryProducts, setCategoryProducts] = useState<Product[]>(initialProducts);
  const [maxPrice, setMaxPrice] = useState<number>(() => savedState?.maxPrice ?? 1000000);
  const [sortBy, setSortBy] = useState<string>(() => savedState?.sortBy || 'featured');
  const [inStockOnly, setInStockOnly] = useState<boolean>(() => savedState?.inStockOnly ?? false);
  const [visibleCount, setVisibleCount] = useState<number>(() => savedState?.visibleCount || 16);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setVisibleCount(16);
  }, [selectedBrandParam, maxPrice, sortBy, inStockOnly, category.slug]);

  // Save listing state when filters or visibleCount change
  useEffect(() => {
    saveListingState(currentUrl, {
      visibleCount,
      selectedBrands: selectedBrandParam ? [selectedBrandParam] : [],
      maxPrice,
      inStockOnly,
      sortBy,
    });
  }, [currentUrl, visibleCount, selectedBrandParam, maxPrice, inStockOnly, sortBy]);

  // Restore scroll position when returning from a product detail page
  const hasRestoredScroll = useRef(false);
  useEffect(() => {
    if (!hasRestoredScroll.current && savedState && savedState.scrollY > 0) {
      hasRestoredScroll.current = true;
      restoreScrollPosition(savedState.scrollY, () => {
        clearListingReturnFlag();
      });
    }
  }, [savedState]);

  // Keep live sync with background updates
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const CAT_KEYS = ['categories', 'products', 'brands'];
      if (key && !CAT_KEYS.includes(key)) return;
      // Background refresh if needed
      fetch(`/api/products?category=${encodeURIComponent(category.slug)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.products)) {
            setCategoryProducts(data.products);
          }
        })
        .catch(() => { });
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [category.slug]);

  // Extract available brands dynamically from categoryProducts
  const availableBrands = useMemo(() => {
    const brandMap = new Map<string, { name: string; slug: string; count: number }>();

    categoryProducts.forEach((p) => {
      const rawName = p.brand?.trim();
      const rawSlug = p.brandSlug?.trim();
      const rawId = ((p as any).brandId || '').toString().trim();

      if (!rawName && !rawSlug && !rawId) return;

      const canonical = allBrands.find(
        (b) =>
          (rawId && b.id?.toLowerCase() === rawId.toLowerCase()) ||
          (rawSlug && b.slug?.toLowerCase() === rawSlug.toLowerCase()) ||
          (rawName && b.name?.toLowerCase() === rawName.toLowerCase())
      );

      const name = canonical?.name || rawName || 'Brand';
      const bSlug = canonical?.slug || rawSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const key = bSlug.toLowerCase();

      const existing = brandMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        brandMap.set(key, { name, slug: bSlug, count: 1 });
      }
    });

    return Array.from(brandMap.values()).sort((a, b) => b.count - a.count);
  }, [categoryProducts, allBrands]);

  const handleBrandChange = (brandSlug: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (!brandSlug || brandSlug === 'all') {
      sp.delete('brand');
    } else {
      sp.set('brand', brandSlug);
    }
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const filteredProducts = useMemo(() => {
    let list = [...categoryProducts];

    list = list.filter((p) => p.price <= maxPrice);

    if (selectedBrandParam) {
      const targetBrand = selectedBrandParam.trim().toLowerCase();
      const canonicalMatch = allBrands.find(
        (b) => b.slug.toLowerCase() === targetBrand || b.name.toLowerCase() === targetBrand
      );
      const targetCanonicalName = canonicalMatch?.name.toLowerCase() || '';
      const targetCanonicalSlug = canonicalMatch?.slug.toLowerCase() || '';
      const targetCanonicalId = canonicalMatch?.id.toLowerCase() || '';

      list = list.filter((p) => {
        const pBrand = (p.brand || '').trim().toLowerCase();
        const pBrandSlug = (p.brandSlug || '').trim().toLowerCase();
        const pBrandId = ((p as any).brandId || '').toString().trim().toLowerCase();

        return (
          pBrand === targetBrand ||
          pBrandSlug === targetBrand ||
          pBrandId === targetBrand ||
          pBrand === targetCanonicalName ||
          pBrandSlug === targetCanonicalSlug ||
          pBrandId === targetCanonicalId
        );
      });
    }

    if (inStockOnly) {
      list = list.filter((p) => p.status !== 'archived' && p.status !== 'inactive');
    }

    switch (sortBy) {
      case 'price-low':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        list.sort((a, b) => ((b as any).createdAt || 0) - ((a as any).createdAt || 0));
        break;
      case 'featured':
      default:
        list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
    }

    return list;
  }, [categoryProducts, selectedBrandParam, allBrands, maxPrice, inStockOnly, sortBy]);

  const activeBrandObj = useMemo(() => {
    if (!selectedBrandParam) return null;
    const target = selectedBrandParam.trim().toLowerCase();
    return availableBrands.find((b) => b.slug.toLowerCase() === target || b.name.toLowerCase() === target);
  }, [selectedBrandParam, availableBrands]);

  return (
    <div className="bg-white min-h-screen">
      {/* Category Hero Banner */}
      <div className="relative bg-neutral-950 text-white overflow-hidden py-12 sm:py-16">
        {category?.image && typeof category.image === 'string' && category.image.trim() && (
          <div className="absolute inset-0 opacity-25">
            <Image
              src={category.image.trim()}
              alt={category.name}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-neutral-400 mb-4 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link href="/categories" className="hover:text-white transition-colors">
              Categories
            </Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-white font-semibold">{category.name}</span>
            {activeBrandObj && (
              <>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="text-amber-400 font-semibold">{activeBrandObj.name}</span>
              </>
            )}
          </nav>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            {category.name}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
            {category.description ||
              `Discover our curated ${category.name} collection. Engineered with premium materials and dispatched nationwide across Pakistan.`}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Brand Filter Inside Category */}
        {availableBrands.length > 0 && (
          <div className="mb-8 pb-6 border-b border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                  Brands in {category.name}
                </span>
              </div>
              {selectedBrandParam && (
                <button
                  type="button"
                  onClick={() => handleBrandChange('all')}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Show All Brands</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                type="button"
                onClick={() => handleBrandChange('all')}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${!selectedBrandParam
                    ? 'bg-neutral-950 text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
              >
                All Brands ({categoryProducts.length})
              </button>

              {availableBrands.map((b) => {
                const isSelected =
                  selectedBrandParam.toLowerCase() === b.slug.toLowerCase() ||
                  selectedBrandParam.toLowerCase() === b.name.toLowerCase();

                return (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => handleBrandChange(b.slug)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${isSelected
                        ? 'bg-neutral-950 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                  >
                    <span>{b.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-600'
                        }`}
                    >
                      {b.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Toolbar: Sorting & Stock Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-neutral-100">
          <div className="text-xs font-medium text-neutral-500">
            Showing <span className="font-bold text-neutral-950">{filteredProducts.length}</span> items in{' '}
            <span className="font-bold text-neutral-950">{category.name}</span>
            {activeBrandObj && (
              <span>
                {' '}
                · Filtered by <span className="font-bold text-neutral-950">{activeBrandObj.name}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* In-Stock Toggle */}
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-neutral-950 focus:ring-0 cursor-pointer"
              />
              <span>In Stock Only</span>
            </label>

            {/* Price Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 font-medium">Max:</span>
              <select
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="text-xs font-semibold bg-neutral-100 border-none rounded-xl px-3 py-1.5 text-neutral-900 focus:outline-none cursor-pointer"
              >
                <option value={1000000}>All Prices</option>
                <option value={2000}>Under Rs. 2,000</option>
                <option value={5000}>Under Rs. 5,000</option>
                <option value={10000}>Under Rs. 10,000</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-neutral-100 hover:bg-neutral-200 border-none rounded-full px-4 py-2 pr-8 text-xs font-semibold text-neutral-900 focus:outline-none cursor-pointer transition-colors"
              >
                <option value="featured">Featured First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Top Customer Rated</option>
                <option value="newest">Newest Arrivals</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-8 max-w-lg mx-auto">
            <PackageX className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900">
              No products available in {category.name}
              {activeBrandObj ? ` from ${activeBrandObj.name}` : ''}
            </h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {selectedBrandParam
                ? `No products match "${activeBrandObj?.name}" in this category. Try switching brands or viewing all items.`
                : 'We are currently restocking this collection with new premium accessories. Explore other categories or shop our complete catalog.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {selectedBrandParam && (
                <button
                  type="button"
                  onClick={() => handleBrandChange('all')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Show All Brands</span>
                </button>
              )}
              <Link
                href="/categories"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors"
              >
                <span>Explore All Categories</span>
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-800 font-semibold text-xs hover:bg-neutral-200 transition-colors"
              >
                <span>Browse All Products</span>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.slice(0, visibleCount).map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>

            {visibleCount < filteredProducts.length && (
              <div className="text-center mt-12">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 16)}
                  className="px-8 py-3.5 rounded-full border border-neutral-950 text-xs sm:text-sm font-semibold text-neutral-950 hover:bg-neutral-950 hover:text-white transition-all shadow-xs cursor-pointer"
                >
                  Load More Products ({filteredProducts.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
