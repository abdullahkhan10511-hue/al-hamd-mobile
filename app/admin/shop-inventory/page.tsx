'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Product } from '@/types';
import { ShopBill } from '@/types/admin';
import { getProducts, updateProduct, syncProductsFromApi } from '@/lib/db/products';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getAdminAuthHeaders } from '@/lib/db/staff';
import { CreateShopBillModal } from '@/components/admin/CreateShopBillModal';
import { ShopBillModal } from '@/components/admin/ShopBillModal';
import {
  Store,
  Warehouse,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRightLeft,
  PackageOpen,
  ReceiptText,
  Clock,
  Eye,
  Ban,
  Package,
  SlidersHorizontal,
  Trash2,
  Power,
  RotateCcw,
  AlertCircle,
  Sliders,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700 border border-amber-200',
  finalized: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  voided: 'bg-rose-100 text-rose-700 border border-rose-200',
};

const STATUS_ICONS: Record<string, React.ComponentType<any>> = {
  draft: Clock,
  finalized: CheckCircle2,
  voided: XCircle,
};

export default function ShopInventoryPage() {
  const { admin } = useAdminAuth();
  const searchParams = useSearchParams();

  // Active view tab: 'stock' (Shop Stock) | 'bills' (Shop Bill History)
  const initialTab = searchParams.get('tab') === 'bills' ? 'bills' : 'stock';
  const [activeTab, setActiveTab] = useState<'stock' | 'bills'>(initialTab);

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'in' | 'low' | 'out' | 'inactive' | 'removed'
  >('all');

  // Shop Bills state
  const [shopBills, setShopBills] = useState<ShopBill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billFilterStatus, setBillFilterStatus] = useState<'all' | 'draft' | 'finalized' | 'voided'>('all');
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [viewingBill, setViewingBill] = useState<ShopBill | null>(null);

  // Shop Bill creation modal state
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false);

  // Void modal state
  const [voidBillId, setVoidBillId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  // Stock Warning Settings modal state
  const [editingWarningProduct, setEditingWarningProduct] = useState<Product | null>(null);
  const [warningThresholdInput, setWarningThresholdInput] = useState<string>('5');
  const [warningSaving, setWarningSaving] = useState(false);

  // Delete from Shop Inventory modal state
  const [deletingShopProduct, setDeletingShopProduct] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Action feedback states
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadProducts = useCallback(() => {
    setProducts(getProducts());
  }, []);

  const loadShopBills = useCallback(async () => {
    setBillsLoading(true);
    try {
      const res = await fetch('/api/admin/shop-bills', {
        headers: getAdminAuthHeaders(admin?.email),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) {
        setShopBills(data.shopBills || []);
      }
    } catch {
      // Graceful fallback
    } finally {
      setBillsLoading(false);
    }
  }, [admin?.email]);

  useEffect(() => {
    loadProducts();
    loadShopBills();

    const handleUpdate = () => {
      loadProducts();
      loadShopBills();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [loadProducts, loadShopBills]);

  // Sync tab with URL if user clicked link with ?tab=create-bill or ?tab=bills
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'bills') {
      setActiveTab('bills');
    } else if (tabParam === 'create-bill') {
      setActiveTab('bills');
      setIsCreateBillOpen(true);
    }
  }, [searchParams]);

  // ========================================================
  // SHOP STOCK CALCULATIONS (Completely Separate from Warehouse Stock)
  // ========================================================
  // Active Shop items (not removed from shop inventory)
  const shopInventoryProducts = useMemo(() => {
    return products.filter((p) => p.inShopInventory !== false);
  }, [products]);

  const removedShopProducts = useMemo(() => {
    return products.filter((p) => p.inShopInventory === false);
  }, [products]);

  const totalShopItems = shopInventoryProducts.length;

  const outOfStockItems = useMemo(() => {
    return shopInventoryProducts.filter((p) => (p.shopStock ?? 0) <= 0);
  }, [shopInventoryProducts]);

  const lowStockItems = useMemo(() => {
    return shopInventoryProducts.filter((p) => {
      const stock = p.shopStock ?? 0;
      const threshold = p.shopLowStockThreshold !== undefined ? p.shopLowStockThreshold : 5;
      return stock > 0 && stock <= threshold;
    });
  }, [shopInventoryProducts]);

  const availableItems = useMemo(() => {
    return shopInventoryProducts.filter((p) => {
      const stock = p.shopStock ?? 0;
      const threshold = p.shopLowStockThreshold !== undefined ? p.shopLowStockThreshold : 5;
      return stock > threshold && p.isShopActive !== false;
    });
  }, [shopInventoryProducts]);

  const inactiveItems = useMemo(() => {
    return shopInventoryProducts.filter((p) => p.isShopActive === false);
  }, [shopInventoryProducts]);

  // Filtered Products for the table
  const filteredProducts = useMemo(() => {
    const baseList = filterStatus === 'removed' ? removedShopProducts : shopInventoryProducts;

    return baseList.filter((p) => {
      const matchesQuery =
        !searchQuery.trim() ||
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesQuery) return false;

      const shopStock = p.shopStock ?? 0;
      const threshold = p.shopLowStockThreshold !== undefined ? p.shopLowStockThreshold : 5;

      if (filterStatus === 'in') {
        return shopStock > threshold && p.isShopActive !== false;
      }
      if (filterStatus === 'low') {
        return shopStock > 0 && shopStock <= threshold;
      }
      if (filterStatus === 'out') {
        return shopStock <= 0;
      }
      if (filterStatus === 'inactive') {
        return p.isShopActive === false;
      }
      return true;
    });
  }, [shopInventoryProducts, removedShopProducts, searchQuery, filterStatus]);

  // Filtered Shop Bills
  const filteredBills = useMemo(() => {
    return shopBills.filter((bill) => {
      if (billFilterStatus !== 'all' && bill.status !== billFilterStatus) return false;
      if (!billSearchQuery.trim()) return true;
      const q = billSearchQuery.toLowerCase();
      return (
        bill.billNumber.toLowerCase().includes(q) ||
        bill.createdBy.toLowerCase().includes(q) ||
        bill.items.some((i) => i.productName.toLowerCase().includes(q))
      );
    });
  }, [shopBills, billFilterStatus, billSearchQuery]);

  // ========================================================
  // PRODUCT ACTION 1: TOGGLE ACTIVE / INACTIVE FOR SHOP INVENTORY
  // ========================================================
  const handleToggleShopActive = async (product: Product) => {
    const currentActive = product.isShopActive !== false;
    const nextActive = !currentActive;
    setTogglingActiveId(product.id);

    try {
      const res = await updateProduct(
        product.id,
        { isShopActive: nextActive },
        admin?.email || 'admin@alhamd.com'
      );

      if (res.success) {
        showToast(
          `"${product.name}" Shop Inventory status is now ${nextActive ? 'Active' : 'Inactive'}. (Warehouse stock and main product data unchanged).`,
          'success'
        );
        loadProducts();
      } else {
        showToast(res.error || 'Failed to update shop status.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error updating shop status.', 'error');
    } finally {
      setTogglingActiveId(null);
    }
  };

  // ========================================================
  // PRODUCT ACTION 2: EDIT STOCK WARNING THRESHOLD
  // ========================================================
  const handleOpenWarningModal = (product: Product) => {
    setEditingWarningProduct(product);
    setWarningThresholdInput(
      String(product.shopLowStockThreshold !== undefined ? product.shopLowStockThreshold : 5)
    );
  };

  const handleSaveWarningThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarningProduct) return;

    const parsed = parseInt(warningThresholdInput.trim(), 10);
    if (isNaN(parsed) || parsed < 0) {
      showToast('Stock Warning Level must be a valid non-negative integer (0, 1, 2, ...).', 'error');
      return;
    }

    setWarningSaving(true);
    try {
      const res = await updateProduct(
        editingWarningProduct.id,
        { shopLowStockThreshold: parsed },
        admin?.email || 'admin@alhamd.com'
      );

      if (res.success) {
        showToast(
          `Stock Warning Level for "${editingWarningProduct.name}" set to ${parsed}.`,
          'success'
        );
        setEditingWarningProduct(null);
        loadProducts();
      } else {
        showToast(res.error || 'Failed to update warning threshold.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error updating warning threshold.', 'error');
    } finally {
      setWarningSaving(false);
    }
  };

  // ========================================================
  // PRODUCT ACTION 3: DELETE / REMOVE FROM SHOP INVENTORY
  // ========================================================
  const handleOpenDeleteModal = (product: Product) => {
    setDeletingShopProduct(product);
  };

  const handleConfirmDeleteFromShop = async () => {
    if (!deletingShopProduct) return;

    const currentShopStock = deletingShopProduct.shopStock ?? 0;
    // Strict safety check: Never silently delete physical shop stock
    if (currentShopStock > 0) {
      showToast(
        `Cannot remove this product while Shop Stock is ${currentShopStock}. Please transfer/sell/adjust the shop stock first.`,
        'error'
      );
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await updateProduct(
        deletingShopProduct.id,
        { inShopInventory: false, isShopActive: false },
        admin?.email || 'admin@alhamd.com'
      );

      if (res.success) {
        showToast(
          `"${deletingShopProduct.name}" removed from Shop Inventory. (Main product and Warehouse Inventory remain intact).`,
          'success'
        );
        setDeletingShopProduct(null);
        loadProducts();
      } else {
        showToast(res.error || 'Failed to remove from Shop Inventory.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error removing product.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Restore removed product to Shop Inventory
  const handleRestoreToShop = async (product: Product) => {
    try {
      const res = await updateProduct(
        product.id,
        { inShopInventory: true, isShopActive: true },
        admin?.email || 'admin@alhamd.com'
      );

      if (res.success) {
        showToast(`"${product.name}" restored to Shop Inventory.`, 'success');
        loadProducts();
      } else {
        showToast(res.error || 'Failed to restore product.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error restoring product.', 'error');
    }
  };

  // Finalize Draft Shop Bill (Warehouse -> Shop Transfer)
  const handleFinalizeBill = async (bill: ShopBill) => {
    if (
      !confirm(
        `Finalize Shop Bill ${bill.billNumber}? This will deduct warehouse stock and increase shop stock transactionally.`
      )
    )
      return;

    setFinalizingId(bill.id);
    try {
      const res = await fetch(`/api/admin/shop-bills/${bill.id}`, {
        method: 'PATCH',
        headers: getAdminAuthHeaders(admin?.email),
        body: JSON.stringify({ action: 'finalize' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Shop Bill ${bill.billNumber} finalized! Stock transferred from Warehouse to Shop.`,
          'success'
        );
        await syncProductsFromApi().catch(() => {});
        loadShopBills();
        loadProducts();
        if (viewingBill?.id === bill.id) {
          setViewingBill(data.shopBill);
        }
      } else {
        showToast(data.error || 'Failed to finalize bill.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error.', 'error');
    } finally {
      setFinalizingId(null);
    }
  };

  // Void Shop Bill (Reverses Warehouse -> Shop Transfer)
  const handleVoidBill = async () => {
    if (!voidBillId || !voidReason.trim()) return;
    setVoidLoading(true);
    try {
      const res = await fetch(`/api/admin/shop-bills/${voidBillId}`, {
        method: 'PATCH',
        headers: getAdminAuthHeaders(admin?.email),
        body: JSON.stringify({ action: 'void', voidReason: voidReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Shop Bill voided. Stock transfer reversed successfully.', 'success');
        setVoidBillId(null);
        setVoidReason('');
        await syncProductsFromApi().catch(() => {});
        loadShopBills();
        loadProducts();
      } else {
        showToast(data.error || 'Failed to void bill.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error.', 'error');
    } finally {
      setVoidLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold transition-all ${
            toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-6 h-6 text-violet-600" />
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Shop Inventory</h1>
          </div>
          <p className="text-xs text-neutral-500">
            Physical stock currently available in the retail shop. Stock enters shop exclusively through Shop Bills.
          </p>
        </div>

        {/* Primary Action Buttons: STRICTLY NO "Add Product" button! */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Create Shop Bill: The ONLY way stock enters Shop Inventory */}
          <button
            onClick={() => setIsCreateBillOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm shadow-violet-200"
          >
            <ReceiptText className="w-4 h-4" />
            <span>Create Shop Bill</span>
          </button>

          <Link
            href="/admin/inventory"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-semibold hover:bg-neutral-200 transition-colors"
          >
            <Warehouse className="w-4 h-4" />
            <span>Warehouse</span>
          </Link>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-neutral-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('stock')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'stock'
              ? 'border-violet-600 text-violet-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Shop Stock</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-neutral-100 text-neutral-600">
            {shopInventoryProducts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('bills')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'bills'
              ? 'border-violet-600 text-violet-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <ReceiptText className="w-4 h-4" />
          <span>Shop Bills (Warehouse → Shop Transfer)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-neutral-100 text-neutral-600">
            {shopBills.length}
          </span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: SHOP STOCK
         ======================================================== */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          {/* Stock Rules Banner */}
          <div className="bg-violet-50/70 border border-violet-200/80 rounded-2xl p-4 flex gap-3 text-xs text-violet-900">
            <ArrowRightLeft className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Two Completely Separate Inventories</p>
              <p className="text-violet-700 mt-0.5 leading-relaxed">
                • <strong>Shop Stock</strong> represents physical stock at the shop. The customer website and POS counter use this stock.<br />
                • Stock only enters Shop Inventory through a <strong>Shop Bill</strong> (Warehouse → Shop transfer).<br />
                • A product remains visible in Shop Inventory even when Warehouse Stock is 0.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-xs font-semibold text-neutral-500 block">Total Shop Items</span>
              <p className="text-2xl font-black text-neutral-950 mt-1">{totalShopItems}</p>
              {inactiveItems.length > 0 && (
                <span className="text-[11px] text-neutral-400 mt-1 block">
                  ({inactiveItems.length} inactive)
                </span>
              )}
            </div>
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-xs font-semibold text-emerald-700 block">Available in Shop</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">{availableItems.length}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-xs font-semibold text-amber-700 block">Low Stock (≤ Warning)</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{lowStockItems.length}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-xs font-semibold text-rose-700 block">Out of Stock</span>
              <p className="text-2xl font-black text-rose-600 mt-1">{outOfStockItems.length}</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or SKU..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:outline-none focus:border-violet-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'in', label: 'Available' },
                  { key: 'low', label: 'Low Stock' },
                  { key: 'out', label: 'Out of Stock' },
                  { key: 'inactive', label: 'Inactive' },
                  { key: 'removed', label: `Removed (${removedShopProducts.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    filterStatus === tab.key
                      ? tab.key === 'all'
                        ? 'bg-neutral-900 text-white'
                        : tab.key === 'in'
                        ? 'bg-emerald-600 text-white'
                        : tab.key === 'low'
                        ? 'bg-amber-500 text-white'
                        : tab.key === 'out'
                        ? 'bg-rose-500 text-white'
                        : tab.key === 'inactive'
                        ? 'bg-zinc-700 text-white'
                        : 'bg-neutral-800 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <button
                onClick={loadProducts}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {/* ========================================================
              SHOP INVENTORY TABLE (All 8 Required Columns)
              1. Product Image
              2. Product Name
              3. SKU
              4. Shop Stock
              5. Stock Warning Level
              6. Stock Status
              7. Shop Inventory Status
              8. Actions
             ======================================================== */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-14 text-center">Image</th>
                    <th className="py-3 px-4 min-w-[200px]">Product Name</th>
                    <th className="py-3 px-4 min-w-[110px]">SKU</th>
                    <th className="py-3 px-4 text-center min-w-[100px]">Shop Stock</th>
                    <th className="py-3 px-4 text-center min-w-[120px]">Stock Warning Level</th>
                    <th className="py-3 px-4 text-center min-w-[110px]">Stock Status</th>
                    <th className="py-3 px-4 text-center min-w-[110px]">Shop Status</th>
                    <th className="py-3 px-4 text-right min-w-[180px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <PackageOpen className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-neutral-500">No products found</p>
                        <p className="text-xs text-neutral-400 mt-1">Try adjusting your search or filter</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const shopStock = product.shopStock ?? 0;
                      const warningThreshold =
                        product.shopLowStockThreshold !== undefined ? product.shopLowStockThreshold : 5;
                      const isShopActive = product.isShopActive !== false;
                      const isRemoved = product.inShopInventory === false;

                      // Stock Status Calculation (derived strictly from Shop Stock & Warning Threshold)
                      let stockStatusLabel = 'Available';
                      let stockBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      let StockIcon = CheckCircle2;

                      if (shopStock <= 0) {
                        stockStatusLabel = 'Out of Stock';
                        stockBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                        StockIcon = XCircle;
                      } else if (shopStock <= warningThreshold) {
                        stockStatusLabel = 'Low Stock';
                        stockBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                        StockIcon = AlertTriangle;
                      }

                      const hasModels =
                        product.enableModelSelection &&
                        Array.isArray(product.models) &&
                        product.models.length > 0;
                      const isExpanded = expandedModels[product.id];
                      const imgUrl = product.images?.[0];

                      return (
                        <React.Fragment key={product.id}>
                          <tr className="hover:bg-neutral-50/60 transition-colors">
                            {/* 1. Product Image */}
                            <td className="py-3 px-4 text-center">
                              <div className="w-11 h-11 rounded-xl bg-neutral-100 border border-neutral-200/80 overflow-hidden mx-auto flex items-center justify-center shrink-0">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Package className="w-4 h-4 text-neutral-400" />
                                )}
                              </div>
                            </td>

                            {/* 2. Product Name */}
                            <td className="py-3 px-4 min-w-[200px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-neutral-900 leading-snug">{product.name}</p>
                                {product.inventoryLocation === 'SHOP' && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                    SHOP
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-400">
                                <span>{product.category || 'General'}</span>
                                {product.brand && (
                                  <>
                                    <span>•</span>
                                    <span>{product.brand}</span>
                                  </>
                                )}
                              </div>
                              {hasModels && (
                                <button
                                  onClick={() =>
                                    setExpandedModels((prev) => ({
                                      ...prev,
                                      [product.id]: !prev[product.id],
                                    }))
                                  }
                                  className="text-[11px] text-violet-600 hover:underline cursor-pointer mt-1 inline-flex items-center gap-1 font-semibold"
                                >
                                  {isExpanded ? '▲ Hide' : '▼ Show'} {product.models!.length} variants
                                </button>
                              )}
                            </td>

                            {/* 3. SKU */}
                            <td className="py-3 px-4 min-w-[110px]">
                              <span className="font-mono text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md">
                                {product.sku || product.id}
                              </span>
                            </td>

                            {/* 4. Shop Stock */}
                            <td className="py-3 px-4 text-center">
                              <span className="text-sm font-black text-neutral-950 block">
                                {shopStock}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-medium">in Shop</span>
                            </td>

                            {/* 5. Stock Warning Level */}
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleOpenWarningModal(product)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-violet-100 text-neutral-700 hover:text-violet-800 text-xs font-bold transition-colors cursor-pointer group"
                                title="Click to change Stock Warning Threshold"
                              >
                                <span>≤ {warningThreshold}</span>
                                <Sliders className="w-3 h-3 text-neutral-400 group-hover:text-violet-600" />
                              </button>
                            </td>

                            {/* 6. Stock Status */}
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${stockBadgeClass}`}
                              >
                                <StockIcon className="w-3 h-3" />
                                <span>{stockStatusLabel}</span>
                              </span>
                            </td>

                            {/* 7. Shop Inventory Status */}
                            <td className="py-3 px-4 text-center">
                              {isRemoved ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-neutral-100 text-neutral-600 border-neutral-200">
                                  <span>Removed</span>
                                </span>
                              ) : isShopActive ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-zinc-100 text-zinc-700 border-zinc-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                  <span>Inactive</span>
                                </span>
                              )}
                            </td>

                            {/* 8. Actions: Activate/Deactivate, Edit Stock Warning, Delete */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {isRemoved ? (
                                  <button
                                    onClick={() => handleRestoreToShop(product)}
                                    className="px-2.5 py-1.5 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                    title="Restore product to Shop Inventory"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Restore</span>
                                  </button>
                                ) : (
                                  <>
                                    {/* Action: Activate / Deactivate */}
                                    <button
                                      onClick={() => handleToggleShopActive(product)}
                                      disabled={togglingActiveId === product.id}
                                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                        isShopActive
                                          ? 'bg-neutral-100 hover:bg-amber-100 text-neutral-700 hover:text-amber-800'
                                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                      }`}
                                      title={
                                        isShopActive
                                          ? 'Deactivate in Shop Inventory'
                                          : 'Activate in Shop Inventory'
                                      }
                                    >
                                      <Power className="w-3.5 h-3.5" />
                                      <span>
                                        {togglingActiveId === product.id
                                          ? '...'
                                          : isShopActive
                                          ? 'Deactivate'
                                          : 'Activate'}
                                      </span>
                                    </button>

                                    {/* Action: Edit Warning */}
                                    <button
                                      onClick={() => handleOpenWarningModal(product)}
                                      className="p-1.5 rounded-lg text-neutral-500 hover:text-violet-700 hover:bg-violet-50 transition-colors cursor-pointer"
                                      title="Edit Stock Warning Level"
                                    >
                                      <Sliders className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Action: Delete from Shop Inventory */}
                                    <button
                                      onClick={() => handleOpenDeleteModal(product)}
                                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Delete from Shop Inventory"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Model Variants Breakdown */}
                          {hasModels &&
                            isExpanded &&
                            product.models!.map((model) => {
                              const mShopStock = (model as any).shopStock ?? 0;
                              let mStatusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                              let mStatusText = 'Available';
                              if (mShopStock <= 0) {
                                mStatusColor = 'bg-rose-50 text-rose-700 border-rose-200';
                                mStatusText = 'Out of Stock';
                              } else if (mShopStock <= warningThreshold) {
                                mStatusColor = 'bg-amber-50 text-amber-700 border-amber-200';
                                mStatusText = 'Low Stock';
                              }

                              return (
                                <tr
                                  key={model.id}
                                  className="bg-violet-50/20 text-xs border-b border-neutral-100"
                                >
                                  <td className="py-2.5 px-4 text-center text-neutral-300">└</td>
                                  <td className="py-2.5 px-4">
                                    <div className="font-semibold text-neutral-800">
                                      {model.name}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-500">
                                    {model.sku || '—'}
                                  </td>
                                  <td className="py-2.5 px-4 text-center font-bold text-neutral-800">
                                    {mShopStock}
                                  </td>
                                  <td className="py-2.5 px-4 text-center text-neutral-400 text-[11px]">
                                    Inherits (≤{warningThreshold})
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${mStatusColor}`}
                                    >
                                      {mStatusText}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-center text-neutral-400 text-[11px]">
                                    {isShopActive ? 'Active' : 'Inactive'}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-[11px] text-neutral-400">
                                    Managed via Parent
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: SHOP BILLS & STOCK TRANSFER HISTORY
         ======================================================== */}
      {activeTab === 'bills' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={billSearchQuery}
                onChange={(e) => setBillSearchQuery(e.target.value)}
                placeholder="Search bills by #, product, or creator..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:outline-none focus:border-violet-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {(['all', 'draft', 'finalized', 'voided'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setBillFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer whitespace-nowrap ${
                    billFilterStatus === s
                      ? s === 'all'
                        ? 'bg-neutral-900 text-white'
                        : s === 'draft'
                        ? 'bg-amber-500 text-white'
                        : s === 'finalized'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {s}
                </button>
              ))}

              <button
                onClick={loadShopBills}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${billsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Shop Bills History Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50 grid grid-cols-12 text-xs font-bold text-neutral-500 uppercase tracking-wider">
              <span className="col-span-3">Bill #</span>
              <span className="col-span-2">Date</span>
              <span className="col-span-2 text-center">Transfer Items</span>
              <span className="col-span-2 text-center">Status</span>
              <span className="col-span-3 text-right">Actions</span>
            </div>

            {filteredBills.length === 0 ? (
              <div className="py-16 text-center">
                <ReceiptText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-neutral-500">No shop bills found</p>
                <p className="text-xs text-neutral-400 mt-1">
                  Create a new Shop Bill to transfer products from Warehouse to Shop.
                </p>
                <button
                  onClick={() => setIsCreateBillOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <ReceiptText className="w-4 h-4" />
                  <span>Create First Shop Bill</span>
                </button>
              </div>
            ) : (
              filteredBills.map((bill) => {
                const StatusIcon = STATUS_ICONS[bill.status] || Clock;
                const totalUnits = bill.items.reduce(
                  (sum, item) => sum + item.transferQuantity,
                  0
                );
                const isFinalizing = finalizingId === bill.id;

                return (
                  <div
                    key={bill.id}
                    className="px-5 py-4 grid grid-cols-12 items-center border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/60 transition-colors"
                  >
                    <div className="col-span-3">
                      <p className="text-xs font-extrabold text-neutral-900">{bill.billNumber}</p>
                      <p className="text-[11px] text-neutral-400">{bill.createdBy}</p>
                    </div>

                    <div className="col-span-2 text-xs text-neutral-600">
                      {new Date(bill.createdAt).toLocaleDateString('en-PK', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>

                    <div className="col-span-2 text-center">
                      <span className="text-xs font-extrabold text-neutral-900 block">
                        {totalUnits} units
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        ({bill.items.length} products)
                      </span>
                    </div>

                    <div className="col-span-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          STATUS_STYLES[bill.status] || ''
                        }`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        <span>{bill.status}</span>
                      </span>
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-1.5">
                      {bill.status === 'draft' && (
                        <button
                          onClick={() => handleFinalizeBill(bill)}
                          disabled={isFinalizing}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                          title="Commit Warehouse -> Shop Stock Transfer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isFinalizing ? 'Finalizing...' : 'Finalize'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => setViewingBill(bill)}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-violet-100 text-neutral-600 hover:text-violet-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                        title="View / Print Shop Bill"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      {bill.status === 'finalized' && (
                        <button
                          onClick={() => {
                            setVoidBillId(bill.id);
                            setVoidReason('');
                          }}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Void bill (reverses stock transfer)"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT STOCK WARNING THRESHOLD
         ======================================================== */}
      {editingWarningProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Stock Warning Settings</h3>
                <p className="text-xs text-neutral-500">Configure low-stock alert threshold for Shop Inventory</p>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-3.5 mb-4 border border-neutral-200/80">
              <p className="text-xs font-bold text-neutral-900">{editingWarningProduct.name}</p>
              <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1 font-mono">
                <span>SKU: {editingWarningProduct.sku || editingWarningProduct.id}</span>
                <span>•</span>
                <span className="font-sans font-bold text-neutral-800">
                  Current Shop Stock: {editingWarningProduct.shopStock ?? 0}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveWarningThreshold}>
              <div className="mb-4">
                <label className="text-xs font-bold text-neutral-800 block mb-1.5">
                  Stock Warning Level (Threshold) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={warningThresholdInput}
                    onChange={(e) => setWarningThresholdInput(e.target.value)}
                    required
                    placeholder="e.g. 3 or 5"
                    className="w-full px-3.5 py-2.5 text-sm font-bold border border-neutral-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white bg-neutral-50"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-400">
                    units
                  </span>
                </div>
                <div className="mt-2.5 p-3 rounded-xl bg-violet-50/60 border border-violet-100 text-[11px] text-violet-900 space-y-1">
                  <p className="font-semibold text-violet-950">Threshold Rules:</p>
                  <p>• Shop Stock &gt; {warningThresholdInput || 0} → <span className="font-bold text-emerald-700">Available</span></p>
                  <p>• Shop Stock ≤ {warningThresholdInput || 0} and &gt; 0 → <span className="font-bold text-amber-700">Low Stock / Warning</span></p>
                  <p>• Shop Stock = 0 → <span className="font-bold text-rose-700">Out of Stock</span></p>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWarningProduct(null)}
                  disabled={warningSaving}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={warningSaving}
                  className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {warningSaving ? 'Saving...' : 'Save Warning Level'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DELETE FROM SHOP INVENTORY
          (Enforces that shopStock must be 0 before removal)
         ======================================================== */}
      {deletingShopProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  (deletingShopProduct.shopStock ?? 0) > 0
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                {(deletingShopProduct.shopStock ?? 0) > 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  {(deletingShopProduct.shopStock ?? 0) > 0
                    ? 'Cannot Remove Product'
                    : 'Remove from Shop Inventory'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {(deletingShopProduct.shopStock ?? 0) > 0
                    ? 'Physical stock must be zero before removal'
                    : 'Shop Inventory-specific record removal'}
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-3.5 mb-4 border border-neutral-200/80">
              <p className="text-xs font-bold text-neutral-900">{deletingShopProduct.name}</p>
              <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1 font-mono">
                <span>SKU: {deletingShopProduct.sku || deletingShopProduct.id}</span>
                <span>•</span>
                <span className="font-sans font-bold text-neutral-800">
                  Shop Stock: {deletingShopProduct.shopStock ?? 0}
                </span>
                <span>•</span>
                <span className="font-sans text-neutral-600">
                  Warehouse Stock: {deletingShopProduct.stock}
                </span>
              </div>
            </div>

            {/* CASE 1: SHOP STOCK > 0 (STRICT SAFETY GUARD) */}
            {(deletingShopProduct.shopStock ?? 0) > 0 ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        Cannot remove this product while Shop Stock is{' '}
                        {deletingShopProduct.shopStock}. Please transfer/sell/adjust the shop
                        stock first.
                      </p>
                      <p className="text-rose-700 text-[11px] mt-1 leading-relaxed">
                        Physical units are present in the retail shop. To avoid unrecorded stock
                        discrepancies, shop stock must be 0 before removing from Shop Inventory.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingShopProduct(null)}
                    className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Understood / Close
                  </button>
                </div>
              </div>
            ) : (
              /* CASE 2: SHOP STOCK === 0 (SAFE TO REMOVE FROM SHOP INVENTORY) */
              <div className="space-y-4">
                <div className="space-y-2 text-xs text-neutral-600">
                  <p className="font-bold text-neutral-900">
                    Are you sure you want to remove this product from Shop Inventory?
                  </p>
                  <p className="leading-relaxed text-neutral-600">
                    This will remove the product from Shop Inventory. The main product and
                    Warehouse Inventory will not be deleted.
                  </p>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800">
                    <strong>Safe Deletion Guarantee:</strong> Main catalog product, Warehouse
                    stock ({deletingShopProduct.stock} units), images, categories, and past
                    orders will remain completely intact.
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingShopProduct(null)}
                    disabled={deleteLoading}
                    className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteFromShop}
                    disabled={deleteLoading}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {deleteLoading ? 'Removing...' : 'Remove from Shop Inventory'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Shop Bill Modal (Warehouse -> Shop Transfer) */}
      {isCreateBillOpen && (
        <CreateShopBillModal
          isOpen={isCreateBillOpen}
          onClose={() => setIsCreateBillOpen(false)}
          products={products}
          onSuccess={(billNum) => {
            showToast(`Shop Bill ${billNum} created successfully!`, 'success');
            loadShopBills();
            loadProducts();
            setActiveTab('bills');
          }}
        />
      )}

      {/* View / Print Official Shop Bill Modal */}
      {viewingBill && (
        <ShopBillModal
          isOpen={Boolean(viewingBill)}
          bill={viewingBill}
          onClose={() => setViewingBill(null)}
          onFinalize={handleFinalizeBill}
          isFinalizing={finalizingId === viewingBill.id}
        />
      )}

      {/* Void Reason Confirmation Modal */}
      {voidBillId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-neutral-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Void Shop Bill</h3>
                <p className="text-xs text-neutral-500">
                  This reverses the transfer: stock will be deducted from Shop and returned to Warehouse.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-neutral-700 block mb-1">
                Reason for Voiding <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Products were not physically transferred or order canceled"
                rows={3}
                className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setVoidBillId(null);
                  setVoidReason('');
                }}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVoidBill}
                disabled={!voidReason.trim() || voidLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {voidLoading ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
