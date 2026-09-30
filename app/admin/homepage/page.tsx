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
import { getBanners, saveBanner, deleteBanner, toggleBannerStatus } from '@/lib/db/banners';
import { getProducts } from '@/lib/db/products';
import { uploadMediaFile } from '@/lib/db/media';
import { HomepageSection, HeroConfig, FloatingProductConfig, FlashSaleConfig, Banner } from '@/types/admin';

export default function HomepageControlPage() {
  const [sections, setSections] = useState<HomepageSection[]>(getHomepageSections());
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(getHeroConfig());
  const [floatingProducts, setFloatingProducts] = useState<FloatingProductConfig[]>(getFloatingProducts());
  const [flashSale, setFlashSale] = useState<FlashSaleConfig>(getFlashSaleConfig());
  const [banners, setBanners] = useState<Banner[]>([]);
  const [editingBanner, setEditingBanner] = useState<Partial<Banner> | null>(null);
  const [deleteTargetBanner, setDeleteTargetBanner] = useState<Banner | null>(null);
  const [activeTab, setActiveTab] = useState<'sections' | 'flash' | 'preview'>('sections');
  const [isSaved, setIsSaved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const loadBanners = () => {
    setBanners(getBanners());
  };

  useEffect(() => {
    loadBanners();
    const handleUpdate = () => {
      loadBanners();
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
          { id: 'flash', label: 'Banner Management & Flash Sale' },
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



      {/* 2. Banner Management & Flash Sale */}

      {activeTab === 'flash' && (
        <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                Banner Management & Flash Sale Deals
              </h2>
              <p className="text-xs text-neutral-500">
                Manage all promotional banners, hero discount cards, and flash sale countdown timers (all {banners.length} active/inactive banners).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/banners"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition-colors"
              >
                <span>Full Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() =>
                  setEditingBanner({
                    title: '',
                    subtitle: '',
                    description: '',
                    image: '',
                    buttonText: 'Shop Now',
                    buttonLink: '/shop',
                    status: 'active',
                    displayOrder: banners.length + 1,
                    countdownEndTime: '',
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Banner</span>
              </button>
            </div>
          </div>

          {/* Banners List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className="bg-neutral-50/70 rounded-2xl border border-neutral-200 overflow-hidden flex flex-col justify-between"
              >
                <div className="h-40 relative overflow-hidden bg-neutral-900 group">
                  <img
                    src={banner.image}
                    alt={banner.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 flex flex-col justify-end text-white">
                    {banner.subtitle && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                        {banner.subtitle}
                      </span>
                    )}
                    <h4 className="text-base font-bold line-clamp-1">{banner.title}</h4>
                    {banner.countdownEndTime && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-300 font-mono mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Countdown Timer Set</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute top-2.5 right-2.5">
                    <button
                      onClick={async () => {
                        await toggleBannerStatus(banner.id);
                        loadBanners();
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 backdrop-blur-md cursor-pointer transition-colors ${
                        banner.status === 'active'
                          ? 'bg-emerald-500/90 hover:bg-emerald-600 text-white'
                          : 'bg-neutral-800/90 hover:bg-neutral-900 text-neutral-300'
                      }`}
                    >
                      {banner.status === 'active' ? (
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
                  <div className="space-y-1 text-neutral-600">
                    <p className="line-clamp-2">{banner.description || 'No description provided.'}</p>
                    <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-neutral-500">
                      <span>Link:</span>
                      <span className="text-neutral-800 font-semibold truncate max-w-[200px]">{banner.buttonLink}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-neutral-400">Order: #{banner.displayOrder}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingBanner({ ...banner })}
                        className="p-1.5 text-neutral-600 hover:text-neutral-950 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="Edit Banner"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetBanner(banner)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Banner"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Delete Confirmation Modal */}
          {deleteTargetBanner && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-neutral-900">Delete Promotional Banner</h3>
                    <p className="text-xs text-neutral-600 mt-1">
                      Are you sure you want to delete &quot;{deleteTargetBanner.title}&quot;? It will be removed immediately from the Home Page.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetBanner(null)}
                    className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteBanner(deleteTargetBanner.id);
                      setDeleteTargetBanner(null);
                      loadBanners();
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit / Create Banner Modal */}
          {editingBanner && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                  <h3 className="font-bold text-neutral-900 text-sm">
                    {editingBanner.id ? 'Edit Promotional Banner' : 'New Promotional Banner'}
                  </h3>
                  <button
                    onClick={() => setEditingBanner(null)}
                    className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!editingBanner.title?.trim()) {
                      alert('Please provide a banner title.');
                      return;
                    }
                    if (!editingBanner.image?.trim()) {
                      alert('Please provide a banner image URL.');
                      return;
                    }
                    await saveBanner(editingBanner as Banner);
                    setEditingBanner(null);
                    loadBanners();
                  }}
                  className="p-6 overflow-y-auto space-y-4 text-xs"
                >
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Banner Title</label>
                    <input
                      type="text"
                      required
                      value={editingBanner.title || ''}
                      onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                      placeholder="e.g., Up To 70% Off"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Subtitle / Badge</label>
                    <input
                      type="text"
                      value={editingBanner.subtitle || ''}
                      onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                      placeholder="e.g., Flash Sale"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editingBanner.description || ''}
                      onChange={(e) => setEditingBanner({ ...editingBanner, description: e.target.value })}
                      placeholder="Promotional copy..."
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Banner Image URL</label>
                    <input
                      type="url"
                      required
                      value={editingBanner.image || ''}
                      onChange={(e) => setEditingBanner({ ...editingBanner, image: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono text-[11px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Button Text</label>
                      <input
                        type="text"
                        value={editingBanner.buttonText || 'Shop Now'}
                        onChange={(e) => setEditingBanner({ ...editingBanner, buttonText: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Button Link</label>
                      <input
                        type="text"
                        value={editingBanner.buttonLink || '/shop'}
                        onChange={(e) => setEditingBanner({ ...editingBanner, buttonLink: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Display Order</label>
                      <input
                        type="number"
                        value={editingBanner.displayOrder ?? 1}
                        onChange={(e) =>
                          setEditingBanner({ ...editingBanner, displayOrder: parseInt(e.target.value, 10) || 1 })
                        }
                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Status</label>
                      <select
                        value={editingBanner.status || 'active'}
                        onChange={(e) =>
                          setEditingBanner({ ...editingBanner, status: e.target.value as 'active' | 'inactive' })
                        }
                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium"
                      >
                        <option value="active">Active (Visible)</option>
                        <option value="inactive">Inactive (Hidden)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Countdown End Date & Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={
                        editingBanner.countdownEndTime
                          ? editingBanner.countdownEndTime.slice(0, 16)
                          : ''
                      }
                      onChange={(e) =>
                        setEditingBanner({
                          ...editingBanner,
                          countdownEndTime: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                        })
                      }
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono"
                    />
                  </div>

                  <div className="pt-3 border-t border-neutral-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingBanner(null)}
                      className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                    >
                      Save Banner
                    </button>
                  </div>
                </form>
              </div>
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
