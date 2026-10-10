'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { StoreSettings } from '@/types/admin';
import {
  getStoreSettings,
  updateStoreSettings,
  toggleSocialPlatformStatus,
  updateSocialPlatformUrl,
  STANDARD_SOCIAL_PLATFORMS,
} from '@/lib/db/settings';
import {
  Settings,
  Store,
  DollarSign,
  Truck,
  Mail,
  Share2,
  Search,
  CheckCircle,
  Save,
  Globe,
  Clock,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  Edit3,
  X,
  Lock,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  Shield,
  Palette,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import Link from 'next/link';

export default function AdminSettingsPage() {
  const { admin: currentAdmin, changePassword: authChangePassword } = useAdminAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [activeTab, setActiveTab] = useState<
    'general' | 'contact' | 'currency' | 'shipping' | 'social' | 'seo' | 'security'
  >('general');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Security / Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Social media state
  const [newPlatformName, setNewPlatformName] = useState('');
  const [newPlatformUrl, setNewPlatformUrl] = useState('');
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [editUrlValue, setEditUrlValue] = useState<string>('');

  // Logo & Favicon upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');
  const logoFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploadError('');

    // Supported formats check: PNG, JPG, JPEG, WEBP, ICO, SVG
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.ico', '.svg'];
    const originalName = file.name || '';
    const ext = '.' + originalName.split('.').pop()?.toLowerCase();

    if (!allowedExts.includes(ext)) {
      setLogoUploadError('Unsupported image format. Please select a PNG, JPG, JPEG, WEBP, or ICO image.');
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed logo size is 5MB.`);
      if (e.target) e.target.value = '';
      return;
    }

    try {
      setIsUploadingLogo(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/settings/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload logo image.');
      }

      if (settings && data.url) {
        const updatedSettings: StoreSettings = {
          ...settings,
          logoUrl: data.url,
          seo: {
            ...settings.seo,
            logoUrl: data.url,
          },
        };
        setSettings(updatedSettings);
        await updateStoreSettings(updatedSettings);
        setMessage('Site Logo uploaded and saved successfully.');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setLogoUploadError(err?.message || 'Error uploading logo image.');
    } finally {
      setIsUploadingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!settings) return;
    setLogoUploadError('');
    const updatedSettings: StoreSettings = {
      ...settings,
      logoUrl: '',
      seo: {
        ...settings.seo,
        logoUrl: '',
      },
    };
    setSettings(updatedSettings);
    await updateStoreSettings(updatedSettings);
    setMessage('Site Logo removed.');
    setTimeout(() => setMessage(''), 3000);
  };

  const loadData = () => {
    setSettings(getStoreSettings());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    await updateStoreSettings(settings);
    setIsSaving(false);
    setMessage('Store settings saved successfully.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password cannot be identical to your current password.');
      return;
    }

    setIsChangingPassword(true);
    const res = await authChangePassword(currentPassword, newPassword);
    setIsChangingPassword(false);

    if (!res.success) {
      setPasswordError(res.error || 'Failed to change password. Please check that your current password is correct.');
      return;
    }

    setPasswordSuccess('Password successfully updated! Your new password is now active and securely hashed.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(''), 6000);
  };

  const handleCancelPassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
  };

  const socialAccountsList = useMemo(() => {
    if (!settings?.socialLinks) return STANDARD_SOCIAL_PLATFORMS.map(p => ({ ...p, url: p.defaultUrl, isActive: true }));
    const accounts = settings.socialLinks.accounts || [];
    const result: { platform: string; name: string; url: string; isActive: boolean }[] = [];
    STANDARD_SOCIAL_PLATFORMS.forEach((std) => {
      const existing = accounts.find((a) => a.platform === std.platform);
      const existingUrl = (settings.socialLinks as any)[std.platform];
      result.push({
        platform: std.platform,
        name: std.name,
        url: typeof existingUrl === 'string' ? existingUrl : existing?.url || std.defaultUrl,
        isActive: settings.socialLinks?.status?.[std.platform] !== false,
      });
    });
    accounts.forEach((acc) => {
      if (!result.some((r) => r.platform === acc.platform)) {
        result.push({
          platform: acc.platform,
          name: acc.name || acc.platform,
          url: acc.url || '',
          isActive: settings.socialLinks?.status?.[acc.platform] !== false,
        });
      }
    });
    return result;
  }, [settings?.socialLinks]);

  const handleToggleSocial = async (platform: string) => {
    if (!settings) return;
    const currentStatus = settings.socialLinks?.status?.[platform] !== false;
    const nextStatus = !currentStatus;

    // Optimistically update local state
    const updatedStatus = { ...(settings.socialLinks?.status || {}), [platform]: nextStatus };
    const updatedAccounts = (settings.socialLinks?.accounts || []).map((acc) =>
      acc.platform === platform ? { ...acc, isActive: nextStatus } : acc
    );
    setSettings({
      ...settings,
      socialLinks: {
        ...settings.socialLinks,
        status: updatedStatus,
        accounts: updatedAccounts,
      },
    });

    try {
      await toggleSocialPlatformStatus(platform, nextStatus);
      const platformName = STANDARD_SOCIAL_PLATFORMS.find((p) => p.platform === platform)?.name || platform;
      setMessage(`${platformName} set to ${nextStatus ? 'Active' : 'Inactive'}.`);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to update social status.');
    }
  };

  const handleUpdateSocialUrl = (platform: string, url: string) => {
    if (!settings) return;
    const currentAccounts = settings.socialLinks?.accounts || [];
    const exists = currentAccounts.some((a) => a.platform === platform);
    let updatedAccounts = currentAccounts;
    if (exists) {
      updatedAccounts = currentAccounts.map((acc) =>
        acc.platform === platform ? { ...acc, url } : acc
      );
    } else {
      updatedAccounts = [...currentAccounts, { platform, name: platform, url, isActive: true }];
    }
    setSettings({
      ...settings,
      socialLinks: {
        ...settings.socialLinks,
        [platform]: url,
        accounts: updatedAccounts,
      },
    });
  };

  const handleAddCustomPlatform = () => {
    if (!settings || !newPlatformName.trim() || !newPlatformUrl.trim()) return;
    const platformKey = newPlatformName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newAccount = {
      platform: platformKey,
      name: newPlatformName.trim(),
      url: newPlatformUrl.trim(),
      isActive: true,
    };
    const accounts = [...(settings.socialLinks?.accounts || []), newAccount];
    const status = { ...(settings.socialLinks?.status || {}), [platformKey]: true };
    setSettings({
      ...settings,
      socialLinks: {
        ...settings.socialLinks,
        [platformKey]: newPlatformUrl.trim(),
        status,
        accounts,
      },
    });
    setNewPlatformName('');
    setNewPlatformUrl('');
    setShowAddPlatform(false);
    setMessage(`Added ${newAccount.name} to social media accounts.`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleStartEdit = (platform: string, currentUrl: string) => {
    setEditingPlatform(platform);
    setEditUrlValue(currentUrl);
  };

  const handleSaveEdit = async (platform: string) => {
    await updateSocialPlatformUrl(platform, editUrlValue);
    handleUpdateSocialUrl(platform, editUrlValue);
    setEditingPlatform(null);
    setMessage(`Updated ${platform} account URL.`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleCancelEdit = () => {
    setEditingPlatform(null);
    setEditUrlValue('');
  };

  const handleDeletePlatform = async (platform: string) => {
    if (!settings) return;
    const currentAccounts = (settings.socialLinks?.accounts || []).filter((a) => a.platform !== platform);
    const status = { ...(settings.socialLinks?.status || {}) };
    delete status[platform];
    const newSocial = {
      ...settings.socialLinks,
      accounts: currentAccounts,
      status,
    };
    delete (newSocial as any)[platform];
    await updateStoreSettings({ socialLinks: newSocial });
    setSettings({
      ...settings,
      socialLinks: newSocial,
    });
    setMessage(`Removed ${platform} account.`);
    setTimeout(() => setMessage(''), 3000);
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return 'bg-blue-600';
      case 'instagram':
        return 'bg-gradient-to-tr from-amber-500 via-rose-600 to-purple-600';
      case 'tiktok':
        return 'bg-neutral-950';
      case 'youtube':
        return 'bg-red-600';
      case 'whatsapp':
        return 'bg-emerald-600';
      default:
        return 'bg-neutral-800';
    }
  };

  const getPlatformBadge = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return 'FB';
      case 'instagram':
        return 'IG';
      case 'tiktok':
        return 'TK';
      case 'youtube':
        return 'YT';
      case 'whatsapp':
        return 'WA';
      default:
        return platform.slice(0, 2).toUpperCase();
    }
  };

  if (!settings) {
    return <div className="p-12 text-center text-neutral-400">Loading store settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Store Settings</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Global configuration for PKR currency, taxes, logistics thresholds, and metadata
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving Changes...' : 'Save All Settings'}
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-2 border-b border-neutral-200 pb-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'general'
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          General & Brand
        </button>

        <button
          onClick={() => setActiveTab('contact')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'contact'
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          Contact & Address
        </button>

        <button
          onClick={() => setActiveTab('currency')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'currency'
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          Currency & Taxes
        </button>

        <button
          onClick={() => setActiveTab('shipping')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'shipping'
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Shipping Logistics
        </button>

        <button
          onClick={() => setActiveTab('social')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'social'
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          Social Channels
        </button>

        <button
          onClick={() => setActiveTab('seo')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'seo'
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          SEO Metadata
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'security'
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          Account Security
        </button>

        <Link
          href="/admin/settings/login-appearance"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-neutral-100 text-neutral-700 border border-neutral-200 hover:bg-neutral-200 transition-colors ml-auto"
        >
          <Palette className="w-3.5 h-3.5 text-neutral-600" />
          Login Appearance
        </Link>
      </div>

      {/* Settings Forms */}
      <form onSubmit={handleSave} className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-6 text-xs">
        {/* TAB: GENERAL */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">General Brand Identity</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Tagline</label>
                <input
                  type="text"
                  value={settings.storeTagline}
                  onChange={(e) => setSettings({ ...settings, storeTagline: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Footer Brand Statement</label>
              <textarea
                rows={3}
                value={settings.footerDescription}
                onChange={(e) => setSettings({ ...settings, footerDescription: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
              />
            </div>
          </div>
        )}

        {/* TAB: CONTACT */}
        {activeTab === 'contact' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">Official Contact Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Concierge Email</label>
                <input
                  type="email"
                  required
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Studio / Retail Address</label>
              <input
                type="text"
                required
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">WhatsApp Direct (Format: +92300...)</label>
                <input
                  type="text"
                  value={settings.whatsapp || ''}
                  placeholder="+923001234567"
                  onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Business Hours</label>
                <input
                  type="text"
                  value={settings.businessHours}
                  onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB: CURRENCY (Pakistan PKR Focused) */}
        {activeTab === 'currency' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">Currency & Regional Pricing</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Base Store Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => {
                    const curr = e.target.value;
                    const sym = curr === 'PKR' ? 'Rs.' : 'Rs.';
                    setSettings({ ...settings, currency: curr, currencySymbol: sym });
                  }}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-bold"
                >
                  <option value="PKR">PKR - Pakistani Rupee (Rs.)</option>
                </select>
                <p className="text-[11px] text-neutral-500 mt-1">Operating in Pakistan exclusively. All catalog prices are rendered in Pakistani Rupees.</p>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-bold font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Tax Percentage (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.taxPercentage}
                onChange={(e) => setSettings({ ...settings, taxPercentage: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono"
              />
              <p className="text-[10px] text-neutral-400 mt-1">Set to 0 to make tax-exempt or include taxes in list price.</p>
            </div>
          </div>
        )}

        {/* TAB: SHIPPING */}
        {activeTab === 'shipping' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">Pakistan Shipping & Logistics Rates</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Free Shipping Above (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.freeShippingThreshold}
                  onChange={(e) =>
                    setSettings({ ...settings, freeShippingThreshold: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Shipping Fee (Standard Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settings.standardShippingFee}
                  onChange={(e) =>
                    setSettings({ ...settings, standardShippingFee: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Express Courier Fee (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settings.expressShippingFee}
                  onChange={(e) =>
                    setSettings({ ...settings, expressShippingFee: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Estimated Delivery Text</label>
                <input
                  type="text"
                  value={settings.estimatedDeliveryText || '3–5 Business Days Nationwide'}
                  onChange={(e) =>
                    setSettings({ ...settings, estimatedDeliveryText: e.target.value })
                  }
                  placeholder="e.g. 3–5 Business Days"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Storefront Delivery Message</label>
                <input
                  type="text"
                  value={settings.deliveryMessage || 'Delivery Across Pakistan | Cash on Delivery Available'}
                  onChange={(e) =>
                    setSettings({ ...settings, deliveryMessage: e.target.value })
                  }
                  placeholder="e.g. Free Delivery on Orders Above Rs. 5,000"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
                />
              </div>
            </div>

            <div className="p-3.5 bg-neutral-50 border border-neutral-200/80 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-semibold text-neutral-900">Pakistan-Only Nationwide Mode</p>
                <p className="text-[11px] text-neutral-500">Limits checkout addresses, phone formatting, and logistics to Pakistan only.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.pakistanOnly ?? true}
                  onChange={(e) => setSettings({ ...settings, pakistanOnly: e.target.checked })}
                  className="w-4 h-4 accent-neutral-950 rounded"
                />
                <span className="text-xs font-bold text-neutral-800">Enabled</span>
              </label>
            </div>
          </div>
        )}

        {/* TAB: SOCIAL */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Social Media Accounts &amp; Visibility</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Individually activate or deactivate social accounts. Inactive platforms are completely hidden from the customer website, while their configured URLs remain safely saved.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddPlatform(!showAddPlatform)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Platform</span>
              </button>
            </div>

            {/* Add Custom Platform Box */}
            {showAddPlatform && (
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3 animate-in fade-in duration-150">
                <span className="font-bold text-xs text-neutral-800 block">Add Custom Social Platform</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Platform Name</label>
                    <input
                      type="text"
                      placeholder="e.g. LinkedIn, Threads, Discord"
                      value={newPlatformName}
                      onChange={(e) => setNewPlatformName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Account URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={newPlatformUrl}
                      onChange={(e) => setNewPlatformUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddPlatform(false)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomPlatform}
                    className="px-3.5 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
                  >
                    Save Platform
                  </button>
                </div>
              </div>
            )}

            {/* Social Accounts List */}
            <div className="space-y-3">
              {socialAccountsList.map((account) => {
                const isActive = settings.socialLinks?.status?.[account.platform] !== false;
                const currentUrl = typeof (settings.socialLinks as any)[account.platform] === 'string'
                  ? (settings.socialLinks as any)[account.platform]
                  : account.url || '';
                const isEditing = editingPlatform === account.platform;
                const isCustom = !STANDARD_SOCIAL_PLATFORMS.some((p) => p.platform === account.platform);

                return (
                  <div
                    key={account.platform}
                    id={`social-card-${account.platform}`}
                    className={`p-4 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isActive
                        ? 'bg-white border-neutral-200 shadow-xs'
                        : 'bg-neutral-50/70 border-neutral-200/80 opacity-80'
                    }`}
                  >
                    {/* Col 1: Platform Icon & Name */}
                    <div className="flex items-center gap-3.5 min-w-[200px]">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold text-xs shadow-xs ${getPlatformColor(account.platform)}`}>
                        {getPlatformBadge(account.platform)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-neutral-900">{account.name}</h4>
                          {isCustom && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-neutral-100 text-neutral-600">
                              Custom
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-500 block mt-0.5">
                          {isActive ? '🟢 Visible on website' : '🔴 Hidden on website'}
                        </span>
                      </div>
                    </div>

                    {/* Col 2: Account / URL */}
                    <div className="flex-1 max-w-md">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="url"
                            placeholder={`https://${account.platform}.com/...`}
                            value={editUrlValue}
                            onChange={(e) => setEditUrlValue(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl text-xs font-mono bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(account.platform)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                            title="Save URL"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-2 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 text-xs font-semibold cursor-pointer shrink-0"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono truncate max-w-xs block border ${
                              currentUrl
                                ? 'bg-neutral-50 border-neutral-200 text-neutral-800'
                                : 'bg-neutral-100 border-neutral-200 text-neutral-400 italic'
                            }`}
                          >
                            {currentUrl || 'No URL configured'}
                          </span>
                          {currentUrl && (
                            <a
                              href={currentUrl.startsWith('http') || currentUrl.startsWith('wa.me') ? currentUrl : `https://${currentUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors shrink-0"
                              title="Test Link in New Tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Col 3: Status (Badge + Toggle) */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {isActive ? '🟢 Active' : '🔴 Inactive'}
                      </span>

                      <button
                        type="button"
                        id={`toggle-social-${account.platform}`}
                        onClick={() => handleToggleSocial(account.platform)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isActive ? 'bg-emerald-600' : 'bg-neutral-300'
                        }`}
                        role="switch"
                        aria-checked={isActive}
                        title={isActive ? 'Click to deactivate platform' : 'Click to activate platform'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Col 4: Actions (Edit button & Delete for custom) */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!isEditing && (
                        <button
                          type="button"
                          id={`edit-social-${account.platform}`}
                          onClick={() => handleStartEdit(account.platform, currentUrl)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-neutral-500" />
                          <span>Edit</span>
                        </button>
                      )}

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeletePlatform(account.platform)}
                          className="p-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Custom Platform"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: SEO */}
        {activeTab === 'seo' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Search Engine Optimization (SEO) &amp; Branding</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Manage your global site icon, search engine meta titles, descriptions, and discovery keywords.
              </p>
            </div>

            {/* Direct Link Banner to Dedicated SEO & Website Settings Page */}
            <div className="p-4 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Dedicated SEO &amp; Website Branding Suite
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                      New
                    </span>
                  </h4>
                  <p className="text-xs text-neutral-300 mt-0.5">
                    Live Google search snippet, simulated website header, and real-time social share card preview editor.
                  </p>
                </div>
              </div>
              <Link
                href="/admin/settings/seo"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-neutral-950 hover:bg-neutral-100 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
              >
                Open Full SEO Editor
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Site Logo / Favicon Upload Section */}
            <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-neutral-700" />
                    Site Logo / Favicon
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Recommended: square PNG or WEBP image for best favicon results.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 bg-neutral-50 px-2.5 py-1 rounded-lg border border-neutral-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Tab Icon &amp; Metadata
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={logoFileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.ico,.svg"
                onChange={handleLogoFileChange}
                className="hidden"
                disabled={isUploadingLogo}
              />

              {/* Logo / Favicon Display & Action Grid */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Current Logo Preview Container */}
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-neutral-50 border-2 border-neutral-200/90 flex items-center justify-center p-2.5 overflow-hidden shadow-2xs transition-all group-hover:border-neutral-400">
                    {(settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl) ? (
                      <img
                        src={settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl}
                        alt="Current Site Logo / Favicon"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 text-center">
                        <ImageIcon className="w-6 h-6 stroke-1 mb-1 text-neutral-400" />
                        <span className="text-[9px] font-semibold uppercase tracking-tight text-neutral-400">Default</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status and Action Buttons */}
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">
                        {(settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl)
                          ? 'Current Uploaded Logo'
                          : 'Default Site Favicon'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          (settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl)
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                        }`}
                      >
                        {(settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl) ? 'Custom' : 'System Default (/favicon.ico)'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 truncate">
                      {(settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl)
                        ? (settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl)
                        : 'Using default /favicon.ico icon.'}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {(settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="inline-flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUploadingLogo ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              Replace Logo
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          disabled={isUploadingLogo}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-neutral-200 hover:border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove Logo
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingLogo ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            Upload Logo
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Validation / Error Message */}
                  {logoUploadError && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs mt-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{logoUploadError}</span>
                      <button
                        type="button"
                        onClick={() => setLogoUploadError('')}
                        className="ml-auto text-rose-400 hover:text-rose-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Browser Tab Simulation Preview */}
              <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/60 -mx-5 -mb-5 p-4 rounded-b-2xl">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Live Browser Tab Preview
                </span>
                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-white border border-neutral-200/90 rounded-lg shadow-2xs max-w-sm">
                  {(settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl) ? (
                    <img
                      src={settings.seo?.faviconUrl || settings.faviconUrl || settings.logoUrl}
                      alt="Tab Icon"
                      className="w-4 h-4 object-contain shrink-0"
                    />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full bg-neutral-900 inline-block shrink-0"></span>
                  )}
                  <span className="text-xs text-neutral-800 font-medium truncate">
                    {settings.seo?.metaTitle || settings.storeName || 'AL-HAMD SHOP'}
                  </span>
                  <X className="w-3 h-3 text-neutral-400 ml-auto shrink-0" />
                </div>
              </div>
            </div>

            {/* Existing SEO fields */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Default Meta Title</label>
              <input
                type="text"
                value={settings.seo?.metaTitle || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    seo: { ...settings.seo, metaTitle: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Meta Description</label>
              <textarea
                rows={3}
                value={settings.seo?.metaDescription || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    seo: { ...settings.seo, metaDescription: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Target Keywords (Comma Separated)</label>
              <input
                type="text"
                value={(settings.seo?.keywords || []).join(', ')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    seo: {
                      ...settings.seo,
                      keywords: e.target.value.split(',').map((k) => k.trim()),
                    },
                  })
                }
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono text-[11px]"
              />
            </div>
          </div>
        )}



        {/* TAB: ACCOUNT SECURITY & CHANGE PASSWORD */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Account Security &amp; Password Management
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Update your administrator password securely. Passwords are cryptographically salted and hashed using SHA-256 Web Crypto. Never stored or displayed in plain text.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  SHA-256 Encrypted
                </span>
              </div>
            </div>

            {/* Current Admin Identity Banner */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {currentAdmin?.name ? currentAdmin.name.slice(0, 2).toUpperCase() : 'AD'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-neutral-900">{currentAdmin?.name || 'Main Administrator'}</h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-neutral-900 text-white font-mono">
                      {currentAdmin?.role || 'SUPER_ADMIN'}
                    </span>
                    {currentAdmin?.isOwner && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                        Owner
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 font-mono mt-0.5">{currentAdmin?.email || 'admin@alhamd.com'}</p>
                </div>
              </div>

              <div className="text-[11px] text-neutral-500 sm:text-right">
                <span className="block font-medium text-neutral-700">Account Status: <span className="text-emerald-600 font-bold">Active</span></span>
                <span className="block text-[10px] text-neutral-400">Full System &amp; Settings Permissions</span>
              </div>
            </div>

            {/* Feedback Alerts */}
            {passwordSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Change Password Card */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                <Key className="w-4 h-4 text-neutral-700" />
                <h4 className="font-bold text-sm text-neutral-900">Change Password</h4>
              </div>

              <div className="grid grid-cols-1 gap-4 max-w-lg">
                {/* Current Password */}
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1.5">
                    Current Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      autoComplete="current-password"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-xs pr-10 focus:outline-none focus:border-neutral-900 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1.5">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters (e.g. AlHamdAdmin@123)"
                      autoComplete="new-password"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-xs pr-10 focus:outline-none focus:border-neutral-900 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1.5">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-xs pr-10 focus:outline-none focus:border-neutral-900 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Requirements note */}
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
                  <span className="font-bold text-neutral-800 block">Security Rules:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-neutral-500">
                    <li>Minimum 6 characters long</li>
                    <li>Passwords are case-sensitive</li>
                    <li>Existing login credentials will be updated immediately upon confirmation</li>
                  </ul>
                </div>

                {/* Form Buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    {isChangingPassword ? 'Saving Password...' : 'Change Password'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelPassword}
                    className="px-4 py-2.5 border border-neutral-200 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Links Card */}
            <div className="p-5 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div>
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-400" />
                  Admin Login Appearance Customization
                </h4>
                <p className="text-neutral-300 text-xs mt-1">
                  Customize the Admin Login page branding, automated image slider, transitions, colors, and labels directly from the portal.
                </p>
              </div>

              <Link
                href="/admin/settings/login-appearance"
                className="px-4 py-2 bg-white text-neutral-900 hover:bg-neutral-100 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
              >
                Customize Login Screen →
              </Link>
            </div>
          </div>
        )}

        {activeTab !== 'security' && (
          <div className="pt-4 border-t border-neutral-200 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
