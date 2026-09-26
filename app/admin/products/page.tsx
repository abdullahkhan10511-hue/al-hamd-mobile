'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowUpDown,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getProducts, deleteProduct, createProduct } from '@/lib/db/products';
import { getCategories } from '@/lib/db/categories';
import { getBrands } from '@/lib/db/brands';
import { subscribeToKey } from '@/lib/db/storage';
import { formatPrice } from '@/lib/utils';
import { Product } from '@/types';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function AdminProductsPage() {
  const { admin, isManager } = useAdminAuth();
  const [products, setProducts] = useState(getProducts());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStockStatus, setSelectedStockStatus] = useState('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const categories = getCategories();
  const brands = getBrands();

  useEffect(() => {
    const unsub = subscribeToKey('products', (data: any) => setProducts(data));
    return () => unsub();
  }, []);

  const filteredProducts = products.filter((p) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (selectedCategory !== 'all' && p.categorySlug !== selectedCategory) {
      return false;
    }

    if (selectedStockStatus === 'low' && (p.stock <= 0 || p.stock > (p.lowStockThreshold || 5))) {
      return false;
    }
    if (selectedStockStatus === 'out' && p.stock > 0) {
      return false;
    }
    if (selectedStockStatus === 'in' && p.stock <= 0) {
      return false;
    }

    return true;
  });

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await deleteProduct(id, admin?.email);
      setDeleteConfirmId(null);
      setIsDeleting(false);
      if (res.success) {
        setProducts(getProducts());
        showToast(res.message || 'Product deleted successfully.', 'success');
      } else {
        showToast(res.message || res.error || 'Failed to delete product.', 'error');
      }
    } catch (err: any) {
      setIsDeleting(false);
      showToast('An error occurred while deleting product.', 'error');
    }
  };

  const handleDuplicate = async (p: any) => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    await createProduct({
      ...p,
      name: `${p.name} (Copy)`,
      slug: `${p.slug}-copy-${randomSuffix}`,
      sku: `${p.sku}-CP${randomSuffix}`,
    });
    setProducts(getProducts());
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Inventory & Catalog
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight mt-1">
            Products ({products.length})
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Manage SKU allocations, pricing, stock levels, images, and homepage badges.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU, brand..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 focus:outline-none focus:border-neutral-950"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="p-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStockStatus}
            onChange={(e) => setSelectedStockStatus(e.target.value)}
            className="p-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock Warning</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/80 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-100">
              <tr>
                <th className="p-4 pl-6">Product</th>
                <th className="p-4">SKU</th>
                <th className="p-4">Category</th>
                <th className="p-4">Brand</th>
                <th className="p-4">Price</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Badges</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400">
                    No products matched your search filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/80 shrink-0 flex items-center justify-center">
                          {p.images && p.images[0] ? (
                            <img src={p.images[0]} alt={p.name || 'Product'} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-neutral-300" />
                          )}
                        </div>
                        <div>
                          <Link href={`/admin/products/${p.id}`} className="font-bold text-neutral-900 text-sm hover:underline block">
                            {p.name || 'Untitled Product'}
                          </Link>
                          <span className="text-[10px] text-neutral-400 font-mono">/{p.slug}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 font-mono font-bold text-neutral-700">{p.sku || '—'}</td>

                    <td className="p-4 text-neutral-600">{p.category || '—'}</td>

                    <td className="p-4 text-neutral-600">{p.brand || '—'}</td>

                    <td className="p-4">
                      <span className="font-mono font-bold text-neutral-950 block">{formatPrice(p.price)}</span>
                      {p.compareAtPrice && (
                        <span className="text-[10px] text-neutral-400 line-through font-mono">
                          {formatPrice(p.compareAtPrice)}
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      {p.stock <= 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> Out of stock
                        </span>
                      ) : p.stock <= (p.lowStockThreshold || 5) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> {p.stock} left (Low)
                        </span>
                      ) : (
                        <span className="font-mono font-semibold text-neutral-900">{p.stock} units</span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {p.status === 'inactive' && (
                          <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-700 text-[10px] font-bold uppercase">
                            Inactive
                          </span>
                        )}
                        {p.isNew && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                            New
                          </span>
                        )}
                        {p.isBestSeller && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                            Best
                          </span>
                        )}
                        {p.trending && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
                            Trend
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 pr-6 text-right space-x-1.5">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 inline-block text-neutral-600 hover:text-neutral-950"
                        title="Edit Product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>

                      <button
                        onClick={() => handleDuplicate(p)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600 hover:text-neutral-950 cursor-pointer"
                        title="Duplicate Product"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {!isManager && (
                        <button
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 cursor-pointer"
                          title="Delete Product (Admin Only)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium ${
              toastMessage.type === 'success'
                ? 'bg-neutral-950 text-white border-neutral-800'
                : toastMessage.type === 'info'
                ? 'bg-amber-950 text-amber-200 border-amber-800'
                : 'bg-rose-900 text-white border-rose-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'info' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-300 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (() => {
          const productToDelete = products.find((p) => p.id === deleteConfirmId);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => !isDeleting && setDeleteConfirmId(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="relative z-10 bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 shadow-2xl border border-neutral-200 text-center space-y-4"
              >
                <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center shadow-inner">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-neutral-950">
                    Delete this product permanently?
                  </h3>
                  <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200 text-xs font-semibold text-neutral-900">
                    {productToDelete?.name || 'Selected Product'}
                    {productToDelete?.sku && (
                      <span className="block text-[11px] font-mono text-neutral-500 font-normal">
                        SKU: {productToDelete.sku}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    This will remove the product from the catalog. Existing customer orders and invoices will be preserved.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-5 py-2.5 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleDelete(deleteConfirmId)}
                    className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Delete Permanently</span>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
