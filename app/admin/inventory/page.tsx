'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { InventoryLog } from '@/types/admin';
import {
  getProducts,
  setProductStock,
  setProductLowStockThreshold,
  getWarningThreshold,
  setModelStock,
} from '@/lib/db/products';
import { getInventoryLogs } from '@/lib/db/inventory';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { NumericKeypadModal } from '@/components/admin/NumericKeypadModal';
import {
  Boxes,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  History,
  TrendingDown,
  RefreshCw,
  Save,
  Check,
  Edit2,
  Hash,
} from 'lucide-react';

export default function AdminInventoryPage() {
  const { admin } = useAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');

  // Interactive Quick Adjust State
  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  // Keypad Modal State
  const [keypadProduct, setKeypadProduct] = useState<Product | null>(null);
  const [keypadMode, setKeypadMode] = useState<'stock' | 'warning'>('stock');
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Model Variant Expansion State
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const openKeypad = (product: Product, mode: 'stock' | 'warning') => {
    setKeypadProduct(product);
    setKeypadMode(mode);
    setIsKeypadOpen(true);
  };

  const loadData = () => {
    setProducts(getProducts());
    setLogs(getInventoryLogs());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const totalSKUs = products.length;
  const outOfStockItems = products.filter((p) => p.stock <= 0);
  const lowStockItems = products.filter((p) => p.stock > 0 && p.stock <= getWarningThreshold(p));
  const inStockItems = products.filter((p) => p.stock > getWarningThreshold(p));

  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      !searchQuery.trim() ||
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesQuery) return false;

    if (filterStatus === 'low') {
      return p.stock > 0 && p.stock <= getWarningThreshold(p);
    }
    if (filterStatus === 'out') {
      return p.stock <= 0;
    }
    return true;
  });

  // Quick Delta Adjustment (+1 or -1) with immediate persistence & double-click protection
  const handleQuickDelta = async (product: Product, delta: number) => {
    if (savingId !== null) return; // Prevent concurrent / double clicks
    const productId = product.id;
    const currentStock = product.stock;
    const nextStock = Math.max(0, currentStock + delta);
    if (nextStock === currentStock && delta < 0) return; // Already at 0

    setSavingId(productId);
    setErrorId(null);
    setSuccessId(null);

    try {
      const ok = await setProductStock(
        productId,
        nextStock,
        `Quick adjust ${delta > 0 ? '+' : ''}${delta} control`,
        admin?.email || 'admin@alhamd.com'
      );

      setSavingId(null);
      if (ok) {
        setSuccessId(productId);
        showToast(`Stock updated to ${nextStock} units.`, 'success');
        loadData();
        setTimeout(() => {
          setSuccessId((curr) => (curr === productId ? null : curr));
        }, 2000);
      } else {
        setErrorId(productId);
        showToast('Failed to update stock.', 'error');
        setTimeout(() => {
          setErrorId((curr) => (curr === productId ? null : curr));
        }, 3000);
      }
    } catch {
      setSavingId(null);
      setErrorId(productId);
      showToast('Error updating stock.', 'error');
      setTimeout(() => {
        setErrorId((curr) => (curr === productId ? null : curr));
      }, 3000);
    }
  };

  const handleModelQuickDelta = async (product: Product, model: any, delta: number) => {
    const key = `${product.id}-${model.name}`;
    if (savingId !== null) return;
    const currentStock = model.stock ?? 0;
    const nextStock = Math.max(0, currentStock + delta);
    if (nextStock === currentStock && delta < 0) return;

    setSavingId(key);
    setErrorId(null);
    setSuccessId(null);

    try {
      const ok = await setModelStock(
        product.id,
        model.id || model.name,
        nextStock,
        `Quick adjust ${delta > 0 ? '+' : ''}${delta} control for ${model.name}`,
        admin?.email || 'admin@alhamd.com'
      );
      setSavingId(null);
      if (ok) {
        setSuccessId(key);
        showToast(`"${model.name}" stock updated to ${nextStock} units.`, 'success');
        loadData();
        setTimeout(() => setSuccessId(null), 2000);
      } else {
        setErrorId(key);
        showToast('Failed to update model stock.', 'error');
        setTimeout(() => setErrorId(null), 3000);
      }
    } catch {
      setSavingId(null);
      setErrorId(key);
      showToast('Error updating model stock.', 'error');
      setTimeout(() => setErrorId(null), 3000);
    }
  };

  const handleKeypadSave = async (newValue: number): Promise<boolean> => {
    if (!keypadProduct) return false;
    const productId = keypadProduct.id;
    setSavingId(productId);

    try {
      if (keypadMode === 'stock') {
        const ok = await setProductStock(
          productId,
          newValue,
          'Direct manual keypad adjustment',
          admin?.email || 'admin@alhamd.com'
        );
        setSavingId(null);
        if (ok) {
          showToast(`Stock updated to ${newValue} units.`, 'success');
          loadData();
          return true;
        }
      } else {
        const ok = await setProductLowStockThreshold(
          productId,
          newValue,
          admin?.email || 'admin@alhamd.com'
        );
        setSavingId(null);
        if (ok) {
          showToast(`Stock warning threshold set to ${newValue} units.`, 'success');
          loadData();
          return true;
        }
      }
      setSavingId(null);
      return false;
    } catch {
      setSavingId(null);
      showToast('Error saving value.', 'error');
      return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Inventory &amp; Stock</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Real-time stock level monitoring, instant inline adjustments, and immutable audit logs
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-neutral-200/80 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'stock'
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Stock Levels
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Adjustment Logs ({logs.length})
          </button>
        </div>
      </div>

      {activeTab === 'stock' ? (
        <>
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-xs font-semibold text-neutral-500 block">Total Catalog Items</span>
              <p className="text-2xl font-extrabold text-neutral-950 mt-1">{totalSKUs}</p>
            </div>
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-xs font-semibold text-emerald-700 block">Healthy Stock</span>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">{inStockItems.length}</p>
            </div>
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-xs font-semibold text-amber-700 block">Stock Warning (Low)</span>
              <p className="text-2xl font-extrabold text-amber-600 mt-1">{lowStockItems.length}</p>
            </div>
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-xs font-semibold text-rose-700 block">Out of Stock (0)</span>
              <p className="text-2xl font-extrabold text-rose-600 mt-1">{outOfStockItems.length}</p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name, SKU..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:outline-none focus:border-neutral-900"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                All ({products.length})
              </button>
              <button
                onClick={() => setFilterStatus('low')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  filterStatus === 'low'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Stock Warning ({lowStockItems.length})
              </button>
              <button
                onClick={() => setFilterStatus('out')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  filterStatus === 'out'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Out of Stock ({outOfStockItems.length})
              </button>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Product &amp; SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Available Stock</th>
                    <th className="py-3 px-4 text-center">Stock Warning</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Quick Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-400">
                        No products match your inventory criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const warningThresh = getWarningThreshold(p);
                      const isSavingThis = savingId === p.id;
                      const isSuccessThis = successId === p.id;
                      const isErrorThis = errorId === p.id;

                      const isLow = p.stock > 0 && p.stock <= warningThresh;
                      const isOut = p.stock <= 0;

                      return (
                        <React.Fragment key={p.id}>
                          <tr className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden relative shrink-0">
                                <img
                                  src={p.images?.[0] || 'https://via.placeholder.com/100'}
                                  alt={p.name || 'Product'}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <Link
                                  href={`/admin/products/${p.id}`}
                                  className="font-bold text-neutral-900 hover:underline"
                                >
                                  {p.name || 'Untitled Product'}
                                </Link>
                                <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                                  SKU: <span className="text-neutral-700 font-semibold">{p.sku || '—'}</span>
                                </div>
                                {p.enableModelSelection && Array.isArray(p.models) && p.models.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedModels((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-semibold transition-colors cursor-pointer"
                                  >
                                    <span>{p.models.length} Model Variants</span>
                                    <span>{expandedModels[p.id] ? '▲' : '▼'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-neutral-600 capitalize">{p.category || '—'}</td>

                          {/* Available Stock: Click to Open Keypad */}
                          <td className="py-3.5 px-4 text-center font-bold font-mono text-sm">
                            <button
                              type="button"
                              onClick={() => openKeypad(p, 'stock')}
                              title="Click to enter exact stock quantity directly"
                              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition-all cursor-pointer font-bold font-mono text-sm border border-transparent hover:border-neutral-200"
                            >
                              <span
                                className={
                                  isOut
                                    ? 'text-rose-600'
                                    : isLow
                                    ? 'text-amber-600'
                                    : 'text-neutral-900'
                                }
                              >
                                {p.stock} units
                              </span>
                              <Edit2 className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>

                          {/* Stock Warning: Click to Open Keypad */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => openKeypad(p, 'warning')}
                              title="Click to change stock warning threshold"
                              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition-all cursor-pointer font-semibold font-mono text-xs text-neutral-700 border border-transparent hover:border-neutral-200"
                            >
                              <span>{warningThresh} units</span>
                              <Edit2 className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>

                          <td className="py-3.5 px-4">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3" />
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3" />
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Available
                              </span>
                            )}
                          </td>

                          {/* Interactive + / - Controls with Instant Persistence & Keypad Direct Input */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className="inline-flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-xl p-1 shadow-2xs">
                                {/* Minus Button */}
                                <button
                                  type="button"
                                  onClick={() => handleQuickDelta(p, -1)}
                                  disabled={p.stock <= 0 || isSavingThis}
                                  title="Decrease stock by 1"
                                  aria-label="Decrease stock"
                                  className="w-7 h-7 rounded-lg bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-100 flex items-center justify-center font-bold transition-transform active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                                >
                                  <Minus className="w-3 h-3 stroke-[2.5]" />
                                </button>

                                {/* Current Stock Display / Click to open keypad */}
                                <button
                                  type="button"
                                  onClick={() => openKeypad(p, 'stock')}
                                  title="Click to enter exact stock number directly"
                                  className="min-w-8 px-1.5 py-0.5 text-center font-mono font-bold text-xs text-neutral-900 hover:bg-neutral-200/60 rounded-md transition-colors cursor-pointer select-none"
                                >
                                  {p.stock}
                                </button>

                                {/* Plus Button */}
                                <button
                                  type="button"
                                  onClick={() => handleQuickDelta(p, 1)}
                                  disabled={isSavingThis}
                                  title="Increase stock by 1"
                                  aria-label="Increase stock"
                                  className="w-7 h-7 rounded-lg bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-100 flex items-center justify-center font-bold transition-transform active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                                >
                                  <Plus className="w-3 h-3 stroke-[2.5]" />
                                </button>
                              </div>

                              {/* Feedback Messages */}
                              {isSavingThis && (
                                <div className="text-[10px] font-bold text-neutral-500 flex items-center gap-1 pr-1">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Saving...</span>
                                </div>
                              )}
                              {isSuccessThis && (
                                <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 animate-in fade-in duration-200 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Saved</span>
                                </div>
                              )}
                              {isErrorThis && (
                                <div className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 animate-in fade-in duration-200">
                                  Failed
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Expandable Model Rows */}
                        {p.enableModelSelection &&
                          Array.isArray(p.models) &&
                          expandedModels[p.id] &&
                          p.models.map((m) => {
                            const modelKey = `${p.id}-${m.name}`;
                            const isSavingModel = savingId === modelKey;
                            const isSuccessModel = successId === modelKey;
                            const isErrorModel = errorId === modelKey;
                            const mStock = m.stock ?? 0;
                            const mOut = mStock <= 0;
                            const mLow = mStock > 0 && mStock <= warningThresh;

                            return (
                              <tr key={modelKey} className="bg-neutral-50/60 border-t border-neutral-100/60">
                                <td className="py-2.5 px-4 pl-12">
                                  <div className="flex items-center gap-2">
                                    <span className="text-neutral-400 font-mono text-[10px]">↳</span>
                                    <div>
                                      <span className="font-bold text-neutral-800">{m.name}</span>
                                      <span className="text-[10px] font-mono text-neutral-400 ml-2">
                                        SKU: {m.sku || '—'} • Rs. {Number(m.price).toLocaleString('en-PK')}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 text-neutral-400 text-[11px]">Variant</td>
                                <td className="py-2.5 px-4 text-center font-bold font-mono text-xs">
                                  <span className={mOut ? 'text-rose-600' : mLow ? 'text-amber-600' : 'text-neutral-800'}>
                                    {mStock} units
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-center text-[10px] text-neutral-400">
                                  —
                                </td>
                                <td className="py-2.5 px-4">
                                  {mOut ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                      Out of Stock
                                    </span>
                                  ) : mLow ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                      Low Stock
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Available
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="inline-flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-0.5 shadow-2xs">
                                      <button
                                        type="button"
                                        onClick={() => handleModelQuickDelta(p, m, -1)}
                                        disabled={mStock <= 0 || isSavingModel}
                                        title={`Decrease ${m.name} stock by 1`}
                                        className="w-6 h-6 rounded bg-neutral-50 hover:bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-xs cursor-pointer disabled:opacity-30"
                                      >
                                        <Minus className="w-2.5 h-2.5" />
                                      </button>
                                      <span className="min-w-6 px-1 text-center font-mono font-bold text-[11px] text-neutral-800">
                                        {mStock}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleModelQuickDelta(p, m, 1)}
                                        disabled={isSavingModel}
                                        title={`Increase ${m.name} stock by 1`}
                                        className="w-6 h-6 rounded bg-neutral-50 hover:bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-xs cursor-pointer disabled:opacity-30"
                                      >
                                        <Plus className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                    {isSavingModel && (
                                      <span className="text-[9px] text-neutral-400 flex items-center gap-1">
                                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Saving...
                                      </span>
                                    )}
                                    {isSuccessModel && (
                                      <span className="text-[9px] text-emerald-600 font-semibold">Saved</span>
                                    )}
                                    {isErrorModel && (
                                      <span className="text-[9px] text-rose-600 font-semibold">Failed</span>
                                    )}
                                  </div>
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
        </>
      ) : (
        /* Adjustment History Tab */
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Product &amp; SKU</th>
                  <th className="py-3 px-4 text-center">Change</th>
                  <th className="py-3 px-4 text-center">New Balance</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      No stock adjustment history logged yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4 font-mono text-neutral-600">
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-neutral-900 block">{log.productName}</span>
                        <span className="font-mono text-[10px] text-neutral-400">SKU: {log.sku || 'N/A'}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span
                          className={
                            log.changeAmount > 0
                              ? 'text-emerald-600'
                              : log.changeAmount < 0
                              ? 'text-rose-600'
                              : 'text-neutral-500'
                          }
                        >
                          {log.changeAmount > 0 ? `+${log.changeAmount}` : log.changeAmount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-neutral-900">
                        {log.newStock}
                      </td>
                      <td className="py-3 px-4 text-neutral-700">{log.reason}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-500">
                        {log.adminEmail}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Keypad Modal */}
      <NumericKeypadModal
        isOpen={isKeypadOpen}
        onClose={() => setIsKeypadOpen(false)}
        product={keypadProduct}
        mode={keypadMode}
        currentValue={
          keypadProduct
            ? keypadMode === 'stock'
              ? keypadProduct.stock
              : getWarningThreshold(keypadProduct)
            : 0
        }
        onSave={handleKeypadSave}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-neutral-950 text-white border-neutral-800'
              : 'bg-rose-600 text-white border-rose-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 text-white" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
