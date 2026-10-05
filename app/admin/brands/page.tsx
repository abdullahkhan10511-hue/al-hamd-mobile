'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Search,
  ImageIcon,
  ExternalLink,
  Upload,
  Loader2,
  ArrowUp,
  ArrowDown,
  Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  syncBrandsFromApi,
  reorderBrands,
} from '@/lib/db/brands';
import { subscribeToKey } from '@/lib/db/storage';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Brand } from '@/types/admin';
import Link from 'next/link';

export default function AdminBrandsPage() {
  const { admin } = useAdminAuth();
  const userEmail = admin?.email || 'admin@alhamd.com';

  const [brands, setBrands] = useState<Brand[]>(getBrands());
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState<Brand | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logo, setLogo] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [error, setError] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/brands/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Failed to upload brand logo.');
      }

      setLogo(data.url);
    } catch (err: any) {
      console.error('Brand logo upload error:', err);
      setError(err?.message || 'Failed to upload brand logo.');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadData = async () => {
    const fresh = await syncBrandsFromApi().catch(() => getBrands());
    if (fresh && fresh.length > 0) {
      setBrands(fresh);
    } else {
      setBrands(getBrands());
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToKey('brands', (data: Brand[]) => {
      if (Array.isArray(data)) setBrands(data);
    });
    return () => unsub();
  }, []);

  const openCreateModal = () => {
    setName('');
    setSlug('');
    setLogo('');
    setDescription('');
    setStatus('active');
    setIsFeatured(false);
    setSortOrder(brands.length + 1);
    setError('');
    setIsCreating(true);
    setIsEditing(null);
  };

  const openEditModal = (b: Brand) => {
    setName(b.name);
    setSlug(b.slug);
    setLogo(b.logo || '');
    setDescription(b.description || '');
    setStatus(b.status);
    setIsFeatured(!!b.isFeatured);
    setSortOrder(b.sortOrder ?? 0);
    setError('');
    setIsEditing(b);
    setIsCreating(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    try {
      if (isCreating) {
        const res = await createBrand({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          logo: logo.trim() || undefined,
          description: description.trim() || undefined,
          status,
          isFeatured,
          sortOrder: Number(sortOrder) || brands.length + 1,
        });
        if (!res.success) {
          setError(res.error || 'Failed to create brand.');
          setIsSaving(false);
          return;
        }
        setIsCreating(false);
        triggerToast(`Brand "${name.trim()}" created successfully`);
      } else if (isEditing) {
        const res = await updateBrand(isEditing.id, {
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          logo: logo.trim() || undefined,
          description: description.trim() || undefined,
          status,
          isFeatured,
          sortOrder: Number(sortOrder) || 0,
        });
        if (!res.success) {
          setError(res.error || 'Failed to update brand.');
          setIsSaving(false);
          return;
        }
        setIsEditing(null);
        triggerToast(`Brand "${name.trim()}" updated successfully`);
      }

      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBrand(id);
    setDeleteConfirmId(null);
    triggerToast('Brand removed successfully');
    await loadData();
  };

  const moveBrand = async (index: number, direction: 'up' | 'down') => {
    if (searchQuery.trim()) return; // Reordering disabled during search
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= brands.length) return;

    setIsReordering(true);
    const copy = [...brands];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    // Optimistically update
    setBrands(copy);

    try {
      const brandIds = copy.map((b) => b.id);
      await reorderBrands(brandIds, userEmail);
      triggerToast('Brand order saved for Shop by Brands');
    } catch (err: any) {
      console.error('Reorder error:', err);
      triggerToast('Failed to save brand order');
      await loadData();
    } finally {
      setIsReordering(false);
    }
  };

  const toggleFeatured = async (b: Brand) => {
    const nextVal = !b.isFeatured;
    try {
      await updateBrand(b.id, { isFeatured: nextVal });
      triggerToast(`${b.name} ${nextVal ? 'marked as Featured' : 'unmarked from Featured'}`);
      await loadData();
    } catch (err) {
      console.error('Toggle featured error:', err);
    }
  };

  const filteredBrands = brands.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q) ||
      (b.description && b.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-neutral-900 text-white shadow-xl border border-neutral-800 flex items-center gap-3 text-xs font-semibold"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Store Taxonomy
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight mt-1">
            Brand Management ({brands.length})
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            MySQL database-driven brands with live display ordering for the homepage &ldquo;Shop by Brands&rdquo; strip.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Brand</span>
        </button>
      </div>

      {/* Search Bar & Order Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search brands by name, slug, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-neutral-200 bg-white text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all"
          />
        </div>
        {searchQuery ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              Reordering disabled while search is filtered.
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 px-2 py-1 cursor-pointer"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="text-xs text-neutral-500 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>Use the <strong>Up/Down arrows</strong> to set homepage priority order.</span>
          </div>
        )}
      </div>

      {/* Brands Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50/80 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-100">
            <tr>
              <th className="p-4 pl-6 w-16 text-center">Order</th>
              <th className="p-4">Brand</th>
              <th className="p-4">Public URL</th>
              <th className="p-4 text-center">Featured</th>
              <th className="p-4 text-center">Products</th>
              <th className="p-4">Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-medium">
            {filteredBrands.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-400">
                  {searchQuery ? `No brands matching "${searchQuery}"` : 'No brands registered yet.'}
                </td>
              </tr>
            ) : (
              filteredBrands.map((b, index) => (
                <tr key={b.id} className="hover:bg-neutral-50/50 transition-colors">
                  {/* Reorder Arrows & Position */}
                  <td className="p-4 pl-6 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="w-6 font-mono text-[11px] text-neutral-400 font-bold">
                        #{index + 1}
                      </span>
                      {!searchQuery && (
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveBrand(index, 'up')}
                            disabled={index === 0 || isReordering}
                            className="p-1 rounded hover:bg-neutral-200 text-neutral-500 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
                            title="Move Up in Shop by Brands"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBrand(index, 'down')}
                            disabled={index === brands.length - 1 || isReordering}
                            className="p-1 rounded hover:bg-neutral-200 text-neutral-500 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
                            title="Move Down in Shop by Brands"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Brand Logo & Name */}
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {b.logo ? (
                        <img
                          src={b.logo}
                          alt={b.name}
                          className="w-12 h-9 rounded-lg object-contain bg-white border border-neutral-200 p-1 shadow-2xs shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-9 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 font-bold text-xs shrink-0">
                          {b.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-neutral-950 flex items-center gap-2">
                          <span>{b.name}</span>
                          {b.isFeatured && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              <span>Featured</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">ID: {b.id}</div>
                      </div>
                    </div>
                  </td>

                  {/* Public Link */}
                  <td className="p-4 font-mono text-neutral-500">
                    <Link
                      href={`/brand/${b.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 hover:text-neutral-900 hover:underline"
                    >
                      <span>/brand/{b.slug}</span>
                      <ExternalLink className="w-3 h-3 text-neutral-400" />
                    </Link>
                  </td>

                  {/* Featured Toggle */}
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleFeatured(b)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                        b.isFeatured
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      }`}
                      title="Click to toggle featured status"
                    >
                      <Star className={`w-3 h-3 ${b.isFeatured ? 'fill-amber-500 text-amber-500' : 'text-neutral-400'}`} />
                      <span>{b.isFeatured ? 'Featured' : 'Standard'}</span>
                    </button>
                  </td>

                  {/* Product Count */}
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700">
                      {b.productCount ?? 0}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="p-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        b.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="p-4 pr-6 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(b)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(b.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold cursor-pointer"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {(isCreating || isEditing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                {isCreating ? 'Add Brand' : `Edit Brand: ${isEditing?.name}`}
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(null);
                }}
                className="p-1 text-neutral-400 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Brand Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (isCreating) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                  }}
                  placeholder="e.g. Ronin, Faster, Anker"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Slug * (Clean URL identifier)</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="ronin"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Public URL: /brand/{slug || 'slug'}
                </span>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Brand Logo / Image (Optional)</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <div className="relative group">
                        <img
                          src={logo}
                          alt="Logo Preview"
                          className="w-24 h-16 rounded-xl object-contain bg-white border border-neutral-200 p-1.5 shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setLogo('')}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs shadow-sm hover:bg-rose-600 cursor-pointer"
                          title="Remove logo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-16 rounded-xl bg-neutral-100 border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 space-y-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingLogo ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>{logo ? 'Replace Logo' : 'Upload Logo'}</span>
                          </>
                        )}
                      </button>
                      <p className="text-[10px] text-neutral-400">
                        PNG, JPG, WebP, or SVG (Max 15MB)
                      </p>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                    placeholder="Or paste image URL (e.g. https://...)"
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brand positioning and overview..."
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none"
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Order Position</label>
                  <input
                    type="number"
                    min="0"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-bold text-neutral-900 block text-xs">Featured in Shop by Brands</span>
                    <span className="text-[10px] text-neutral-500 block">
                      Prioritizes this brand in the homepage animated carousel strip.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(null);
                  }}
                  className="px-4 py-2 rounded-full border border-neutral-200 font-semibold text-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded-full bg-neutral-950 text-white font-semibold hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-950">Delete Brand?</h3>
            <p className="text-xs text-neutral-500">
              Are you sure you want to permanently delete this brand from MySQL? Existing products will retain their brand name.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-5 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-5 py-2 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
