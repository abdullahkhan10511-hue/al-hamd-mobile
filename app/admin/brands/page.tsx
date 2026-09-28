'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Tag, Plus, Edit2, Trash2, Check, X, AlertCircle, Search, ImageIcon, ExternalLink, Upload, Loader2 } from 'lucide-react';
import { getBrands, createBrand, updateBrand, deleteBrand, syncBrandsFromApi } from '@/lib/db/brands';
import { subscribeToKey } from '@/lib/db/storage';
import { Brand } from '@/types/admin';
import Link from 'next/link';

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>(getBrands());
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState<Brand | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logo, setLogo] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [error, setError] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    syncBrandsFromApi().then((fresh) => {
      if (fresh && fresh.length > 0) {
        setBrands(fresh);
      }
    });

    const unsub = subscribeToKey('brands', (data: Brand[]) => setBrands(data));
    return () => unsub();
  }, []);

  const openCreateModal = () => {
    setName('');
    setSlug('');
    setLogo('');
    setDescription('');
    setStatus('active');
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
        });
        if (!res.success) {
          setError(res.error || 'Failed to create brand.');
          setIsSaving(false);
          return;
        }
        setIsCreating(false);
      } else if (isEditing) {
        const res = await updateBrand(isEditing.id, {
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          logo: logo.trim() || undefined,
          description: description.trim() || undefined,
          status,
        });
        if (!res.success) {
          setError(res.error || 'Failed to update brand.');
          setIsSaving(false);
          return;
        }
        setIsEditing(null);
      }

      const fresh = await syncBrandsFromApi();
      setBrands(fresh.length > 0 ? fresh : getBrands());
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBrand(id);
    setDeleteConfirmId(null);
    const fresh = await syncBrandsFromApi();
    setBrands(fresh.length > 0 ? fresh : getBrands());
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
    <div className="space-y-8">
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
            MySQL database-driven brands linked dynamically to product catalog, add/edit forms, and public brand routes.
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

      {/* Search Bar */}
      <div className="flex items-center gap-3">
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
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Brands Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50/80 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-100">
            <tr>
              <th className="p-4 pl-6">Brand</th>
              <th className="p-4">Public URL</th>
              <th className="p-4">Description</th>
              <th className="p-4 text-center">Products</th>
              <th className="p-4">Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-medium">
            {filteredBrands.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-neutral-400">
                  {searchQuery ? `No brands matching "${searchQuery}"` : 'No brands registered yet.'}
                </td>
              </tr>
            ) : (
              filteredBrands.map((b) => (
                <tr key={b.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      {b.logo ? (
                        <img
                          src={b.logo}
                          alt={b.name}
                          className="w-8 h-8 rounded-lg object-contain bg-neutral-50 border border-neutral-200 p-0.5"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 font-bold text-[11px]">
                          {b.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-neutral-950">{b.name}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">ID: {b.id}</div>
                      </div>
                    </div>
                  </td>
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
                  <td className="p-4 text-neutral-600 max-w-xs truncate">{b.description || '—'}</td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700">
                      {b.productCount ?? 0}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        b.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(b)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(b.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold"
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
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                {isCreating ? 'Add Brand' : `Edit Brand: ${isEditing?.name}`}
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(null);
                }}
                className="p-1 text-neutral-400 hover:text-neutral-900"
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
                  placeholder="e.g. Apple, Samsung, Anker"
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
                  placeholder="apple"
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
                          className="w-14 h-14 rounded-xl object-contain bg-neutral-50 border border-neutral-200 p-1"
                        />
                        <button
                          type="button"
                          onClick={() => setLogo('')}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs shadow-sm hover:bg-rose-600"
                          title="Remove logo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-neutral-100 border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400">
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

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none"
                >
                  <option value="active">Active (Visible in Product Add/Edit & Brand list)</option>
                  <option value="inactive">Inactive (Hidden from new product selections)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(null);
                  }}
                  className="px-4 py-2 rounded-full border border-neutral-200 font-semibold text-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded-full bg-neutral-950 text-white font-semibold hover:bg-neutral-800 disabled:opacity-50"
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
                className="px-5 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-5 py-2 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
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
