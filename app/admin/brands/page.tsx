'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { getBrands, createBrand, updateBrand, deleteBrand } from '@/lib/db/brands';
import { subscribeToKey } from '@/lib/db/storage';
import { Brand } from '@/types/admin';

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>(getBrands());
  const [isEditing, setIsEditing] = useState<Brand | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = subscribeToKey('brands', (data: Brand[]) => setBrands(data));
    return () => unsub();
  }, []);

  const openCreateModal = () => {
    setName('');
    setSlug('');
    setDescription('');
    setStatus('active');
    setError('');
    setIsCreating(true);
    setIsEditing(null);
  };

  const openEditModal = (b: Brand) => {
    setName(b.name);
    setSlug(b.slug);
    setDescription(b.description || '');
    setStatus(b.status);
    setError('');
    setIsEditing(b);
    setIsCreating(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isCreating) {
      const res = await createBrand({ name, slug, description, status });
      if (!res.success) {
        setError(res.error || 'Failed to create brand.');
        return;
      }
      setIsCreating(false);
    } else if (isEditing) {
      const res = await updateBrand(isEditing.id, { name, slug, description, status });
      if (!res.success) {
        setError(res.error || 'Failed to update brand.');
        return;
      }
      setIsEditing(null);
    }

    setBrands(getBrands());
  };

  const handleDelete = async (id: string) => {
    await deleteBrand(id);
    setDeleteConfirmId(null);
    setBrands(getBrands());
  };

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
            Dynamic brands linked to product catalogs and search filters.
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

      {/* Brands Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50/80 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-100">
            <tr>
              <th className="p-4 pl-6">Brand Name</th>
              <th className="p-4">Slug</th>
              <th className="p-4">Description</th>
              <th className="p-4">Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-medium">
            {brands.map((b) => (
              <tr key={b.id} className="hover:bg-neutral-50/50 transition-colors">
                <td className="p-4 pl-6 font-bold text-sm text-neutral-950">{b.name}</td>
                <td className="p-4 font-mono text-neutral-500">/{b.slug}</td>
                <td className="p-4 text-neutral-600 max-w-xs truncate">{b.description || '—'}</td>
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
            ))}
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
                    if (isCreating) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  placeholder="e.g. Bang & Olufsen"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="bang-olufsen"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brand positioning and origin..."
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
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
                  className="px-6 py-2 rounded-full bg-neutral-950 text-white font-semibold hover:bg-neutral-800"
                >
                  Save Brand
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
              Are you sure you want to permanently delete this brand from the database?
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
