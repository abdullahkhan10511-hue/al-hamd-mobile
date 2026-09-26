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
  FileText,
  Hash,
  Eye,
  RefreshCw,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { BillSettings } from '@/types/admin';
import { getBillSettings, updateBillSettings } from '@/lib/db/billSettings';
import { uploadMediaFile } from '@/lib/db/media';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { subscribeToKey } from '@/lib/db/storage';

export default function StoreBillSettingsPage() {
  const { admin, isManager } = useAdminAuth();
  const [settings, setSettings] = useState<BillSettings>(getBillSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewTab, setPreviewTab] = useState<'a4' | 'thermal'>('a4');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(getBillSettings());
    const unsub = subscribeToKey('bill_settings', (data: any) => {
      if (data) setSettings(data);
    });
    return () => unsub();
  }, []);

  const handleChange = (field: keyof BillSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const res = await uploadMediaFile(file, admin?.email || 'admin@alhamd.com');
    setIsUploading(false);

    if (res.success && res.item) {
      handleChange('storeLogo', res.item.url);
    }
  };

  const handleRemoveLogo = () => {
    handleChange('storeLogo', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    await updateBillSettings(settings, admin?.email || 'admin@alhamd.com');
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
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
              {isManager ? 'Store Manager Mode' : 'Admin Mode'}
            </span>
            <span className="text-xs text-neutral-400">• Centralized Billing System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
            Store &amp; Bill Settings
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Update store identity, branding logo, customer contact lines, and print notes displayed on receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSave()}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {/* Success Notification Banner */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">Settings Saved Successfully!</p>
              <p className="text-[11px] text-emerald-700 font-normal">
                All changes are now active and will automatically appear on customer bills &amp; printable invoices.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase bg-emerald-200/60 px-2 py-1 rounded text-emerald-800">
            Live Synchronized
          </span>
        </div>
      )}

      {/* Main Grid: Form Left (7 cols), Live Preview Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* 1. Store Identity & Logo */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-3.5">
              <Building2 className="w-5 h-5 text-neutral-800" />
              <h2 className="text-sm font-bold text-neutral-950 uppercase tracking-tight">
                1. Store Identity &amp; Logo
              </h2>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Store Name</label>
                <input
                  type="text"
                  value={settings.storeName}
                  onChange={(e) => handleChange('storeName', e.target.value)}
                  placeholder="e.g. AL·HAMD MOBILES"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-medium"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Prominently featured as the main header on all generated bills and receipts.
                </span>
              </div>

              {/* Logo Management */}
              <div>
                <label className="font-semibold text-neutral-800 block mb-1.5">Store Logo</label>
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
                          This logo will render on printable A4 invoices and POS thermal bills.
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
                        <p className="font-semibold text-neutral-800">No Store Logo Set</p>
                        <p className="text-[10px] text-neutral-500">
                          Upload a PNG, JPG, or WebP logo to print directly on bills
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
                      Processing &amp; uploading logo image...
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Store Address</label>
                <textarea
                  rows={2}
                  value={settings.storeAddress}
                  onChange={(e) => handleChange('storeAddress', e.target.value)}
                  placeholder="e.g. Shop # 12, Commercial Plaza, MM Alam Road, Gulberg III, Lahore, Pakistan"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-medium"
                />
              </div>
            </div>
          </div>

          {/* 2. Contact & Connectivity */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-3.5">
              <Phone className="w-5 h-5 text-neutral-800" />
              <h2 className="text-sm font-bold text-neutral-950 uppercase tracking-tight">
                2. Contact &amp; Online Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">WhatsApp Number</label>
                <div className="relative">
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={settings.whatsapp || ''}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="support@alhamd-mobile.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Website URL</label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={settings.website || ''}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="alhamd.pk"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Bill & Invoice Text Customization */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-3.5">
              <ReceiptText className="w-5 h-5 text-neutral-800" />
              <h2 className="text-sm font-bold text-neutral-950 uppercase tracking-tight">
                3. Bill &amp; Invoice Customization
              </h2>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Invoice Header Text / Tagline
                </label>
                <input
                  type="text"
                  value={settings.invoiceHeaderText || ''}
                  onChange={(e) => handleChange('invoiceHeaderText', e.target.value)}
                  placeholder="e.g. Curated Everyday Modern Luxury"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Sub-heading displayed underneath the store title on A4 and Thermal bills.
                </span>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Invoice Footer Text
                </label>
                <input
                  type="text"
                  value={settings.invoiceFooterText || ''}
                  onChange={(e) => handleChange('invoiceFooterText', e.target.value)}
                  placeholder="e.g. Thank you for your business."
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Closing gratitude note at the bottom of the invoice.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-neutral-800 block mb-1">
                    Tax / NTN Information <span className="text-neutral-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={settings.taxNumber || ''}
                      onChange={(e) => handleChange('taxNumber', e.target.value)}
                      placeholder="e.g. NTN: 1234567-8"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-neutral-800 block mb-1">
                    Thermal Receipt Note
                  </label>
                  <input
                    type="text"
                    value={settings.thermalFooterNote || ''}
                    onChange={(e) => handleChange('thermalFooterNote', e.target.value)}
                    placeholder="e.g. THANK YOU FOR YOUR PATRONAGE!"
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 uppercase font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-neutral-400">
              * Any change saved here takes effect immediately on newly opened or printed customer invoices.
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>

        {/* Right Column: Real-Time Live Bill Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-neutral-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-xs uppercase tracking-wide">Live Bill Preview</span>
            </div>
            <div className="flex items-center bg-neutral-800 p-1 rounded-xl text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setPreviewTab('a4')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  previewTab === 'a4' ? 'bg-white text-neutral-950 font-bold shadow-xs' : 'text-neutral-400 hover:text-white'
                }`}
              >
                A4 Invoice
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('thermal')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  previewTab === 'thermal' ? 'bg-white text-neutral-950 font-bold shadow-xs' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Thermal Receipt
              </button>
            </div>
          </div>

          {/* Preview Canvas */}
          <div className="bg-neutral-100 p-4 sm:p-6 rounded-3xl border border-neutral-200/80 shadow-inner overflow-hidden">
            {previewTab === 'a4' ? (
              /* A4 Simulation */
              <div className="bg-white rounded-2xl p-6 shadow-md border border-neutral-200/80 text-neutral-900 text-xs font-sans space-y-5">
                {/* Header with Logo */}
                <div className="border-b-2 border-neutral-900 pb-4">
                  {settings.storeLogo ? (
                    <div className="mb-2 max-h-12 max-w-[160px] overflow-hidden">
                      <img
                        src={settings.storeLogo}
                        alt="Logo"
                        className="max-h-12 w-auto object-contain"
                      />
                    </div>
                  ) : null}
                  <h3 className="font-black text-lg tracking-tight uppercase">
                    {settings.storeName || 'AL·HAMD'}
                  </h3>
                  {settings.invoiceHeaderText && (
                    <p className="text-[10px] text-neutral-500 font-medium tracking-wider uppercase">
                      {settings.invoiceHeaderText}
                    </p>
                  )}
                  <div className="text-[10px] text-neutral-600 mt-2 space-y-0.5">
                    <p>{settings.storeAddress}</p>
                    <p>
                      Phone: {settings.phone}
                      {settings.whatsapp ? ` • WhatsApp: ${settings.whatsapp}` : ''}
                    </p>
                    <p>
                      Email: {settings.email}
                      {settings.website ? ` • Web: ${settings.website}` : ''}
                    </p>
                    {settings.taxNumber && (
                      <p className="font-mono text-neutral-800 font-bold">Tax/NTN: {settings.taxNumber}</p>
                    )}
                  </div>
                </div>

                {/* Simulated Order Items */}
                <div className="space-y-2 py-2">
                  <div className="flex justify-between font-bold text-[10px] text-neutral-400 uppercase border-b pb-1">
                    <span>Sample Item</span>
                    <span>Total</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <div>
                      <p className="font-semibold">MagSafe Shockproof Case</p>
                      <p className="text-[9px] text-neutral-400 font-mono">SKU: ALH-MC-001 • Qty: 1</p>
                    </div>
                    <span className="font-mono font-bold">Rs. 2,499</span>
                  </div>
                </div>

                {/* Subtotal & Total */}
                <div className="border-t border-neutral-200 pt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">Rs. 2,499</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs text-neutral-950 border-t border-neutral-900 pt-1">
                    <span>Total:</span>
                    <span className="font-mono">Rs. 2,499</span>
                  </div>
                </div>

                {/* Footer Notes */}
                <div className="border-t border-neutral-200 pt-3 flex flex-col sm:flex-row justify-between items-center text-[10px] text-neutral-500 gap-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified receipt from {settings.storeName || 'AL·HAMD'}</span>
                  </div>
                  <p className="font-medium text-neutral-800">
                    {settings.invoiceFooterText || 'Thank you for your business.'}
                  </p>
                </div>
              </div>
            ) : (
              /* Thermal Simulation */
              <div className="bg-white rounded-2xl p-4 shadow-md border border-neutral-200/80 text-neutral-900 font-mono text-[10px] max-w-[280px] mx-auto text-center space-y-2">
                {settings.storeLogo ? (
                  <div className="mb-2 flex justify-center">
                    <img
                      src={settings.storeLogo}
                      alt="Logo"
                      className="max-h-10 max-w-[100px] object-contain"
                    />
                  </div>
                ) : null}
                <div className="font-bold text-xs tracking-wider uppercase">
                  {settings.storeName || 'AL·HAMD'}
                </div>
                {settings.invoiceHeaderText && (
                  <div className="text-[8px] text-neutral-500">{settings.invoiceHeaderText}</div>
                )}
                <div className="text-[9px] text-neutral-600 leading-tight">
                  {settings.storeAddress}
                </div>
                <div className="text-[9px] text-neutral-600">TEL: {settings.phone}</div>
                {settings.whatsapp && (
                  <div className="text-[9px] text-neutral-600">WA: {settings.whatsapp}</div>
                )}
                {settings.taxNumber && (
                  <div className="text-[9px] font-bold">NTN: {settings.taxNumber}</div>
                )}

                <div className="border-b border-dashed border-neutral-400 my-1"></div>

                <div className="text-left text-[9px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>INV: 2026-000123</span>
                    <span>PKR 2,499</span>
                  </div>
                </div>

                <div className="border-b border-dashed border-neutral-400 my-1"></div>

                <div className="text-[8px] text-neutral-600 space-y-0.5">
                  <div className="font-bold uppercase">
                    {settings.thermalFooterNote || 'THANK YOU FOR YOUR PATRONAGE!'}
                  </div>
                  <div>{settings.website || 'alhamd.pk'}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
