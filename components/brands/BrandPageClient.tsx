'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, PackageX, ChevronDown, Tag, Layers, RotateCcw } from 'lucide-react';
import { ProductCard } from '@/components/products/ProductCard';
import { Brand } from '@/types/admin';
import { Product, Category } from '@/types';

interface BrandPageClientProps {
  brand: Brand;
  initialProducts: Product[];
  allBrands: Brand[];
  allCategories: Category[];
}

export function BrandPageClient({
  brand,
  initialProducts,
  allBrands,
  allCategories,
}: BrandPageClientProps) {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-xs font-semibold text-neutral-500">Loading brand collection...</div>}>
      <BrandPageContent
        brand={brand}
        initialProducts={initialProducts}
        allBrands={allBrands}
        allCategories={allCategories}
      />
    </Suspense>
  );
}

function BrandPageContent({
  brand,
  initialProducts,
  allBrands: _allBrands,
  allCategories,
}: BrandPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedCategoryParam = searchParams.get('category') || '';

  const [brandProducts, setBrandProducts] = useState<Product[]>(initialProducts);
  const [maxPrice, setMaxPrice] = useState<number>(1000000);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(16);

  useEffect(() => {
    setVisibleCount(16);
  }, [selectedCategoryParam, maxPrice, sortBy, inStockOnly, searchQuery, brand.slug]);

  // Keep live sync with background updates
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const CAT_KEYS = ['brands', 'products', 'categories'];
      if (key && !CAT_KEYS.includes(key)) return;
      fetch(`/api/products?brand=${encodeURIComponent(brand.slug)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.products)) {
            setBrandProducts(data.products);
          }
        })
        .catch(() => {});
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [brand.slug]);

  // Extract available categories dynamically from brandProducts
  const availableCategories = useMemo(() => {
    const catMap = new Map<string, { name: string; slug: string; count: number }>();

    brandProducts.forEach((p) => {
      const rawCat = p.category?.trim();
      const rawSlug = p.categorySlug?.trim();
      const rawId = ((p as any).categoryId || '').toString().trim();

      if (!rawCat && !rawSlug && !rawId) return;

      const canonical = allCategories.find(
        (c) =>
          (rawId && c.id?.toLowerCase() === rawId.toLowerCase()) ||
          (rawSlug && c.slug?.toLowerCase() === rawSlug.toLowerCase()) ||
          (rawCat && c.name?.toLowerCase() === rawCat.toLowerCase())
      );

      const name = canonical?.name || rawCat || 'Accessories';
      const cSlug = canonical?.slug || rawSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const key = cSlug.toLowerCase();

      const existing = catMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        catMap.set(key, { name, slug: cSlug, count: 1 });
      }
    });

    return Array.from(catMap.values()).sort((a, b) => b.count - a.count);
  }, [brandProducts, allCategories]);

  const handleCategoryChange = (categorySlug: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (!categorySlug || categorySlug === 'all') {
      sp.delete('category');
    } else {
      sp.set('category', categorySlug);
    }
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const filteredProducts = useMemo(() => {
    let list = [...brandProducts];

    list = list.filter((p) => p.price <= maxPrice);

    if (selectedCategoryParam) {
      const targetCat = selectedCategoryParam.trim().toLowerCase();
      const canonicalMatch = allCategories.find(
        (c) => c.slug.toLowerCase() === targetCat || c.name.toLowerCase() === targetCat
      );
      const targetCanonicalName = canonicalMatch?.name.toLowerCase() || '';
      const targetCanonicalSlug = canonicalMatch?.slug.toLowerCase() || '';
      const targetCanonicalId = canonicalMatch?.id.toLowerCase() || '';

      list = list.filter((p) => {
        const pCat = (p.category || '').trim().toLowerCase();
        const pCatSlug = (p.categorySlug || '').trim().toLowerCase();
        const pCatId = ((p as any).categoryId || '').toString().trim().toLowerCase();

        return (
          pCat === targetCat ||
          pCatSlug === targetCat ||
          pCatId === targetCat ||
          pCat === targetCanonicalName ||
          pCatSlug === targetCanonicalSlug ||
          pCatId === targetCanonicalId
        );
      });
    }

    if (inStockOnly) {
      list = list.filter((p) => (p.shopStock ?? 0) > 0 && p.isShopActive !== false);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
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
  }, [brandProducts, selectedCategoryParam, allCategories, maxPrice, inStockOnly, searchQuery, sortBy]);

  const displayName = brand.name;

  const activeCategoryObj = useMemo(() => {
    if (!selectedCategoryParam) return null;
    const target = selectedCategoryParam.trim().toLowerCase();
    return availableCategories.find((c) => c.slug.toLowerCase() === target || c.name.toLowerCase() === target);
  }, [selectedCategoryParam, availableCategories]);

  return (
    <div className="bg-white min-h-screen">
      {/* Brand Hero Banner */}
      <div className="bg-neutral-950 text-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-neutral-400 mb-4 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link href="/brands" className="hover:text-white transition-colors">
              Brands
            </Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-white font-semibold">{displayName}</span>
            {activeCategoryObj && (
              <>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="text-amber-400 font-semibold">{activeCategoryObj.name}</span>
              </>
            )}
          </nav>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-900 border border-neutral-800 text-amber-400 mb-2">
                <Tag className="w-3 h-3" />
                <span>Official Brand Collection</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                {displayName}
              </h1>
              <p className="mt-3 text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
                {brand.description ||
                  `Browse authentic ${displayName} mobile accessories. Premium quality, best market rates, and nationwide fast shipping across Pakistan.`}
              </p>
            </div>

            {/* Total Brand Count Badge */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shrink-0">
              <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center text-amber-400 font-bold text-lg">
                {brandProducts.length}
              </div>
              <div>
                <div className="text-xs text-neutral-400 font-medium">Available Stock</div>
                <div className="text-sm font-bold text-white">Verified Products</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Category Filter Tabs */}
        {availableCategories.length > 0 && (
          <div className="mb-8 pb-6 border-b border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                  Categories for {displayName}
                </span>
              </div>
              {selectedCategoryParam && (
                <button
                  type="button"
                  onClick={() => handleCategoryChange('all')}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Show All Categories</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                type="button"
                onClick={() => handleCategoryChange('all')}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  !selectedCategoryParam
                    ? 'bg-neutral-950 text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                All Categories ({brandProducts.length})
              </button>

              {availableCategories.map((c) => {
                const isSelected =
                  selectedCategoryParam.toLowerCase() === c.slug.toLowerCase() ||
                  selectedCategoryParam.toLowerCase() === c.name.toLowerCase();

                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => handleCategoryChange(c.slug)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-neutral-950 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {c.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Toolbar: Sorting & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-neutral-100">
          <div className="text-xs font-medium text-neutral-500">
            Showing <span className="font-bold text-neutral-950">{filteredProducts.length}</span> items for{' '}
            <span className="font-bold text-neutral-950">{displayName}</span>
            {activeCategoryObj && (
              <span>
                {' '}
                in <span className="font-bold text-neutral-950">{activeCategoryObj.name}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search within Brand */}
            <input
              type="text"
              placeholder={`Search ${displayName}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs px-3.5 py-1.5 rounded-full border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900 w-36 sm:w-48 transition-all"
            />

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
              No products found for {activeCategoryObj ? `${activeCategoryObj.name} in ` : ''}{displayName}
            </h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {selectedCategoryParam
                ? `No products match this category under ${displayName}. Try selecting "All Products" or another category.`
                : `We currently do not have items in stock under ${displayName}. Check back soon as new inventory arrives, or explore our other verified brands.`}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {selectedCategoryParam && (
                <button
                  type="button"
                  onClick={() => handleCategoryChange('all')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Show All {displayName} Products</span>
                </button>
              )}
              <Link
                href="/brands"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors"
              >
                <span>Explore All Brands</span>
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
