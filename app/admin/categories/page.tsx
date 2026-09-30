'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Check,
  X,
  Upload,
  ArrowUp,
  ArrowDown,
  AlertCircle,
} from 'lucide-react';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  generateCategorySlug,
  deduplicateCategoriesById,
} from '@/lib/db/categories';
import { subscribeToKey } from '@/lib/db/storage';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Category } from '@/types';

export default function AdminCategoriesPage() {
  const { admin } = useAdminAuth();
  const userEmail = admin?.email || 'admin@alhamd.com';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isEditing, setIsEditing] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [status, setStatus] = useState<'active' | 'archived' | 'inactive'>('active');

  // Async & UI status
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
          setCategories(deduplicateCategoriesById(data.categories));
          return;
        }
      }
    } catch {}
    setCategories(deduplicateCategoriesById(getCategories()));
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToKey('categories', (data: Category[]) => {
      if (Array.isArray(data)) {
        setCategories(deduplicateCategoriesById(data));
      }
    });
    return () => unsub();
  }, []);

  const triggerSuccessToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const openCreateModal = () => {
    setName('');
    setSlug('');
    setDescription('');
    setImage('https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=800&auto=format&fit=crop');
    setStatus('active');
    setErrorMessage('');
    setIsCreating(true);
    setIsEditing(null);
  };

  const openEditModal = (cat: Category) => {
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setImage(cat.image);
    setStatus(cat.status);
    setErrorMessage('');
    setIsEditing(cat);
    setIsCreating(false);
  };

  const closeFormModal = () => {
    if (isSaving) return;
    setIsCreating(false);
    setIsEditing(null);
    setErrorMessage('');
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (isCreating) {
      setSlug(generateCategorySlug(val));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      alert('Please upload a valid image file (JPG, JPEG, PNG, or WEBP).');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/categories/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Failed to upload category image.');
      }

      setImage(data.url);
    } catch (err: any) {
      console.error('Category image upload error:', err);
      alert(err?.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setErrorMessage('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Category name is required.');
      return;
    }

    setIsSaving(true);

    try {
      if (isCreating) {
        const res = await createCategory(
          {
            name: trimmedName,
            slug: slug.trim() ? slug.trim() : generateCategorySlug(trimmedName),
            description: description.trim(),
            image: image.trim(),
            status,
            productCount: 0,
          },
          userEmail
        );

        if (!res.success) {
          setErrorMessage(res.error || 'Failed to create category.');
          return;
        }

        // Close modal and reset form
        setIsCreating(false);
        setName('');
        setSlug('');
        setDescription('');
        setImage('');
        setErrorMessage('');
        loadData();
        triggerSuccessToast('Category created successfully');
      } else if (isEditing) {
        const res = await updateCategory(
          isEditing.id,
          {
            name: trimmedName,
            slug: slug.trim() ? slug.trim() : generateCategorySlug(trimmedName),
            description: description.trim(),
            image: image.trim(),
            status,
          },
          userEmail
        );

        if (!res.success) {
          setErrorMessage(res.error || 'Failed to update category.');
          return;
        }

        setIsEditing(null);
        setErrorMessage('');
        loadData();
        triggerSuccessToast('Category updated successfully');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    const target = deleteTarget;
    setIsDeleting(true);

    try {
      const success = await deleteCategory(target.id, userEmail);
      if (success) {
        // Immediately close the confirmation modal
        setDeleteTarget(null);
        // Optimistically update local list so the item animates out smoothly
        setCategories((prev) => prev.filter((c) => c.id !== target.id));
        triggerSuccessToast(`Category "${target.name}" deleted successfully`);
        loadData();
      } else {
        alert('Failed to delete category. Please try again.');
        setDeleteTarget(null);
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'An error occurred while deleting the category.');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const copy = [...categories];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    setCategories(copy);
    await reorderCategories(copy.map((c) => c.id), userEmail);
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Store Taxonomy
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight mt-1">
            Category Management ({categories.length})
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Manage category titles, slugs, and upload/replace promotional photography.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/80 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-100">
              <tr>
                <th className="p-4 pl-6">Order</th>
                <th className="p-4">Category</th>
                <th className="p-4">Slug</th>
                <th className="p-4">Description</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              <AnimatePresence mode="popLayout">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-400">
                      No categories found. Click &ldquo;Add Category&rdquo; to create one.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat, idx) => (
                    <motion.tr
                      key={cat.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, height: 0, transition: { duration: 0.25 } }}
                      className="hover:bg-neutral-50/50 transition-colors"
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-neutral-400 font-bold w-4">{idx + 1}</span>
                          <button
                            disabled={idx === 0}
                            onClick={() => moveCategory(idx, 'up')}
                            className="p-1 rounded hover:bg-neutral-200 disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            disabled={idx === categories.length - 1}
                            onClick={() => moveCategory(idx, 'down')}
                            className="p-1 rounded hover:bg-neutral-200 disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-14 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/80 shrink-0">
                            <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                          </div>
                          <span className="font-bold text-neutral-900 text-sm">{cat.name}</span>
                        </div>
                      </td>

                      <td className="p-4 font-mono text-neutral-500">/{cat.slug}</td>

                      <td className="p-4 text-neutral-600 max-w-xs truncate">{cat.description}</td>

                      <td className="p-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            cat.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {cat.status}
                        </span>
                      </td>

                      <td className="p-4 pr-6 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(cat)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(cat)}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Create Modal */}
      <AnimatePresence>
        {(isCreating || isEditing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                  {isCreating ? 'Add New Category' : `Edit Category: ${isEditing?.name}`}
                </h3>
                <button
                  onClick={closeFormModal}
                  disabled={isSaving}
                  className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. MagSafe Wallets & Accessories"
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Slug URL *</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. magsafe-accessories"
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono text-neutral-900"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description for category card and collection page..."
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900"
                  />
                </div>

                {/* Category Image: URL OR Upload from Gallery */}
                <div className="space-y-3 p-3.5 bg-neutral-50/70 border border-neutral-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-800 block text-xs">
                      Category Image *
                    </label>
                    {image && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                        Image Ready
                      </span>
                    )}
                  </div>

                  {/* Immediate Image Preview */}
                  {image ? (
                    <div className="flex items-center gap-3">
                      <div className="relative w-20 h-24 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-200 shadow-xs shrink-0">
                        <img
                          src={image}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=800&auto=format&fit=crop';
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={isUploading || isSaving}
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploading ? 'Uploading...' : 'Change / Replace Image'}</span>
                        </button>

                        <div>
                          <button
                            type="button"
                            disabled={isUploading || isSaving}
                            onClick={() => setImage('')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove Image</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Option 1: Image URL */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Option 1: Image URL
                    </label>
                    <input
                      type="url"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full p-2 text-[11px] rounded-xl border border-neutral-200 bg-white font-mono text-neutral-900 focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>

                  <div className="relative flex items-center justify-center py-0.5">
                    <div className="border-t border-neutral-200 w-full" />
                    <span className="bg-neutral-50 px-2 text-[10px] uppercase font-bold text-neutral-400 absolute">
                      OR
                    </span>
                  </div>

                  {/* Option 2: Upload from Gallery */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Option 2: Upload from Gallery / Device
                    </label>
                    <button
                      type="button"
                      disabled={isUploading || isSaving}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 px-3 bg-white hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 rounded-xl text-neutral-800 text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-neutral-600" />
                      <span>{isUploading ? 'Uploading Image...' : 'Upload from Gallery'}</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1 text-center">
                      Accepts JPG, JPEG, PNG, WEBP (Max 5MB)
                    </p>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900"
                  >
                    <option value="active">Active (Visible on storefront)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                    <option value="archived">Archived (Hidden)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={closeFormModal}
                    className="px-4 py-2 rounded-full border border-neutral-200 text-neutral-700 font-semibold hover:bg-neutral-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 rounded-full bg-neutral-950 text-white font-semibold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving && (
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    <span>{isSaving ? 'Saving Category...' : 'Save Category'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal with AnimatePresence */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-950">Delete Category?</h3>
              <p className="text-xs text-neutral-500">
                Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>? Products assigned to it will remain in catalog.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="px-5 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Confirm Delete</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
