'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Video,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Check,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  X,
  ExternalLink,
  Film,
  Sparkles,
  GripVertical,
  AlertCircle,
  FileVideo,
  Clock,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  getHomepageVideos,
  saveHomepageVideo,
  toggleHomepageVideoStatus,
  reorderHomepageVideos,
  deleteHomepageVideo,
} from '@/lib/db/homepageVideos';
import { HomepageVideo } from '@/types/admin';

export default function HomepageVideosPage() {
  const [videos, setVideos] = useState<HomepageVideo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals & Panels
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<HomepageVideo | null>(null);
  const [editingVideo, setEditingVideo] = useState<HomepageVideo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HomepageVideo | null>(null);

  // New Video Form State
  const [newTitle, setNewTitle] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newActive, setNewActive] = useState(true);

  // Drag and drop ordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    setVideos(getHomepageVideos());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const notifySuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  // Reorder Up / Down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= videos.length) return;

    const copy = [...videos];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const orderedIds = copy.map((v) => v.id);
    const updated = await reorderHomepageVideos(orderedIds);
    setVideos(updated);
    notifySuccess('Video playback sequence updated');
  };

  // Toggle Active
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const updated = await toggleHomepageVideoStatus(id, !currentStatus);
    if (updated) {
      loadData();
      notifySuccess(`Video ${!currentStatus ? 'activated' : 'deactivated'} for storefront hero`);
    }
  };

  // Delete Video
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const ok = await deleteHomepageVideo(deleteTarget.id);
    if (ok) {
      loadData();
      notifySuccess(`"${deleteTarget.title}" deleted successfully`);
    }
    setDeleteTarget(null);
  };

  // Save Edit (Name / URL / Active)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;

    await saveHomepageVideo(editingVideo);
    setEditingVideo(null);
    loadData();
    notifySuccess('Video details updated');
  };

  // Upload or Add Video Form Submission
  const handleCreateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');

    if (!newTitle.trim()) {
      setUploadError('Please enter a descriptive name for this video.');
      return;
    }

    let finalUrl = '';
    let fileSize: number | undefined;
    let mimeType: string | undefined;

    if (uploadMethod === 'file') {
      if (!selectedFile) {
        setUploadError('Please select a video file (.mp4, .webm, .mov) to upload.');
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const res = await fetch('/api/admin/homepage-videos/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Video upload failed.');
        }

        finalUrl = data.url;
        fileSize = data.size;
        mimeType = data.mimeType;
      } catch (err: any) {
        setIsUploading(false);
        setUploadError(err.message || 'Failed to upload video to server.');
        return;
      }
      setIsUploading(false);
    } else {
      if (!videoUrlInput.trim()) {
        setUploadError('Please enter a valid video URL.');
        return;
      }
      finalUrl = videoUrlInput.trim();
    }

    await saveHomepageVideo({
      title: newTitle.trim(),
      url: finalUrl,
      active: newActive,
      size: fileSize,
      mimeType,
    });

    // Reset form
    setNewTitle('');
    setVideoUrlInput('');
    setSelectedFile(null);
    setNewActive(true);
    setUploadModalOpen(false);
    loadData();
    notifySuccess('New video added to homepage sequence!');
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const copy = [...videos];
    const draggedItem = copy[draggedIndex];
    copy.splice(draggedIndex, 1);
    copy.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setVideos(copy);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;
    setDraggedIndex(null);
    const orderedIds = videos.map((v) => v.id);
    const updated = await reorderHomepageVideos(orderedIds);
    setVideos(updated);
    notifySuccess('Saved persistent video order');
  };

  const activeVideos = videos.filter((v) => v.active);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Storefront Hero Media
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white">
              Full-Screen Hero
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight mt-1 flex items-center gap-3">
            <Film className="w-7 h-7 text-neutral-900" />
            <span>Home Page Videos</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
            Upload, arrange, preview, and control multiple full-screen videos for the customer homepage hero.
            Active videos play automatically in the exact sequence configured below.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <span>Live Homepage</span>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
          </Link>

          <button
            type="button"
            onClick={() => {
              setUploadError('');
              setUploadModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Video</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-xs transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Total Uploaded
          </span>
          <span className="text-2xl font-black text-neutral-950 mt-1 block">
            {videos.length}
          </span>
          <span className="text-[10px] text-neutral-500 mt-0.5 block">Stored in library</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Active Sequence
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {activeVideos.length}
          </span>
          <span className="text-[10px] text-neutral-500 mt-0.5 block">Playing on homepage</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Inactive Videos
          </span>
          <span className="text-2xl font-black text-neutral-400 mt-1 block">
            {videos.length - activeVideos.length}
          </span>
          <span className="text-[10px] text-neutral-500 mt-0.5 block">Standby / Paused</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Playback Mode
          </span>
          <span className="text-sm font-extrabold text-neutral-900 mt-2 block truncate">
            {activeVideos.length > 1
              ? `Auto-Sequence (${activeVideos.length} Videos)`
              : activeVideos.length === 1
              ? 'Single Video Loop'
              : 'Hero Fallback Active'}
          </span>
          <span className="text-[10px] text-neutral-500 mt-0.5 block">Crossfade transition</span>
        </div>
      </div>

      {/* Main Video Management Table / List */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-neutral-950 uppercase tracking-tight flex items-center gap-2">
              <span>Homepage Video Arrangement & Controls</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Drag or use the arrows to arrange videos. The homepage plays active videos strictly in this order (1 → 2 → 3...).
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Changes save persistently</span>
          </div>
        </div>

        {videos.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
              <FileVideo className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">No Homepage Videos Found</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                Upload your first video to transform the storefront into a cinematic video hero.
              </p>
            </div>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-5 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Upload First Video
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {videos.map((vid, idx) => (
              <div
                key={vid.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  draggedIndex === idx
                    ? 'bg-neutral-100/80 opacity-50 scale-[0.99]'
                    : 'hover:bg-neutral-50/60'
                } ${!vid.active ? 'opacity-70 bg-neutral-50/40' : ''}`}
              >
                {/* Left: Drag Handle, Number Badge, Video Thumbnail & Info */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Drag Handle */}
                  <div
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 cursor-grab active:cursor-grabbing shrink-0"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Order Number Badge */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                      vid.active
                        ? 'bg-neutral-950 text-white shadow-xs'
                        : 'bg-neutral-200 text-neutral-500'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  {/* Video Thumbnail with Quick Play Overlay */}
                  <div
                    onClick={() => setPreviewVideo(vid)}
                    className="relative w-24 sm:w-32 aspect-video rounded-xl overflow-hidden bg-neutral-900 shrink-0 border border-neutral-200 group cursor-pointer shadow-xs"
                  >
                    <video
                      src={vid.url}
                      className="w-full h-full object-cover pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                      <div className="w-7 h-7 rounded-full bg-white/90 text-neutral-950 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-xs sm:text-sm text-neutral-950 truncate max-w-[260px] sm:max-w-md">
                        {vid.title}
                      </h4>
                      {vid.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-500 border border-neutral-200">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-mono">
                      <span className="truncate max-w-[180px] sm:max-w-xs">{vid.url}</span>
                      {vid.size && (
                        <span>• {(vid.size / (1024 * 1024)).toFixed(1)} MB</span>
                      )}
                      {vid.createdAt && (
                        <span className="hidden md:inline">
                          • {new Date(vid.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center shrink-0">
                  {/* Arrange Up */}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveOrder(idx, 'up')}
                    className="p-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Move earlier in sequence"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Arrange Down */}
                  <button
                    type="button"
                    disabled={idx === videos.length - 1}
                    onClick={() => handleMoveOrder(idx, 'down')}
                    className="p-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Move later in sequence"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Activate / Deactivate Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(vid.id, vid.active)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      vid.active
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-neutral-200'
                    }`}
                    title={vid.active ? 'Deactivate from homepage' : 'Activate on homepage'}
                  >
                    {vid.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{vid.active ? 'Active' : 'Inactive'}</span>
                  </button>

                  {/* Preview Button */}
                  <button
                    type="button"
                    onClick={() => setPreviewVideo(vid)}
                    className="p-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 cursor-pointer transition-colors"
                    title="Preview video playback"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit Name Button */}
                  <button
                    type="button"
                    onClick={() => setEditingVideo({ ...vid })}
                    className="p-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 cursor-pointer transition-colors"
                    title="Edit video title"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(vid)}
                    className="p-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 cursor-pointer transition-colors"
                    title="Delete video"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UPLOAD / ADD VIDEO MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-neutral-950">Add Homepage Video</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Upload an MP4/WebM file or provide a direct video URL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleCreateVideo} className="space-y-4 text-xs">
              {/* Video Title */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">
                  Video Name / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GaN Fast Chargers Showcase 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none transition-colors"
                />
              </div>

              {/* Upload Method Selector */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">Video Source</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadMethod('file')}
                    className={`py-2 px-3 rounded-xl font-bold transition-all cursor-pointer ${
                      uploadMethod === 'file'
                        ? 'bg-neutral-950 text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    Upload File (.mp4, .webm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMethod('url')}
                    className={`py-2 px-3 rounded-xl font-bold transition-all cursor-pointer ${
                      uploadMethod === 'url'
                        ? 'bg-neutral-950 text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    Direct Video URL
                  </button>
                </div>
              </div>

              {/* Method 1: File Upload */}
              {uploadMethod === 'file' ? (
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">
                    Select Video File (Up to 100MB) *
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-300 hover:border-neutral-950 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-neutral-50/50 hover:bg-neutral-50"
                  >
                    <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                    {selectedFile ? (
                      <div>
                        <p className="font-bold text-neutral-900 truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-neutral-700">Click to choose video file</p>
                        <p className="text-[10px] text-neutral-400 mt-1">
                          Supports MP4, WebM, MOV (High definition recommended)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Method 2: Direct URL */
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">
                    Direct Video URL *
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/videos/hero_video.mp4"
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none transition-colors font-mono text-[11px]"
                  />
                </div>
              )}

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                <div>
                  <p className="font-bold text-neutral-900">Activate Immediately</p>
                  <p className="text-[10px] text-neutral-500">
                    Include in live storefront hero sequence upon adding
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={newActive}
                  onChange={(e) => setNewActive(e.target.checked)}
                  className="w-4 h-4 rounded text-neutral-950 accent-neutral-950 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-bold hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold tracking-wider uppercase disabled:opacity-50 transition-colors shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Uploading Video...</span>
                    </>
                  ) : (
                    <span>Add Video</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VIDEO MODAL */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-extrabold text-neutral-950">Edit Homepage Video</h3>
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-neutral-800 block mb-1">Video Name</label>
                <input
                  type="text"
                  required
                  value={editingVideo.title}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-800 block mb-1">Video URL</label>
                <input
                  type="text"
                  required
                  value={editingVideo.url}
                  onChange={(e) => setEditingVideo({ ...editingVideo, url: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                <span className="font-bold text-neutral-800">Active Status</span>
                <input
                  type="checkbox"
                  checked={editingVideo.active}
                  onChange={(e) => setEditingVideo({ ...editingVideo, active: e.target.checked })}
                  className="w-4 h-4 accent-neutral-950 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 font-bold text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-neutral-950 text-white font-bold hover:bg-neutral-800 shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW VIDEO MODAL */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="max-w-4xl w-full bg-neutral-950 rounded-3xl overflow-hidden shadow-2xl border border-neutral-800 space-y-3 p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-white pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2 truncate">
                <Film className="w-4 h-4 text-neutral-400" />
                <h3 className="font-bold text-sm truncate">{previewVideo.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              <video
                src={previewVideo.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 font-mono">
              <span className="truncate max-w-xs">{previewVideo.url}</span>
              <span className="font-semibold text-emerald-400">
                {previewVideo.active ? '● Active on Homepage' : '○ Standby / Inactive'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-neutral-950">Delete Video?</h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Are you sure you want to delete <strong className="text-neutral-900">"{deleteTarget.title}"</strong>?
                It will be permanently removed from the storefront hero sequence.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Delete Video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
