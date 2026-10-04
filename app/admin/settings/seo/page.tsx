'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Globe,
  Search,
  Sparkles,
  Save,
  Upload,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  ArrowLeft,
  Share2,
  Layers,
  Image as ImageIcon,
  Check,
  X,
  Loader2,
  Info,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { StoreSettings } from '@/types/admin';
import {
  getStoreSettings,
  updateStoreSettings,
  normalizeCanonicalUrl,
  syncStoreSettingsFromApi,
} from '@/lib/db/settings';

export default function AdminSeoSettingsPage() {
  const { admin: currentAdmin } = useAdminAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [siteName, setSiteName] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [searchEngineTitle, setSearchEngineTitle] = useState('');
  const [searchEngineDescription, setSearchEngineDescription] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');

  // Uploading states
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isUploadingOg, setIsUploadingOg] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // File input refs
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);
  const ogInputRef = useRef<HTMLInputElement | null>(null);

  // Load initial settings
  useEffect(() => {
    async function loadSettings() {
      // 1. Instant local load
      const initial = getStoreSettings();
      populateForm(initial);
      setSettings(initial);
      setIsLoading(false);

      // 2. Fresh server sync
      try {
        const fresh = await syncStoreSettingsFromApi();
        if (fresh) {
          populateForm(fresh);
          setSettings(fresh);
        }
      } catch (err) {
        console.warn('Failed to sync fresh store settings:', err);
      }
    }

    loadSettings();
  }, []);

  function populateForm(s: StoreSettings) {
    const rawSiteName = s.storeName || 'AL-HAMD MOBILE ACCESSORIES';
    const rawWebsiteTitle = s.websiteTitle || s.seo?.websiteTitle || s.seo?.metaTitle || `${rawSiteName} | Mobile Accessories in Pakistan`;
    const rawMetaDesc = s.seo?.metaDescription || 'Shop quality mobile accessories in Pakistan including phone cases, screen protectors, chargers, cables, power banks, earbuds and more.';
    
    // Stale seed/legacy default values
    const knownSeedTitles = [
      'AL-HAMD MOBILE ACCESSORIES | Premium Mobile Accessories in Pakistan',
      'AL-HAMD MOBILE ACCESSORIES | Mobile Accessories in Pakistan',
    ];

    const knownSeedDescriptions = [
      'Shop quality mobile accessories in Pakistan including phone cases, screen protectors, chargers, cables, power banks, earbuds and more.',
      'Find authentic chargers, cables, cases, and earbuds with express delivery across Pakistan.',
    ];

    // Only pre-fill override fields if they are explicitly different from primary title/description and not stale seed defaults
    const rawSearchTitle =
      s.seo?.searchEngineTitle &&
      s.seo.searchEngineTitle.trim() !== rawWebsiteTitle.trim() &&
      !knownSeedTitles.includes(s.seo.searchEngineTitle.trim())
        ? s.seo.searchEngineTitle.trim()
        : '';
    const rawSearchDesc =
      s.seo?.searchEngineDescription &&
      s.seo.searchEngineDescription.trim() !== rawMetaDesc.trim() &&
      !knownSeedDescriptions.includes(s.seo.searchEngineDescription.trim())
        ? s.seo.searchEngineDescription.trim()
        : '';
    const rawCanonical = s.canonicalUrl || s.seo?.canonicalUrl || 'https://alhamdshop.com';
    const rawLogo = s.logoUrl || s.seo?.logoUrl || '';
    const rawFavicon = s.faviconUrl || s.seo?.faviconUrl || '/favicon.ico';
    const rawOg = s.ogImageUrl || s.seo?.ogImageUrl || '';

    setSiteName(rawSiteName);
    setWebsiteTitle(rawWebsiteTitle);
    setMetaDescription(rawMetaDesc);
    setSearchEngineTitle(rawSearchTitle);
    setSearchEngineDescription(rawSearchDesc);
    setCanonicalUrl(rawCanonical);
    setLogoUrl(rawLogo);
    setFaviconUrl(rawFavicon);
    setOgImageUrl(rawOg);
  }

  // Generic Media Upload Handler reusing existing persistent media storage
  const handleFileUpload = async (
    file: File,
    type: 'logo' | 'favicon' | 'ogImage'
  ) => {
    setUploadError('');

    // Allowed extensions check
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.ico', '.svg'];
    const originalName = file.name || '';
    const ext = '.' + originalName.split('.').pop()?.toLowerCase();

    if (!allowedExts.includes(ext)) {
      setUploadError(`Unsupported format "${ext}". Allowed: PNG, JPG, JPEG, WEBP, ICO, SVG.`);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 5MB.`);
      return;
    }

    const setLoader =
      type === 'logo'
        ? setIsUploadingLogo
        : type === 'favicon'
        ? setIsUploadingFavicon
        : setIsUploadingOg;

    try {
      setLoader(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/admin/settings/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || `Failed to upload ${type}.`);
      }

      if (type === 'logo') {
        setLogoUrl(data.url);
      } else if (type === 'favicon') {
        setFaviconUrl(data.url);
      } else if (type === 'ogImage') {
        setOgImageUrl(data.url);
      }

      setSaveMessage(`${type === 'logo' ? 'Website Logo' : type === 'favicon' ? 'Favicon' : 'Social Share Image'} uploaded to persistent storage.`);
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err: any) {
      setUploadError(err?.message || `Error uploading ${type}.`);
    } finally {
      setLoader(false);
    }
  };

  // Save changes to database and server
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    setSaveMessage('');
    setErrorMessage('');

    try {
      const normalizedCanonical = normalizeCanonicalUrl(canonicalUrl);

      const cleanSiteName = siteName.trim() || 'AL-HAMD MOBILE ACCESSORIES';
      const cleanWebsiteTitle = websiteTitle.trim();
      const cleanMetaDescription = metaDescription.trim();

      // If override is left blank, intentionally default to primary title / description so no stale overrides linger
      const effectiveSearchTitle = searchEngineTitle.trim() ? searchEngineTitle.trim() : cleanWebsiteTitle;
      const effectiveSearchDesc = searchEngineDescription.trim() ? searchEngineDescription.trim() : cleanMetaDescription;

      const updatedSettings: StoreSettings = {
        ...settings,
        storeName: cleanSiteName,
        websiteTitle: cleanWebsiteTitle,
        canonicalUrl: normalizedCanonical,
        logoUrl: logoUrl.trim(),
        faviconUrl: faviconUrl.trim() || '/favicon.ico',
        ogImageUrl: ogImageUrl.trim(),
        seo: {
          ...settings.seo,
          metaTitle: cleanWebsiteTitle,
          metaDescription: cleanMetaDescription,
          websiteTitle: cleanWebsiteTitle,
          searchEngineTitle: effectiveSearchTitle,
          searchEngineDescription: effectiveSearchDesc,
          canonicalUrl: normalizedCanonical,
          logoUrl: logoUrl.trim(),
          faviconUrl: faviconUrl.trim() || '/favicon.ico',
          ogImageUrl: ogImageUrl.trim(),
        },
      };

      // 1. Update local storage and dispatch update event
      const saved = await updateStoreSettings(updatedSettings, currentAdmin?.email || 'admin@alhamd.com');
      setSettings(saved);

      // 2. Direct server verification
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saved),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server error while saving settings.');
      }

      setSaveMessage('SEO and Website Branding settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Computed Live Previews
  const previewSearchTitle = useMemo(() => {
    return (searchEngineTitle.trim() || websiteTitle.trim() || siteName.trim() || 'AL-HAMD MOBILE ACCESSORIES | Mobile Accessories in Pakistan');
  }, [searchEngineTitle, websiteTitle, siteName]);

  const previewSearchDesc = useMemo(() => {
    return (searchEngineDescription.trim() || metaDescription.trim() || 'Shop quality mobile accessories in Pakistan including phone cases, screen protectors, chargers, cables, power banks, earbuds and more.');
  }, [searchEngineDescription, metaDescription]);

  const previewCanonical = useMemo(() => {
    return normalizeCanonicalUrl(canonicalUrl || 'https://alhamdshop.com');
  }, [canonicalUrl]);

  const previewDomain = useMemo(() => {
    try {
      const url = new URL(previewCanonical);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return 'alhamdshop.com';
    }
  }, [previewCanonical]);

  const previewFavicon = useMemo(() => {
    return faviconUrl.trim() || '/favicon.ico';
  }, [faviconUrl]);

  const previewOgImage = useMemo(() => {
    return ogImageUrl.trim() || 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop';
  }, [ogImageUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-neutral-500">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-900" />
          <span className="text-sm font-medium">Loading SEO &amp; Website Settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <Link href="/admin" className="hover:text-neutral-900 transition-colors">Admin</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/admin/settings" className="hover:text-neutral-900 transition-colors">Settings</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-neutral-900 font-semibold">SEO &amp; Website Settings</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2.5">
            <Globe className="w-6 h-6 text-neutral-800" />
            SEO &amp; Website Branding Settings
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Configure global website metadata, search engine snippet appearance, logos, favicon, and social graph cards.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-600 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Store Settings
          </Link>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{saveMessage}</span>
          <button
            type="button"
            onClick={() => setSaveMessage('')}
            className="ml-auto text-emerald-500 hover:text-emerald-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="ml-auto text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError('')}
            className="ml-auto text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={logoInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.svg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, 'logo');
          if (e.target) e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={faviconInputRef}
        type="file"
        accept=".ico,.png,.svg,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, 'favicon');
          if (e.target) e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={ogInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, 'ogImage');
          if (e.target) e.target.value = '';
        }}
        className="hidden"
      />

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: EDITABLE SETTINGS FORM                      */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-6">
          {/* SECTION 1: SEO SETTINGS */}
          <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
              <Search className="w-5 h-5 text-neutral-800" />
              <div>
                <h2 className="text-base font-bold text-neutral-900">SEO Settings</h2>
                <p className="text-xs text-neutral-500">
                  Primary titles, meta tags, and URL settings crawled by Google, Bing, and web browsers.
                </p>
              </div>
            </div>

            {/* A. Website / Browser Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-800">
                  Website / Browser Title <span className="text-rose-500">*</span>
                </label>
                <span className={`text-[11px] font-mono ${websiteTitle.length > 70 ? 'text-amber-600 font-bold' : 'text-neutral-400'}`}>
                  {websiteTitle.length} chars
                </span>
              </div>
              <input
                type="text"
                value={websiteTitle}
                onChange={(e) => setWebsiteTitle(e.target.value)}
                placeholder="AL-HAMD MOBILE ACCESSORIES | Mobile Accessories in Pakistan"
                className="w-full px-3.5 py-2.5 bg-neutral-50/70 border border-neutral-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all font-normal text-neutral-900 placeholder:text-neutral-400"
              />
              <p className="text-[11px] text-neutral-500">
                Controls the browser tab title and the site's primary SEO fallback title. Recommended: 50–65 characters.
              </p>
            </div>

            {/* C. Site Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800">
                Site Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="AL-HAMD MOBILE ACCESSORIES"
                className="w-full px-3.5 py-2.5 bg-neutral-50/70 border border-neutral-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all font-normal text-neutral-900 placeholder:text-neutral-400"
              />
              <p className="text-[11px] text-neutral-500">
                The official brand name used across header navigation, schema markup, and social share metadata.
              </p>
            </div>

            {/* B. Meta Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-800">
                  Meta Description <span className="text-rose-500">*</span>
                </label>
                <span className={`text-[11px] font-mono ${metaDescription.length > 160 ? 'text-amber-600 font-bold' : 'text-neutral-400'}`}>
                  {metaDescription.length} / 160 chars
                </span>
              </div>
              <textarea
                rows={3}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Shop quality mobile accessories in Pakistan including phone cases, screen protectors, chargers, cables, power banks, earbuds and more."
                className="w-full px-3.5 py-2.5 bg-neutral-50/70 border border-neutral-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all font-normal text-neutral-900 placeholder:text-neutral-400 resize-y"
              />
              <p className="text-[11px] text-neutral-500">
                General meta description explaining your store. Recommended: 130–160 characters.
              </p>
            </div>

            {/* D. Search Engine Title (Override) */}
            <div className="space-y-1.5 pt-2 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                  Search Engine Title (Override)
                  <span className="text-[10px] font-normal text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">Optional</span>
                </label>
                <div className="flex items-center gap-2">
                  {searchEngineTitle.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchEngineTitle('')}
                      className="text-[11px] text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                    >
                      Clear override
                    </button>
                  )}
                  <span className={`text-[11px] font-mono ${searchEngineTitle.length > 70 ? 'text-amber-600 font-bold' : 'text-neutral-400'}`}>
                    {searchEngineTitle.length} chars
                  </span>
                </div>
              </div>
              <input
                type="text"
                value={searchEngineTitle}
                onChange={(e) => setSearchEngineTitle(e.target.value)}
                placeholder={websiteTitle || 'Defaults to Website / Browser Title if empty'}
                className="w-full px-3.5 py-2.5 bg-neutral-50/70 border border-neutral-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all font-normal text-neutral-900 placeholder:text-neutral-400"
              />
              <p className="text-[11px] text-neutral-500">
                Custom title explicitly crafted for Google/Bing search snippets. If left blank, safely falls back to <strong className="text-neutral-700">Website / Browser Title</strong>.
              </p>
            </div>

            {/* E. Search Engine Description (Override) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                  Search Engine Description (Override)
                  <span className="text-[10px] font-normal text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">Optional</span>
                </label>
                <div className="flex items-center gap-2">
                  {searchEngineDescription.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchEngineDescription('')}
                      className="text-[11px] text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                    >
                      Clear override
                    </button>
                  )}
                  <span className={`text-[11px] font-mono ${searchEngineDescription.length > 160 ? 'text-amber-600 font-bold' : 'text-neutral-400'}`}>
                    {searchEngineDescription.length} / 160 chars
                  </span>
                </div>
              </div>
              <textarea
                rows={2}
                value={searchEngineDescription}
                onChange={(e) => setSearchEngineDescription(e.target.value)}
                placeholder={metaDescription || 'Defaults to Meta Description if empty'}
                className="w-full px-3.5 py-2.5 bg-neutral-50/70 border border-neutral-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all font-normal text-neutral-900 placeholder:text-neutral-400 resize-y"
              />
              <p className="text-[11px] text-neutral-500">
                Search-engine specific snippet description. If left blank, safely falls back to <strong className="text-neutral-700">Meta Description</strong>.
              </p>
            </div>

            {/* F. Canonical Website URL */}
            <div className="space-y-1.5 pt-2 border-t border-neutral-100">
              <label className="text-xs font-semibold text-neutral-800">
                Canonical Website URL
              </label>
              <input
                type="text"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder="https://alhamdshop.com"
                className="w-full px-3.5 py-2.5 bg-neutral-50/70 border border-neutral-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all font-normal text-neutral-900 placeholder:text-neutral-400"
              />
              <p className="text-[11px] text-neutral-500">
                Your production domain name (e.g. <code className="bg-neutral-100 px-1 rounded text-neutral-700">https://alhamdshop.com</code>). Automatically normalized to remove trailing slashes.
              </p>
            </div>
          </div>

          {/* SECTION 2: WEBSITE BRANDING */}
          <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
              <Layers className="w-5 h-5 text-neutral-800" />
              <div>
                <h2 className="text-base font-bold text-neutral-900">Website Branding</h2>
                <p className="text-xs text-neutral-500">
                  Upload and manage your store logo, browser favicon, and social share image using persistent storage.
                </p>
              </div>
            </div>

            {/* 1. WEBSITE LOGO */}
            <div className="p-4 bg-neutral-50/60 rounded-xl border border-neutral-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Website Logo</h3>
                  <p className="text-[11px] text-neutral-500">
                    Appears in header, footer, customer login portal, and invoice printouts.
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${logoUrl ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' : 'bg-neutral-200/70 text-neutral-600'}`}>
                  {logoUrl ? 'Active Logo' : 'Text Fallback'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                {/* Logo Preview Container */}
                <div className="w-32 h-16 sm:w-40 sm:h-20 bg-white rounded-xl border border-neutral-200 flex items-center justify-center p-2 overflow-hidden shadow-2xs shrink-0">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Website Logo Preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-neutral-400 text-center">
                      <ImageIcon className="w-5 h-5 stroke-1 mb-0.5" />
                      <span className="text-[10px] font-semibold">No Logo</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          {logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </>
                      )}
                    </button>

                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        disabled={isUploadingLogo}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate">
                    {logoUrl ? logoUrl : 'Using clean brand text in header.'}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. FAVICON */}
            <div className="p-4 bg-neutral-50/60 rounded-xl border border-neutral-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Browser Favicon</h3>
                  <p className="text-[11px] text-neutral-500">
                    Displayed in browser tabs, bookmarks, and search results. Square format (.ico, .png, .svg).
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${faviconUrl && faviconUrl !== '/favicon.ico' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' : 'bg-neutral-200/70 text-neutral-600'}`}>
                  {faviconUrl && faviconUrl !== '/favicon.ico' ? 'Custom Favicon' : 'System Default'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                {/* Favicon Previews */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-12 h-12 bg-white rounded-xl border border-neutral-200 flex items-center justify-center p-2 shadow-2xs">
                    <img
                      src={faviconUrl || '/favicon.ico'}
                      alt="Favicon"
                      className="w-7 h-7 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  {/* Browser Tab Simulation */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 border border-neutral-200/80 rounded-lg text-[11px] text-neutral-700 font-medium max-w-[180px] truncate shadow-2xs">
                    <img
                      src={faviconUrl || '/favicon.ico'}
                      alt="Tab Icon"
                      className="w-3.5 h-3.5 object-contain shrink-0"
                    />
                    <span className="truncate">{siteName}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => faviconInputRef.current?.click()}
                      disabled={isUploadingFavicon}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingFavicon ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          {faviconUrl && faviconUrl !== '/favicon.ico' ? 'Change Favicon' : 'Upload Favicon'}
                        </>
                      )}
                    </button>

                    {faviconUrl && faviconUrl !== '/favicon.ico' && (
                      <button
                        type="button"
                        onClick={() => setFaviconUrl('/favicon.ico')}
                        disabled={isUploadingFavicon}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset Default
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate">
                    {faviconUrl || '/favicon.ico'}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. SOCIAL SHARE IMAGE (OG IMAGE) */}
            <div className="p-4 bg-neutral-50/60 rounded-xl border border-neutral-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Social Share Image (OG Image)</h3>
                  <p className="text-[11px] text-neutral-500">
                    Image shown when your website link is shared on WhatsApp, Facebook, X (Twitter), and LinkedIn. Recommended: 1200 × 630 pixels.
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ogImageUrl ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' : 'bg-neutral-200/70 text-neutral-600'}`}>
                  {ogImageUrl ? 'Custom OG Image' : 'Default Banner'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                {/* OG Image Preview */}
                <div className="w-32 h-18 sm:w-40 sm:h-22 bg-neutral-900 rounded-xl overflow-hidden border border-neutral-200 relative shrink-0 shadow-2xs">
                  <img
                    src={previewOgImage}
                    alt="Social Share Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                    <Share2 className="w-4 h-4 text-white/80" />
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => ogInputRef.current?.click()}
                      disabled={isUploadingOg}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingOg ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          {ogImageUrl ? 'Change OG Image' : 'Upload OG Image'}
                        </>
                      )}
                    </button>

                    {ogImageUrl && (
                      <button
                        type="button"
                        onClick={() => setOgImageUrl('')}
                        disabled={isUploadingOg}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Reset Default
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate">
                    {ogImageUrl || 'Using default high-resolution mobile accessory banner.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Save Trigger */}
            <div className="pt-3 border-t border-neutral-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: REALISTIC LIVE PREVIEWS                    */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-6 lg:sticky lg:top-20">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-neutral-700" />
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                Live Dynamic Previews
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Synced
            </span>
          </div>

          {/* 1. GOOGLE SEARCH PREVIEW */}
          <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-neutral-50/80 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-neutral-800">Google Search Result Preview</span>
              </div>
              <span className="text-[10px] text-neutral-400 font-medium">Desktop Snippet</span>
            </div>

            <div className="p-5 space-y-2">
              {/* Site URL & Favicon Row */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={previewFavicon}
                    alt="Google Favicon"
                    className="w-4 h-4 object-contain"
                  />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-xs font-medium text-neutral-800 truncate">
                    {siteName || 'AL-HAMD MOBILE ACCESSORIES'}
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate font-mono">
                    {previewCanonical}
                  </div>
                </div>
              </div>

              {/* Search Title Link */}
              <h3 className="text-base sm:text-lg font-medium text-[#1a0dab] hover:underline cursor-pointer leading-snug break-words">
                {previewSearchTitle}
              </h3>

              {/* Description Snippet */}
              <p className="text-xs text-[#4d5156] leading-relaxed break-words line-clamp-3">
                {previewSearchDesc}
              </p>

              {/* Informational Crawling Notice */}
              <div className="pt-3 mt-3 border-t border-neutral-100 flex items-start gap-2 text-[11px] text-neutral-500 leading-normal bg-neutral-50/80 -mx-5 -mb-5 p-3 rounded-b-2xl">
                <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                <span>
                  Search engines may take time to update title and description after changes are saved and crawled.
                </span>
              </div>
            </div>
          </div>

          {/* 2. WEBSITE HEADER PREVIEW */}
          <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-neutral-50/80 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-neutral-700" />
                <span className="text-xs font-bold text-neutral-800">Website Header Preview</span>
              </div>
              <span className="text-[10px] text-neutral-400 font-medium">Customer View</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Simulated Browser Bar */}
              <div className="bg-neutral-100/80 rounded-xl p-2.5 flex items-center gap-2 border border-neutral-200/70">
                <div className="flex items-center gap-1.5 shrink-0 px-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                </div>
                <div className="flex-1 bg-white px-3 py-1 rounded-lg border border-neutral-200 text-[11px] text-neutral-600 flex items-center gap-1.5 truncate shadow-2xs">
                  <span className="text-emerald-600 font-bold">🔒</span>
                  <span className="truncate">{previewCanonical}</span>
                </div>
              </div>

              {/* Header Navbar Simulation */}
              <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-xs flex items-center justify-between gap-4">
                {/* Brand */}
                <div className="flex items-center gap-2.5 shrink-0">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={siteName}
                      className="h-7 sm:h-8 w-auto max-w-[120px] object-contain shrink-0"
                    />
                  ) : null}
                  <span className="font-bold text-xs sm:text-sm tracking-tight text-neutral-900 uppercase">
                    {siteName || 'AL-HAMD MOBILE'}
                  </span>
                </div>

                {/* Mock Navigation links */}
                <div className="hidden sm:flex items-center gap-3 text-[11px] font-medium text-neutral-600">
                  <span className="text-neutral-900 font-bold">Home</span>
                  <span>Products</span>
                  <span>Categories</span>
                  <span>Deals</span>
                </div>

                {/* Mock Search / Cart */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 text-[10px]">
                    🔍
                  </div>
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px]">
                    🛒
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. SOCIAL SHARE (OPEN GRAPH) PREVIEW */}
          <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-neutral-50/80 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-neutral-800">Social Share / OG Card Preview</span>
              </div>
              <span className="text-[10px] text-neutral-400 font-medium">WhatsApp / Facebook / X</span>
            </div>

            <div className="p-4">
              {/* Card Container */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50 shadow-xs max-w-md mx-auto">
                {/* 1200x630 ratio image preview */}
                <div className="w-full aspect-[1.91/1] bg-neutral-900 relative overflow-hidden">
                  <img
                    src={previewOgImage}
                    alt="Open Graph Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[9px] font-semibold uppercase rounded-md tracking-wider">
                    og:image
                  </div>
                </div>

                {/* Card Text Content */}
                <div className="p-3 bg-white space-y-1">
                  <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                    {previewDomain}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-neutral-900 leading-snug line-clamp-2">
                    {previewSearchTitle}
                  </h4>
                  <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                    {previewSearchDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
