'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnnouncementItem, NavigationItem, StoreSettings } from '@/types/admin';
import {
  getAnnouncements,
  updateAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '@/lib/db/announcements';
import {
  getNavigation,
  updateNavigation,
  createNavigationItem,
  deleteNavigationItem,
} from '@/lib/db/navigation';
import { getStoreSettings, updateStoreSettings, syncStoreSettingsFromApi } from '@/lib/db/settings';
import { uploadImage, getMediaItems, MediaItem } from '@/lib/db/media';
import {
  Compass,
  Megaphone,
  Plus,
  Trash2,
  Edit2,
  MoveUp,
  MoveDown,
  Eye,
  EyeOff,
  CheckCircle,
  Save,
  Layers,
  Settings,
  Upload,
  Image as ImageIcon,
  Search,
  RotateCcw,
  FolderOpen,
} from 'lucide-react';

export default function AdminNavigationPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'announcements' | 'header' | 'settings'>('announcements');
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [navItems, setNavItems] = useState<NavigationItem[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [initialStoreSettings, setInitialStoreSettings] = useState<StoreSettings | null>(null);

  // Logo upload state & ref & gallery picker state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Announcement Modal/Editor State
  const [editingAnn, setEditingAnn] = useState<Partial<AnnouncementItem> | null>(null);

  // Nav Item Modal/Editor State
  const [editingNav, setEditingNav] = useState<Partial<NavigationItem> | null>(null);

  const [message, setMessage] = useState('');

  const loadData = () => {
    setAnnouncements(getAnnouncements());
    setNavItems(getNavigation());
    const current = getStoreSettings();
    setStoreSettings(current);
    setInitialStoreSettings((prev) => prev || current);
  };

  useEffect(() => {
    loadData();

    syncStoreSettingsFromApi().then((fresh) => {
      if (fresh) {
        setStoreSettings(fresh);
        setInitialStoreSettings(fresh);
      }
    }).catch(() => {});

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const notify = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // ANNOUNCEMENTS HANDLERS
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnn?.text) return;

    if (editingAnn.id) {
      const updated = announcements.map((a) =>
        a.id === editingAnn.id ? ({ ...a, ...editingAnn } as AnnouncementItem) : a
      );
      await updateAnnouncements(updated);
      notify('Announcement updated successfully');
    } else {
      await createAnnouncement({
        text: editingAnn.text,
        link: editingAnn.link || '',
        linkText: editingAnn.linkText || 'Shop Now',
        active: editingAnn.active ?? true,
        displayOrder: editingAnn.displayOrder || announcements.length + 1,
      });
      notify('New announcement created');
    }

    setEditingAnn(null);
    loadData();
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await deleteAnnouncement(id);
    loadData();
    notify('Announcement removed');
  };

  const handleToggleAnnActive = async (id: string) => {
    const updated = announcements.map((a) => (a.id === id ? { ...a, active: !a.active } : a));
    await updateAnnouncements(updated);
    loadData();
  };

  const handleMoveAnnouncement = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= announcements.length) return;

    const copy = [...announcements];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    copy.forEach((item, i) => (item.displayOrder = i + 1));
    await updateAnnouncements(copy);
    loadData();
  };

  // NAVIGATION HANDLERS
  const handleSaveNav = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNav?.label || !editingNav?.href) return;

    if (editingNav.id) {
      const updated = navItems.map((n) =>
        n.id === editingNav.id ? ({ ...n, ...editingNav } as NavigationItem) : n
      );
      await updateNavigation(updated);
      notify('Menu item updated');
    } else {
      await createNavigationItem({
        label: editingNav.label,
        href: editingNav.href,
        visible: editingNav.visible ?? true,
        displayOrder: editingNav.displayOrder || navItems.length + 1,
      });
      notify('Menu item added');
    }

    setEditingNav(null);
    loadData();
  };

  const handleDeleteNav = async (id: string) => {
    if (!confirm('Delete this menu item?')) return;
    await deleteNavigationItem(id);
    loadData();
    notify('Menu item removed');
  };

  const handleToggleNavVisible = async (id: string) => {
    const updated = navItems.map((n) => (n.id === id ? { ...n, visible: !n.visible } : n));
    await updateNavigation(updated);
    loadData();
  };

  const handleMoveNav = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= navItems.length) return;

    const copy = [...navItems];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    copy.forEach((item, i) => (item.displayOrder = i + 1));
    await updateNavigation(copy);
    loadData();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type) && !/\.(jpe?g|png|webp|svg|ico)$/i.test(file.name)) {
      alert('Please upload a valid image file (JPG, JPEG, PNG, WEBP, or SVG).');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const url = await uploadImage(file, 'branding');
      if (storeSettings) {
        // Data safety: preserve existing storeName and preview the new logo
        const updated: StoreSettings = {
          ...storeSettings,
          logoUrl: url,
        };
        setStoreSettings(updated);
        notify('Store logo uploaded & preview active. Click "Save Header Identity" to commit changes.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to upload logo image. Please try again.');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    if (!storeSettings) return;
    const updated: StoreSettings = {
      ...storeSettings,
      logoUrl: '',
    };
    setStoreSettings(updated);
    notify('Header logo removed from preview. Click "Save Header Identity" to commit changes.');
  };

  const handleResetSettings = () => {
    if (initialStoreSettings) {
      setStoreSettings(initialStoreSettings);
      notify('Header Identity reverted to last saved state.');
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeSettings) return;
    try {
      const saved = await updateStoreSettings(storeSettings);
      setStoreSettings(saved);
      setInitialStoreSettings(saved);
      notify('Header brand settings saved successfully');
      router.refresh();
    } catch (err: any) {
      console.error('Failed to save header settings:', err);
      alert('Failed to save header brand settings. Please try again.');
    }
  };

  const hasUnsavedChanges = Boolean(
    initialStoreSettings && storeSettings && (
      storeSettings.storeName !== initialStoreSettings.storeName ||
      storeSettings.logoUrl !== initialStoreSettings.logoUrl ||
      storeSettings.storeTagline !== initialStoreSettings.storeTagline
    )
  );

  const galleryItems = getMediaItems();
  const filteredGalleryItems = galleryItems.filter((m) =>
    !mediaSearchQuery.trim() || m.name.toLowerCase().includes(mediaSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Navigation & Announcement Center</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Control the top announcement marquee, main navigation links, and header brand identity
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-neutral-200/80 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'announcements'
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Top Announcements ({announcements.length})
          </button>
          <button
            onClick={() => setActiveTab('header')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'header'
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Header Menu ({navItems.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Header Identity
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* ======================= TAB 1: TOP ANNOUNCEMENTS ======================= */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <span className="text-xs text-neutral-500">
              Announcements display at the very top of store pages (removed from the video-first homepage for a clean, premium viewport).
            </span>
            <button
              onClick={() =>
                setEditingAnn({
                  text: '',
                  link: '/shop',
                  linkText: 'Shop Now',
                  active: true,
                  displayOrder: announcements.length + 1,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Announcement
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-neutral-100">
              {announcements.map((item, index) => (
                <div
                  key={item.id}
                  className="p-4 flex items-center justify-between hover:bg-neutral-50/70 transition-colors gap-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveAnnouncement(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-neutral-200 rounded disabled:opacity-20 cursor-pointer"
                      >
                        <MoveUp className="w-3 h-3 text-neutral-600" />
                      </button>
                      <button
                        onClick={() => handleMoveAnnouncement(index, 'down')}
                        disabled={index === announcements.length - 1}
                        className="p-1 hover:bg-neutral-200 rounded disabled:opacity-20 cursor-pointer"
                      >
                        <MoveDown className="w-3 h-3 text-neutral-600" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-900 truncate">
                          "{item.text}"
                        </span>
                        <button
                          onClick={() => handleToggleAnnActive(item.id)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
                            item.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                          }`}
                        >
                          {item.active ? (
                            <>
                              <Eye className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" /> Disabled
                            </>
                          )}
                        </button>
                      </div>

                      {item.link && (
                        <p className="text-[11px] text-neutral-500 mt-0.5 font-mono">
                          Link: <span className="text-neutral-700">{item.link}</span> ({item.linkText})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingAnn(item)}
                      className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(item.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: HEADER MENU ======================= */}
      {activeTab === 'header' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <span className="text-xs text-neutral-500">
              Customize the customer-facing navigation links. Reorder items, hide seasonal pages, or link to external catalogs.
            </span>
            <button
              onClick={() =>
                setEditingNav({
                  label: '',
                  href: '/',
                  visible: true,
                  displayOrder: navItems.length + 1,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Menu Link
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-neutral-100">
              {navItems.map((item, index) => (
                <div
                  key={item.id}
                  className="p-4 flex items-center justify-between hover:bg-neutral-50/70 transition-colors gap-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveNav(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-neutral-200 rounded disabled:opacity-20 cursor-pointer"
                      >
                        <MoveUp className="w-3 h-3 text-neutral-600" />
                      </button>
                      <button
                        onClick={() => handleMoveNav(index, 'down')}
                        disabled={index === navItems.length - 1}
                        className="p-1 hover:bg-neutral-200 rounded disabled:opacity-20 cursor-pointer"
                      >
                        <MoveDown className="w-3 h-3 text-neutral-600" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-900">{item.label}</span>
                        <button
                          onClick={() => handleToggleNavVisible(item.id)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
                            item.visible
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                          }`}
                        >
                          {item.visible ? (
                            <>
                              <Eye className="w-3 h-3" /> Visible
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" /> Hidden
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5 font-mono">
                        Target Path: <span className="text-neutral-700">{item.href}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingNav(item)}
                      className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNav(item.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 3: HEADER IDENTITY & BRANDING ======================= */}
      {activeTab === 'settings' && storeSettings && (
        <form onSubmit={handleSaveStoreSettings} className="space-y-6 max-w-2xl text-xs">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-neutral-900">Header Branding & Identification</h3>
                <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
                  Live Preview Enabled
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Configure both your Logo image and Brand Name. Both elements will display together side-by-side in the website header.
              </p>
            </div>

            {/* LIVE PREVIEW COMPONENT */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-neutral-600" />
                  Live Header Identity Preview
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {storeSettings.logoUrl?.trim() && storeSettings.storeName?.trim()
                    ? 'Dual Display (Logo + Name)'
                    : storeSettings.logoUrl?.trim()
                    ? 'Logo Only'
                    : 'Name Only'}
                </span>
              </div>

              {/* Simulated Header Bar */}
              <div className="rounded-xl border border-neutral-200 bg-white p-3.5 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between gap-4">
                  {/* The Identity Area */}
                  <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                    {storeSettings.logoUrl && storeSettings.logoUrl.trim() ? (
                      <div className="h-8 sm:h-9 max-w-[120px] sm:max-w-[160px] flex items-center justify-center overflow-hidden">
                        <img
                          src={storeSettings.logoUrl.trim()}
                          alt={storeSettings.storeName || 'Store Logo'}
                          className="h-full w-auto max-w-full object-contain object-center"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}

                    {storeSettings.storeName && storeSettings.storeName.trim() ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base sm:text-lg tracking-tight text-neutral-950 uppercase">
                          {storeSettings.storeName}
                        </span>
                      </div>
                    ) : !storeSettings.logoUrl?.trim() ? (
                      <span className="font-bold text-base sm:text-lg tracking-tight text-neutral-400 uppercase">
                        (No Identity Configured)
                      </span>
                    ) : null}
                  </div>

                  {/* Simulated Nav Links & Actions */}
                  <div className="hidden md:flex items-center gap-3 text-[11px] text-neutral-400 font-medium select-none pointer-events-none">
                    <span>Shop</span>
                    <span>Brands</span>
                    <span>Deals</span>
                    <div className="w-px h-3 bg-neutral-200" />
                    <span>Search</span>
                    <span>Cart (0)</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-neutral-500">
                This shows exactly how your brand appears on customer desktop & mobile screens. Both the logo and brand name appear together without replacing each other.
              </p>
            </div>

            {/* Field 1: Website / Brand Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-neutral-700 text-xs">
                  Website Name / Header Name
                </label>
                {storeSettings.storeName && (
                  <button
                    type="button"
                    onClick={() => setStoreSettings({ ...storeSettings, storeName: '' })}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                  >
                    Clear Name
                  </button>
                )}
              </div>
              <input
                type="text"
                value={storeSettings.storeName || ''}
                onChange={(e) => setStoreSettings({ ...storeSettings, storeName: e.target.value })}
                placeholder="e.g., AL-HAMD MOBILE ACCESSORIES"
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-bold text-sm focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                The primary website/brand name displayed in the header beside your logo. Leave blank if you wish to display only the logo.
              </p>
            </div>

            {/* Field 2: Header Logo Image */}
            <div className="space-y-2">
              <label className="block font-semibold text-neutral-700 text-xs">
                Header Logo Image (Optional)
              </label>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />

              {storeSettings.logoUrl && storeSettings.logoUrl.trim() ? (
                <div className="p-4 border border-neutral-200 rounded-2xl bg-neutral-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-700">Configured Logo</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                      Active Preview
                    </span>
                  </div>

                  {/* Logo Display Container */}
                  <div className="h-20 w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-3 flex items-center justify-center shadow-2xs overflow-hidden">
                    <img
                      src={storeSettings.logoUrl}
                      alt={storeSettings.storeName || 'Store Logo'}
                      className="max-h-14 w-auto max-w-full object-contain object-center"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '';
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingLogo ? 'Uploading...' : 'Upload New Image'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={() => setIsMediaPickerOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Choose from Gallery</span>
                    </button>

                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-2xl p-6 text-center bg-neutral-50/50 transition-colors flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-500 shadow-2xs">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-800 text-xs">No Custom Logo Uploaded</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Upload a transparent PNG, WEBP, SVG, or JPG to display beside your brand name.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isUploadingLogo ? 'Uploading...' : 'Upload from Device'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={() => setIsMediaPickerOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-xl font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Choose from Gallery</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-neutral-400">
                    Accepts JPG, JPEG, PNG, WEBP, SVG (Max 5MB)
                  </p>
                </div>
              )}
            </div>

            {/* Field 3: Store Tagline */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1 text-xs">Store Tagline</label>
              <input
                type="text"
                value={storeSettings.storeTagline || ''}
                onChange={(e) => setStoreSettings({ ...storeSettings, storeTagline: e.target.value })}
                placeholder="e.g., Premium Mobile Accessories & Everyday Tech Essentials"
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-xs focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all"
              />
            </div>

            {/* Submit / Reset Actions */}
            <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
              {hasUnsavedChanges ? (
                <button
                  type="button"
                  onClick={handleResetSettings}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:bg-neutral-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Changes</span>
                </button>
              ) : <div />}

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold text-xs shadow-sm transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save Header Identity
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Media Picker Modal for selecting logo from existing assets */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-neutral-900 text-sm">Select Logo from Media Library</h3>
                <p className="text-[11px] text-neutral-500">Pick any existing branding or media image to use as your header logo</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-neutral-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={mediaSearchQuery}
                onChange={(e) => setMediaSearchQuery(e.target.value)}
                placeholder="Search media files by name..."
                className="w-full text-xs text-neutral-900 focus:outline-none"
              />
            </div>

            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96">
              {filteredGalleryItems.length > 0 ? (
                filteredGalleryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (storeSettings) {
                        setStoreSettings({ ...storeSettings, logoUrl: item.url });
                        notify('Logo selected from gallery. Click "Save Header Identity" to publish.');
                      }
                      setIsMediaPickerOpen(false);
                    }}
                    className={`group relative p-2 border rounded-xl flex flex-col items-center gap-2 hover:border-neutral-900 hover:shadow-xs transition-all cursor-pointer ${
                      storeSettings?.logoUrl === item.url ? 'border-neutral-900 ring-2 ring-neutral-900 bg-neutral-50' : 'border-neutral-200'
                    }`}
                  >
                    <div className="w-full h-24 bg-neutral-50 rounded-lg flex items-center justify-center overflow-hidden p-2">
                      <img src={item.url} alt={item.name} className="max-h-full max-w-full object-contain" />
                    </div>
                    <span className="text-[10px] font-medium text-neutral-700 truncate w-full text-center">
                      {item.name}
                    </span>
                  </button>
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-neutral-400 text-xs">
                  No images found in media library.
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between text-xs">
              <span className="text-neutral-500 text-[11px]">{filteredGalleryItems.length} assets available</span>
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="px-4 py-1.5 bg-neutral-200 hover:bg-neutral-300 rounded-lg font-medium text-xs text-neutral-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Modal */}
      {editingAnn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-sm">
                {editingAnn.id ? 'Edit Announcement' : 'New Announcement'}
              </h3>
              <button onClick={() => setEditingAnn(null)} className="text-neutral-400 hover:text-neutral-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Announcement Text</label>
                <input
                  type="text"
                  required
                  value={editingAnn.text || ''}
                  onChange={(e) => setEditingAnn({ ...editingAnn, text: e.target.value })}
                  placeholder="e.g., Free Delivery on Orders Over Rs. 5,000"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Destination Link</label>
                <input
                  type="text"
                  value={editingAnn.link || ''}
                  onChange={(e) => setEditingAnn({ ...editingAnn, link: e.target.value })}
                  placeholder="e.g., /shop or /shop?filter=sale"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Link CTA Text</label>
                <input
                  type="text"
                  value={editingAnn.linkText || 'Shop Now'}
                  onChange={(e) => setEditingAnn({ ...editingAnn, linkText: e.target.value })}
                  placeholder="e.g., Shop Now or Learn More"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ann-active"
                  checked={editingAnn.active ?? true}
                  onChange={(e) => setEditingAnn({ ...editingAnn, active: e.target.checked })}
                  className="w-4 h-4 rounded text-neutral-900 focus:ring-neutral-900"
                />
                <label htmlFor="ann-active" className="text-neutral-700 font-semibold cursor-pointer">
                  Activate on customer website immediately
                </label>
              </div>

              <div className="pt-3 border-t border-neutral-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAnn(null)}
                  className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-sm"
                >
                  Save Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nav Item Modal */}
      {editingNav && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-sm">
                {editingNav.id ? 'Edit Menu Link' : 'New Menu Link'}
              </h3>
              <button onClick={() => setEditingNav(null)} className="text-neutral-400 hover:text-neutral-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNav} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Menu Label</label>
                <input
                  type="text"
                  required
                  value={editingNav.label || ''}
                  onChange={(e) => setEditingNav({ ...editingNav, label: e.target.value })}
                  placeholder="e.g., Summer Lookbook"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-bold focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">URL / Route Path</label>
                <input
                  type="text"
                  required
                  value={editingNav.href || ''}
                  onChange={(e) => setEditingNav({ ...editingNav, href: e.target.value })}
                  placeholder="e.g., /shop?category=phone-cases-covers or https://..."
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="nav-visible"
                  checked={editingNav.visible ?? true}
                  onChange={(e) => setEditingNav({ ...editingNav, visible: e.target.checked })}
                  className="w-4 h-4 rounded text-neutral-900 focus:ring-neutral-900"
                />
                <label htmlFor="nav-visible" className="text-neutral-700 font-semibold cursor-pointer">
                  Visible in header menu
                </label>
              </div>

              <div className="pt-3 border-t border-neutral-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNav(null)}
                  className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-sm"
                >
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
