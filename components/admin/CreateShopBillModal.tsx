'use client';

import React, { useState, useMemo } from 'react';
import { Product } from '@/types';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getAdminAuthHeaders } from '@/lib/db/staff';
import { syncProductsFromApi } from '@/lib/db/products';
import {
  ArrowRightLeft,
  Warehouse,
  Store,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Package,
  ArrowRight,
} from 'lucide-react';

interface DraftItem {
  productId: string;
  productName: string;
  image?: string;
  sku?: string;
  modelId?: string;
  modelName?: string;
  transferQuantity: number;
  warehouseStock: number;
  shopStock: number;
}

interface CreateShopBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSuccess: (billNumber: string) => void;
}

export function CreateShopBillModal({
  isOpen,
  onClose,
  products,
  onSuccess,
}: CreateShopBillModalProps) {
  const { admin } = useAdminAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Requirement: Only Warehouse-origin products with available Warehouse Stock (> 0) should be selectable for transfer
  const availableWarehouseProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      // Must NOT be a Shop-only product
      if (p.inventoryLocation === 'SHOP') return false;

      // Must have warehouse stock > 0 at product level or model level
      const hasProductWarehouseStock = (p.stock || 0) > 0;
      const hasModelWarehouseStock =
        p.enableModelSelection &&
        Array.isArray(p.models) &&
        p.models.some((m) => (m.stock || 0) > 0);

      if (!hasProductWarehouseStock && !hasModelWarehouseStock) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery]);

  if (!isOpen) return null;

  const handleAddProduct = (product: Product, model?: any) => {
    const key = model ? `${product.id}__${model.id}` : product.id;
    const exists = draftItems.some((item) => {
      const itemKey = item.modelId ? `${item.productId}__${item.modelId}` : item.productId;
      return itemKey === key;
    });

    if (exists) {
      setError(`"${product.name}${model ? ` (${model.name})` : ''}" is already in the bill.`);
      return;
    }

    const whStock = model ? (model.stock ?? 0) : (product.stock ?? 0);
    if (whStock <= 0) {
      setError(`No warehouse stock available for "${product.name}".`);
      return;
    }

    const newItem: DraftItem = {
      productId: product.id,
      productName: product.name,
      image: product.images?.[0],
      sku: model?.sku || product.sku,
      modelId: model?.id,
      modelName: model?.name,
      transferQuantity: 1,
      warehouseStock: whStock,
      shopStock: model ? ((model as any).shopStock ?? 0) : (product.shopStock ?? 0),
    };

    setDraftItems((prev) => [...prev, newItem]);
    setError(null);
  };

  const handleUpdateQty = (index: number, val: number) => {
    setDraftItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        // Clamp transfer quantity between 1 and available warehouse stock
        const validQty = Math.max(1, Math.min(item.warehouseStock, Math.round(val)));
        return { ...item, transferQuantity: validQty };
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (finalizeImmediately: boolean = false) => {
    if (draftItems.length === 0) {
      setError('Add at least one product to the Shop Bill.');
      return;
    }

    // Validate quantities
    for (const item of draftItems) {
      if (item.transferQuantity <= 0) {
        setError(`Invalid transfer quantity for "${item.productName}".`);
        return;
      }
      if (item.transferQuantity > item.warehouseStock) {
        setError(
          `Transfer quantity (${item.transferQuantity}) exceeds available warehouse stock (${item.warehouseStock}) for "${item.productName}".`
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create the bill
      const res = await fetch('/api/admin/shop-bills', {
        method: 'POST',
        headers: getAdminAuthHeaders(admin?.email),
        body: JSON.stringify({
          items: draftItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            modelId: item.modelId,
            modelName: item.modelName,
            transferQuantity: item.transferQuantity,
          })),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to create shop bill.');
        setSubmitting(false);
        return;
      }

      const createdBill = data.shopBill;

      // 2. If finalizeImmediately requested, finalize it in database
      if (finalizeImmediately) {
        const finalizeRes = await fetch(`/api/admin/shop-bills/${createdBill.id}`, {
          method: 'PATCH',
          headers: getAdminAuthHeaders(admin?.email),
          body: JSON.stringify({ action: 'finalize' }),
        });

        const finalizeData = await finalizeRes.json();
        if (!finalizeData.success) {
          setError(
            `Bill ${createdBill.billNumber} created as draft, but finalization failed: ${finalizeData.error}`
          );
          setSubmitting(false);
          return;
        }

        await syncProductsFromApi().catch(() => {});
      }

      onSuccess(createdBill.billNumber);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalTransferUnits = draftItems.reduce((sum, item) => sum + item.transferQuantity, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-neutral-200 overflow-hidden my-6">
        {/* Bill Title Banner (Always Displays # SHOP BILL) */}
        <div className="px-6 py-5 bg-gradient-to-r from-violet-900 to-neutral-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-violet-300">
                Stock Transfer Order
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-0.5">
              # SHOP BILL
            </h1>
            <p className="text-xs text-neutral-300 mt-0.5 flex items-center gap-2">
              <span>Source: <strong>Warehouse</strong></span>
              <ArrowRight className="w-3.5 h-3.5 text-violet-400" />
              <span>Destination: <strong>Shop Counter</strong></span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Transfer Flow Header Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-neutral-200 flex items-center justify-center text-neutral-700 shrink-0">
                <Warehouse className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Source</span>
                <span className="font-bold text-neutral-800">Warehouse Inventory</span>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 font-bold text-[11px] flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Controlled Stock Transfer</span>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-start sm:justify-end">
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Destination</span>
                <span className="font-bold text-violet-700">Shop Inventory</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Product Selector (Warehouse Available Only) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                  Select Warehouse Products
                </label>
                <span className="text-[11px] text-neutral-400 font-medium">
                  {availableWarehouseProducts.length} available
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products in warehouse..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:outline-none focus:border-violet-500 focus:bg-white"
                />
              </div>

              {/* Product List */}
              <div className="border border-neutral-200 rounded-2xl divide-y divide-neutral-100 max-h-72 overflow-y-auto">
                {availableWarehouseProducts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400 px-4">
                    No products with available warehouse stock match your search.
                  </div>
                ) : (
                  availableWarehouseProducts.map((p) => {
                    const hasModels =
                      p.enableModelSelection &&
                      Array.isArray(p.models) &&
                      p.models.length > 0;
                    const imgUrl = p.images?.[0];

                    return (
                      <div key={p.id} className="p-3 hover:bg-neutral-50/80 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200/80 overflow-hidden shrink-0 flex items-center justify-center">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-4 h-4 text-neutral-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-neutral-900 truncate">{p.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-500">
                              <span className="font-semibold text-neutral-700">
                                WH: {p.stock}
                              </span>
                              <span>•</span>
                              <span className="text-violet-600 font-semibold">
                                Shop: {p.shopStock ?? 0}
                              </span>
                            </div>
                          </div>

                          {!hasModels ? (
                            <button
                              type="button"
                              onClick={() => handleAddProduct(p)}
                              disabled={p.stock <= 0}
                              className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                            >
                              Add
                            </button>
                          ) : null}
                        </div>

                        {/* Model options if applicable */}
                        {hasModels && (
                          <div className="mt-2 pl-12 space-y-1.5 border-t border-neutral-100 pt-2">
                            {p.models!.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between text-xs py-1"
                              >
                                <span className="font-medium text-neutral-700 truncate">
                                  {m.name} {m.sku ? `(${m.sku})` : ''}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] text-neutral-500">
                                    WH: {m.stock}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddProduct(p, m)}
                                    disabled={(m.stock ?? 0) <= 0}
                                    className="px-2 py-0.5 rounded bg-violet-100 hover:bg-violet-200 text-violet-700 text-[11px] font-bold cursor-pointer disabled:opacity-40"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Bill Items Table */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                  Bill Line Items ({draftItems.length})
                </label>
                <span className="text-xs font-bold text-violet-700">
                  Total Transfer: {totalTransferUnits} units
                </span>
              </div>

              {draftItems.length === 0 ? (
                <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-8 text-center text-neutral-400">
                  <Package className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                  <p className="text-xs font-bold text-neutral-600">No products added to this bill yet</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Select items from the warehouse list on the left to create the transfer bill.
                  </p>
                </div>
              ) : (
                <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Product</th>
                        <th className="py-2.5 px-2 text-center">WH Avail</th>
                        <th className="py-2.5 px-2 text-center">Transfer Qty</th>
                        <th className="py-2.5 px-2 text-center">New WH / Shop</th>
                        <th className="py-2.5 px-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {draftItems.map((item, idx) => {
                        const newWh = item.warehouseStock - item.transferQuantity;
                        const newShop = item.shopStock + item.transferQuantity;

                        return (
                          <tr key={idx} className="hover:bg-neutral-50/50">
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-neutral-900 truncate max-w-[160px]">
                                {item.productName}
                              </p>
                              {item.modelName && (
                                <p className="text-[10px] text-violet-600 font-medium">
                                  {item.modelName}
                                </p>
                              )}
                              {item.sku && (
                                <p className="text-[10px] text-neutral-400">SKU: {item.sku}</p>
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-center font-bold text-neutral-700">
                              {item.warehouseStock}
                            </td>

                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="1"
                                max={item.warehouseStock}
                                value={item.transferQuantity}
                                onChange={(e) =>
                                  handleUpdateQty(idx, parseInt(e.target.value, 10) || 1)
                                }
                                className="w-16 px-2 py-1 rounded-lg border border-neutral-300 text-center font-bold text-neutral-900 focus:outline-none focus:border-violet-500"
                              />
                            </td>

                            <td className="py-2.5 px-2 text-center text-[11px]">
                              <span className="text-rose-600 font-semibold">{newWh}</span>
                              <span className="text-neutral-400 mx-1">/</span>
                              <span className="text-emerald-700 font-bold">{newShop}</span>
                            </td>

                            <td className="py-2.5 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 rounded-md text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Bill Notes / Dispatch Remarks
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Regular morning retail shelf restock"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-neutral-500">
            <strong>{draftItems.length}</strong> product(s), <strong>{totalTransferUnits}</strong> total units.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting || draftItems.length === 0}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
            >
              Save Draft Bill
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting || draftItems.length === 0}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-md shadow-violet-200 flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finalize &amp; Transfer Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
