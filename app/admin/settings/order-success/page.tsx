'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Save,
  RotateCcw,
  Sliders,
  ExternalLink,
  Info,
  Check,
  AlertTriangle,
  ArrowRight,
  Eye,
} from 'lucide-react';
import {
  OrderSuccessPageSettings,
  DEFAULT_ORDER_SUCCESS_SETTINGS,
  replaceOrderSuccessPlaceholders,
} from '@/lib/db/siteUiSettings';

export default function OrderSuccessAdminPage() {
  const [settings, setSettings] = useState<OrderSuccessPageSettings>(DEFAULT_ORDER_SUCCESS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableExists, setTableExists] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/ui-settings');
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.orderSuccess) {
          setSettings(data.orderSuccess);
        }
        if (typeof data.tableExists === 'boolean') {
          setTableExists(data.tableExists);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load Order Success page settings.');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/admin/ui-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order_success',
          data: settings,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to save (HTTP ${res.status})`);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Reset all Order Success page texts to factory defaults?')) {
      setSettings(DEFAULT_ORDER_SUCCESS_SETTINGS);
    }
  };

  // Sample data for the live interactive preview box
  const sampleData = {
    customerName: 'Muhammad Ali',
    orderNumber: '10482',
    invoiceNumber: 'INV-2026-0089',
    total: 'Rs. 4,850',
    phone: '03432200995',
    paymentMethod: 'Cash on Delivery (COD)',
  };

  const previewBadge = replaceOrderSuccessPlaceholders(settings.badgeText, sampleData);
  const previewHeading = replaceOrderSuccessPlaceholders(settings.heading, sampleData);
  const previewMessage = replaceOrderSuccessPlaceholders(settings.message, sampleData);
  const previewFootnote = replaceOrderSuccessPlaceholders(settings.footnoteText, sampleData);

  const previewLabelOrderNumber = replaceOrderSuccessPlaceholders(settings.labelOrderNumber, sampleData);
  const previewLabelInvoiceNumber = replaceOrderSuccessPlaceholders(settings.labelInvoiceNumber, sampleData);
  const previewLabelOrderStatus = replaceOrderSuccessPlaceholders(settings.labelOrderStatus, sampleData);
  const previewLabelPaymentMethod = replaceOrderSuccessPlaceholders(settings.labelPaymentMethod, sampleData);
  const previewLabelPaymentReference = replaceOrderSuccessPlaceholders(settings.labelPaymentReference, sampleData);
  const previewLabelTotalAmount = replaceOrderSuccessPlaceholders(settings.labelTotalAmount, sampleData);

  const previewPrimaryBtnLabel = replaceOrderSuccessPlaceholders(settings.primaryButtonLabel, sampleData);
  const previewSecondaryBtnLabel = replaceOrderSuccessPlaceholders(settings.secondaryButtonLabel, sampleData);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
              Order Success Page
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Customize the thank-you screen shown to customers immediately after checkout.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={saving || loading}
            className="px-3.5 py-2 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="submit"
            form="order-success-form"
            disabled={saving || loading}
            className="px-4 py-2 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Saved and live. Storefront checkout confirmation reflects these updates.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Supported Placeholders Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 border border-neutral-200/90 text-xs space-y-2">
        <div className="flex items-center gap-2 text-neutral-800 font-bold">
          <Info className="w-4 h-4 text-emerald-600" />
          <span>Available Dynamic Placeholders</span>
        </div>
        <p className="text-neutral-600 leading-relaxed">
          You can use any of these placeholders in titles, messages, labels, and footnotes. They are replaced with clean plain text on checkout completion:
        </p>
        <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-800">
            {'{customerName}'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-800">
            {'{orderNumber}'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-800">
            {'{invoiceNumber}'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-800">
            {'{total}'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-800">
            {'{phone}'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-800">
            {'{paymentMethod}'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Controls */}
        <form
          id="order-success-form"
          onSubmit={handleSave}
          className="lg:col-span-7 space-y-6 bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/90 shadow-xs"
        >
          {/* Section 1: Main Header & Copy */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-2">
              1. Header & Message
            </h2>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Badge Text (max 60 chars)
              </label>
              <input
                type="text"
                maxLength={60}
                value={settings.badgeText}
                onChange={(e) => setSettings({ ...settings, badgeText: e.target.value })}
                placeholder="e.g. ORDER PLACED SUCCESSFULLY"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Main Heading (max 120 chars)
              </label>
              <input
                type="text"
                maxLength={120}
                value={settings.heading}
                onChange={(e) => setSettings({ ...settings, heading: e.target.value })}
                placeholder="e.g. Thank You for Your Order!"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Thank-You Paragraph (max 600 chars)
              </label>
              <textarea
                rows={4}
                maxLength={600}
                value={settings.message}
                onChange={(e) => setSettings({ ...settings, message: e.target.value })}
                placeholder="Thank you message..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-y"
              />
            </div>
          </div>

          {/* Section 2: Order Reference Row Labels */}
          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-2">
              2. Order Summary Row Labels
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Order Number Label
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={settings.labelOrderNumber}
                  onChange={(e) => setSettings({ ...settings, labelOrderNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Invoice Number Label
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={settings.labelInvoiceNumber}
                  onChange={(e) => setSettings({ ...settings, labelInvoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Order Status Label
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={settings.labelOrderStatus}
                  onChange={(e) => setSettings({ ...settings, labelOrderStatus: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Payment Method Label
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={settings.labelPaymentMethod}
                  onChange={(e) => setSettings({ ...settings, labelPaymentMethod: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Payment Reference (TID) Label
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={settings.labelPaymentReference}
                  onChange={(e) => setSettings({ ...settings, labelPaymentReference: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Total Amount Label
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={settings.labelTotalAmount}
                  onChange={(e) => setSettings({ ...settings, labelTotalAmount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Notification Footnote Line */}
          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-2">
              3. Confirmation Footnote Notice
            </h2>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80">
              <div>
                <span className="text-xs font-bold text-neutral-900 block">
                  Show Dispatched / Confirmation Footnote
                </span>
                <span className="text-[11px] text-neutral-500">
                  Default: Off. Enable only if automated SMS/WhatsApp alerts are actively dispatched.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.showFootnote}
                onChange={(e) => setSettings({ ...settings, showFootnote: e.target.checked })}
                className="w-4 h-4 rounded text-neutral-950 focus:ring-neutral-900 cursor-pointer"
              />
            </div>

            {settings.showFootnote && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Footnote Notice Text (max 200 chars)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={settings.footnoteText}
                  onChange={(e) => setSettings({ ...settings, footnoteText: e.target.value })}
                  placeholder="e.g. A confirmation has also been dispatched to {phone}."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            )}
          </div>

          {/* Section 4: Action Buttons */}
          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-2">
              4. Navigation & Action Buttons
            </h2>

            {/* Primary Button */}
            <div className="space-y-3 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
              <span className="text-xs font-bold text-neutral-900 block">Primary Button (Always Visible)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Button Label (max 40)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={settings.primaryButtonLabel}
                    onChange={(e) => setSettings({ ...settings, primaryButtonLabel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Destination Link (relative / or https://)
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={settings.primaryButtonLink}
                    onChange={(e) => setSettings({ ...settings, primaryButtonLink: e.target.value })}
                    placeholder="/shop"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Secondary Button */}
            <div className="space-y-3 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-900 block">Optional Secondary Button</span>
                  <span className="text-[11px] text-neutral-500">Provide an extra call-to-action link (e.g. Account or Inquiries).</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.secondaryButtonEnabled}
                  onChange={(e) => setSettings({ ...settings, secondaryButtonEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-neutral-950 focus:ring-neutral-900 cursor-pointer"
                />
              </div>

              {settings.secondaryButtonEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Button Label (max 40)
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      value={settings.secondaryButtonLabel}
                      onChange={(e) => setSettings({ ...settings, secondaryButtonLabel: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                      Destination Link (relative / or https://)
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={settings.secondaryButtonLink}
                      onChange={(e) => setSettings({ ...settings, secondaryButtonLink: e.target.value })}
                      placeholder="/account"
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Live Interactive Preview Box */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-24">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Storefront Preview
            </span>
            <span className="text-[11px] text-neutral-400 font-medium">Live Sample Rendering</span>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-neutral-200/80 text-center">
            {/* Success icon */}
            <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <div className="relative w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500/20 text-emerald-600 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
              </div>
            </div>

            {/* Badge */}
            {previewBadge ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold tracking-wider uppercase mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {previewBadge}
              </div>
            ) : null}

            {/* Heading */}
            {previewHeading ? (
              <h3 className="text-xl font-extrabold text-neutral-950 tracking-tight leading-snug">
                {previewHeading}
              </h3>
            ) : null}

            {/* Message */}
            {previewMessage ? (
              <p className="text-xs text-neutral-600 mt-3 leading-relaxed font-normal whitespace-pre-line px-1">
                {previewMessage}
              </p>
            ) : null}

            {/* Order Card Preview */}
            <div className="mt-6 mb-6 p-4 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-neutral-200/70">
                <span className="text-neutral-500">{previewLabelOrderNumber || 'Order Number'}:</span>
                <span className="font-mono font-extrabold text-neutral-950">#{sampleData.orderNumber}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500">{previewLabelInvoiceNumber || 'Invoice Number'}:</span>
                <span className="font-mono font-semibold text-neutral-800">{sampleData.invoiceNumber}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500">{previewLabelOrderStatus || 'Order Status'}:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Confirmed
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500">{previewLabelPaymentMethod || 'Payment Method'}:</span>
                <span className="font-semibold text-neutral-900">{sampleData.paymentMethod}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-neutral-200/70">
                <span className="text-neutral-600 font-semibold">{previewLabelTotalAmount || 'Total Amount'}:</span>
                <span className="font-mono font-extrabold text-base text-emerald-600">
                  {sampleData.total}
                </span>
              </div>
            </div>

            {/* Footnote preview */}
            {settings.showFootnote && previewFootnote ? (
              <p className="text-[11px] text-neutral-500 mb-5">
                {previewFootnote}
              </p>
            ) : null}

            {/* Action buttons */}
            <div className="space-y-2.5">
              <div className="w-full py-3 px-4 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 pointer-events-none">
                <span>{previewPrimaryBtnLabel || 'CONTINUE SHOPPING'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>

              {settings.secondaryButtonEnabled ? (
                <div className="w-full py-2.5 px-4 rounded-full bg-neutral-100 text-neutral-900 font-bold text-xs tracking-wider uppercase border border-neutral-200 flex items-center justify-center gap-2 pointer-events-none">
                  <span>{previewSecondaryBtnLabel || 'VIEW DETAILS'}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

