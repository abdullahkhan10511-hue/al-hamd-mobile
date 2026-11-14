'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  Search,
  RotateCcw,
} from 'lucide-react';
import { getProducts } from '@/lib/db/products';
import { getActiveCategories, syncCategoriesFromApi, deduplicateCategoriesById } from '@/lib/db/categories';
import { getBrands, syncBrandsFromApi } from '@/lib/db/brands';
import { ProductCard } from '@/components/products/ProductCard';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { formatPrice, isStorefrontVisibleProduct } from '@/lib/utils';
import { Product, Category } from '@/types';
import { Brand } from '@/types/admin';
import {
  getSavedListingState,
  saveListingState,
  restoreScrollPosition,
  clearListingReturnFlag,
} from '@/lib/scrollRestoration';

export default function ShopPage() {
  return (
    <>
      <h1 className="sr-only">AL-HAMD SHOP — Mobile Accessories Store Catalog</h1>
      <Suspense fallback={<div className="py-24 text-center">Loading collection...</div>}>
        <ShopContent />
      </Suspense>
    </>
  );
}

function ShopContent() {
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

  const initialCategory = searchParams.get('category') || 'all';
  const initialBrand = searchParams.get('brand') || '';
  const initialFilter = searchParams.get('filter') || '';
  const initialSearch = searchParams.get('search') || '';

  const [productsList, setProductsList] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [brandsList, setBrandsList] = useState<Brand[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => savedState?.selectedCategory || initialCategory
  );
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    () => savedState?.selectedBrands || (initialBrand ? [initialBrand] : [])
  );
  const [maxPrice, setMaxPrice] = useState<number>(() => savedState?.maxPrice ?? 1000000);
  const [minRating, setMinRating] = useState<number | null>(() => savedState?.minRating ?? null);
  const [sortBy, setSortBy] = useState<string>(
    () =>
      savedState?.sortBy ||
      (initialFilter === 'new'
        ? 'newest'
        : initialFilter === 'bestseller'
        ? 'best-selling'
        : 'featured')
  );
  const [searchQuery, setSearchQuery] = useState<string>(() => savedState?.searchQuery || initialSearch);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(() => savedState?.visibleCount || 12);

  // Category Horizontal Scrolling & Drag State
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  // Save listing state when filters or visibleCount change
  useEffect(() => {
    saveListingState(currentUrl, {
      visibleCount,
      selectedCategory,
      selectedBrands,
      maxPrice,
      minRating,
      sortBy,
      searchQuery,
    });
  }, [currentUrl, visibleCount, selectedCategory, selectedBrands, maxPrice, minRating, sortBy, searchQuery]);

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

  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const [currentPage, setCurrentPage] = useState<number>(() => (isNaN(initialPage) || initialPage < 1 ? 1 : initialPage));
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const fetchProductsPage = async (pageToFetch: number, isAppending = false) => {
    if (isAppending) {
      setIsLoadingMore(true);
    }
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageToFetch));
      params.set('limit', '24');
      params.set('minimal', 'true');

      if (selectedCategory && selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      if (selectedBrands.length > 0 && selectedBrands[0] !== 'all') {
        params.set('brand', selectedBrands[0]);
      }
      if (searchQuery && searchQuery.trim().length >= 2) {
        params.set('q', searchQuery.trim());
      }
      if (maxPrice < 1000000) {
        params.set('maxPrice', String(maxPrice));
      }
      if (sortBy) {
        params.set('sort', sortBy);
      }

      const res = await fetch(`/api/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          if (isAppending) {
            setProductsList((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newItems = data.products.filter((p: Product) => !existingIds.has(p.id));
              return [...prev, ...newItems];
            });
          } else {
            setProductsList(data.products);
          }
          const total = typeof data.total === 'number' ? data.total : data.products.length;
          setTotalCount(total);
          setTotalPages(typeof data.totalPages === 'number' ? data.totalPages : Math.ceil(total / 24));
          setHasMore(Boolean(data.hasMore));
          setCurrentPage(pageToFetch);
        }
      }
    } catch (err) {
      console.error('[ShopPage] Failed to fetch products from SQL:', err);
    } finally {
      setHasLoaded(true);
      setIsLoadingMore(false);
    }
  };

  const loadData = async () => {
    try {
      const [freshCats, freshBrands] = await Promise.all([
        syncCategoriesFromApi().catch(() => deduplicateCategoriesById(getActiveCategories())),
        syncBrandsFromApi().catch(() => getBrands()),
      ]);
      if (Array.isArray(freshCats)) setCategoriesList(deduplicateCategoriesById(freshCats));
      if (Array.isArray(freshBrands)) setBrandsList(freshBrands.filter((b) => b.status === 'active'));
    } catch (err) {
      console.error('[ShopPage] Error syncing categories/brands:', err);
    }
    await fetchProductsPage(currentPage, false);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const SHOP_KEYS = ['products', 'categories', 'brands'];
      if (key && !SHOP_KEYS.includes(key)) return;
      fetchProductsPage(1, false);
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Fetch from SQL whenever filters change (debounced for search and slider)
  const isInitialFilterMount = useRef(true);
  useEffect(() => {
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchProductsPage(1, false);
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedCategory, selectedBrands, maxPrice, sortBy, searchQuery]);

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

  // Update selected category or brand when query parameter changes
  useEffect(() => {
    const cat = searchParams.get('category');
    setSelectedCategory(cat || 'all');

    const brandParam = searchParams.get('brand');
    setSelectedBrands(brandParam ? [brandParam] : []);
  }, [searchParams]);

  const updateUrlFilters = (nextCategory?: string, nextBrands?: string[], nextPage?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    const cat = nextCategory !== undefined ? nextCategory : selectedCategory;
    const brands = nextBrands !== undefined ? nextBrands : selectedBrands;

    if (cat && cat !== 'all') {
      params.set('category', cat);
    } else {
      params.delete('category');
    }

    if (brands.length > 0 && brands[0] !== 'all') {
      params.set('brand', brands[0]);
    } else {
      params.delete('brand');
    }

    if (nextPage && nextPage > 1) {
      params.set('page', String(nextPage));
    } else {
      params.delete('page');
    }

    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  // Active selected brand object and category object
  const selectedBrandObj = useMemo(() => {
    if (selectedBrands.length === 0) return null;
    const target = selectedBrands[0].trim().toLowerCase();
    return brandsList.find(
      (b) =>
        b.slug?.toLowerCase() === target ||
        b.name?.toLowerCase() === target ||
        b.id?.toLowerCase() === target
    );
  }, [selectedBrands, brandsList]);

  const selectedCategoryObj = useMemo(() => {
    if (selectedCategory === 'all') return null;
    const target = selectedCategory.trim().toLowerCase();
    return categoriesList.find(
      (c) =>
        c.slug?.toLowerCase() === target ||
        c.name?.toLowerCase() === target ||
        c.id?.toLowerCase() === target
    );
  }, [selectedCategory, categoriesList]);

  // Categories available for the currently selected brand
  // ONLY categories that actually have products for this brand are included.
  const availableCategoriesForBrand = useMemo(() => {
    if (selectedBrands.length === 0) {
      return categoriesList;
    }

    const matchingBrandProducts = productsList.filter((product) => {
      return selectedBrands.some((sel) => {
        const s = sel.trim().toLowerCase();
        const pBrand = (product.brand || '').trim().toLowerCase();
        const pSlug = (product.brandSlug || '').trim().toLowerCase();
        const pId = ((product as any).brandId || '').toString().trim().toLowerCase();
        const brandObj = brandsList.find(
          (b) => b.slug?.toLowerCase() === s || b.name?.toLowerCase() === s || b.id?.toLowerCase() === s
        );
        const targetName = brandObj ? brandObj.name.toLowerCase() : s;
        const targetSlug = brandObj ? brandObj.slug.toLowerCase() : s;

        return (
          pBrand === s ||
          pSlug === s ||
          pBrand === targetName ||
          pSlug === targetSlug ||
          (pId && (pId === s || (brandObj && pId === brandObj.id.toLowerCase())))
        );
      });
    });

    const activeCatKeys = new Set<string>();
    matchingBrandProducts.forEach((p) => {
      if (p.categorySlug) activeCatKeys.add(p.categorySlug.trim().toLowerCase());
      if (p.category) activeCatKeys.add(p.category.trim().toLowerCase());
      if ((p as any).categoryId) activeCatKeys.add(((p as any).categoryId).toString().trim().toLowerCase());
    });

    return categoriesList.filter((c) =>
      activeCatKeys.has(c.slug?.toLowerCase()) ||
      activeCatKeys.has(c.name?.toLowerCase()) ||
      activeCatKeys.has(c.id?.toLowerCase())
    );
  }, [categoriesList, productsList, selectedBrands, brandsList]);

  // Brands available for the currently selected category
  // ONLY brands that actually have products in this category are included.
  const availableBrands = useMemo(() => {
    const relevantProducts = selectedCategory === 'all'
      ? productsList
      : productsList.filter((product) => {
          const cat = selectedCategory.trim().toLowerCase();
          const pCat = (product.category || '').trim().toLowerCase();
          const pCatSlug = (product.categorySlug || '').trim().toLowerCase();
          const pCatId = ((product as any).categoryId || '').toString().trim().toLowerCase();
          const catObj = categoriesList.find(
            (c) => c.slug?.toLowerCase() === cat || c.name?.toLowerCase() === cat || c.id?.toLowerCase() === cat
          );
          const targetName = catObj ? catObj.name.toLowerCase() : cat;
          const targetSlug = catObj ? catObj.slug.toLowerCase() : cat;

          return (
            pCat === cat ||
            pCatSlug === cat ||
            pCatId === cat ||
            pCat === targetName ||
            pCatSlug === targetSlug
          );
        });

    const brandSet = new Set<string>();
    relevantProducts.forEach((p) => {
      const b = p.brand?.trim();
      if (b) brandSet.add(b);
    });

    const ordered: string[] = [];
    brandsList.forEach((b) => {
      const matched = Array.from(brandSet).find(
        (name) =>
          name.toLowerCase() === b.name?.toLowerCase() ||
          name.toLowerCase() === b.slug?.toLowerCase() ||
          name.toLowerCase() === b.id?.toLowerCase()
      );
      if (matched) {
        ordered.push(matched);
        brandSet.delete(matched);
      }
    });

    brandSet.forEach((name) => ordered.push(name));
    return ordered;
  }, [brandsList, productsList, selectedCategory, categoriesList]);

  // Brand-filtered count for "All Items" quick pill
  const brandFilteredCount = useMemo(() => {
    if (selectedBrands.length === 0) return productsList.length;
    return productsList.filter((product) => {
      return selectedBrands.some((sel) => {
        const s = sel.trim().toLowerCase();
        const pBrand = (product.brand || '').trim().toLowerCase();
        const pSlug = (product.brandSlug || '').trim().toLowerCase();
        const pId = ((product as any).brandId || '').toString().trim().toLowerCase();
        const brandObj = brandsList.find(
          (b) => b.slug?.toLowerCase() === s || b.name?.toLowerCase() === s || b.id?.toLowerCase() === s
        );
        const targetName = brandObj ? brandObj.name.toLowerCase() : s;
        const targetSlug = brandObj ? brandObj.slug.toLowerCase() : s;

        return (
          pBrand === s ||
          pSlug === s ||
          pBrand === targetName ||
          pSlug === targetSlug ||
          (pId && (pId === s || (brandObj && pId === brandObj.id.toLowerCase())))
        );
      });
    }).length;
  }, [productsList, selectedBrands, brandsList]);

  const isBrandSelected = (brandName: string) => {
    const bLower = brandName.toLowerCase();
    const matchedBrandObj = brandsList.find(
      (b) => b.name?.toLowerCase() === bLower || b.slug?.toLowerCase() === bLower || b.id?.toLowerCase() === bLower
    );
    return selectedBrands.some((sel) => {
      const s = sel.toLowerCase();
      return (
        s === bLower ||
        (matchedBrandObj && s === matchedBrandObj.slug?.toLowerCase()) ||
        (matchedBrandObj && s === matchedBrandObj.name?.toLowerCase()) ||
        (matchedBrandObj && s === matchedBrandObj.id?.toLowerCase())
      );
    });
  };

  const toggleBrand = (brandName: string) => {
    const bLower = brandName.toLowerCase();
    const brandObj = brandsList.find(
      (b) => b.name?.toLowerCase() === bLower || b.slug?.toLowerCase() === bLower || b.id?.toLowerCase() === bLower
    );
    const canonical = brandObj?.slug || brandName;

    const isCurrentlySelected = selectedBrands.some((sel) => {
      const s = sel.toLowerCase();
      return (
        s === bLower ||
        (brandObj && s === brandObj.slug?.toLowerCase()) ||
        (brandObj && s === brandObj.name?.toLowerCase())
      );
    });

    const nextBrands = isCurrentlySelected ? [] : [canonical];
    setSelectedBrands(nextBrands);
    updateUrlFilters(selectedCategory, nextBrands);
  };

  // Display products (filtered and sorted in SQL, optional client-side rating filter)
  const displayProducts = useMemo(() => {
    if (minRating !== null) {
      return productsList.filter((product) => (product.rating || 0) >= minRating);
    }
    return productsList;
  }, [productsList, minRating]);

  const sortedProducts = displayProducts;
  const filteredProducts = displayProducts;

  const pageHeading = useMemo(() => {
    if (selectedCategoryObj && selectedBrandObj) {
      return `${selectedCategoryObj.name} — ${selectedBrandObj.name}`;
    }
    if (selectedBrandObj) {
      return `${selectedBrandObj.name} Collection`;
    }
    if (selectedCategoryObj) {
      return selectedCategoryObj.name;
    }
    return 'All Items';
  }, [selectedCategoryObj, selectedBrandObj]);

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrands([]);
    setMaxPrice(1000000);
    setMinRating(null);
    setSearchQuery('');
    setSortBy('featured');
    updateUrlFilters('all', []);
  };

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    selectedBrands.length +
    (maxPrice < 1000000 ? 1 : 0) +
    (minRating !== null ? 1 : 0) +
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
                {pageHeading}
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Showing {displayProducts.length} of {totalCount} curated products
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
                  updateUrlFilters('all', selectedBrands, 1);
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95 cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-950'
                }`}
              >
                {selectedBrandObj ? `All ${selectedBrandObj.name} (${selectedBrandObj.productCount ?? brandFilteredCount})` : `All Items (${totalCount})`}
              </button>
              {availableCategoriesForBrand.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={(e) => {
                    if (hasDragged) {
                      e.preventDefault();
                      return;
                    }
                    setSelectedCategory(cat.slug);
                    updateUrlFilters(cat.slug, selectedBrands, 1);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95 cursor-pointer ${
                    selectedCategory.toLowerCase() === cat.slug?.toLowerCase() ||
                    selectedCategory.toLowerCase() === cat.name?.toLowerCase()
                      ? 'bg-neutral-950 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-950'
                  }`}
                >
                  {cat.name} {typeof cat.productCount === 'number' && cat.productCount > 0 ? `(${cat.productCount})` : ''}
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
                  Category: {selectedCategoryObj?.name || selectedCategory}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                    onClick={() => {
                      setSelectedCategory('all');
                      updateUrlFilters('all', selectedBrands);
                    }}
                  />
                </span>
              )}
              {selectedBrands.map((brand) => {
                const brandObj = brandsList.find(
                  (b) => b.slug?.toLowerCase() === brand.toLowerCase() || b.name?.toLowerCase() === brand.toLowerCase() || b.id?.toLowerCase() === brand.toLowerCase()
                );
                return (
                  <span
                    key={brand}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium"
                  >
                    Brand: {brandObj?.name || brand}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                      onClick={() => toggleBrand(brand)}
                    />
                  </span>
                );
              })}
              {maxPrice < 1000000 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-medium">
                  Under {formatPrice(maxPrice)}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                    onClick={() => setMaxPrice(1000000)}
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
            <div className="pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Brands
                </h3>
                {selectedBrands.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedBrands([]);
                      updateUrlFilters(selectedCategory, []);
                    }}
                    className="text-[10px] text-neutral-400 hover:text-neutral-950 font-semibold cursor-pointer"
                  >
                    Clear ({selectedBrands.length})
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {availableBrands.map((brand) => (
                  <label
                    key={brand}
                    className="flex items-center gap-2.5 text-xs text-neutral-700 hover:text-neutral-950 cursor-pointer py-1"
                  >
                    <input
                      type="checkbox"
                      checked={isBrandSelected(brand)}
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
            {!hasLoaded ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-5">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-neutral-200/70 bg-neutral-50 aspect-[3/4] animate-pulse" />
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-5">
                {displayProducts.map((product, idx) => (
                  <ScrollReveal
                    key={product.id}
                    delayMs={Math.min((idx % 6) * 25, 100)}
                    className="h-full"
                  >
                    <ProductCard product={product} />
                  </ScrollReveal>
                ))}
              </div>
            )}

            {/* Load More & Pagination Area */}
            {hasMore && (
              <div className="text-center mt-12 flex flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={() => {
                    const nextPage = currentPage + 1;
                    fetchProductsPage(nextPage, true);
                    updateUrlFilters(selectedCategory, selectedBrands, nextPage);
                  }}
                  className="px-8 py-3.5 rounded-full border border-neutral-950 text-xs sm:text-sm font-semibold text-neutral-950 hover:bg-neutral-950 hover:text-white transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading More Products...' : `Load More Products (${Math.max(0, totalCount - displayProducts.length)} remaining)`}
                </button>
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3 text-xs font-semibold text-neutral-700">
                {currentPage > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const prevPage = currentPage - 1;
                      fetchProductsPage(prevPage, false);
                      updateUrlFilters(selectedCategory, selectedBrands, prevPage);
                    }}
                    className="px-4 py-2 rounded-full border border-neutral-200 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    ← Previous Page
                  </button>
                )}
                <span className="px-3 py-1 bg-neutral-100 rounded-full text-neutral-600">
                  Page {currentPage} of {totalPages}
                </span>
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextPage = currentPage + 1;
                      fetchProductsPage(nextPage, false);
                      updateUrlFilters(selectedCategory, selectedBrands, nextPage);
                    }}
                    className="px-4 py-2 rounded-full border border-neutral-200 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Next Page →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Mobile Slide-Over Filter Drawer */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileFiltersOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* Slide-over panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-100">
                <h2 className="text-base font-bold text-neutral-950 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
                </h2>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Search */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-2">
                    Search
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Keywords, brand..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 focus:outline-none"
                    />
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-2">
                    Category
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        updateUrlFilters('all', selectedBrands);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                        selectedCategory === 'all'
                          ? 'bg-neutral-950 text-white'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {selectedBrandObj ? `All ${selectedBrandObj.name}` : 'All Items'}
                    </button>
                    {availableCategoriesForBrand.map((cat) => (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.slug);
                          updateUrlFilters(cat.slug, selectedBrands);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                          selectedCategory.toLowerCase() === cat.slug?.toLowerCase() ||
                          selectedCategory.toLowerCase() === cat.name?.toLowerCase()
                            ? 'bg-neutral-950 text-white'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Ceiling */}
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
                    max="1000000"
                    step="5000"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full accent-neutral-950"
                  />
                </div>

                {/* Brand Filter */}
                <div className="pt-4 border-t border-neutral-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                      Brands
                    </h3>
                    {selectedBrands.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedBrands([]);
                          updateUrlFilters(selectedCategory, []);
                        }}
                        className="text-[10px] text-neutral-400 hover:text-neutral-950 font-semibold"
                      >
                        Clear ({selectedBrands.length})
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {availableBrands.map((brand) => (
                      <label
                        key={brand}
                        className="flex items-center gap-2.5 text-xs text-neutral-700 hover:text-neutral-950 cursor-pointer py-1"
                      >
                        <input
                          type="checkbox"
                          checked={isBrandSelected(brand)}
                          onChange={() => toggleBrand(brand)}
                          className="w-3.5 h-3.5 rounded text-neutral-950"
                        />
                        <span className="truncate">{brand}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center gap-3">
                <button
                  onClick={resetFilters}
                  className="flex-1 py-2.5 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 text-center"
                >
                  Reset All
                </button>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="flex-1 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 text-center"
                >
                  Apply ({filteredProducts.length})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
