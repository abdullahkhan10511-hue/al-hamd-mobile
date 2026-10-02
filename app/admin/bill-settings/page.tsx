'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ReceiptText,
  Save,
  CheckCircle2,
  Upload,
  Trash2,
  Image as ImageIcon,
  Building2,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  Hash,
  Eye,
  RefreshCw,
  Printer,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';
import { BillSettings, BillFieldToggles, Order } from '@/types/admin';
import { getBillSettings, updateBillSettings, defaultBillFieldToggles } from '@/lib/db/billSettings';
import { uploadMediaFile } from '@/lib/db/media';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { subscribeToKey } from '@/lib/db/storage';
import { printBillElement } from '@/lib/utils/printBill';
import A4BillTemplate from '@/components/admin/billing/A4BillTemplate';
import ThermalBillTemplate from '@/components/admin/billing/ThermalBillTemplate';

// Realistic preview sample data (NEVER saved into orders table)
const samplePreviewOrder: Order = {
  id: '78921',
  invoiceNumber: 'INV-2026-00892',
  customer: {
    firstName: 'Abdullah',
    lastName: 'Testing',
    email: 'abdullah.test@example.com',
    phone: '+92 300 0000000',
  },
  shippingAddress: {
    street: 'House 42, Street 7, Sector F-8/2',
    city: 'Islamabad',
    postalCode: '44000',
    country: 'Pakistan',
  },
  items: [
    {
      productId: 'sample-p1',
      productName: 'Vivid Earbuds ANC Pro Wireless',
      slug: 'vivid-earbuds-anc-pro',
      quantity: 1,
      price: 3495,
      total: 3495,
      sku: 'ALH-EB-001',
      selectedModel: 'Pro Edition',
      selectedColor: 'Midnight Black',
      image: '/placeholder.png',
    },
    {
      productId: 'sample-p2',
      productName: '65W GaN Fast Charger Dual Port',
      slug: '65w-gan-fast-charger',
      quantity: 1,
      price: 2450,
      total: 2450,
      sku: 'ALH-CH-065',
      selectedColor: 'White',
      image: '/placeholder.png',
    },
  ],
  subtotal: 5945,
  shipping: 200,
  tax: 0,
  discount: 500,
  total: 5645,
  paymentMethod: 'Cash on Delivery',
  paymentStatus: 'Paid',
  status: 'Delivered',
  currency: 'PKR',
  createdAt: '2026-10-02T14:30:00.000Z',
  updatedAt: '2026-10-02T14:30:00.000Z',
  deliveryMethod: 'standard',
};

export default function StoreBillSettingsPage() {
  const { admin, isManager } = useAdminAuth();
  const [settings, setSettings] = useState<BillSettings>(() => getBillSettings());
  const [savedBaseline, setSavedBaseline] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewTab, setPreviewTab] = useState<'a4' | 'thermal'>('a4');
  const [activeSettingsSection, setActiveSettingsSection] = useState<'general' | 'a4' | 'thermal'>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initial = getBillSettings();
    setSettings(initial);
    setSavedBaseline(JSON.stringify(initial));

    const unsub = subscribeToKey('bill_settings', (data: any) => {
      if (data) {
        setSettings(data);
        setSavedBaseline(JSON.stringify(data));
      }
    });
    return () => unsub();
  }, []);

  const hasUnsavedChanges = savedBaseline !== '' && JSON.stringify(settings) !== savedBaseline;

  // Generic updater for shop information
  const handleShopChange = (field: keyof BillSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Format-specific toggle handler
  const handleToggleChange = (format: 'a4' | 'thermal', field: keyof BillFieldToggles, value: boolean | string) => {
    setSettings((prev) => {
      const configKey = format === 'a4' ? 'a4Config' : 'thermalConfig';
      const currentConfig = prev[configKey] || { ...defaultBillFieldToggles };
      return {
        ...prev,
        [configKey]: {
          ...currentConfig,
          [field]: value,
        },
      };
    });
  };

  // Upload logo using existing media architecture
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const res = await uploadMediaFile(file, admin?.email || 'admin@alhamd.com');
    setIsUploading(false);

    if (res.success && res.item) {
      handleShopChange('storeLogo', res.item.url);
    }
  };

  const handleRemoveLogo = () => {
    handleShopChange('storeLogo', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await updateBillSettings(settings, admin?.email || 'admin@alhamd.com');
      setSettings(updated);
      setSavedBaseline(JSON.stringify(updated));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = () => {
    printBillElement('alhamd-live-preview-target', {
      format: previewTab,
      title: `Test_Print_${previewTab.toUpperCase()}`,
    });
  };

  // Active toggles for currently selected preview format
  const activeToggles = previewTab === 'a4'
    ? { ...defaultBillFieldToggles, ...(settings.a4Config || {}) }
    : { ...defaultBillFieldToggles, ...(settings.thermalConfig || {}) };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* ===================================================================== */}
      {/* PAGE HEADER & TOP ACTION BAR                                          */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                isManager
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {isManager ? 'Store Manager' : 'Admin'}
            </span>
            <span className="text-xs text-neutral-400">• Bill Template System</span>

            {/* Unsaved Changes / Saved Status Pill */}
            {hasUnsavedChanges ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white animate-pulse">
                <AlertCircle className="w-3 h-3" />
                Unsaved Changes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-700">
                <Check className="w-3 h-3 text-emerald-600" />
                Saved
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
            Bill &amp; Invoice Settings
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Configure shop identity, customize customer bill sections, and preview changes live in real-time.
          </p>
        </div>

        {/* Primary Save Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Settings...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">Settings Saved Successfully!</p>
              <p className="text-[11px] text-emerald-700 font-normal">
                Your changes have been saved to the database and will immediately apply to all new bills, POS receipts, and invoice reprints.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase bg-emerald-200/60 px-2 py-1 rounded text-emerald-800">
            Persistent
          </span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2-COLUMN RESPONSIVE LAYOUT (Left: Controls, Right: Live Preview)      */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN: SETTINGS CONTROLS (7 Cols)                            */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setActiveSettingsSection('general');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeSettingsSection === 'general'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200'
              }`}
            >
              Shop Information &amp; Logo
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSettingsSection('a4');
                setPreviewTab('a4');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeSettingsSection === 'a4'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200'
              }`}
            >
              A4 Invoice Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSettingsSection('thermal');
                setPreviewTab('thermal');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeSettingsSection === 'thermal'
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200'
              }`}
            >
              Thermal Receipt Settings
            </button>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* TAB 1: SHOP INFORMATION & LOGO                                    */}
          {/* ----------------------------------------------------------------- */}
          {activeSettingsSection === 'general' && (
            <div className="space-y-6">
              {/* Store Identity */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                  <Building2 className="w-4 h-4 text-neutral-800" />
                  <h2 className="text-xs font-bold text-neutral-950 uppercase tracking-tight">
                    1. Shop Information
                  </h2>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-neutral-800 block mb-1">
                      Shop Name
                    </label>
                    <input
                      type="text"
                      value={settings.storeName || ''}
                      onChange={(e) => handleShopChange('storeName', e.target.value)}
                      placeholder="e.g. AL-HAMD MOBILE ACCESSORIES"
                      className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-medium"
                    />
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      Prominently printed at the top of A4 invoices and thermal receipts.
                    </span>
                  </div>

                  <div>
                    <label className="font-semibold text-neutral-800 block mb-1">
                      Shop Address
                    </label>
                    <textarea
                      rows={2}
                      value={settings.storeAddress || ''}
                      onChange={(e) => handleShopChange('storeAddress', e.target.value)}
                      placeholder="Shop address..."
                      className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-neutral-800 block mb-1">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={settings.phone || ''}
                          onChange={(e) => handleShopChange('phone', e.target.value)}
                          placeholder="+92 343 2200995"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-neutral-800 block mb-1">
                        WhatsApp Number
                      </label>
                      <div className="relative">
                        <MessageSquare className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={settings.whatsapp || ''}
                          onChange={(e) => handleShopChange('whatsapp', e.target.value)}
                          placeholder="+92 343 2200995"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-neutral-800 block mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={settings.email || ''}
                          onChange={(e) => handleShopChange('email', e.target.value)}
                          placeholder="support@alhamd-mobile.com"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-neutral-800 block mb-1">
                        Website URL
                      </label>
                      <div className="relative">
                        <Globe className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={settings.website || ''}
                          onChange={(e) => handleShopChange('website', e.target.value)}
                          placeholder="alhamd.pk"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-neutral-800 block mb-1">
                      Tax / NTN Number <span className="text-neutral-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Hash className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={settings.taxNumber || ''}
                        onChange={(e) => handleShopChange('taxNumber', e.target.value)}
                        placeholder="e.g. NTN: 1234567-8"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Shop Logo Section */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                  <ImageIcon className="w-4 h-4 text-neutral-800" />
                  <h2 className="text-xs font-bold text-neutral-950 uppercase tracking-tight">
                    2. Shop Logo
                  </h2>
                </div>

                <div className="p-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 space-y-3">
                  {settings.storeLogo ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Logo Preview */}
                      <div className="w-32 h-20 bg-white rounded-xl border border-neutral-200 p-2 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        <img
                          src={settings.storeLogo}
                          alt="Store Logo Preview"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      <div className="flex-1 text-center sm:text-left space-y-2">
                        <p className="text-[11px] font-semibold text-neutral-800">Current Logo Active</p>
                        <p className="text-[10px] text-neutral-500">
                          This logo renders on printable A4 invoices and thermal bills. Live preview updates immediately.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start pt-1">
                          <label className="px-3 py-1.5 rounded-lg bg-neutral-950 text-white font-medium text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-neutral-800 transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Replace Logo</span>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium text-[11px] flex items-center gap-1.5 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove Logo</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-neutral-200/70 text-neutral-600 mx-auto flex items-center justify-center">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-800 text-xs">No Shop Logo Set</p>
                        <p className="text-[10px] text-neutral-500">
                          Upload your shop logo to display directly on customer bills
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-950 text-white font-semibold text-[11px] cursor-pointer hover:bg-neutral-800 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo from Computer</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {isUploading && (
                    <div className="text-center text-[11px] text-neutral-500 font-medium animate-pulse">
                      Processing and uploading logo...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* TAB 2 & 3: FORMAT-SPECIFIC TOGGLES (A4 or Thermal)                */}
          {/* ----------------------------------------------------------------- */}
          {(activeSettingsSection === 'a4' || activeSettingsSection === 'thermal') && (
            <div className="space-y-6">
              {/* Header / Banner for current format */}
              <div className="bg-neutral-950 text-white p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    {activeSettingsSection === 'a4' ? 'A4 Invoice Format Controls' : '80mm Thermal Receipt Controls'}
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Toggle visibility of header, customer, and invoice fields. Changes reflect live in the preview.
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                  {activeSettingsSection.toUpperCase()}
                </span>
              </div>

              {/* 1. Header & Shop Display Toggles */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
                <h4 className="text-xs font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-100 pb-2">
                  Header &amp; Shop Branding
                </h4>
                <div className="space-y-3 text-xs">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showLogo)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showLogo', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Shop Logo</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showStoreName)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showStoreName', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Shop Name</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showStoreAddress)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showStoreAddress', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Shop Address</span>
                  </label>
                </div>
              </div>

              {/* 2. Customer Section Toggles */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
                <h4 className="text-xs font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-100 pb-2">
                  Customer Section Fields
                </h4>
                <div className="space-y-3 text-xs">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showCustomerName)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showCustomerName', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Customer Name</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showCustomerPhone)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showCustomerPhone', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Customer Phone</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showCustomerAddress)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showCustomerAddress', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Customer Address</span>
                  </label>
                </div>
              </div>

              {/* 3. Invoice & Order Information Toggles */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
                <h4 className="text-xs font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-100 pb-2">
                  Order &amp; Invoice Information
                </h4>
                <div className="space-y-3 text-xs">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showInvoiceNumber)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showInvoiceNumber', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Invoice / Bill Number</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showDate)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showDate', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Order Date</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showTime)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showTime', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Order Time</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showPaymentMethod)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showPaymentMethod', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Payment Method &amp; Status</span>
                  </label>
                </div>
              </div>

              {/* 4. Footer Settings */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
                <h4 className="text-xs font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-100 pb-2">
                  Footer &amp; Gratitude Message
                </h4>
                <div className="space-y-4 text-xs">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showWebsite)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showWebsite', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Website URL in Footer</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeToggles.showThankYou)}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'showThankYou', e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium text-neutral-800">Show Thank You Message</span>
                  </label>

                  <div>
                    <label className="font-semibold text-neutral-800 block mb-1">
                      Footer Message Text
                    </label>
                    <input
                      type="text"
                      value={activeToggles.footerMessage || ''}
                      onChange={(e) => handleToggleChange(activeSettingsSection, 'footerMessage', e.target.value)}
                      placeholder="Thank You for Shopping!"
                      className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Save Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-neutral-400">
              * Saved changes apply immediately to newly printed invoices and POS receipts.
            </p>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Settings...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: REAL-TIME LIVE BILL PREVIEW (5 Cols)                  */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          {/* Preview Header & Controls */}
          <div className="bg-neutral-950 text-white p-4 rounded-2xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-xs uppercase tracking-wide">Live Bill Preview</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Format Switcher */}
              <div className="flex items-center bg-neutral-900 p-0.5 rounded-xl text-[11px] font-medium border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setPreviewTab('a4')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    previewTab === 'a4'
                      ? 'bg-white text-neutral-950 font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  A4 Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('thermal')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    previewTab === 'thermal'
                      ? 'bg-white text-neutral-950 font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Thermal (80mm)
                </button>
              </div>

              {/* Test Print Button */}
              <button
                type="button"
                onClick={handleTestPrint}
                title="Test Print Preview"
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Preview Canvas Container */}
          <div className="bg-neutral-200/70 p-3 sm:p-5 rounded-3xl border border-neutral-300/80 shadow-inner overflow-x-auto max-h-[82vh] overflow-y-auto">
            <div id="alhamd-live-preview-target" className="transition-all duration-150">
              {previewTab === 'a4' ? (
                <div className="bg-white rounded-2xl shadow-md border border-neutral-200 overflow-hidden transform-gpu origin-top">
                  <A4BillTemplate
                    order={samplePreviewOrder}
                    settings={settings}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-md border border-neutral-200 overflow-hidden mx-auto w-[80mm]">
                  <ThermalBillTemplate
                    order={samplePreviewOrder}
                    settings={settings}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-[11px] text-neutral-400 font-mono">
            Preview uses sample test data • Instant live rendering
          </div>
        </div>
      </div>
    </div>
  );
}
