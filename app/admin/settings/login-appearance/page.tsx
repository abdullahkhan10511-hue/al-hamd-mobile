'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Palette,
  Image as ImageIcon,
  Type,
  Layout,
  Sparkles,
  Save,
  RotateCcw,
  ExternalLink,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Monitor,
  Tablet,
  Smartphone,
  Plus,
  RefreshCw,
  X,
  Sliders,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerLoginView from '@/components/login/CustomerLoginView';
import {
  LoginPageSettings,
  LoginPageMediaItem,
  MediaTransitionType,
  DEFAULT_LOGIN_PAGE_SETTINGS,
  DEFAULT_LOGIN_PAGE_MEDIA,
  getLoginPageSettings,
  fetchLoginPageSettings,
  updateLoginPageSettings,
  getLoginPageMedia,
  fetchLoginPageMedia,
} from '@/lib/db/loginPage';

type EditorTab = 'branding' | 'media' | 'text' | 'colors' | 'layout';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface ToastNotice {
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function LoginAppearancePage() {
  const { admin } = useAdminAuth();

  // Loaded (saved) state vs Draft (live editing) state
  const [savedSettings, setSavedSettings] = useState<LoginPageSettings>(DEFAULT_LOGIN_PAGE_SETTINGS);
  const [savedMedia, setSavedMedia] = useState<LoginPageMediaItem[]>([]);

  const [draftSettings, setDraftSettings] = useState<LoginPageSettings>(DEFAULT_LOGIN_PAGE_SETTINGS);
  const [draftMedia, setDraftMedia] = useState<LoginPageMediaItem[]>([]);

  // Editor states
  const [activeTab, setActiveTab] = useState<EditorTab>('branding');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [toast, setToast] = useState<ToastNotice | null>(null);

  // Reset confirmation modal state
  const [showResetModal, setShowResetModal] = useState(false);

  // New Media URL quick-add input
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaTitle, setNewMediaTitle] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Load initial settings and media from server / local storage
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [settingsData, mediaData] = await Promise.all([
          fetchLoginPageSettings(),
          fetchLoginPageMedia(),
        ]);
        if (isMounted) {
          setSavedSettings(settingsData);
          setDraftSettings(settingsData);
          setSavedMedia(mediaData);
          setDraftMedia(mediaData);
        }
      } catch (err) {
        console.error('Failed to load login appearance:', err);
        if (isMounted) {
          const fallbackSettings = getLoginPageSettings();
          const fallbackMedia = getLoginPageMedia();
          setSavedSettings(fallbackSettings);
          setDraftSettings(fallbackSettings);
          setSavedMedia(fallbackMedia);
          setDraftMedia(fallbackMedia);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Determine if draft has unsaved changes
  const isDirty =
    JSON.stringify(draftSettings) !== JSON.stringify(savedSettings) ||
    JSON.stringify(draftMedia) !== JSON.stringify(savedMedia);

  // Update a field in draftSettings
  const updateDraft = (updates: Partial<LoginPageSettings>) => {
    setDraftSettings((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  // -------------------------------------------------------------
  // MEDIA MANAGEMENT FUNCTIONS
  // -------------------------------------------------------------

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isLogo = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (image max 10MB, video max 50MB)
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(`File too large. Maximum size is ${isVideo ? '50MB' : '10MB'}.`);
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', isVideo ? 'video' : 'image');

      const res = await fetch('/api/admin/login-page/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload media file');
      }

      if (isLogo) {
        updateDraft({ logoUrl: data.url, showLogo: true });
        showToast('success', 'Logo uploaded! It is now visible in the live preview.');
      } else {
        const nextOrder =
          draftMedia.length > 0 ? Math.max(...draftMedia.map((m) => m.displayOrder || 0)) + 1 : 1;

        const newItem: LoginPageMediaItem = {
          id: `login-media-${Date.now()}`,
          type: data.type || (isVideo ? 'video' : 'image'),
          url: data.url,
          title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          caption: 'Visual showcase',
          transition: 'default',
          isActive: true,
          displayOrder: nextOrder,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setDraftMedia((prev) => [...prev, newItem]);
        showToast('success', 'Media uploaded! It is now active in the live preview.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please try again.');
      showToast('error', err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddMediaUrl = () => {
    const trimmed = newMediaUrl.trim();
    if (!trimmed) {
      setUploadError('Please provide a valid media URL.');
      return;
    }

    const isVideo = newMediaType === 'video' || !!trimmed.match(/\.(mp4|webm|mov)(\?.*)?$/i);
    const nextOrder =
      draftMedia.length > 0 ? Math.max(...draftMedia.map((m) => m.displayOrder || 0)) + 1 : 1;

    const newItem: LoginPageMediaItem = {
      id: `login-media-${Date.now()}`,
      type: isVideo ? 'video' : 'image',
      url: trimmed,
      title: newMediaTitle.trim() || 'New Showcase Slide',
      caption: '',
      transition: 'default',
      isActive: true,
      displayOrder: nextOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDraftMedia((prev) => [...prev, newItem]);
    setNewMediaUrl('');
    setNewMediaTitle('');
    setUploadError('');
    showToast('success', 'Image added to preview! Click "Save Changes" to publish to customers.');
  };

  const handleDeleteMedia = (id: string) => {
    setDraftMedia((prev) => prev.filter((item) => item.id !== id));
    showToast('info', 'Image removed from preview. Click "Save Changes" to confirm.');
  };

  const handleToggleMediaActive = (id: string) => {
    setDraftMedia((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isActive: !item.isActive } : item))
    );
  };

  const handleMoveMedia = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= draftMedia.length) return;

    const newArr = [...draftMedia];
    const temp = newArr[index];
    newArr[index] = newArr[targetIndex];
    newArr[targetIndex] = temp;

    // Recalculate displayOrder
    const reindexed = newArr.map((item, idx) => ({
      ...item,
      displayOrder: idx + 1,
    }));

    setDraftMedia(reindexed);
  };

  const handleUpdateMediaItem = (id: string, updates: Partial<LoginPageMediaItem>) => {
    setDraftMedia((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // -------------------------------------------------------------
  // SAVE & RESET FUNCTIONS
  // -------------------------------------------------------------

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setUploadError('');

    try {
      // 1. Save Settings to server
      const settingsRes = await fetch('/api/admin/login-page/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftSettings),
      });

      if (!settingsRes.ok) {
        const errData = await settingsRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save login appearance settings');
      }

      // 2. Save Media list to server (sync action handles adds, updates, deletes)
      const mediaRes = await fetch('/api/admin/login-page/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          items: draftMedia,
        }),
      });

      if (!mediaRes.ok) {
        const errData = await mediaRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save login media list');
      }

      // 3. Update client-side storage cache & dispatch event
      await updateLoginPageSettings(draftSettings, admin?.email);
      setSavedSettings(draftSettings);
      setSavedMedia(draftMedia);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('alhamd:data-updated'));
      }

      showToast(
        'success',
        'Changes saved successfully! Customer login page has been updated.'
      );
    } catch (err: any) {
      console.error('Save error:', err);
      showToast('error', err.message || 'Changes could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmReset = () => {
    setDraftSettings(DEFAULT_LOGIN_PAGE_SETTINGS);
    setDraftMedia(DEFAULT_LOGIN_PAGE_MEDIA);
    setShowResetModal(false);
    showToast(
      'info',
      'Reset applied to preview. Click "Save Changes" to publish defaults to customer login page.'
    );
  };

  // Quick theme presets
  const applyPresetTheme = (preset: 'dark' | 'light' | 'midnight' | 'emerald') => {
    switch (preset) {
      case 'dark':
        updateDraft({
          pageBgColor: '#0a0a0a',
          cardBgColor: '#171717',
          headingColor: '#ffffff',
          textColor: '#a3a3a3',
          buttonBgColor: '#ffffff',
          buttonTextColor: '#0a0a0a',
          inputBgColor: '#262626',
          inputBorderColor: '#404040',
        });
        break;
      case 'light':
        updateDraft({
          pageBgColor: '#f4f4f5',
          cardBgColor: '#ffffff',
          headingColor: '#0a0a0a',
          textColor: '#737373',
          buttonBgColor: '#0a0a0a',
          buttonTextColor: '#ffffff',
          inputBgColor: '#fafafa',
          inputBorderColor: '#e5e5e5',
        });
        break;
      case 'midnight':
        updateDraft({
          pageBgColor: '#020617',
          cardBgColor: '#0f172a',
          headingColor: '#f8fafc',
          textColor: '#94a3b8',
          buttonBgColor: '#38bdf8',
          buttonTextColor: '#0f172a',
          inputBgColor: '#1e293b',
          inputBorderColor: '#334155',
        });
        break;
      case 'emerald':
        updateDraft({
          pageBgColor: '#064e3b',
          cardBgColor: '#022c22',
          headingColor: '#ecfdf5',
          textColor: '#6ee7b7',
          buttonBgColor: '#10b981',
          buttonTextColor: '#022c22',
          inputBgColor: '#064e3b',
          inputBorderColor: '#047857',
        });
        break;
    }
    showToast('info', `Applied ${preset.toUpperCase()} color preset to preview.`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-neutral-600">Loading Login Appearance editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-semibold border transition-all ${
            toast.type === 'success'
              ? 'bg-neutral-950 text-white border-neutral-800'
              : toast.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-800'
              : 'bg-neutral-900 text-neutral-200 border-neutral-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 hover:opacity-70 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Confirmation Modal for Reset to Default */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                Reset Login Appearance to default settings?
              </h3>
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                This will reset branding, images, colors, and text to default values in the editor and preview.
                The customer-facing login page will <strong>not</strong> change until you click{' '}
                <strong>Save Changes</strong>.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-colors cursor-pointer"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER & ACTION BAR */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Admin Portal
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-900">
                Login Appearance
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight mt-1">
              Login Appearance Management
            </h1>
            <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
              Customize the visual appearance, branding, image slider, colors, and text of the customer-facing login page. Changes reflect instantly in the live preview.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/login"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-colors cursor-pointer"
              title="Open current live customer login page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Live /login</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              id="save-login-appearance-button"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                isDirty
                  ? 'bg-neutral-950 hover:bg-neutral-800 ring-2 ring-neutral-900/30'
                  : 'bg-neutral-900 hover:bg-neutral-800'
              }`}
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* Unsaved Changes Banner */}
        {isDirty && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-semibold">
                You have unsaved changes. The live preview reflects your draft, but customers will only see changes after you click &quot;Save Changes&quot;.
              </span>
            </div>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="font-bold underline text-amber-900 hover:text-black cursor-pointer whitespace-nowrap"
            >
              Save Now
            </button>
          </div>
        )}
      </div>

      {/* SPLIT SCREEN LAYOUT: LEFT = SETTINGS / EDITOR, RIGHT = REAL LIVE PREVIEW */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ============================================================== */}
        {/* LEFT COLUMN: SETTINGS / EDITOR (5 COLS ON XL)                 */}
        {/* ============================================================== */}
        <div className="xl:col-span-5 space-y-4">
          {/* Navigation Tabs */}
          <div className="bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-sm flex flex-wrap items-center gap-1 text-xs select-none">
            <button
              type="button"
              id="tab-branding"
              onClick={() => setActiveTab('branding')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'branding'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Branding</span>
            </button>

            <button
              type="button"
              id="tab-media"
              onClick={() => setActiveTab('media')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'media'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Images</span>
            </button>

            <button
              type="button"
              id="tab-text"
              onClick={() => setActiveTab('text')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'text'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text</span>
            </button>

            <button
              type="button"
              id="tab-colors"
              onClick={() => setActiveTab('colors')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'colors'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Colors</span>
            </button>

            <button
              type="button"
              id="tab-layout"
              onClick={() => setActiveTab('layout')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'layout'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Layout</span>
            </button>
          </div>

          {/* TAB 1: BRANDING */}
          {activeTab === 'branding' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-5 text-xs">
              <div className="border-b border-neutral-100 pb-3">
                <h2 className="font-bold text-sm text-neutral-900">Brand Identity & Logo</h2>
                <p className="text-neutral-500 text-[11px] mt-0.5">
                  Control how the store brand and logo appear on the login card.
                </p>
              </div>

              {/* Show Logo Switch */}
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200/70">
                <div>
                  <span className="font-bold text-neutral-900 block">Show Brand Logo</span>
                  <span className="text-neutral-500 text-[11px]">Display store logo or brand emblem</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftSettings.showLogo}
                    onChange={(e) => updateDraft({ showLogo: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neutral-950"></div>
                </label>
              </div>

              {draftSettings.showLogo && (
                <div className="space-y-4 pt-2 border-t border-neutral-100">
                  <div>
                    <label className="font-bold text-neutral-800 block mb-1">Logo URL or Upload</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={draftSettings.logoUrl || ''}
                        onChange={(e) => updateDraft({ logoUrl: e.target.value })}
                        placeholder="https://... or upload below"
                        className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                      />
                      <input
                        type="file"
                        ref={logoInputRef}
                        onChange={(e) => handleFileUpload(e, true)}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 font-bold border border-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-neutral-800 block mb-1">Logo Display Size</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['sm', 'md', 'lg'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => updateDraft({ logoSize: sz })}
                          className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer ${
                            draftSettings.logoSize === sz
                              ? 'bg-neutral-950 text-white border-neutral-950'
                              : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                          }`}
                        >
                          {sz === 'sm' ? 'Small' : sz === 'md' ? 'Medium' : 'Large'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Brand Name */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">Brand Name</label>
                <input
                  type="text"
                  value={draftSettings.brandName || ''}
                  onChange={(e) => updateDraft({ brandName: e.target.value })}
                  placeholder="AL-HAMD MOBILE"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">Tagline</label>
                <input
                  type="text"
                  value={draftSettings.tagline || ''}
                  onChange={(e) => updateDraft({ tagline: e.target.value })}
                  placeholder="Premium Mobile Accessories"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                />
              </div>

              {/* Badge Text */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">Badge Text (Optional)</label>
                <input
                  type="text"
                  value={draftSettings.badgeText || ''}
                  onChange={(e) => updateDraft({ badgeText: e.target.value })}
                  placeholder="Official Customer Portal"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 2: IMAGES & MEDIA */}
          {activeTab === 'media' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-5 text-xs">
              <div className="border-b border-neutral-100 pb-3">
                <h2 className="font-bold text-sm text-neutral-900">Login Page Images & Media</h2>
                <p className="text-neutral-500 text-[11px] mt-0.5">
                  Upload, reorder, and manage imagery shown in the login visual showcase.
                </p>
              </div>

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload Image Button */}
              <div className="p-4 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200 text-center space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e, false)}
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-neutral-950 text-white flex items-center justify-center mx-auto shadow-sm">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-neutral-900 text-xs">Upload New Visual</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    PNG, JPG, WEBP, or MP4 video (Up to 10MB images, 50MB video)
                  </p>
                </div>
                <button
                  type="button"
                  id="upload-login-image-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Browse Computer'}
                </button>
              </div>

              {/* Add by URL input */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-2">
                <span className="font-bold text-neutral-800 block text-[11px]">Or Add by Direct Image / Video URL</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddMediaUrl}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-bold text-xs cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Media List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-900">
                    Active Media Slides ({draftMedia.length})
                  </span>
                  <span className="text-[11px] text-neutral-400">Drag/reorder priority</span>
                </div>

                {draftMedia.length === 0 ? (
                  <div className="p-6 bg-neutral-50 rounded-xl border border-neutral-200 text-center text-neutral-400 text-xs">
                    No images in showcase. Upload or add an image to preview.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {draftMedia.map((item, index) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${
                          item.isActive
                            ? 'bg-white border-neutral-200 shadow-sm'
                            : 'bg-neutral-50/80 border-neutral-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="w-14 h-14 rounded-lg bg-neutral-900 overflow-hidden relative shrink-0 border border-neutral-200">
                            {item.type === 'video' ? (
                              <video
                                src={item.url}
                                muted
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={item.url}
                                alt={item.title || 'Slide'}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/75 text-[9px] text-white font-mono uppercase">
                              {item.type}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) =>
                                handleUpdateMediaItem(item.id, { title: e.target.value })
                              }
                              placeholder="Slide Title"
                              className="font-bold text-neutral-900 text-xs w-full bg-transparent focus:outline-none focus:border-b border-neutral-300 truncate"
                            />
                            <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                              {item.url}
                            </p>
                          </div>

                          {/* Action Controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveMedia(index, 'up')}
                              disabled={index === 0}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveMedia(index, 'down')}
                              disabled={index === draftMedia.length - 1}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleMediaActive(item.id)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                item.isActive
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-neutral-400 hover:bg-neutral-200'
                              }`}
                              title={item.isActive ? 'Active (Click to hide)' : 'Inactive'}
                            >
                              {item.isActive ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              id={`delete-login-image-${index}`}
                              onClick={() => handleDeleteMedia(item.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete visual"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Showcase Animation & Transition Settings */}
              <div className="pt-3 border-t border-neutral-100 space-y-3">
                <span className="font-bold text-neutral-900 block">Slideshow & Animation Controls</span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Transition Effect
                    </label>
                    <select
                      value={draftSettings.defaultTransition}
                      onChange={(e) =>
                        updateDraft({ defaultTransition: e.target.value as MediaTransitionType })
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-200 text-xs bg-white font-medium"
                    >
                      <option value="zoom">Zoom In</option>
                      <option value="fade">Smooth Fade</option>
                      <option value="slide">Horizontal Slide</option>
                      <option value="crossfade">Crossfade Blur</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Slide Duration
                    </label>
                    <select
                      value={draftSettings.slideDuration}
                      onChange={(e) => updateDraft({ slideDuration: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-200 text-xs bg-white font-medium"
                    >
                      <option value={3000}>3 Seconds</option>
                      <option value={5000}>5 Seconds (Recommended)</option>
                      <option value={7000}>7 Seconds</option>
                      <option value={10000}>10 Seconds</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
                  <span className="text-neutral-700 font-medium">Auto-play Slideshow</span>
                  <input
                    type="checkbox"
                    checked={draftSettings.autoPlaySlideshow}
                    onChange={(e) => updateDraft({ autoPlaySlideshow: e.target.checked })}
                    className="w-4 h-4 rounded text-neutral-950"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEXT & CONTENT */}
          {activeTab === 'text' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4 text-xs">
              <div className="border-b border-neutral-100 pb-3">
                <h2 className="font-bold text-sm text-neutral-900">Customer Login Headings & Labels</h2>
                <p className="text-neutral-500 text-[11px] mt-0.5">
                  Change all customer-facing text, button labels, and descriptions in real time.
                </p>
              </div>

              {/* Main Heading */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">Main Heading</label>
                <input
                  type="text"
                  id="editor-main-heading"
                  value={draftSettings.mainHeading || ''}
                  onChange={(e) => updateDraft({ mainHeading: e.target.value })}
                  placeholder="Welcome to AL-HAMD"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">Subtitle / Description</label>
                <textarea
                  rows={2}
                  id="editor-subtitle"
                  value={draftSettings.subtitle || ''}
                  onChange={(e) => updateDraft({ subtitle: e.target.value })}
                  placeholder="Sign in to track orders, manage your wishlist..."
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs leading-relaxed"
                />
              </div>

              {/* Button Text */}
              <div>
                <label className="font-bold text-neutral-800 block mb-1">Sign In Button Text</label>
                <input
                  type="text"
                  id="editor-button-text"
                  value={draftSettings.buttonText || ''}
                  onChange={(e) => updateDraft({ buttonText: e.target.value })}
                  placeholder="Sign In"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                />
              </div>

              {/* Identifier Input Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Identifier Label</label>
                  <input
                    type="text"
                    value={draftSettings.identifierLabel || ''}
                    onChange={(e) => updateDraft({ identifierLabel: e.target.value })}
                    placeholder="Email Address or Shop Name"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Identifier Placeholder</label>
                  <input
                    type="text"
                    value={draftSettings.identifierPlaceholder || ''}
                    onChange={(e) => updateDraft({ identifierPlaceholder: e.target.value })}
                    placeholder="you@example.com or Shop Name"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                  />
                </div>
              </div>

              {/* Password & Forgot Password Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Password Field Label</label>
                  <input
                    type="text"
                    value={draftSettings.passwordLabel || ''}
                    onChange={(e) => updateDraft({ passwordLabel: e.target.value })}
                    placeholder="Password"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Forgot Password Link</label>
                  <input
                    type="text"
                    value={draftSettings.forgotPasswordText || ''}
                    onChange={(e) => updateDraft({ forgotPasswordText: e.target.value })}
                    placeholder="Forgot Password?"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                  />
                </div>
              </div>

              {/* Create Account Tab Texts */}
              <div className="pt-3 border-t border-neutral-100 space-y-3">
                <span className="font-bold text-neutral-900 block">Registration Tab Texts</span>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Create Account Heading</label>
                  <input
                    type="text"
                    value={draftSettings.createAccountHeading || ''}
                    onChange={(e) => updateDraft({ createAccountHeading: e.target.value })}
                    placeholder="Create Customer Account"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Create Account Button</label>
                  <input
                    type="text"
                    value={draftSettings.createAccountButtonText || ''}
                    onChange={(e) => updateDraft({ createAccountButtonText: e.target.value })}
                    placeholder="Create Account"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                  />
                </div>
              </div>

              {/* Footer Trust Notice */}
              <div className="pt-3 border-t border-neutral-100">
                <label className="font-bold text-neutral-800 block mb-1">Footer Notice</label>
                <input
                  type="text"
                  value={draftSettings.footerNotice || ''}
                  onChange={(e) => updateDraft({ footerNotice: e.target.value })}
                  placeholder="100% Genuine Certified Accessories • Nationwide Delivery"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 4: COLORS & THEME */}
          {activeTab === 'colors' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-5 text-xs">
              <div className="border-b border-neutral-100 pb-3">
                <h2 className="font-bold text-sm text-neutral-900">Color Palette & Theme</h2>
                <p className="text-neutral-500 text-[11px] mt-0.5">
                  Pick custom colors or select a pre-designed harmonious aesthetic preset.
                </p>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="font-bold text-neutral-800 block mb-2">1-Click Theme Presets</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPresetTheme('dark')}
                    className="p-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-white font-bold text-center hover:opacity-90 cursor-pointer shadow-sm"
                  >
                    Dark Slate
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTheme('light')}
                    className="p-2.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 font-bold text-center hover:bg-neutral-50 cursor-pointer shadow-sm"
                  >
                    Clean Light
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTheme('midnight')}
                    className="p-2.5 rounded-xl border border-blue-900 bg-slate-900 text-cyan-400 font-bold text-center hover:opacity-90 cursor-pointer shadow-sm"
                  >
                    Midnight Blue
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTheme('emerald')}
                    className="p-2.5 rounded-xl border border-emerald-800 bg-emerald-950 text-emerald-300 font-bold text-center hover:opacity-90 cursor-pointer shadow-sm"
                  >
                    Emerald Gold
                  </button>
                </div>
              </div>

              {/* Granular Color Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-neutral-100">
                {/* Page Background */}
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Page Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftSettings.pageBgColor || '#0a0a0a'}
                      onChange={(e) => updateDraft({ pageBgColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={draftSettings.pageBgColor || '#0a0a0a'}
                      onChange={(e) => updateDraft({ pageBgColor: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                {/* Card Background */}
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Card Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftSettings.cardBgColor || '#ffffff'}
                      onChange={(e) => updateDraft({ cardBgColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={draftSettings.cardBgColor || '#ffffff'}
                      onChange={(e) => updateDraft({ cardBgColor: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                {/* Heading Color */}
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Headings Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftSettings.headingColor || '#0a0a0a'}
                      onChange={(e) => updateDraft({ headingColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={draftSettings.headingColor || '#0a0a0a'}
                      onChange={(e) => updateDraft({ headingColor: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                {/* Text Color */}
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftSettings.textColor || '#737373'}
                      onChange={(e) => updateDraft({ textColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={draftSettings.textColor || '#737373'}
                      onChange={(e) => updateDraft({ textColor: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                {/* Button Background */}
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Button Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftSettings.buttonBgColor || '#0a0a0a'}
                      onChange={(e) => updateDraft({ buttonBgColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={draftSettings.buttonBgColor || '#0a0a0a'}
                      onChange={(e) => updateDraft({ buttonBgColor: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                {/* Button Text Color */}
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Button Text</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftSettings.buttonTextColor || '#ffffff'}
                      onChange={(e) => updateDraft({ buttonTextColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={draftSettings.buttonTextColor || '#ffffff'}
                      onChange={(e) => updateDraft({ buttonTextColor: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                {/* Input Background */}
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Input Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftSettings.inputBgColor || '#fafafa'}
                      onChange={(e) => updateDraft({ inputBgColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={draftSettings.inputBgColor || '#fafafa'}
                      onChange={(e) => updateDraft({ inputBgColor: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                {/* Input Border */}
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Input Border</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftSettings.inputBorderColor || '#e5e5e5'}
                      onChange={(e) => updateDraft({ inputBorderColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={draftSettings.inputBorderColor || '#e5e5e5'}
                      onChange={(e) => updateDraft({ inputBorderColor: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 font-mono text-xs uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LAYOUT & SIZING */}
          {activeTab === 'layout' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-5 text-xs">
              <div className="border-b border-neutral-100 pb-3">
                <h2 className="font-bold text-sm text-neutral-900">Layout, Geometry & Sizing</h2>
                <p className="text-neutral-500 text-[11px] mt-0.5">
                  Control visual structure, media positioning, and rounded corners.
                </p>
              </div>

              {/* Show Media Section Toggle */}
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200/70">
                <div>
                  <span className="font-bold text-neutral-900 block">Show Visual Media Section</span>
                  <span className="text-neutral-500 text-[11px]">
                    Display split-screen image slider next to the login form
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftSettings.showMediaSection}
                    onChange={(e) => updateDraft({ showMediaSection: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neutral-950"></div>
                </label>
              </div>

              {draftSettings.showMediaSection && (
                <>
                  {/* Media Position */}
                  <div>
                    <label className="font-bold text-neutral-800 block mb-1.5">
                      Media Showcase Position
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateDraft({ mediaPosition: 'left' })}
                        className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                          draftSettings.mediaPosition === 'left'
                            ? 'bg-neutral-950 text-white border-neutral-950'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        Left Side
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft({ mediaPosition: 'right' })}
                        className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                          draftSettings.mediaPosition === 'right'
                            ? 'bg-neutral-950 text-white border-neutral-950'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        Right Side
                      </button>
                    </div>
                  </div>

                  {/* Media Fit */}
                  <div>
                    <label className="font-bold text-neutral-800 block mb-1.5">
                      Image Scale / Fit Behavior
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateDraft({ mediaFit: 'cover' })}
                        className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                          draftSettings.mediaFit === 'cover'
                            ? 'bg-neutral-950 text-white border-neutral-950'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        Cover (Full Bleed)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft({ mediaFit: 'contain' })}
                        className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                          draftSettings.mediaFit === 'contain'
                            ? 'bg-neutral-950 text-white border-neutral-950'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        Contain (Keep Ratio)
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Corner Radius */}
              <div className="pt-2 border-t border-neutral-100">
                <label className="font-bold text-neutral-800 block mb-1.5">Card Corner Radius</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateDraft({ borderRadius: r })}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold uppercase transition-all cursor-pointer ${
                        draftSettings.borderRadius === r
                          ? 'bg-neutral-950 text-white border-neutral-950'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: REAL LIVE PREVIEW (7 COLS ON XL)                */}
        {/* ============================================================== */}
        <div className="xl:col-span-7 sticky top-6 space-y-3">
          {/* Preview Device Controls Toolbar */}
          <div className="bg-white px-4 py-2.5 rounded-2xl border border-neutral-200 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-xs text-neutral-900">Actual Customer Login Page Preview</span>
            </div>

            {/* Device Switcher */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
              <button
                type="button"
                id="preview-mode-desktop"
                onClick={() => setDeviceMode('desktop')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  deviceMode === 'desktop'
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Desktop View (100% width)"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </button>

              <button
                type="button"
                id="preview-mode-tablet"
                onClick={() => setDeviceMode('tablet')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  deviceMode === 'tablet'
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Tablet View (768px width)"
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tablet</span>
              </button>

              <button
                type="button"
                id="preview-mode-mobile"
                onClick={() => setDeviceMode('mobile')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  deviceMode === 'mobile'
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Mobile View (390px width)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>
          </div>

          {/* Interactive Live Preview Box */}
          <div className="bg-neutral-900/90 rounded-2xl p-2 sm:p-4 border border-neutral-800 shadow-xl overflow-x-auto min-h-[620px] flex items-center justify-center">
            <div
              className={`transition-all duration-300 w-full ${
                deviceMode === 'mobile'
                  ? 'max-w-[400px] border-4 border-neutral-700 rounded-[2.5rem] p-1.5 bg-neutral-950 shadow-2xl overflow-hidden'
                  : deviceMode === 'tablet'
                  ? 'max-w-[768px] border-2 border-neutral-700 rounded-2xl overflow-hidden'
                  : 'max-w-full'
              }`}
            >
              {/* Actual Customer Login Page Component with LIVE DRAFT Settings */}
              <CustomerLoginView
                settings={draftSettings}
                mediaItems={draftMedia}
                isPreview={true}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400 px-2">
            <span>Live render using current unsaved settings</span>
            <span>Customer page changes only after saving</span>
          </div>
        </div>
      </div>
    </div>
  );
}
