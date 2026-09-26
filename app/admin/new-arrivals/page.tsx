'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  RotateCcw,
  Search,
  Image as ImageIcon,
} from 'lucide-react';
import { getProducts, updateProduct } from '@/lib/db/products';
import { getHomepageSections, updateHomepageSections } from '@/lib/db/homepage';
import { formatPrice } from '@/lib/utils';
import { Product } from '@/types';
import { HomepageSection } from '@/types/admin';

function getValidProductImage(images?: string[] | null): string | null {
  if (!images || !Array.isArray(images) || images.length === 0) return null;
  for (const img of images) {
    if (typeof img === 'string') {
      const trimmed = img.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

export default function AdminNewArrivalsPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const loadData = () => {
    setAllProducts(getProducts());
    setSections(getHomepageSections());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const newArrivalsSection = sections.find((s) => s.id === 'new-arrivals');
  const isSectionEnabled = newArrivalsSection ? newArrivalsSection.enabled : true;

  const handleToggleSection = async () => {
    const updated = sections.map((s) =>
      s.id === 'new-arrivals' ? { ...s, enabled: !s.enabled } : s
    );
    await updateHomepageSections(updated);
    setSections(updated);
    showSaved('Section visibility updated.');
  };

  const newArrivalProducts = allProducts.filter((p) => p.isNewArrival || p.isNew);
  const nonNewArrivalProducts = allProducts.filter((p) => !p.isNewArrival && !p.isNew);

  const handleToggleProduct = async (product: Product, newValue: boolean) => {
    await updateProduct(product.id, {
      isNewArrival: newValue,
      isNew: newValue,
    });
    setAllProducts(getProducts());
    showSaved(newValue ? `Added "${product.name}" to New Arrivals.` : `Removed "${product.name}" from New Arrivals.`);
  };

  const showSaved = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const filteredCandidates = nonNewArrivalProducts.filter((p) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || ((p as any).sku && (p as any).sku.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
              New Arrivals Management
            </h1>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Control which items appear on the customer &ldquo;New Arrivals&rdquo; page and the homepage showcase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/new-arrivals"
            target="_blank"
            className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>View Live Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={handleToggleSection}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isSectionEnabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200'
            }`}
          >
            {isSectionEnabled ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Homepage Section: Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Homepage Section: Hidden</span>
              </>
            )}
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Grid: Current New Arrivals + Add from Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Active New Arrivals List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              Active New Arrivals ({newArrivalProducts.length})
            </h2>
            <span className="text-xs text-neutral-400">
              Live on /new-arrivals
            </span>
          </div>

          {newArrivalProducts.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
              No products are currently marked as New Arrivals. Select items from the catalog on the right.
            </div>
          ) : (
            <div className="space-y-2.5">
              {newArrivalProducts.map((prod) => {
                const imageUrl = getValidProductImage(prod.images);
                return (
                  <div
                    key={prod.id}
                    className="p-3.5 bg-white rounded-2xl border border-neutral-200 flex items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-100">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={prod.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                          {prod.brand}
                        </span>
                        {(prod as any).sku && (
                          <span className="text-[10px] font-mono text-neutral-400">
                            • {(prod as any).sku}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-neutral-900 truncate">
                        {prod.name}
                      </h4>
                      <p className="text-xs font-mono font-semibold text-neutral-700 mt-0.5">
                        {formatPrice(prod.price)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleProduct(prod, false)}
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 shrink-0"
                    title="Remove from New Arrivals"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Add from Catalog */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              Add More Products
            </h2>
            <span className="text-xs text-neutral-400">
              {filteredCandidates.length} Available
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search catalog..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
            />
          </div>

          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
            {filteredCandidates.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-8">
                No matching products found.
              </p>
            ) : (
              filteredCandidates.map((prod) => {
                const candidateImage = getValidProductImage(prod.images);
                return (
                  <div
                    key={prod.id}
                    className="p-3 bg-white rounded-xl border border-neutral-100 hover:border-neutral-200 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-10 h-12 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                        {candidateImage ? (
                          <Image
                            src={candidateImage}
                            alt={prod.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 truncate">
                        {prod.name}
                      </p>
                      <p className="text-[10px] text-neutral-400 font-mono">
                        {formatPrice(prod.price)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleProduct(prod, true)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              );
            })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
