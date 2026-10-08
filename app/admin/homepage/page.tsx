'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  Check,
  Plus,
  Trash2,
  Upload,
  ExternalLink,
  Layers,
  RotateCcw,
  Edit2,
  Clock,
} from 'lucide-react';
import {
  getHomepageSections,
  updateHomepageSections,
  getHeroConfig,
  updateHeroConfig,
  getFloatingProducts,
  updateFloatingProducts,
  getFlashSaleConfig,
  updateFlashSaleConfig,
} from '@/lib/db/homepage';
import { getDeals, toggleDealStatus } from '@/lib/db/deals';
import { getProducts } from '@/lib/db/products';
import { uploadMediaFile } from '@/lib/db/media';
import { HomepageSection, HeroConfig, FloatingProductConfig, FlashSaleConfig, Deal } from '@/types/admin';

export default function HomepageControlPage() {
  const [sections, setSections] = useState<HomepageSection[]>(getHomepageSections());
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(getHeroConfig());
  const [floatingProducts, setFloatingProducts] = useState<FloatingProductConfig[]>(getFloatingProducts());
  const [flashSale, setFlashSale] = useState<FlashSaleConfig>(getFlashSaleConfig());
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activeTab, setActiveTab] = useState<'sections' | 'flash' | 'preview'>('sections');
  const [isSaved, setIsSaved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const loadDeals = () => {
    setDeals(getDeals());
  };

  useEffect(() => {
    loadDeals();
    const handleUpdate = () => {
      loadDeals();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const allProducts = getProducts();

  // Move section Up
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const copy = [...sections];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reordered = copy.map((s, idx) => ({ ...s, order: idx + 1 }));
    setSections(reordered);
  };

  // Toggle section enabled
  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Hero Image Upload
  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isMobile = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const res = await uploadMediaFile(file);
    setIsUploading(false);

    if (res.success && res.item) {
      if (isMobile) {
        setHeroConfig((prev) => ({ ...prev, mobileImage: res.item!.url }));
      } else {
        setHeroConfig((prev) => ({ ...prev, desktopImage: res.item!.url }));
      }
    }
  };

  // Floating Card Handlers (Max 4 cards)
  const handleAddFloatingCard = () => {
    if (floatingProducts.length >= 4) return;

    const usedPositions = new Set(floatingProducts.map((c) => c.position));
    const allPositions: ('top-left' | 'top-right' | 'bottom-left' | 'bottom-right')[] = [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ];
    const nextPos = allPositions.find((p) => !usedPositions.has(p)) || 'bottom-right';

    const usedProductIds = new Set(floatingProducts.map((c) => c.productId));
    const nextProduct = allProducts.find((p) => !usedProductIds.has(p.id)) || allProducts[0];

    const newCard: FloatingProductConfig = {
      id: `fp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: nextProduct ? nextProduct.id : '',
      position: nextPos,
      badge: nextPos === 'bottom-right' ? 'Featured' : 'Top Choice',
      animationEnabled: true,
      animationSpeed: 'normal',
      visible: true,
    };

    setFloatingProducts((prev) => [...prev, newCard]);
  };

  const handleRemoveFloatingCard = (cardId: string) => {
    setFloatingProducts((prev) => prev.filter((c) => c.id !== cardId));
  };

  // Save all changes
  const handleSaveAll = async () => {
    await updateHomepageSections(sections);
    await updateHeroConfig(heroConfig);
    await updateFloatingProducts(floatingProducts);
    await updateFlashSaleConfig(flashSale);

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Storefront Layout Editor
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight mt-1">
            Homepage Control Center
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Reorder sections, toggle visibility, and configure promotional banners.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/homepage-videos"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-neutral-300 hover:bg-neutral-100 text-neutral-900 font-bold text-xs tracking-wider uppercase transition-colors"
          >
            <span>Home Page Videos</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={handleSaveAll}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-md cursor-pointer"
          >
            {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'Changes Saved' : 'Save Homepage'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 overflow-x-auto whitespace-nowrap pb-px">
        {[
          { id: 'sections', label: 'Section Reordering & Visibility' },
          { id: 'flash', label: 'Deals & Promotional Campaigns' },
          { id: 'preview', label: 'Live Storefront Preview' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === tab.id
                ? 'border-neutral-950 text-neutral-950'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. Sections Reorder & Visibility */}
      {activeTab === 'sections' && (
        <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
              Homepage Layout Sequence
            </h2>
            <p className="text-xs text-neutral-500">
              Use the arrow buttons to change the order in which sections render on the customer homepage.
            </p>
          </div>

          <div className="divide-y divide-neutral-100">
            {sections.map((sec, idx) => (
              <div
                key={sec.id}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-neutral-50/50 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-mono font-bold text-xs text-neutral-400">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
                        {sec.id === 'hero' ? 'Full-Screen Video Hero' : sec.name}
                      </h4>
                      {sec.id === 'hero' && (
                        <Link
                          href="/admin/homepage-videos"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-0.5 rounded-full transition-colors"
                        >
                          <span>Manage Videos →</span>
                        </Link>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">id: #{sec.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Visibility Toggle */}
                  <button
                    onClick={() => toggleSection(sec.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                      sec.enabled
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                    }`}
                  >
                    {sec.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{sec.enabled ? 'Enabled' : 'Hidden'}</span>
                  </button>

                  {/* Move Up */}
                  <button
                    disabled={idx === 0}
                    onClick={() => moveSection(idx, 'up')}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Down */}
                  <button
                    disabled={idx === sections.length - 1}
                    onClick={() => moveSection(idx, 'down')}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* 2. Deals Management & Promotional Campaigns */}
      {activeTab === 'flash' && (
        <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                Deals Showcase & Campaigns
              </h2>
              <p className="text-xs text-neutral-500">
                Manage all promotional product deals, bundles, and shop-inventory campaigns (all {deals.length} deals configured).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/deals"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Full Deals Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {deals.length === 0 ? (
            <div className="py-12 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 p-6">
              <p className="text-sm font-semibold text-neutral-700">No deals created yet</p>
              <p className="text-xs text-neutral-500 mt-1">Create promotional deals bundled with Shop Inventory products.</p>
              <Link
                href="/admin/deals"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Go to Deals & Make a Deal</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  className="bg-neutral-50/70 rounded-2xl border border-neutral-200 overflow-hidden flex flex-col justify-between"
                >
                  <div className="h-40 relative overflow-hidden bg-neutral-900 group">
                    {deal.image ? (
                      <img
                        src={deal.image}
                        alt={deal.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-950 flex items-center justify-center p-4">
                        <div className="text-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Deal Bundle</span>
                          <p className="text-sm font-bold text-white mt-1">{deal.name}</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2.5 right-2.5">
                      <button
                        onClick={async () => {
                          await toggleDealStatus(deal.id);
                          loadDeals();
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 backdrop-blur-md cursor-pointer transition-colors ${
                          deal.status === 'active'
                            ? 'bg-emerald-500/90 hover:bg-emerald-600 text-white'
                            : 'bg-neutral-800/90 hover:bg-neutral-900 text-neutral-300'
                        }`}
                      >
                        {deal.status === 'active' ? (
                          <>
                            <Eye className="w-3 h-3" /> Live
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" /> Hidden
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 text-xs flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h4 className="font-bold text-neutral-900 text-sm">{deal.name}</h4>
                      <p className="line-clamp-2 text-neutral-500">{deal.description || 'No description provided.'}</p>
                      <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                        <span className="text-neutral-900 font-bold">
                          {deal.dealPrice ? `Rs. ${deal.dealPrice.toLocaleString()}` : 'Special Price'}
                        </span>
                        {deal.originalPrice && (
                          <span className="line-through text-neutral-400">Rs. {deal.originalPrice.toLocaleString()}</span>
                        )}
                        {deal.discountPercentage ? (
                          <span className="text-emerald-600 font-semibold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">
                            {deal.discountPercentage}% OFF
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {deal.products?.length || 0} product{deal.products?.length === 1 ? '' : 's'} included
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-neutral-400">Order: #{deal.displayOrder}</span>
                      <Link
                        href="/admin/deals"
                        className="text-xs font-semibold text-neutral-700 hover:text-neutral-950 flex items-center gap-1"
                      >
                        <span>Edit in Studio</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Live Storefront Preview */}
      {activeTab === 'preview' && (
        <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
              Storefront Embedded Live Preview
            </h2>
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900 hover:underline"
            >
              <span>Open in new tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-inner h-[650px] w-full bg-neutral-100">
            <iframe src="/" className="w-full h-full border-0" title="Storefront Live Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
