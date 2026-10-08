'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  SlidersHorizontal,
  Edit2,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Upload,
  X,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Sparkles,
  Zap,
  Tag,
  DollarSign,
  Calendar,
  Clock,
  ChevronDown,
  Store,
  RefreshCw,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { Product } from '@/types';
import { Deal, DealProductItem } from '@/types/admin';
import {
  getDeals,
  saveDeal,
  deleteDeal,
  toggleDealStatus,
  syncDealsFromApi,
  toDateTimeLocalString,
  parseDateTimeInputToIso,
  isDealCurrentlyActive,
  isDealExpired,
  isDealUpcoming,
} from '@/lib/db/deals';
import { getProducts, syncProductsFromApi } from '@/lib/db/products';
import { getCategories } from '@/lib/db/categories';
import { getBrands } from '@/lib/db/brands';
import { uploadMediaFile } from '@/lib/db/media';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface FlattenedInventoryItem {
  key: string;
  productId: string;
  modelId?: string;
  productName: string;
  modelName?: string;
  sku: string;
  image: string;
  category: string;
  brand: string;
  price: number;
  shopStock: number;
}

export default function AdminDealsPage() {
  const { admin } = useAdminAuth();
  const userEmail = admin?.email || 'admin@alhamd.com';

  // Deals state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealFilterStatus, setDealFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [dealSearchQuery, setDealSearchQuery] = useState('');

  // Catalog & Inventory state for product selector
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form fields
  const [dealId, setDealId] = useState('');
  const [dealName, setDealName] = useState('');
  const [dealDescription, setDealDescription] = useState('');
  const [dealImage, setDealImage] = useState('');
  const [dealPrice, setDealPrice] = useState<string>('');
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [showOnHomepage, setShowOnHomepage] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [selectedItems, setSelectedItems] = useState<DealProductItem[]>([]);

  // Product Selector filter state
  const [selectorSearch, setSelectorSearch] = useState('');
  const [selectorCategory, setSelectorCategory] = useState('all');
  const [selectorBrand, setSelectorBrand] = useState('all');
  const [selectorStockFilter, setSelectorStockFilter] = useState<'all' | 'in_stock'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = () => {
    setDeals(getDeals());
    setProducts(getProducts());
    setCategories(getCategories());
    setBrands(getBrands());
  };

  useEffect(() => {
    loadData();
    syncDealsFromApi().then(() => setDeals(getDeals()));
    syncProductsFromApi().then(() => setProducts(getProducts()));

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Flatten catalog products into individual selectable shop inventory items
  const inventoryItems = useMemo<FlattenedInventoryItem[]>(() => {
    const list: FlattenedInventoryItem[] = [];

    products.forEach((prod) => {
      const baseImage =
        (prod.images && prod.images[0]) ||
        (prod.media && prod.media[0]?.url) ||
        '';

      if (prod.enableModelSelection && Array.isArray(prod.models) && prod.models.length > 0) {
        prod.models.forEach((model) => {
          const modelImage =
            (model.images && model.images[0]) || baseImage;

          list.push({
            key: `model_${prod.id}_${model.id}`,
            productId: prod.id,
            modelId: model.id,
            productName: prod.name,
            modelName: model.name,
            sku: model.sku || prod.sku || '',
            image: modelImage,
            category: prod.category || '',
            brand: prod.brand || '',
            price: Number(model.price || prod.price || 0),
            shopStock: Number(model.shopStock ?? 0),
          });
        });
      } else {
        list.push({
          key: `prod_${prod.id}`,
          productId: prod.id,
          modelId: undefined,
          productName: prod.name,
          modelName: undefined,
          sku: prod.sku || '',
          image: baseImage,
          category: prod.category || '',
          brand: prod.brand || '',
          price: Number(prod.price || 0),
          shopStock: Number(prod.shopStock ?? 0),
        });
      }
    });

    return list;
  }, [products]);

  // Filtered inventory items for the selector
  const filteredInventoryItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      if (selectorCategory !== 'all' && item.category !== selectorCategory) {
        return false;
      }
      if (selectorBrand !== 'all' && item.brand !== selectorBrand) {
        return false;
      }
      if (selectorStockFilter === 'in_stock' && item.shopStock <= 0) {
        return false;
      }
      if (selectorSearch.trim()) {
        const query = selectorSearch.toLowerCase().trim();
        const matchesName = item.productName.toLowerCase().includes(query);
        const matchesSku = item.sku.toLowerCase().includes(query);
        const matchesModel = item.modelName ? item.modelName.toLowerCase().includes(query) : false;
        const matchesCategory = item.category.toLowerCase().includes(query);
        const matchesBrand = item.brand.toLowerCase().includes(query);

        if (!matchesName && !matchesSku && !matchesModel && !matchesCategory && !matchesBrand) {
          return false;
        }
      }
      return true;
    });
  }, [inventoryItems, selectorCategory, selectorBrand, selectorStockFilter, selectorSearch]);

  // Reset and open form for new deal
  const handleOpenNewDeal = () => {
    setDealId('');
    setDealName('');
    setDealDescription('');
    setDealImage('');
    setDealPrice('');
    setOriginalPrice('');
    setDiscountAmount('');
    setDiscountPercentage('');
    setStartDate('');
    setEndDate('');
    setStatus('active');
    setShowOnHomepage(true);
    setDisplayOrder(deals.length + 1);
    setSelectedItems([]);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  // Open form for editing existing deal
  const handleEditDeal = (deal: Deal) => {
    setDealId(deal.id);
    setDealName(deal.name);
    setDealDescription(deal.description || '');
    setDealImage(deal.image || '');
    setDealPrice(deal.dealPrice !== undefined ? String(deal.dealPrice) : '');
    setOriginalPrice(deal.originalPrice !== undefined ? String(deal.originalPrice) : '');
    setDiscountAmount(deal.discountAmount !== undefined ? String(deal.discountAmount) : '');
    setDiscountPercentage(deal.discountPercentage !== undefined ? String(deal.discountPercentage) : '');
    setStartDate(toDateTimeLocalString(deal.startDate));
    setEndDate(toDateTimeLocalString(deal.endDate));
    setStatus(deal.status);
    setShowOnHomepage(deal.showOnHomepage ?? true);
    setDisplayOrder(deal.displayOrder || 1);
    setSelectedItems(deal.products || []);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  // Toggle item selection in product selector
  const isItemSelected = (item: FlattenedInventoryItem) => {
    return selectedItems.some((s) => s.productId === item.productId && s.modelId === item.modelId);
  };

  const handleToggleItemSelection = (item: FlattenedInventoryItem) => {
    const existingIndex = selectedItems.findIndex(
      (s) => s.productId === item.productId && s.modelId === item.modelId
    );

    let updatedList: DealProductItem[];

    if (existingIndex >= 0) {
      updatedList = selectedItems.filter((_, i) => i !== existingIndex);
    } else {
      const newItem: DealProductItem = {
        id: `dp-${Date.now()}-${selectedItems.length}`,
        productId: item.productId,
        modelId: item.modelId,
        productName: item.productName,
        modelName: item.modelName,
        sku: item.sku,
        image: item.image,
        category: item.category,
        brand: item.brand,
        price: item.price,
        shopStock: item.shopStock,
        sortOrder: selectedItems.length + 1,
      };
      updatedList = [...selectedItems, newItem];
    }

    setSelectedItems(updatedList);
    recalculatePrices(updatedList, dealPrice);
  };

  const handleRemoveSelectedItem = (index: number) => {
    const updated = selectedItems.filter((_, i) => i !== index);
    setSelectedItems(updated);
    recalculatePrices(updated, dealPrice);
  };

  const handleMoveSelectedItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedItems.length) return;

    const copy = [...selectedItems];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reordered = copy.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
    setSelectedItems(reordered);
  };

  // Auto calculate Original Price, Discount Amount & Discount Percentage
  const recalculatePrices = (items: DealProductItem[], currentDealPriceStr: string) => {
    const totalOriginal = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    setOriginalPrice(totalOriginal > 0 ? String(totalOriginal) : '');

    const numDealPrice = parseFloat(currentDealPriceStr);
    if (!isNaN(numDealPrice) && totalOriginal > 0) {
      const diff = totalOriginal - numDealPrice;
      setDiscountAmount(diff > 0 ? String(diff) : '0');
      const pct = Math.round((diff / totalOriginal) * 100);
      setDiscountPercentage(pct > 0 ? String(pct) : '0');
    }
  };

  const handleDealPriceChange = (val: string) => {
    setDealPrice(val);
    const numDeal = parseFloat(val);
    const numOrig = parseFloat(originalPrice);

    if (!isNaN(numDeal) && !isNaN(numOrig) && numOrig > 0) {
      const diff = numOrig - numDeal;
      setDiscountAmount(diff > 0 ? String(diff) : '0');
      const pct = Math.round((diff / numOrig) * 100);
      setDiscountPercentage(pct > 0 ? String(pct) : '0');
    }
  };

  // Image Upload handler using existing persistent upload system
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      alert('Please upload a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadMediaFile(file, 'deals');
      if (result.success && result.item?.url) {
        setDealImage(result.item.url);
        showToast('Deal image uploaded successfully');
      } else {
        throw new Error(result.error || 'Failed to upload image.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Image upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Save Deal
  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!dealName.trim()) {
      alert('Deal Name is required.');
      return;
    }

    if (selectedItems.length === 0) {
      alert('Please select at least 1 product from Shop Inventory for this deal.');
      return;
    }

    if (dealPrice && (isNaN(parseFloat(dealPrice)) || parseFloat(dealPrice) < 0)) {
      alert('Please enter a valid Deal Price (positive number).');
      return;
    }

    if (startDate && endDate) {
      const s = new Date(startDate).getTime();
      const eDate = new Date(endDate).getTime();
      if (!isNaN(s) && !isNaN(eDate) && s > eDate) {
        alert('Start Date cannot be after End Date.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const targetId = dealId || `deal-${Date.now()}`;
      const dealPayload: Partial<Deal> & { name: string } = {
        id: targetId,
        name: dealName.trim(),
        description: dealDescription.trim() || undefined,
        image: dealImage.trim() || undefined,
        dealPrice: dealPrice ? parseFloat(dealPrice) : undefined,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
        discountPercentage: discountPercentage ? parseInt(discountPercentage, 10) : undefined,
        startDate: parseDateTimeInputToIso(startDate),
        endDate: parseDateTimeInputToIso(endDate),
        status,
        showOnHomepage,
        displayOrder: Number(displayOrder || 1),
        products: selectedItems,
      };

      const saved = await saveDeal(dealPayload, userEmail);

      // Also sync to backend API
      try {
        if (dealId) {
          await fetch(`/api/admin/deals/${encodeURIComponent(dealId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dealPayload),
          });
        } else {
          await fetch('/api/admin/deals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dealPayload),
          });
        }
      } catch (apiErr) {
        console.warn('API sync background note:', apiErr);
      }

      loadData();
      setIsModalOpen(false);
      showToast(isEditing ? `Deal "${saved.name}" updated successfully` : `Deal "${saved.name}" created successfully`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred while saving the deal.');
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate deal
  const handleDuplicateDeal = async (deal: Deal) => {
    try {
      const duplicated: Partial<Deal> & { name: string } = {
        name: `${deal.name} (Copy)`,
        description: deal.description,
        image: deal.image,
        dealPrice: deal.dealPrice,
        originalPrice: deal.originalPrice,
        discountAmount: deal.discountAmount,
        discountPercentage: deal.discountPercentage,
        startDate: deal.startDate,
        endDate: deal.endDate,
        status: 'inactive',
        showOnHomepage: deal.showOnHomepage,
        displayOrder: deals.length + 1,
        products: deal.products.map((p, idx) => ({
          ...p,
          id: `dp-${Date.now()}-${idx}`,
          sortOrder: idx + 1,
        })),
      };

      await saveDeal(duplicated, userEmail);
      loadData();
      showToast(`Deal "${deal.name}" duplicated as inactive draft`);
    } catch (err: any) {
      showToast(err.message || 'Failed to duplicate deal', 'error');
    }
  };

  // Confirm delete
  const confirmDeleteDeal = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteDeal(deleteTarget.id, userEmail);

      try {
        await fetch(`/api/admin/deals/${encodeURIComponent(deleteTarget.id)}`, {
          method: 'DELETE',
        });
      } catch (apiErr) {
        console.warn('API delete background note:', apiErr);
      }

      loadData();
      showToast(`Deal "${deleteTarget.name}" deleted permanently`);
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete deal', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleDealStatus(id, userEmail);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle deal status', 'error');
    }
  };

  // Filtered deals list for table view
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (dealFilterStatus !== 'all' && d.status !== dealFilterStatus) {
        return false;
      }
      if (dealSearchQuery.trim()) {
        const q = dealSearchQuery.toLowerCase().trim();
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesDesc = d.description ? d.description.toLowerCase().includes(q) : false;
        const matchesProduct = d.products?.some(
          (p) =>
            p.productName.toLowerCase().includes(q) ||
            (p.modelName && p.modelName.toLowerCase().includes(q)) ||
            (p.sku && p.sku.toLowerCase().includes(q))
        );
        if (!matchesName && !matchesDesc && !matchesProduct) {
          return false;
        }
      }
      return true;
    });
  }, [deals, dealFilterStatus, dealSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-neutral-900 text-white border border-neutral-700'
              : 'bg-rose-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Promotional Marketing</span>
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              Shop Stock Bundles
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight mt-1">
            Deals Management
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Create and manage promotional product deals bundled strictly from Shop Inventory. Does not change physical stock levels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-600 transition-colors cursor-pointer"
            title="Refresh Deals"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleOpenNewDeal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Make a Deal</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">Total Deals</span>
          <span className="text-2xl font-black text-neutral-950 font-mono mt-1 block">{deals.length}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">Active Deals</span>
          <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">
            {deals.filter((d) => d.status === 'active').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">Homepage Featured</span>
          <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">
            {deals.filter((d) => d.showOnHomepage && d.status === 'active').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">Shop Items Available</span>
          <span className="text-2xl font-black text-neutral-950 font-mono mt-1 block">{inventoryItems.length}</span>
        </div>
      </div>

      {/* Deals Filtering Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search deals by name, description, SKU..."
              value={dealSearchQuery}
              onChange={(e) => setDealSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setDealFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dealFilterStatus === 'all' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              All ({deals.length})
            </button>
            <button
              onClick={() => setDealFilterStatus('active')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dealFilterStatus === 'active' ? 'bg-white text-emerald-700 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setDealFilterStatus('inactive')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                dealFilterStatus === 'inactive' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      {/* Deals List Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        {filteredDeals.length === 0 ? (
          <div className="py-16 text-center px-4 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
              <Zap className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-neutral-900">No deals found</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              {deals.length === 0
                ? 'Create your first promotional bundle deal using products from Shop Inventory.'
                : 'No deals match your search and filter criteria.'}
            </p>
            {deals.length === 0 && (
              <button
                onClick={handleOpenNewDeal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-950 text-white font-semibold text-xs shadow-md hover:bg-neutral-800 transition-colors cursor-pointer mt-2"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Make a Deal</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Deal</th>
                  <th className="py-3.5 px-4">Products Bundled</th>
                  <th className="py-3.5 px-4">Pricing & Discount</th>
                  <th className="py-3.5 px-4">Homepage</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredDeals.map((deal) => {
                  const productCount = deal.products?.length || 0;
                  const savings =
                    deal.discountAmount ||
                    (deal.originalPrice && deal.dealPrice ? deal.originalPrice - deal.dealPrice : 0);

                  return (
                    <tr key={deal.id} className="hover:bg-neutral-50/50 transition-colors">
                      {/* Deal Name & Media */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl bg-neutral-900 border border-neutral-200 shrink-0 overflow-hidden flex items-center justify-center">
                            {deal.image ? (
                              <img
                                src={deal.image}
                                alt={deal.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center p-1">
                                <Zap className="w-5 h-5 text-amber-400 mx-auto" />
                                <span className="text-[8px] font-bold text-neutral-400 uppercase block">No Img</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-neutral-900 text-sm block truncate max-w-xs">
                              {deal.name}
                            </span>
                            {deal.description && (
                              <span className="text-[11px] text-neutral-500 truncate block max-w-xs">
                                {deal.description}
                              </span>
                            )}
                            <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-neutral-400">
                              <span>Order: #{deal.displayOrder}</span>
                              {deal.endDate && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>Ends {new Date(deal.endDate).toLocaleDateString()}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Products Bundled */}
                      <td className="py-3 px-4">
                        <div className="space-y-1 max-w-xs">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 font-semibold text-neutral-800 text-xs">
                            <Package className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{productCount} Product{productCount === 1 ? '' : 's'}</span>
                          </span>
                          <div className="text-[11px] text-neutral-500 truncate">
                            {deal.products && deal.products.length > 0
                              ? deal.products.map((p) => p.productName).join(', ')
                              : 'No products selected'}
                          </div>
                        </div>
                      </td>

                      {/* Pricing & Discount */}
                      <td className="py-3 px-4">
                        <div className="font-mono">
                          <span className="font-black text-sm text-neutral-950 block">
                            {deal.dealPrice ? `Rs. ${deal.dealPrice.toLocaleString()}` : '—'}
                          </span>
                          {deal.originalPrice ? (
                            <span className="text-[11px] line-through text-neutral-400 block">
                              Rs. {deal.originalPrice.toLocaleString()}
                            </span>
                          ) : null}
                          {deal.discountPercentage ? (
                            <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                              {deal.discountPercentage}% OFF
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Show on Homepage */}
                      <td className="py-3 px-4">
                        {deal.showOnHomepage ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Shown</span>
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-[10px] font-semibold uppercase tracking-wider">
                            Hidden
                          </span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(deal.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                            deal.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                          }`}
                        >
                          {deal.status === 'active' ? (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-neutral-400" />
                              <span>Inactive</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditDeal(deal)}
                            className="p-2 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Deal"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateDeal(deal)}
                            className="p-2 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                            title="Duplicate Deal"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(deal)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Deal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MAKE A DEAL / EDIT DEAL MODAL
      ========================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-auto overflow-hidden max-h-[92vh] flex flex-col border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-neutral-200 bg-neutral-50/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 bg-amber-100/70 px-2.5 py-0.5 rounded-full">
                  {isEditing ? 'Edit Deal' : 'New Promotional Deal'}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight mt-1">
                  {isEditing ? `Edit: ${dealName || 'Deal'}` : 'Make a Deal'}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Select products from Shop Inventory and configure promotional bundle pricing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-full bg-neutral-200/60 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveDeal} className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-7 text-xs">
              {/* SECTION A: Basic Deal Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-950 flex items-center gap-1.5 pb-2 border-b border-neutral-100">
                  <Tag className="w-4 h-4 text-amber-500" />
                  <span>1. Deal Overview</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Deal Name */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      Deal Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Summer Charging Bundle"
                      value={dealName}
                      onChange={(e) => setDealName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-950 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                    />
                  </div>

                  {/* Display Order */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-950 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                    />
                  </div>
                </div>

                {/* Deal Description */}
                <div>
                  <label className="block font-bold text-neutral-900 mb-1">
                    Deal Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short summary highlighting the bundle value..."
                    value={dealDescription}
                    onChange={(e) => setDealDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  />
                </div>

                {/* Deal Image (OPTIONAL) */}
                <div className="bg-neutral-50/80 p-4 rounded-2xl border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block font-bold text-neutral-900">
                        Deal Image <span className="text-neutral-400 font-normal">(Optional)</span>
                      </label>
                      <span className="text-[11px] text-neutral-500">
                        Optional promotional banner image. If omitted, the deal displays with dynamic product thumbnails.
                      </span>
                    </div>

                    {dealImage && (
                      <button
                        type="button"
                        onClick={() => setDealImage('')}
                        className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {dealImage ? (
                      <div className="w-28 h-20 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-300 shrink-0 relative">
                        <img
                          src={dealImage}
                          alt="Deal Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-28 h-20 rounded-xl bg-neutral-100 border border-dashed border-neutral-300 shrink-0 flex flex-col items-center justify-center text-neutral-400">
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-[9px] uppercase font-bold mt-1">No Image</span>
                      </div>
                    )}

                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl font-semibold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploading ? 'Uploading...' : 'Upload from Device / Gallery'}</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400 uppercase font-bold">Or URL:</span>
                        <input
                          type="url"
                          placeholder="https://..."
                          value={dealImage}
                          onChange={(e) => setDealImage(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: Multiple Product Selector (Shop Inventory) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-950 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-emerald-600" />
                    <span>2. Select Products (Shop Inventory) <span className="text-rose-600">*</span></span>
                  </h3>
                  <span className="text-xs font-bold font-mono text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {selectedItems.length} Products Selected
                  </span>
                </div>

                {/* Selected Products List & Ordering */}
                {selectedItems.length > 0 && (
                  <div className="bg-neutral-950 text-white p-4 sm:p-5 rounded-2xl border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      <span>Selected Products Queue ({selectedItems.length})</span>
                      <span className="text-[11px] text-amber-400 font-normal">
                        Order items using arrows
                      </span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedItems.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 text-center font-mono font-bold text-neutral-500">
                              {idx + 1}.
                            </span>
                            <div className="w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.productName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-neutral-600" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate max-w-sm">
                                {item.productName}
                              </p>
                              {item.modelName && (
                                <p className="text-[10px] text-amber-400 font-mono truncate">
                                  Model: {item.modelName}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                                {item.sku && <span>SKU: {item.sku}</span>}
                                {item.shopStock !== undefined && (
                                  <span className="text-emerald-400">
                                    Shop Stock: {item.shopStock}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-neutral-200 mr-1">
                              Rs. {item.price.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveSelectedItem(idx, 'up')}
                              className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5 text-neutral-300" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === selectedItems.length - 1}
                              onClick={() => handleMoveSelectedItem(idx, 'down')}
                              className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5 text-neutral-300" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSelectedItem(idx)}
                              className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded cursor-pointer transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter Toolbar for Product Selector */}
                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    {/* Search */}
                    <div className="sm:col-span-2 relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search product, SKU, model..."
                        value={selectorSearch}
                        onChange={(e) => setSelectorSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-950"
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <select
                        value={selectorCategory}
                        onChange={(e) => setSelectorCategory(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-xs focus:outline-none"
                      >
                        <option value="all">All Categories</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Brand */}
                    <div>
                      <select
                        value={selectorBrand}
                        onChange={(e) => setSelectorBrand(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-xs focus:outline-none"
                      >
                        <option value="all">All Brands</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-200">
                    <span className="font-mono">
                      Showing {filteredInventoryItems.length} items from Shop Stock
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectorStockFilter(selectorStockFilter === 'all' ? 'in_stock' : 'all')
                      }
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                        selectorStockFilter === 'in_stock'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                      }`}
                    >
                      {selectorStockFilter === 'in_stock' ? '✓ In-Stock Only' : 'Show All Items'}
                    </button>
                  </div>
                </div>

                {/* Available Products Picker Grid */}
                <div className="border border-neutral-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-neutral-100 bg-white">
                  {filteredInventoryItems.length === 0 ? (
                    <div className="py-8 text-center text-neutral-400">
                      No matching products found in Shop Inventory.
                    </div>
                  ) : (
                    filteredInventoryItems.map((item) => {
                      const selected = isItemSelected(item);

                      return (
                        <div
                          key={item.key}
                          onClick={() => handleToggleItemSelection(item)}
                          className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            selected ? 'bg-amber-50/70 hover:bg-amber-100/60' : 'hover:bg-neutral-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {}} // handled by parent onClick
                              className="w-4 h-4 rounded text-neutral-950 border-neutral-300 pointer-events-none"
                            />

                            {/* Thumbnail */}
                            <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 shrink-0 overflow-hidden flex items-center justify-center">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.productName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>

                            {/* Product Info */}
                            <div className="min-w-0">
                              <p className="font-bold text-neutral-950 truncate max-w-sm">
                                {item.productName}
                              </p>
                              {item.modelName && (
                                <p className="text-[10px] text-amber-600 font-mono font-semibold truncate">
                                  Model: {item.modelName}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-400 font-mono mt-0.5">
                                {item.sku && <span>SKU: {item.sku}</span>}
                                {item.category && <span>• {item.category}</span>}
                                {item.brand && <span>• {item.brand}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Shop Stock & Price Badge */}
                          <div className="text-right shrink-0">
                            <span className="font-bold text-neutral-950 font-mono block">
                              Rs. {item.price.toLocaleString()}
                            </span>
                            <span
                              className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                                item.shopStock > 5
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : item.shopStock > 0
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              Shop Stock: {item.shopStock}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SECTION C: Pricing & Discounts */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-950 flex items-center gap-1.5 pb-2 border-b border-neutral-100">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>3. Pricing & Discounts</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
                  {/* Original Price */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      Original Price (Rs.)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Sum of items"
                      value={originalPrice}
                      onChange={(e) => {
                        setOriginalPrice(e.target.value);
                        const numOrig = parseFloat(e.target.value);
                        const numDeal = parseFloat(dealPrice);
                        if (!isNaN(numOrig) && !isNaN(numDeal) && numOrig > 0) {
                          const diff = numOrig - numDeal;
                          setDiscountAmount(diff > 0 ? String(diff) : '0');
                          const pct = Math.round((diff / numOrig) * 100);
                          setDiscountPercentage(pct > 0 ? String(pct) : '0');
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-950 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-neutral-950"
                    />
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      Auto-calculated from items
                    </span>
                  </div>

                  {/* Deal Price */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      Deal Price (Rs.)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 2999"
                      value={dealPrice}
                      onChange={(e) => handleDealPriceChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-400 rounded-xl text-neutral-950 font-mono font-black focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-amber-600 font-semibold mt-1 block">
                      Promotional bundle price
                    </span>
                  </div>

                  {/* Discount Amount */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      Discount Amount (Rs.)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 500"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-950 font-mono focus:outline-none"
                    />
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      Savings for customer
                    </span>
                  </div>

                  {/* Discount Percentage */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      Discount %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 25"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-neutral-950 font-mono font-bold focus:outline-none"
                    />
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      Display badge percentage
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION D: Schedule, Homepage & Status */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-950 flex items-center gap-1.5 pb-2 border-b border-neutral-100">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>4. Schedule & Settings</span>
                </h3>

                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-neutral-500">
                      Timing rules: Empty dates mean deal is active immediately and indefinitely.
                    </span>
                  </div>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                    >
                      Clear Dates (Keep Indefinite)
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Start Date */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      Start Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-950 font-mono"
                    />
                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                      Leave empty to start immediately
                    </span>
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      End Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-950 font-mono"
                    />
                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                      Leave empty for indefinite duration
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      Deal Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                      className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-950 font-bold"
                    >
                      <option value="active">Active (Visible)</option>
                      <option value="inactive">Inactive (Hidden)</option>
                    </select>
                  </div>

                  {/* Show on Homepage */}
                  <div>
                    <label className="block font-bold text-neutral-900 mb-1">
                      Homepage Display
                    </label>
                    <label className="flex items-center gap-2 p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showOnHomepage}
                        onChange={(e) => setShowOnHomepage(e.target.checked)}
                        className="w-4 h-4 rounded text-neutral-950 border-neutral-300"
                      />
                      <span className="font-semibold text-neutral-900 text-xs">
                        Show on Homepage
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-2"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <span>{isSaving ? 'Saving Deal...' : isEditing ? 'Save Changes' : 'Create Deal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE CONFIRMATION MODAL
      ========================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-neutral-200">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-neutral-950">Delete Promotional Deal</h3>
                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete &quot;<strong className="text-neutral-900">{deleteTarget.name}</strong>&quot;?
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  This only removes the promotional deal grouping. Shop inventory stock counts will NOT be affected.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-neutral-200 text-neutral-700 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteDeal}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
