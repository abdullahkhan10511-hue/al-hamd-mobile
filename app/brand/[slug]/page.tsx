'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, PackageX, ChevronDown, Tag, Layers, RotateCcw } from 'lucide-react';
import { getActiveBrands, syncBrandsFromApi } from '@/lib/db/brands';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { getActiveCategories, syncCategoriesFromApi } from '@/lib/db/categories';
import { ProductCard } from '@/components/products/ProductCard';
import { Brand } from '@/types/admin';
import { Product, Category } from '@/types';

export default function BrandPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-xs font-semibold text-neutral-500">Loading brand collection...</div>}>
      <BrandPageContent />
    </Suspense>
  );
}

function BrandPageContent() {
  const params = useParams();
  const rawSlug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug as string);
  const slug = decodeURIComponent(rawSlug || '');

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedCategoryParam = searchParams.get('category') || '';

  const [brand, setBrand] = useState<Brand | null>(null);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [brandProducts, setBrandProducts] = useState<Product[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const applyData = (brandsList: Brand[], prodsList: Product[], catsList: Category[]) => {
    const cleanSlug = slug.trim().toLowerCase();

    // 1. Identify target brand
    let currentBrand = brandsList.find(
      (b) =>
        b.slug?.toLowerCase() === cleanSlug ||
        b.name?.toLowerCase() === cleanSlug ||
        b.id?.toLowerCase() === cleanSlug
    );

    setBrand(currentBrand || null);

    // 2. Identify brand identifiers for robust matching
    const targetName = (currentBrand?.name || slug).trim().toLowerCase();
    const targetSlug = (currentBrand?.slug || slug).trim().toLowerCase();
    const targetId = currentBrand?.id ? currentBrand.id.toLowerCase() : '';

    // 3. Filter products belonging strictly to this brand
    const prods = prodsList.filter((p) => {
      // Exclude archived/inactive products
      if ((p as any).status === 'archived' || (p as any).status === 'inactive' || (p as any).isActive === false) {
        return false;
      }

      const pBrand = (p.brand || '').trim().toLowerCase();
      const pBrandSlug = (p.brandSlug || '').trim().toLowerCase();
      const pBrandId = ((p as any).brandId || '').toString().trim().toLowerCase();

      return (
        (pBrand && (pBrand === targetName || pBrand === targetSlug || pBrand === cleanSlug)) ||
        (pBrandSlug && (pBrandSlug === targetSlug || pBrandSlug === cleanSlug || pBrandSlug === targetName)) ||
        (targetId && pBrandId && pBrandId === targetId) ||
        (targetId && pBrand && pBrand === targetId)
      );
    });

    setBrandProducts(prods);
  };

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      // 1. Initial fast local cache load
      const initialBrands = getActiveBrands();
      const initialProds = getProducts();
      const initialCats = getActiveCategories();

      setAllBrands(initialBrands);
      setAllCategories(initialCats);
      applyData(initialBrands, initialProds, initialCats);

      // 2. Network synchronization: ALWAYS fetch fresh data from API
      const [freshBrands, freshProds, freshCats] = await Promise.all([
        syncBrandsFromApi().catch(() => initialBrands),
        syncProductsFromApi().catch(() => initialProds),
        syncCategoriesFromApi().catch(() => initialCats),
      ]);

      const activeFreshBrands = freshBrands.filter((b) => b.status === 'active');
      setAllBrands(activeFreshBrands);
      setAllCategories(freshCats);
      applyData(activeFreshBrands, freshProds, freshCats);

      // 3. Fallback: if brand still not resolved, query individual brand API endpoint
      const cleanSlug = slug.trim().toLowerCase();
      const brandFound = activeFreshBrands.some(
        (b) =>
          b.slug?.toLowerCase() === cleanSlug ||
          b.name?.toLowerCase() === cleanSlug ||
          b.id?.toLowerCase() === cleanSlug
      );

      if (!brandFound && slug) {
        try {
          const res = await fetch(`/api/brands/${encodeURIComponent(slug)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.brand) {
              setBrand(data.brand);
            }
          }
        } catch {
          // ignore
        }
      }
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const BRAND_KEYS = ['brands', 'products', 'categories'];
      if (key && !BRAND_KEYS.includes(key)) return;
      loadData(false);
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [slug]);

  // Extract available categories dynamically for this brand with real product counts
  // ONLY categories that actually have products for this brand are included.
  const availableCategories = useMemo(() => {
    const catMap = new Map<string, { name: string; slug: string; count: number }>();

    brandProducts.forEach((p) => {
      const rawName = p.category?.trim();
      const rawSlug = p.categorySlug?.trim();
      const rawId = ((p as any).categoryId || '').toString().trim();

      // Skip products that have no category assigned
      if (!rawName && !rawSlug && !rawId) return;

      // Find canonical category if available in allCategories
      const canonical = allCategories.find(
        (c) =>
          (rawId && c.id?.toLowerCase() === rawId.toLowerCase()) ||
          (rawSlug && c.slug?.toLowerCase() === rawSlug.toLowerCase()) ||
          (rawName && c.name?.toLowerCase() === rawName.toLowerCase())
      );

      const name = canonical?.name || rawName || 'Category';
      const catSlug = canonical?.slug || rawSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const key = catSlug.toLowerCase();

      const existing = catMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        catMap.set(key, { name, slug: catSlug, count: 1 });
      }
    });

    return Array.from(catMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [brandProducts, allCategories]);

  const handleCategoryChange = (catSlug: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!catSlug || catSlug === 'all') {
      next.delete('category');
    } else {
      next.set('category', catSlug);
    }
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  // Filtered products considering category, price, stock, search, and sorting
  const filteredProducts = useMemo(() => {
    let list = brandProducts.filter((p) => p.price <= maxPrice);

    // Category filter inside brand
    if (selectedCategoryParam && selectedCategoryParam !== 'all') {
      const targetCat = selectedCategoryParam.trim().toLowerCase();

      const canonical = allCategories.find(
        (c) =>
          c.slug?.toLowerCase() === targetCat ||
          c.name?.toLowerCase() === targetCat ||
          c.id?.toLowerCase() === targetCat
      );

      const targetCanonicalName = canonical ? canonical.name.toLowerCase() : targetCat;
      const targetCanonicalSlug = canonical ? canonical.slug.toLowerCase() : targetCat;
      const targetCanonicalId = canonical ? canonical.id.toLowerCase() : targetCat;

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
      const q = searchQuery.toLowerCase();
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

  const displayName = brand?.name || slug;

  const activeCategoryObj = useMemo(() => {
    if (!selectedCategoryParam) return null;
    const target = selectedCategoryParam.trim().toLowerCase();
    return availableCategories.find((c) => c.slug.toLowerCase() === target || c.name.toLowerCase() === target);
  }, [selectedCategoryParam, availableCategories]);

  if (!isLoading && !brand && brandProducts.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white">
        <PackageX className="w-12 h-12 text-neutral-400 mb-3" />
        <h1 className="text-2xl font-bold text-neutral-900">Brand Not Found</h1>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm">
          The brand &quot;{slug}&quot; does not exist or may currently have no products available.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/shop"
            className="px-6 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors"
          >
            Browse All Products
          </Link>
          <Link
            href="/categories"
            className="px-6 py-2.5 rounded-full bg-neutral-100 text-neutral-800 font-semibold text-xs hover:bg-neutral-200 transition-colors"
          >
            Explore Categories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Brand Hero Banner */}
      <div className="relative bg-neutral-950 text-white overflow-hidden py-12 sm:py-16">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-neutral-400 mb-4 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link href="/shop" className="hover:text-white transition-colors">
              Shop
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

          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {brand?.logo && (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white p-2.5 flex items-center justify-center shrink-0 shadow-lg border border-neutral-800">
                <img
                  src={brand.logo}
                  alt={displayName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-neutral-300 text-xs font-semibold mb-3">
                <Tag className="w-3.5 h-3.5" />
                <span>Official Brand Collection</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                {displayName}
              </h1>
              <p className="mt-3 text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
                {brand?.description ||
                  `Explore genuine ${displayName} products and accessories with authentic guarantee and fast shipping across Pakistan.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Categories Section for this Brand */}
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
                All Products ({brandProducts.length})
              </button>

              {availableCategories.map((cat) => {
                const isSelected =
                  selectedCategoryParam.toLowerCase() === cat.slug.toLowerCase() ||
                  selectedCategoryParam.toLowerCase() === cat.name.toLowerCase();

                return (
                  <button
                    type="button"
                    key={cat.slug}
                    onClick={() => handleCategoryChange(isSelected ? 'all' : cat.slug)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-neutral-950 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-neutral-100">
          <span className="text-xs sm:text-sm font-semibold text-neutral-800">
            Showing <strong className="text-neutral-950 font-mono">{filteredProducts.length}</strong>{' '}
            {activeCategoryObj ? `${activeCategoryObj.name} in ` : ''}
            {displayName}
          </span>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-neutral-950"
              />
              <span>In-Stock Only</span>
            </label>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-900 py-2 pl-3 pr-8 rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
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
            <p className="text-xs text-neutral-500 mt-1">
              {selectedCategoryParam
                ? `No products match this category under ${displayName}. Try selecting "All Products" or another category.`
                : 'Check back soon as we add new stock or browse other collections.'}
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
                href="/shop"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-800 font-semibold text-xs hover:bg-neutral-200 transition-colors"
              >
                <span>Browse All Products</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
