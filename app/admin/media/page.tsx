'use client';

import React, { useState, useEffect } from 'react';
import { getMediaItems, uploadMediaFile, deleteMediaItem, MediaItem } from '@/lib/db/media';
import {
  Upload,
  Trash2,
  Copy,
  Check,
  Search,
  Image as ImageIcon,
  ExternalLink,
  Maximize2,
  X,
} from 'lucide-react';

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  const loadData = () => {
    setMedia(getMediaItems());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    for (let i = 0; i < files.length; i++) {
      await uploadMediaFile(files[i]);
    }
    loadData();
    setIsUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this media asset?')) return;
    await deleteMediaItem(id);
    loadData();
    if (previewItem?.id === id) setPreviewItem(null);
  };

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = media.filter((m) =>
    !searchQuery.trim() ? true : m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Media & Asset Library</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Centralized repository stored in Firebase Storage for banners, products, and categories
          </p>
        </div>

        <label className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          {isUploading ? 'Uploading...' : 'Upload Media Files'}
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search images by filename..."
          className="w-full bg-transparent text-xs text-neutral-900 focus:outline-none"
        />
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-neutral-400 bg-white rounded-2xl border border-neutral-200">
            <ImageIcon className="w-10 h-10 mx-auto mb-2 text-neutral-300" />
            <p className="text-xs">No media files found.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden group hover:shadow-md transition-all flex flex-col"
            >
              <div className="aspect-square bg-neutral-100 relative overflow-hidden flex items-center justify-center">
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPreviewItem(item)}
                    title="Preview Full Image"
                    className="p-2 bg-white/90 hover:bg-white text-neutral-900 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCopy(item.url, item.id)}
                    title="Copy URL"
                    className="p-2 bg-white/90 hover:bg-white text-neutral-900 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Delete Image"
                    className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-2.5 text-xs flex-1 flex flex-col justify-between">
                <p className="font-semibold text-neutral-900 truncate text-[11px]" title={item.name}>
                  {item.name}
                </p>
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1">
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleCopy(item.url, item.id)}
                    className="text-neutral-700 hover:underline flex items-center gap-0.5"
                  >
                    {copiedId === item.id ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Full Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <span className="font-bold text-xs text-neutral-900 truncate">{previewItem.name}</span>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-neutral-900 flex items-center justify-center overflow-auto max-h-[70vh]">
              <img
                src={previewItem.url}
                alt={previewItem.name}
                className="max-h-[65vh] object-contain rounded-lg"
              />
            </div>

            <div className="p-4 border-t border-neutral-200 flex items-center justify-between text-xs">
              <input
                type="text"
                readOnly
                value={previewItem.url}
                className="flex-1 bg-neutral-100 px-3 py-1.5 rounded-lg font-mono text-[10px] text-neutral-700 mr-3 truncate"
              />
              <button
                onClick={() => handleCopy(previewItem.url, previewItem.id)}
                className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg font-semibold hover:bg-neutral-800 transition-colors"
              >
                {copiedId === previewItem.id ? 'Copied URL' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
