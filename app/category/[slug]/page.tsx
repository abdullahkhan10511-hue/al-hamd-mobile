'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, SlidersHorizontal, RotateCcw, PackageX, ChevronDown } from 'lucide-react';
import { getActiveCategories } from '@/lib/db/categories';
import { getProducts } from '@/lib/db/products';
import { ProductCard } from '@/components/products/ProductCard';
import { formatPrice } from '@/lib/utils';
import { Category, Product } from '@/types';

export default function CategoryPage() {
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  const loadData = () => {
    const cats = getActiveCategories();
    setAllCategories(cats);

    const currentCat = cats.find(
      (c) =>
        c.slug.toLowerCase() === (slug || '').toLowerCase() ||
        c.id.toLowerCase() === (slug || '').toLowerCase()
    );
    setCategory(currentCat || null);

    const prods = getProducts().filter(
      (p) =>
        (p as any).status !== 'archived' &&
        (p as any).status !== 'inactive' &&
        (p as any).isActive !== false &&
        (p.categorySlug?.toLowerCase() === (slug || '').toLowerCase() ||
          (currentCat && (
            p.category?.toLowerCase() === currentCat.name.toLowerCase() ||
            p.categorySlug?.toLowerCase() === currentCat.slug.toLowerCase() ||
            (p as any).categoryId === currentCat.id
          )))
    );
    setCategoryProducts(prods);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [slug]);

  const filteredProducts = useMemo(() => {
    let list = categoryProducts.filter((p) => p.price <= maxPrice);

    if (inStockOnly) {
      list = list.filter((p) => p.stock > 0);
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
  }, [categoryProducts, maxPrice, inStockOnly, sortBy]);

  if (!category && allCategories.length > 0) {
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
      <div className="relative bg-neutral-950 text-white overflow-hidden py-14 sm:py-20">
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
          <nav className="flex items-center gap-2 text-xs text-neutral-400 mb-4">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/categories" className="hover:text-white transition-colors">
              Categories
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white font-semibold">{category?.name || slug}</span>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-neutral-100">
          <span className="text-xs sm:text-sm font-semibold text-neutral-800">
            Showing <strong className="text-neutral-950 font-mono">{filteredProducts.length}</strong> items in {category?.name}
          </span>

          <div className="flex items-center gap-3">
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
              No products available in this category yet.
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Check back soon as we add new stock or browse other collections.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href="/categories"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors"
              >
                <span>Browse All Categories</span>
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-800 font-semibold text-xs hover:bg-neutral-200 transition-colors"
              >
                <span>All Products</span>
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
