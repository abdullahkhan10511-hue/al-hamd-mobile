'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Banner } from '@/types/admin';
import { getBanners, saveBanner, deleteBanner, toggleBannerStatus } from '@/lib/db/banners';
import { uploadImage } from '@/lib/db/media';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  Plus,
  Trash2,
  Edit2,
  Copy,
  Eye,
  EyeOff,
  Upload,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react';

export default function AdminBannersPage() {
  const { admin } = useAdminAuth();
  const userEmail = admin?.email || 'admin@alhamd.com';

  const [banners, setBanners] = useState<Banner[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBanner, setCurrentBanner] = useState<Partial<Banner>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Delete Confirmation Modal state
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    const list = getBanners();
    setBanners(list);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const handleOpenNew = () => {
    setCurrentBanner({
      title: '',
      subtitle: '',
      description: '',
      image: '',
      buttonText: 'Shop Now',
      buttonLink: '/shop',
      status: 'active',
      displayOrder: banners.length + 1,
      countdownEndTime: '',
    });
    setIsEditing(true);
  };

  const handleEdit = (banner: Banner) => {
    setCurrentBanner({ ...banner });
    setIsEditing(true);
  };

  const handleDuplicate = async (banner: Banner) => {
    try {
      const duplicated: Omit<Banner, 'id'> = {
        ...banner,
        title: `${banner.title} (Copy)`,
        displayOrder: banners.length + 1,
      };
      await saveBanner(duplicated, userEmail);
      loadData();
      setStatusMessage('Banner duplicated successfully');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to duplicate banner');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      const success = await deleteBanner(deleteTarget.id, userEmail);
      if (success) {
        loadData();
        setStatusMessage(`Banner "${deleteTarget.title}" deleted successfully`);
        setTimeout(() => setStatusMessage(''), 3000);
        setDeleteTarget(null);
      } else {
        setErrorMessage('Failed to delete banner: Item not found.');
        setTimeout(() => setErrorMessage(''), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred while deleting the banner.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleBannerStatus(id, userEmail);
      loadData();
    } catch (err: any) {
      console.error(err);
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
      const url = await uploadImage(file, 'banners');
      setCurrentBanner((prev) => ({ ...prev, image: url }));
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to upload image. Please try again.');
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

    if (!currentBanner.title?.trim()) {
      alert('Please provide a banner title.');
      return;
    }
    if (!currentBanner.image?.trim()) {
      alert('Please provide a banner image (either via URL or Upload from Gallery).');
      return;
    }

    setIsSaving(true);
    try {
      await saveBanner(currentBanner as Banner, userEmail);
      loadData();
      setIsEditing(false);
      setStatusMessage('Banner saved successfully');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to save banner. Please try again.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Banner Management</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Dynamic Flash Sale countdown cards, promotional banners, and seasonal campaigns
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          + Add Banner
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          {errorMessage}
        </div>
      )}

      {/* Banner Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col"
          >
            {/* Banner Image Preview */}
            <div className="h-44 bg-neutral-900 relative overflow-hidden group">
              <img
                src={
                  banner.image ||
                  'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop'
                }
                alt={banner.title}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
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
                <h3 className="text-lg font-bold line-clamp-1">{banner.title}</h3>
                {banner.countdownEndTime && (
                  <div className="flex items-center gap-1.5 text-[11px] text-rose-300 font-mono mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Live Countdown Active</span>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => handleToggleStatus(banner.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 shadow-sm backdrop-blur-md cursor-pointer transition-colors ${
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
                      <EyeOff className="w-3 h-3" /> Inactive
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Content & Actions */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-1.5 text-xs text-neutral-600">
                <p className="line-clamp-2">{banner.description || 'No description provided.'}</p>
                <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-neutral-500">
                  <span>Target Link:</span>
                  <span className="text-neutral-800 font-semibold truncate max-w-[200px]">{banner.buttonLink}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-[11px] text-neutral-400 font-mono">Order: #{banner.displayOrder}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDuplicate(banner)}
                    title="Duplicate Banner"
                    className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleEdit(banner)}
                    title="Edit Banner"
                    className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeleteTarget(banner)}
                    title="Delete Banner"
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-neutral-900">Delete Promotional Banner</h3>
                <p className="text-xs text-neutral-600 mt-1">
                  Are you sure you want to delete <span className="font-semibold text-neutral-900">&quot;{deleteTarget.title}&quot;</span>?
                  This will immediately remove it from the Home Page and Admin Panel.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Delete Banner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Banner Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-sm">
                {currentBanner.id ? 'Edit Promotional Banner' : 'New Promotional Banner'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Banner Title</label>
                <input
                  type="text"
                  required
                  value={currentBanner.title || ''}
                  onChange={(e) => setCurrentBanner({ ...currentBanner, title: e.target.value })}
                  placeholder="e.g., Up To 70% Off"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Subtitle / Badge</label>
                <input
                  type="text"
                  value={currentBanner.subtitle || ''}
                  onChange={(e) => setCurrentBanner({ ...currentBanner, subtitle: e.target.value })}
                  placeholder="e.g., Flash Sale or Fast Charge"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={currentBanner.description || ''}
                  onChange={(e) => setCurrentBanner({ ...currentBanner, description: e.target.value })}
                  placeholder="Short promotional text..."
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              {/* Banner Image Section: URL OR Upload from Gallery */}
              <div className="space-y-3 p-4 bg-neutral-50/80 border border-neutral-200 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-neutral-800 text-xs">
                    Banner Image <span className="text-rose-500">*</span>
                  </label>
                  {currentBanner.image && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                      Image Selected
                    </span>
                  )}
                </div>

                {/* Immediate Image Preview if present */}
                {currentBanner.image ? (
                  <div className="space-y-2">
                    <div className="relative aspect-[21/9] sm:aspect-[16/7] w-full bg-neutral-900 rounded-xl overflow-hidden border border-neutral-200 shadow-inner group">
                      <img
                        src={currentBanner.image}
                        alt="Banner Preview"
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex items-end justify-between text-white pointer-events-none">
                        <span className="text-[10px] bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded font-mono truncate max-w-[200px]">
                          Preview
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isUploading || isSaving}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploading ? 'Uploading...' : 'Change / Replace Image'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isUploading || isSaving}
                        onClick={() => setCurrentBanner((prev) => ({ ...prev, image: '' }))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Image</span>
                      </button>
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
                    value={currentBanner.image || ''}
                    onChange={(e) => setCurrentBanner({ ...currentBanner, image: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-900 focus:ring-2 focus:ring-neutral-900 font-mono text-[11px]"
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
                    Option 2: Upload from Gallery
                  </label>
                  <button
                    type="button"
                    disabled={isUploading || isSaving}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-4 bg-white hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 rounded-xl text-neutral-800 text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4 text-neutral-600" />
                    <span>{isUploading ? 'Uploading Image from Gallery...' : 'Upload from Gallery'}</span>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Button Text</label>
                  <input
                    type="text"
                    value={currentBanner.buttonText || 'Shop Now'}
                    onChange={(e) => setCurrentBanner({ ...currentBanner, buttonText: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Button Link</label>
                  <input
                    type="text"
                    value={currentBanner.buttonLink || '/shop'}
                    onChange={(e) => setCurrentBanner({ ...currentBanner, buttonLink: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={currentBanner.displayOrder ?? 1}
                    onChange={(e) =>
                      setCurrentBanner({ ...currentBanner, displayOrder: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Status</label>
                  <select
                    value={currentBanner.status || 'active'}
                    onChange={(e) =>
                      setCurrentBanner({ ...currentBanner, status: e.target.value as 'active' | 'inactive' })
                    }
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium"
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Optional Countdown End Time */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Countdown End Date & Time (Optional for Flash Sale)
                </label>
                <input
                  type="datetime-local"
                  value={
                    currentBanner.countdownEndTime
                      ? currentBanner.countdownEndTime.slice(0, 16)
                      : ''
                  }
                  onChange={(e) =>
                    setCurrentBanner({
                      ...currentBanner,
                      countdownEndTime: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  Leave empty if this is a standard promotional banner. If set, a live countdown clock will render on the Home Page.
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-200 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving || isUploading}
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Saving Banner...' : 'Save Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
