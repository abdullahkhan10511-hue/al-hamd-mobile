'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, PackageX, ChevronDown, Tag, RotateCcw } from 'lucide-react';
import { getActiveCategories, syncCategoriesFromApi, deduplicateCategoriesById } from '@/lib/db/categories';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { getActiveBrands, syncBrandsFromApi } from '@/lib/db/brands';
import { ProductCard } from '@/components/products/ProductCard';
import { Category, Product } from '@/types';
import { Brand } from '@/types/admin';

export default function CategoryPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-xs font-semibold text-neutral-500">Loading category collection...</div>}>
      <CategoryPageContent />
    </Suspense>
  );
}

function CategoryPageContent() {
  const params = useParams();
  const rawSlug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug as string);
  const slug = decodeURIComponent(rawSlug || '');

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedBrandParam = searchParams.get('brand') || '';

  const [category, setCategory] = useState<Category | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const applyData = (catsList: Category[], prodsList: Product[], brandsList: Brand[]) => {
    const cleanSlug = slug.trim().toLowerCase();

    // 1. Identify target category
    const currentCat = catsList.find(
      (c) =>
        c.slug?.toLowerCase() === cleanSlug ||
        c.name?.toLowerCase() === cleanSlug ||
        c.id?.toLowerCase() === cleanSlug
    );
    setCategory(currentCat || null);

    const targetName = (currentCat?.name || slug).trim().toLowerCase();
    const targetSlug = (currentCat?.slug || slug).trim().toLowerCase();
    const targetId = currentCat?.id ? currentCat.id.toLowerCase() : '';

    // 2. Filter products belonging strictly to this category
    const filteredProds = prodsList.filter((p) => {
      // Exclude archived/inactive products
      if ((p as any).status === 'archived' || (p as any).status === 'inactive' || (p as any).isActive === false) {
        return false;
      }

      const pCat = (p.category || '').trim().toLowerCase();
      const pCatSlug = (p.categorySlug || '').trim().toLowerCase();
      const pCatId = ((p as any).categoryId || '').toString().trim().toLowerCase();

      return (
        (pCat && (pCat === targetName || pCat === targetSlug || pCat === cleanSlug)) ||
        (pCatSlug && (pCatSlug === targetSlug || pCatSlug === cleanSlug || pCatSlug === targetName)) ||
        (targetId && pCatId && pCatId === targetId) ||
        (targetId && pCat === targetId)
      );
    });

    setCategoryProducts(filteredProds);
  };

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      // 1. Initial fast local cache load
      const initialCats = deduplicateCategoriesById(getActiveCategories());
      const initialProds = getProducts();
      const initialBrands = getActiveBrands();

      setAllCategories(initialCats);
      setAllBrands(initialBrands);
      applyData(initialCats, initialProds, initialBrands);

      // 2. Network synchronization: ALWAYS fetch fresh data from API
      const [freshCats, freshProds, freshBrands] = await Promise.all([
        syncCategoriesFromApi().catch(() => initialCats),
        syncProductsFromApi().catch(() => initialProds),
        syncBrandsFromApi().catch(() => initialBrands),
      ]);

      const deduplicatedCats = deduplicateCategoriesById(freshCats);
      const activeFreshBrands = freshBrands.filter((b) => b.status === 'active');

      setAllCategories(deduplicatedCats);
      setAllBrands(activeFreshBrands);
      applyData(deduplicatedCats, freshProds, activeFreshBrands);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const CAT_KEYS = ['categories', 'products', 'brands'];
      if (key && !CAT_KEYS.includes(key)) return;
      loadData(false);
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [slug]);

  // Extract available brands dynamically from categoryProducts with real product counts
  // ONLY brands that actually have products in this category are included.
  const availableBrands = useMemo(() => {
    const brandMap = new Map<string, { name: string; slug: string; count: number }>();

    categoryProducts.forEach((p) => {
      const rawName = p.brand?.trim();
      const rawSlug = p.brandSlug?.trim();
      const rawId = ((p as any).brandId || '').toString().trim();

      // Skip products that have no brand assigned
      if (!rawName && !rawSlug && !rawId) return;

      // Find canonical brand if available in allBrands
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

    return Array.from(brandMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [categoryProducts, allBrands]);

  const handleBrandChange = (brandSlug: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!brandSlug || brandSlug === 'all') {
      next.delete('brand');
    } else {
      next.set('brand', brandSlug);
    }
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const filteredProducts = useMemo(() => {
    let list = categoryProducts.filter((p) => p.price <= maxPrice);

    // Brand filter inside category
    if (selectedBrandParam && selectedBrandParam !== 'all') {
      const targetBrand = selectedBrandParam.trim().toLowerCase();

      const canonical = allBrands.find(
        (b) =>
          b.slug?.toLowerCase() === targetBrand ||
          b.name?.toLowerCase() === targetBrand ||
          b.id?.toLowerCase() === targetBrand
      );

      const targetCanonicalName = canonical ? canonical.name.toLowerCase() : targetBrand;
      const targetCanonicalSlug = canonical ? canonical.slug.toLowerCase() : targetBrand;
      const targetCanonicalId = canonical ? canonical.id.toLowerCase() : targetBrand;

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
      list = list.filter((p) => (p.shopStock ?? 0) > 0 && p.isShopActive !== false);
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

  if (!category && allCategories.length > 0 && !isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white">
        <PackageX className="w-12 h-12 text-neutral-400 mb-3" />
        <h1 className="text-2xl font-bold text-neutral-900">Category Not Found</h1>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm">
          The category you requested does not exist or may currently be inactive.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/categories"
            className="px-6 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors"
          >
            Explore All Categories
          </Link>
          <Link
            href="/shop"
            className="px-6 py-2.5 rounded-full bg-neutral-100 text-neutral-800 font-semibold text-xs hover:bg-neutral-200 transition-colors"
          >
            Browse All Products
          </Link>
        </div>
      </div>
    );
  }

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
            <span className="text-white font-semibold">{category?.name || slug}</span>
            {activeBrandObj && (
              <>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="text-amber-400 font-semibold">{activeBrandObj.name}</span>
              </>
            )}
          </nav>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            {category?.name || slug}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
            {category?.description ||
              `Discover our curated ${category?.name || slug} collection. Engineered with premium materials and dispatched nationwide across Pakistan.`}
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
                  Brands in {category?.name || slug}
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
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  !selectedBrandParam
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
                    type="button"
                    key={b.slug}
                    onClick={() => handleBrandChange(isSelected ? 'all' : b.slug)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-neutral-950 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    <span>{b.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-600'
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

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-neutral-100">
          <span className="text-xs sm:text-sm font-semibold text-neutral-800">
            Showing <strong className="text-neutral-950 font-mono">{filteredProducts.length}</strong>{' '}
            {activeBrandObj ? `${activeBrandObj.name} items in ` : 'items in '}
            {category?.name}
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
              No products found {activeBrandObj ? `for ${activeBrandObj.name}` : ''} in {category?.name || slug}
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              {selectedBrandParam
                ? `No products match this brand under ${category?.name}. Try selecting "All Brands" or another brand.`
                : 'Check back soon as we add new stock or browse other collections.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {selectedBrandParam && (
                <button
                  type="button"
                  onClick={() => handleBrandChange('all')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Show All Brands in {category?.name}</span>
                </button>
              )}
              <Link
                href="/categories"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-800 font-semibold text-xs hover:bg-neutral-200 transition-colors"
              >
                <span>Browse All Categories</span>
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
