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
  Image as ImageIcon,
  AlertTriangle,
  Laptop,
  Smartphone,
} from 'lucide-react';
import {
  getHomepageVideos,
  saveHomepageVideo,
  toggleHomepageVideoStatus,
  reorderHomepageVideos,
  deleteHomepageVideo,
  getHeroMediaType,
  getHeroSlideDuration,
} from '@/lib/db/homepageVideos';
import { HomepageVideo } from '@/types/admin';
import { getAdminAuthHeaders } from '@/lib/permissions';
import { persistCollection } from '@/lib/db/storage';
import {
  HERO_MEDIA_LIMITS,
  getHeroSizeHealth,
  formatHeroBytes,
  HeroMediaCategory,
} from '@/lib/heroMedia';

async function captureWebpPosterFromVideo(
  srcUrl: string,
  seekTimeSeconds?: number
): Promise<{ blob: Blob; previewUrl: string; duration: number } | null> {
  if (typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.crossOrigin = 'anonymous';
      videoEl.src = srcUrl;

      let settled = false;
      const finish = (res: { blob: Blob; previewUrl: string; duration: number } | null) => {
        if (settled) return;
        settled = true;
        resolve(res);
      };

      videoEl.onloadeddata = () => {
        const dur = videoEl.duration && isFinite(videoEl.duration) ? videoEl.duration : 4;
        const target =
          typeof seekTimeSeconds === 'number' && seekTimeSeconds >= 0
            ? Math.min(seekTimeSeconds, Math.max(0.1, dur - 0.1))
            : Math.min(2, Math.max(0.5, dur / 2));
        videoEl.currentTime = target;
      };

      videoEl.onseeked = () => {
        try {
          const rawW = videoEl.videoWidth || 1280;
          const rawH = videoEl.videoHeight || 720;
          const maxW = 1600;
          const scale = rawW > maxW ? maxW / rawW : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(rawW * scale));
          canvas.height = Math.max(1, Math.round(rawH * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return finish(null);
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) return finish(null);
              finish({
                blob,
                previewUrl: URL.createObjectURL(blob),
                duration: videoEl.duration && isFinite(videoEl.duration) ? videoEl.duration : 10,
              });
            },
            'image/webp',
            0.85
          );
        } catch {
          finish(null);
        }
      };

      videoEl.onerror = () => finish(null);
      setTimeout(() => finish(null), 8000);
    } catch {
      resolve(null);
    }
  });
}

function classifyClientFileCategory(file: File | null): HeroMediaCategory {
  if (!file) return 'image';
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
  if (isVideo) return 'video';
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
  if (isGif) return 'animated';
  return 'image';
}

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
  const [createPosterTarget, setCreatePosterTarget] = useState<HomepageVideo | null>(null);
  const [createPosterPreviewUrl, setCreatePosterPreviewUrl] = useState('');
  const [createPosterBlob, setCreatePosterBlob] = useState<Blob | null>(null);
  const [createPosterSeekSec, setCreatePosterSeekSec] = useState(2);
  const [createPosterDuration, setCreatePosterDuration] = useState(10);
  const [mobileColumnsSupported, setMobileColumnsSupported] = useState(true);

  // New Media Form State (Desktop + Optional Mobile)
  const [newTitle, setNewTitle] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [thumbnailUrlInput, setThumbnailUrlInput] = useState('');
  const [mobileUrlInput, setMobileUrlInput] = useState('');
  const [mobileThumbInput, setMobileThumbInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [desktopPreviewUrl, setDesktopPreviewUrl] = useState<string>('');
  const [desktopVideoDuration, setDesktopVideoDuration] = useState<number>(10);
  const [desktopFrameSeekSec, setDesktopFrameSeekSec] = useState<number>(2);
  const [customPosterFile, setCustomPosterFile] = useState<File | null>(null);
  const [capturedPosterBlob, setCapturedPosterBlob] = useState<Blob | null>(null);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string>('');

  const [selectedMobileFile, setSelectedMobileFile] = useState<File | null>(null);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string>('');
  const [mobileVideoDuration, setMobileVideoDuration] = useState<number>(10);
  const [mobileFrameSeekSec, setMobileFrameSeekSec] = useState<number>(2);
  const [customMobilePosterFile, setCustomMobilePosterFile] = useState<File | null>(null);
  const [capturedMobilePosterBlob, setCapturedMobilePosterBlob] = useState<Blob | null>(null);
  const [mobilePosterPreviewUrl, setMobilePosterPreviewUrl] = useState<string>('');

  const [slideDuration, setSlideDuration] = useState<number>(5);
  const [newActive, setNewActive] = useState(true);

  // Drag and drop ordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const mobilePosterInputRef = useRef<HTMLInputElement>(null);
  const editPosterInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    setVideos(getHomepageVideos());
  };

  useEffect(() => {
    loadData();

    // Fetch authoritative list directly from API on mount
    fetch(`/api/admin/homepage-videos?t=${Date.now()}`, {
      cache: 'no-store',
      headers: getAdminAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.videos)
          ? data.videos
          : [];
        if (data.success && Array.isArray(list)) {
          setVideos(list);
          persistCollection('homepage_videos', list, true);
        }
        if (typeof data.mobileColumnsSupported === 'boolean') {
          setMobileColumnsSupported(data.mobileColumnsSupported);
        }
      })
      .catch(() => {});

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const notifySuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  // Automatic Desktop Video Poster Capture via Canvas (WebP max 1600px, ~2s in)
  const handleMediaFileChange = async (file: File | null) => {
    setSelectedFile(file);
    setUploadError('');
    setCapturedPosterBlob(null);
    setPosterPreviewUrl('');
    setCustomPosterFile(null);
    setDesktopPreviewUrl('');

    if (!file) return;

    const category = classifyClientFileCategory(file);
    const limits = HERO_MEDIA_LIMITS[category];
    if (file.size > limits.maxBytes) {
      setUploadError(
        `${limits.title} is ${(file.size / (1024 * 1024)).toFixed(1)} MB — max allowed is ${limits.maxLabel}.`
      );
    }

    const objUrl = URL.createObjectURL(file);
    setDesktopPreviewUrl(objUrl);

    if (category === 'video') {
      const res = await captureWebpPosterFromVideo(objUrl, 2);
      if (res) {
        setCapturedPosterBlob(res.blob);
        setPosterPreviewUrl(res.previewUrl);
        setDesktopVideoDuration(res.duration);
        setDesktopFrameSeekSec(Math.min(2, Math.max(0.5, res.duration / 2)));
      }
    } else {
      setPosterPreviewUrl(objUrl);
    }
  };

  const handleReCaptureDesktopFrame = async (seekSec: number) => {
    setDesktopFrameSeekSec(seekSec);
    if (!desktopPreviewUrl) return;
    const res = await captureWebpPosterFromVideo(desktopPreviewUrl, seekSec);
    if (res) {
      setCustomPosterFile(null);
      setCapturedPosterBlob(res.blob);
      setPosterPreviewUrl(res.previewUrl);
    }
  };

  // Optional Mobile Media File Change + Mobile Poster Capture
  const handleMobileMediaFileChange = async (file: File | null) => {
    setSelectedMobileFile(file);
    setCapturedMobilePosterBlob(null);
    setMobilePosterPreviewUrl('');
    setCustomMobilePosterFile(null);
    setMobilePreviewUrl('');

    if (!file) return;

    const category = classifyClientFileCategory(file);
    const limits = HERO_MEDIA_LIMITS[category];
    if (file.size > limits.maxBytes) {
      setUploadError(
        `Mobile ${limits.title} is ${(file.size / (1024 * 1024)).toFixed(1)} MB — max allowed is ${limits.maxLabel}.`
      );
    }

    const objUrl = URL.createObjectURL(file);
    setMobilePreviewUrl(objUrl);

    if (category === 'video') {
      const res = await captureWebpPosterFromVideo(objUrl, 2);
      if (res) {
        setCapturedMobilePosterBlob(res.blob);
        setMobilePosterPreviewUrl(res.previewUrl);
        setMobileVideoDuration(res.duration);
        setMobileFrameSeekSec(Math.min(2, Math.max(0.5, res.duration / 2)));
      }
    } else {
      setMobilePosterPreviewUrl(objUrl);
    }
  };

  const handleReCaptureMobileFrame = async (seekSec: number) => {
    setMobileFrameSeekSec(seekSec);
    if (!mobilePreviewUrl) return;
    const res = await captureWebpPosterFromVideo(mobilePreviewUrl, seekSec);
    if (res) {
      setCustomMobilePosterFile(null);
      setCapturedMobilePosterBlob(res.blob);
      setMobilePosterPreviewUrl(res.previewUrl);
    }
  };

  // Create Poster for existing video without poster
  const handleOpenCreatePoster = async (vid: HomepageVideo) => {
    setCreatePosterTarget(vid);
    setCreatePosterPreviewUrl('');
    setCreatePosterBlob(null);
    setCreatePosterSeekSec(2);
    const res = await captureWebpPosterFromVideo(vid.url, 2);
    if (res) {
      setCreatePosterBlob(res.blob);
      setCreatePosterPreviewUrl(res.previewUrl);
      setCreatePosterDuration(res.duration);
    }
  };

  const handleSaveCreatedPoster = async () => {
    if (!createPosterTarget || !createPosterBlob) return;
    setIsUploading(true);
    try {
      const posterFile = new File([createPosterBlob], 'poster.webp', { type: 'image/webp' });
      const pForm = new FormData();
      pForm.append('file', posterFile);
      const pRes = await fetch('/api/admin/homepage-videos/upload', {
        method: 'POST',
        body: pForm,
      });
      const pData = await pRes.json();
      if (!pRes.ok || !pData.success || !pData.url) {
        throw new Error(pData.error || 'Poster upload failed');
      }
      await saveHomepageVideo({ ...createPosterTarget, thumbnailUrl: pData.url });
      setCreatePosterTarget(null);
      loadData();
      notifySuccess('WebP poster created and saved!');
    } catch (err: any) {
      alert(err.message || 'Failed to save poster');
    } finally {
      setIsUploading(false);
    }
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
    notifySuccess('Hero sequence updated');
  };

  // Toggle Active
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const updated = await toggleHomepageVideoStatus(id, !currentStatus);
    if (updated) {
      loadData();
      notifySuccess(`Item ${!currentStatus ? 'activated' : 'deactivated'} for storefront hero`);
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

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;

    await saveHomepageVideo(editingVideo);
    setEditingVideo(null);
    loadData();
    notifySuccess('Item details updated');
  };

  // Upload Poster for Editing Item
  const handleUploadEditPoster = async (file: File) => {
    if (!editingVideo) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/homepage-videos/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Poster upload failed');
      }
      setEditingVideo({ ...editingVideo, thumbnailUrl: data.url });
      notifySuccess('Poster uploaded! Click Save to apply.');
    } catch (err: any) {
      alert(err.message || 'Failed to upload poster image');
    } finally {
      setIsUploading(false);
    }
  };

  // Upload or Add Video Form Submission
  const handleCreateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');

    if (!newTitle.trim()) {
      setUploadError('Please enter a descriptive name for this item.');
      return;
    }

    let finalUrl = '';
    let finalThumbnailUrl = '';
    let finalMobileUrl = '';
    let finalMobileThumbUrl = '';
    let finalMobileMime: string | undefined;
    let fileSize: number | undefined;
    let mimeType: string | undefined;

    const uploadSingleFile = async (f: File) => {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch('/api/admin/homepage-videos/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok || !d.success) {
        throw new Error(d.error || 'Media upload failed.');
      }
      return d;
    };

    if (uploadMethod === 'file') {
      if (!selectedFile) {
        setUploadError('Please select a Laptop / Desktop media file (Video, Image, or GIF) to upload.');
        return;
      }

      setIsUploading(true);
      try {
        const data = await uploadSingleFile(selectedFile);
        finalUrl = data.url;
        fileSize = data.size;
        mimeType = data.mimeType;

        const isVideo = classifyClientFileCategory(selectedFile) === 'video';
        if (isVideo) {
          if (customPosterFile) {
            const pData = await uploadSingleFile(customPosterFile);
            if (pData.url) finalThumbnailUrl = pData.url;
          } else if (capturedPosterBlob) {
            const posterFile = new File([capturedPosterBlob], 'poster.webp', { type: 'image/webp' });
            const pData = await uploadSingleFile(posterFile);
            if (pData.url) finalThumbnailUrl = pData.url;
          }
        }

        // Optional Mobile media upload
        if (selectedMobileFile) {
          const mData = await uploadSingleFile(selectedMobileFile);
          finalMobileUrl = mData.url;
          finalMobileMime = mData.mimeType;

          const isMobileVid = classifyClientFileCategory(selectedMobileFile) === 'video';
          if (isMobileVid) {
            if (customMobilePosterFile) {
              const mpData = await uploadSingleFile(customMobilePosterFile);
              if (mpData.url) finalMobileThumbUrl = mpData.url;
            } else if (capturedMobilePosterBlob) {
              const mpFile = new File([capturedMobilePosterBlob], 'mobile_poster.webp', { type: 'image/webp' });
              const mpData = await uploadSingleFile(mpFile);
              if (mpData.url) finalMobileThumbUrl = mpData.url;
            }
          }
        }
      } catch (err: any) {
        setIsUploading(false);
        setUploadError(err.message || 'Failed to upload media to server.');
        return;
      }
      setIsUploading(false);
    } else {
      if (!videoUrlInput.trim()) {
        setUploadError('Please enter a valid media URL.');
        return;
      }
      finalUrl = videoUrlInput.trim();
      finalThumbnailUrl = thumbnailUrlInput.trim();
      finalMobileUrl = mobileUrlInput.trim();
      finalMobileThumbUrl = mobileThumbInput.trim();
    }

    const nextOrder =
      videos.length > 0
        ? Math.max(...videos.map((v) => Number(v.displayOrder) || 0)) + 1
        : 1;

    const mediaType = getHeroMediaType(finalUrl, mimeType);
    const durationVal = mediaType === 'video' ? undefined : getHeroSlideDuration(slideDuration);

    await saveHomepageVideo({
      title: newTitle.trim(),
      url: finalUrl,
      thumbnailUrl: finalThumbnailUrl || undefined,
      mobileUrl: finalMobileUrl || undefined,
      mobileThumbnailUrl: finalMobileThumbUrl || undefined,
      mobileMimeType: finalMobileMime,
      duration: durationVal,
      active: newActive,
      displayOrder: nextOrder,
      size: fileSize,
      mimeType,
    });

    // Reset form
    setNewTitle('');
    setVideoUrlInput('');
    setThumbnailUrlInput('');
    setMobileUrlInput('');
    setMobileThumbInput('');
    setSelectedFile(null);
    setDesktopPreviewUrl('');
    setCustomPosterFile(null);
    setCapturedPosterBlob(null);
    setPosterPreviewUrl('');
    setSelectedMobileFile(null);
    setMobilePreviewUrl('');
    setCustomMobilePosterFile(null);
    setCapturedMobilePosterBlob(null);
    setMobilePosterPreviewUrl('');
    setSlideDuration(5);
    setNewActive(true);
    setUploadModalOpen(false);
    loadData();
    notifySuccess('New hero item added to sequence!');
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
    notifySuccess('Saved persistent hero order');
  };

  const isSelectedVideo = selectedFile && (selectedFile.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(selectedFile.name));
  const isSelectedLarge = selectedFile && selectedFile.size >= 8 * 1024 * 1024;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-neutral-950 text-white shadow-xs">
              <Film className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-950 tracking-tight">
              Homepage Hero Media
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Manage your storefront hero slider with Videos, Pictures, or Animated GIFs for laptop and mobile.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setUploadError('');
              setUploadModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Hero Slide</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs sm:text-sm flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Migration Notice when mobile_* columns do not exist yet */}
      {!mobileColumnsSupported && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-center gap-2.5 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Run the hero migration to enable mobile media: </span>
            <span className="font-mono text-[11px]">scripts/migrations/add_hero_mobile_media.sql</span>
          </div>
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <span className="text-xs text-neutral-500 font-medium block">Total Slides</span>
          <span className="text-xl sm:text-2xl font-extrabold text-neutral-950 mt-1 block">
            {videos.length}
          </span>
          <span className="text-[10px] text-neutral-400 mt-0.5 block">Configured items</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <span className="text-xs text-neutral-500 font-medium block">Active in Sequence</span>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-1 block">
            {videos.filter((v) => v.active).length}
          </span>
          <span className="text-[10px] text-neutral-400 mt-0.5 block">Shown on storefront</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <span className="text-xs text-neutral-500 font-medium block">Media Limits</span>
          <span className="text-xs font-bold text-neutral-800 mt-1 block">
            Pic 3MB • GIF 6MB • Video 15MB
          </span>
          <span className="text-[10px] text-neutral-400 mt-0.5 block">Magic-byte validated</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <span className="text-xs text-neutral-500 font-medium block">Playback Logic</span>
          <span className="text-xs font-bold text-neutral-800 mt-1 block">
            Pictures/GIFs: 3-15s • Video: max 15s
          </span>
          <span className="text-[10px] text-neutral-400 mt-0.5 block">Instant LCP poster paint</span>
        </div>
      </div>

      {/* H5 Admin Guide Card */}
      <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-4 sm:p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-neutral-800">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Hero Media Guide (Fast Loading & Crisp Display)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-neutral-600">
          <div className="bg-white rounded-xl p-3 border border-neutral-200/70">
            <p className="font-bold text-neutral-900 mb-1">Recommended Sizes</p>
            <p>Laptop / Desktop: <span className="font-mono font-semibold">1920x1080</span> (16:9)</p>
            <p>Mobile (optional): <span className="font-mono font-semibold">1080x1920</span> (9:16)</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-neutral-200/70">
            <p className="font-bold text-neutral-900 mb-1">Target File Weights</p>
            <p>Picture (WebP/JPG): &lt; 400 KB (max 3 MB)</p>
            <p>Video (MP4 720p, 8-12s, no audio): &lt; 6 MB (max 15 MB)</p>
            <p>GIF: &lt; 2 MB (max 6 MB)</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-neutral-200/70">
            <p className="font-bold text-neutral-900 mb-1">Speed Tips</p>
            <p>First slide loads immediately as a poster image; videos mount after page paint.</p>
            <p className="text-amber-700 font-medium mt-0.5">For smooth and fast results use a short MP4 instead of a GIF.</p>
          </div>
        </div>
      </div>

      {/* Main Video Management Table / List */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-neutral-950 uppercase tracking-tight flex items-center gap-2">
              <span>Hero Slider Playlist & Arrangement</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Drag or use the arrows to arrange items. The homepage displays active items in this sequence with instant LCP paint and lazy videos.
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
              <Film className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">No Hero Slides Found</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                Upload your first video, image, or animated GIF to create a cinematic hero slider.
              </p>
            </div>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-5 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Upload First Slide
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {videos.map((vid, idx) => {
              const mediaType = getHeroMediaType(vid.url, vid.mimeType);
              const isVideo = mediaType === 'video';
              const hasNoPoster = isVideo && (!vid.thumbnailUrl || !vid.thumbnailUrl.trim());
              const sizeHealth = getHeroSizeHealth(vid.size, mediaType);
              const hasMobile = Boolean(vid.mobileUrl && vid.mobileUrl.trim());

              return (
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
                  {/* Left: Drag Handle, Number Badge, Thumbnail & Info */}
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
                      #{vid.displayOrder ?? idx + 1}
                    </div>

                    {/* Thumbnail / Media Preview */}
                    <div
                      onClick={() => setPreviewVideo(vid)}
                      className="relative w-24 sm:w-32 aspect-video rounded-xl overflow-hidden bg-neutral-900 shrink-0 border border-neutral-200 group cursor-pointer shadow-xs"
                    >
                      {isVideo ? (
                        vid.thumbnailUrl ? (
                          <img
                            src={vid.thumbnailUrl}
                            alt={vid.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-zinc-900 text-white/40 text-[9px] text-center p-1">
                            <span>No Poster</span>
                          </div>
                        )
                      ) : (
                        <img
                          src={vid.url}
                          alt={vid.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                        <div className="w-7 h-7 rounded-full bg-white/90 text-neutral-950 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm text-neutral-950 truncate max-w-[240px] sm:max-w-md">
                          {vid.title}
                        </h4>

                        {/* Media Type Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-200">
                          {mediaType}
                        </span>

                        {/* Status Badge */}
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

                        {/* Poster Status / Create Poster Button */}
                        {isVideo && (
                          hasNoPoster ? (
                            <button
                              type="button"
                              onClick={() => handleOpenCreatePoster(vid)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 cursor-pointer transition-colors"
                              title="Capture a WebP poster from 2s into this video"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Create poster
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Poster OK
                            </span>
                          )
                        )}

                        {/* Mobile vs Desktop-only Badge */}
                        {hasMobile ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            <Smartphone className="w-3 h-3" />
                            Mobile
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-500 border border-neutral-200">
                            <Laptop className="w-3 h-3" />
                            Desktop only
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] text-neutral-400 font-mono flex-wrap">
                        <span className="truncate max-w-[160px] sm:max-w-xs">{vid.url}</span>

                        {/* Green / Amber File Size Indicator */}
                        {vid.size && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              sizeHealth === 'red'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : sizeHealth === 'amber'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                            title={
                              sizeHealth === 'red'
                                ? 'Over maximum recommended limit'
                                : sizeHealth === 'amber'
                                ? 'This file will load slowly — consider compressing'
                                : 'Optimal file size'
                            }
                          >
                            {formatHeroBytes(vid.size)}
                          </span>
                        )}

                        {/* Slide Display Duration for Images/GIFs */}
                        {!isVideo && (
                          <span className="text-neutral-500 font-sans">
                            • {vid.duration ?? 5}s slide duration
                          </span>
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
                      title="Preview slide"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => setEditingVideo({ ...vid })}
                      className="p-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 cursor-pointer transition-colors"
                      title="Edit slide details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(vid)}
                      className="p-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 cursor-pointer transition-colors"
                      title="Delete slide"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPLOAD / ADD HERO SLIDE MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-neutral-950">Add Hero Slide</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Upload a Video (MP4/WebM), Image (JPG/PNG/WebP/AVIF), or Animated GIF.
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
              {/* Slide Title */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">
                  Slide Name / Title *
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
                <label className="font-bold text-neutral-800 block mb-1">Media Source</label>
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
                    Upload File
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
                    Direct URL
                  </button>
                </div>
              </div>

              {/* Method 1: File Upload (Side-by-Side Laptop / Desktop & Mobile) */}
              {uploadMethod === 'file' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Laptop / Desktop Upload Box */}
                    <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <Laptop className="w-4 h-4 text-neutral-700" />
                          Laptop / Desktop *
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">1920x1080 rec</span>
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="video/mp4,video/webm,image/jpeg,image/png,image/webp,image/avif,image/gif"
                        onChange={(e) => handleMediaFileChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />

                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-neutral-300 hover:border-neutral-950 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-white"
                      >
                        <Upload className="w-5 h-5 text-neutral-400 mx-auto mb-1.5" />
                        {selectedFile ? (
                          <div>
                            <p className="font-bold text-neutral-900 truncate text-[11px]">{selectedFile.name}</p>
                            <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                              {formatHeroBytes(selectedFile.size)} • {classifyClientFileCategory(selectedFile)}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-bold text-neutral-700">Choose desktop file</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              Pic ≤ 3MB • GIF ≤ 6MB • Video ≤ 15MB
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Laptop Frame Preview */}
                      {desktopPreviewUrl && (
                        <div className="rounded-xl bg-neutral-900 p-1.5 shadow-inner border border-neutral-800">
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-neutral-950 flex items-center justify-center">
                            {isSelectedVideo ? (
                              <video
                                src={desktopPreviewUrl}
                                poster={posterPreviewUrl || undefined}
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={desktopPreviewUrl}
                                alt="Desktop preview"
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="h-1.5 w-16 mx-auto mt-1 rounded-full bg-neutral-700" />
                        </div>
                      )}

                      {/* Desktop Size Health Warning */}
                      {selectedFile && (() => {
                        const cat = classifyClientFileCategory(selectedFile);
                        const health = getHeroSizeHealth(selectedFile.size, cat);
                        if (health === 'amber') {
                          return (
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <span>This file will load slowly. Recommended: {HERO_MEDIA_LIMITS[cat].recommendedLabel}.</span>
                            </div>
                          );
                        }
                        if (health === 'red') {
                          return (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <span>Exceeds {HERO_MEDIA_LIMITS[cat].maxLabel} limit for {HERO_MEDIA_LIMITS[cat].title.toLowerCase()}.</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Desktop Video Poster + Choose another frame */}
                      {isSelectedVideo && (
                        <div className="p-3 rounded-xl bg-white border border-neutral-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-neutral-800">Desktop Poster *</span>
                            <span className="text-[10px] text-neutral-500">
                              {customPosterFile ? 'Custom Image' : capturedPosterBlob ? 'WebP Auto-Poster' : 'Capturing...'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            {posterPreviewUrl ? (
                              <img
                                src={posterPreviewUrl}
                                alt="Desktop poster preview"
                                className="w-20 aspect-video rounded-lg object-cover border border-neutral-200 bg-neutral-900 shrink-0"
                              />
                            ) : (
                              <div className="w-20 aspect-video rounded-lg border border-dashed border-neutral-300 bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-400 shrink-0">
                                No Poster
                              </div>
                            )}
                            <div className="flex-1 space-y-1.5">
                              <label className="block text-[10px] text-neutral-600 font-medium">
                                Choose another frame ({desktopFrameSeekSec.toFixed(1)}s)
                              </label>
                              <input
                                type="range"
                                min="0.5"
                                max={Math.max(1, desktopVideoDuration)}
                                step="0.5"
                                value={desktopFrameSeekSec}
                                onChange={(e) => handleReCaptureDesktopFrame(parseFloat(e.target.value))}
                                className="w-full accent-neutral-950 cursor-pointer"
                              />
                              <input
                                type="file"
                                ref={posterInputRef}
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                onChange={(e) => {
                                  const p = e.target.files?.[0] || null;
                                  if (p) {
                                    setCustomPosterFile(p);
                                    setPosterPreviewUrl(URL.createObjectURL(p));
                                  }
                                }}
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() => posterInputRef.current?.click()}
                                className="px-2.5 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-[10px] font-bold cursor-pointer"
                              >
                                Upload Custom Poster
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mobile (optional) Upload Box */}
                    <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-neutral-700" />
                          Mobile (optional)
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">1080x1920 rec</span>
                      </div>

                      <input
                        type="file"
                        ref={mobileFileInputRef}
                        accept="video/mp4,video/webm,image/jpeg,image/png,image/webp,image/avif,image/gif"
                        onChange={(e) => handleMobileMediaFileChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />

                      <div
                        onClick={() => mobileFileInputRef.current?.click()}
                        className="border-2 border-dashed border-neutral-300 hover:border-neutral-950 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-white"
                      >
                        <Upload className="w-5 h-5 text-neutral-400 mx-auto mb-1.5" />
                        {selectedMobileFile ? (
                          <div>
                            <p className="font-bold text-neutral-900 truncate text-[11px]">{selectedMobileFile.name}</p>
                            <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                              {formatHeroBytes(selectedMobileFile.size)} • {classifyClientFileCategory(selectedMobileFile)}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-bold text-neutral-700">Choose mobile file</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              Optional 9:16 portrait for phones (&lt;768px)
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Phone Frame Preview */}
                      {mobilePreviewUrl && (
                        <div className="w-28 mx-auto rounded-2xl bg-neutral-900 p-1.5 shadow-inner border border-neutral-800">
                          <div className="aspect-[9/16] w-full rounded-xl overflow-hidden bg-neutral-950 flex items-center justify-center">
                            {classifyClientFileCategory(selectedMobileFile) === 'video' ? (
                              <video
                                src={mobilePreviewUrl}
                                poster={mobilePosterPreviewUrl || undefined}
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={mobilePreviewUrl}
                                alt="Mobile preview"
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Mobile Size Health Warning */}
                      {selectedMobileFile && (() => {
                        const cat = classifyClientFileCategory(selectedMobileFile);
                        const health = getHeroSizeHealth(selectedMobileFile.size, cat);
                        if (health === 'amber') {
                          return (
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <span>This file will load slowly. Recommended: {HERO_MEDIA_LIMITS[cat].recommendedLabel}.</span>
                            </div>
                          );
                        }
                        if (health === 'red') {
                          return (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <span>Exceeds {HERO_MEDIA_LIMITS[cat].maxLabel} limit for {HERO_MEDIA_LIMITS[cat].title.toLowerCase()}.</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Mobile Video Poster + Choose another frame */}
                      {selectedMobileFile && classifyClientFileCategory(selectedMobileFile) === 'video' && (
                        <div className="p-3 rounded-xl bg-white border border-neutral-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-neutral-800">Mobile Poster</span>
                            <span className="text-[10px] text-neutral-500">
                              {customMobilePosterFile ? 'Custom Image' : capturedMobilePosterBlob ? 'WebP Auto-Poster' : 'Capturing...'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            {mobilePosterPreviewUrl ? (
                              <img
                                src={mobilePosterPreviewUrl}
                                alt="Mobile poster preview"
                                className="w-12 aspect-[9/16] rounded-lg object-cover border border-neutral-200 bg-neutral-900 shrink-0"
                              />
                            ) : (
                              <div className="w-12 aspect-[9/16] rounded-lg border border-dashed border-neutral-300 bg-neutral-100 flex items-center justify-center text-[9px] text-neutral-400 shrink-0">
                                None
                              </div>
                            )}
                            <div className="flex-1 space-y-1.5">
                              <label className="block text-[10px] text-neutral-600 font-medium">
                                Choose another frame ({mobileFrameSeekSec.toFixed(1)}s)
                              </label>
                              <input
                                type="range"
                                min="0.5"
                                max={Math.max(1, mobileVideoDuration)}
                                step="0.5"
                                value={mobileFrameSeekSec}
                                onChange={(e) => handleReCaptureMobileFrame(parseFloat(e.target.value))}
                                className="w-full accent-neutral-950 cursor-pointer"
                              />
                              <input
                                type="file"
                                ref={mobilePosterInputRef}
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                onChange={(e) => {
                                  const p = e.target.files?.[0] || null;
                                  if (p) {
                                    setCustomMobilePosterFile(p);
                                    setMobilePosterPreviewUrl(URL.createObjectURL(p));
                                  }
                                }}
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() => mobilePosterInputRef.current?.click()}
                                className="px-2.5 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-[10px] font-bold cursor-pointer"
                              >
                                Upload Custom Poster
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GIF Tip */}
                  {((selectedFile && classifyClientFileCategory(selectedFile) === 'animated') ||
                    (selectedMobileFile && classifyClientFileCategory(selectedMobileFile) === 'animated')) && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>For smooth and fast results use a short MP4 instead of a GIF.</span>
                    </div>
                  )}

                  {/* Display seconds field for static images & GIFs */}
                  {selectedFile && !isSelectedVideo && (
                    <div>
                      <label className="font-bold text-neutral-800 block mb-1">
                        Display Duration (Seconds) *
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="15"
                        value={slideDuration}
                        onChange={(e) => setSlideDuration(Math.min(15, Math.max(3, parseInt(e.target.value) || 5)))}
                        className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none font-mono"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">
                        How long this image/GIF stays on screen before advancing (3 to 15 seconds, default: 5s).
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Method 2: Direct URL */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-neutral-800 block mb-1">
                        Laptop / Desktop Media URL *
                      </label>
                      <input
                        type="url"
                        placeholder="/uploads/homepage/hero_video.mp4"
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        className="w-full p-3 rounded-2xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none transition-colors font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-neutral-800 block mb-1">
                        Desktop Poster Image URL
                      </label>
                      <input
                        type="url"
                        placeholder="/uploads/homepage/hero_poster.webp"
                        value={thumbnailUrlInput}
                        onChange={(e) => setThumbnailUrlInput(e.target.value)}
                        className="w-full p-3 rounded-2xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none transition-colors font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-neutral-800 block mb-1">
                        Mobile Media URL (optional)
                      </label>
                      <input
                        type="url"
                        placeholder="/uploads/homepage/hero_mobile.mp4"
                        value={mobileUrlInput}
                        onChange={(e) => setMobileUrlInput(e.target.value)}
                        className="w-full p-3 rounded-2xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none transition-colors font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-neutral-800 block mb-1">
                        Mobile Poster Image URL (optional)
                      </label>
                      <input
                        type="url"
                        placeholder="/uploads/homepage/hero_mobile_poster.webp"
                        value={mobileThumbInput}
                        onChange={(e) => setMobileThumbInput(e.target.value)}
                        className="w-full p-3 rounded-2xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none transition-colors font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-neutral-800 block mb-1">
                      Display Duration (Seconds, for images/GIFs)
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="15"
                      value={slideDuration}
                      onChange={(e) => setSlideDuration(Math.min(15, Math.max(3, parseInt(e.target.value) || 5)))}
                      className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono"
                    />
                  </div>
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
                      <span>Uploading Media...</span>
                    </>
                  ) : (
                    <span>Add Hero Slide</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-extrabold text-neutral-950">Edit Hero Slide</h3>
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
                <label className="font-bold text-neutral-800 block mb-1">Slide Title</label>
                <input
                  type="text"
                  required
                  value={editingVideo.title}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-800 block mb-1">Media URL</label>
                <input
                  type="text"
                  required
                  value={editingVideo.url}
                  onChange={(e) => setEditingVideo({ ...editingVideo, url: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono text-[11px]"
                />
              </div>

              {/* Poster Image URL & Upload */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">Poster Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="/uploads/videos/poster.jpg"
                    value={editingVideo.thumbnailUrl || ''}
                    onChange={(e) => setEditingVideo({ ...editingVideo, thumbnailUrl: e.target.value })}
                    className="flex-1 p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono text-[11px]"
                  />
                  <input
                    type="file"
                    ref={editPosterInputRef}
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadEditPoster(f);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => editPosterInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs"
                    title="Upload poster image from disk"
                  >
                    Upload
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-800 block mb-1">Display Seconds (Images/GIFs: 3 to 15s)</label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  value={editingVideo.duration ?? 5}
                  onChange={(e) =>
                    setEditingVideo({
                      ...editingVideo,
                      duration: Math.min(15, Math.max(3, parseInt(e.target.value) || 5)),
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-800 block mb-1">Display Order #</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editingVideo.displayOrder ?? 1}
                  onChange={(e) =>
                    setEditingVideo({
                      ...editingVideo,
                      displayOrder: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-950 focus:outline-none font-mono text-xs"
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

      {/* PREVIEW MODAL */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-950 rounded-3xl max-w-2xl w-full p-4 border border-white/10 shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-white pb-2 border-b border-white/10">
              <span className="font-bold text-sm truncate">{previewVideo.title}</span>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              {getHeroMediaType(previewVideo.url, previewVideo.mimeType) === 'video' ? (
                <video
                  src={previewVideo.url}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={previewVideo.url}
                  alt={previewVideo.title}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-neutral-950">Delete Hero Slide?</h3>
              <p className="text-xs text-neutral-500">
                Are you sure you want to remove &quot;{deleteTarget.title}&quot; from the hero playlist?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-bold hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POSTER MODAL FOR EXISTING VIDEOS WITHOUT POSTER */}
      {createPosterTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-neutral-950">Create WebP Poster</h3>
                <p className="text-xs text-neutral-500 truncate max-w-[260px]">{createPosterTarget.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setCreatePosterTarget(null)}
                className="p-2 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200 flex items-center justify-center">
              {createPosterPreviewUrl ? (
                <img
                  src={createPosterPreviewUrl}
                  alt="Captured poster preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-white/60">Capturing WebP frame...</span>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 block">
                Choose another frame ({createPosterSeekSec.toFixed(1)}s)
              </label>
              <input
                type="range"
                min="0.5"
                max={Math.max(1, createPosterDuration)}
                step="0.5"
                value={createPosterSeekSec}
                onChange={async (e) => {
                  const sec = parseFloat(e.target.value);
                  setCreatePosterSeekSec(sec);
                  const res = await captureWebpPosterFromVideo(createPosterTarget.url, sec);
                  if (res) {
                    setCreatePosterBlob(res.blob);
                    setCreatePosterPreviewUrl(res.previewUrl);
                  }
                }}
                className="w-full accent-neutral-950 cursor-pointer"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreatePosterTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-bold text-xs hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!createPosterBlob || isUploading}
                onClick={handleSaveCreatedPoster}
                className="flex-1 py-2.5 rounded-xl bg-neutral-950 text-white font-bold text-xs hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
              >
                {isUploading ? 'Saving...' : 'Save WebP Poster'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
