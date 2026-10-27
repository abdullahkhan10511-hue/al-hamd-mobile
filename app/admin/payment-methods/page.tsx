'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Banknote,
  Smartphone,
  ShieldCheck,
  Check,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  RotateCcw,
  Save,
  Lock,
  Info,
  Plus,
  Trash2,
  CheckCircle2,
  Sliders,
  Globe,
  Eye,
  AlertCircle,
  Copy,
  Sparkles,
} from 'lucide-react';
import {
  PaymentMethodConfig,
  PaymentSecuritySettings,
  CustomInfoBlock,
} from '@/types/admin';
import {
  getPaymentMethods,
  getPaymentSecuritySettings,
  saveCompletePaymentConfig,
  resetPaymentMethodsToDefault,
  syncPaymentMethodsFromApi,
  seedPaymentMethods,
  seedPaymentSecuritySettings,
} from '@/lib/db/paymentMethods';
import { useAdminAuth } from '@/context/AdminAuthContext';

type TabKey = 'global' | 'cod' | 'card' | 'easypaisa' | 'jazzcash' | 'preview';

export default function AdminPaymentContentManagementPage() {
  const { admin, hasPermission, isSuperAdmin } = useAdminAuth();
  const adminEmail = admin?.email || 'admin@alhamd.com';
  const canEdit = isSuperAdmin || hasPermission('settings.edit') || hasPermission('settings.manage');

  // Server/Canonical state
  const [savedMethods, setSavedMethods] = useState<PaymentMethodConfig[]>([]);
  const [savedSecurity, setSavedSecurity] = useState<PaymentSecuritySettings>(seedPaymentSecuritySettings);

  // Active Draft state for editing
  const [draftMethods, setDraftMethods] = useState<PaymentMethodConfig[]>([]);
  const [draftSecurity, setDraftSecurity] = useState<PaymentSecuritySettings>(seedPaymentSecuritySettings);

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>('global');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Disable Confirmation Modal State
  const [methodToDisable, setMethodToDisable] = useState<PaymentMethodConfig | null>(null);

  // Custom Info Block Modal State
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CustomInfoBlock | null>(null);

  // Reset to Default Confirmation Modal
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Preview interactive state
  const [previewSelectedId, setPreviewSelectedId] = useState<string>('cod');
  const [previewRefInput, setPreviewRefInput] = useState<string>('');
  const [previewCopied, setPreviewCopied] = useState(false);

  // Check if draft has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return (
      JSON.stringify(savedMethods) !== JSON.stringify(draftMethods) ||
      JSON.stringify(savedSecurity) !== JSON.stringify(draftSecurity)
    );
  }, [savedMethods, draftMethods, savedSecurity, draftSecurity]);

  // Load canonical data from storage & sync from persistent server API
  const loadData = () => {
    try {
      const methods = getPaymentMethods();
      const security = getPaymentSecuritySettings();
      setSavedMethods(methods);
      setDraftMethods(JSON.parse(JSON.stringify(methods)));
      setSavedSecurity(security);
      setDraftSecurity(JSON.parse(JSON.stringify(security)));
    } catch (err) {
      console.warn('Error loading payment methods:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    syncPaymentMethodsFromApi()
      .then((res) => {
        if (res && res.methods) {
          setSavedMethods(res.methods);
          setDraftMethods(JSON.parse(JSON.stringify(res.methods)));
          if (res.security) {
            setSavedSecurity(res.security);
            setDraftSecurity(JSON.parse(JSON.stringify(res.security)));
          }
        }
      })
      .catch((err) => console.warn('Failed initial payment sync:', err));

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Save full configuration to canonical server storage
  const handleSaveAll = async () => {
    if (!canEdit) {
      showToast('You do not have permission to modify payment settings.', true);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await saveCompletePaymentConfig(draftMethods, draftSecurity, adminEmail);
      setSavedMethods(res.methods);
      setDraftMethods(JSON.parse(JSON.stringify(res.methods)));
      setSavedSecurity(res.security);
      setDraftSecurity(JSON.parse(JSON.stringify(res.security)));
      showToast('Payment configuration and checkout content saved globally!');
    } catch (err: any) {
      console.error('Failed to save payment configuration:', err);
      showToast(err?.message || 'Failed to save payment configuration to server.', true);
    } finally {
      setIsSaving(false);
    }
  };

  // Discard draft changes and reload from canonical storage
  const handleDiscardDraft = () => {
    setDraftMethods(JSON.parse(JSON.stringify(savedMethods)));
    setDraftSecurity(JSON.parse(JSON.stringify(savedSecurity)));
    showToast('Unsaved changes discarded.');
  };

  // Reset to project defaults
  const handleConfirmReset = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      const defaults = await resetPaymentMethodsToDefault(adminEmail);
      setSavedMethods(defaults);
      setDraftMethods(JSON.parse(JSON.stringify(defaults)));
      setSavedSecurity(seedPaymentSecuritySettings);
      setDraftSecurity(JSON.parse(JSON.stringify(seedPaymentSecuritySettings)));
      setShowResetConfirm(false);
      showToast('Payment methods and content reset to standard defaults.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reset payment methods.', true);
    } finally {
      setIsSaving(false);
    }
  };

  // Method update helper
  const updateDraftMethod = (id: string, updates: Partial<PaymentMethodConfig>) => {
    setDraftMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m))
    );
  };

  // Toggle method active status with confirmation guard
  const requestToggleMethod = (method: PaymentMethodConfig) => {
    if (method.enabled) {
      // Prompt confirmation before disabling active method
      setMethodToDisable(method);
    } else {
      updateDraftMethod(method.id, { enabled: true });
      showToast(`${method.name} enabled for checkout.`);
    }
  };

  const confirmDisableMethod = () => {
    if (!methodToDisable) return;
    updateDraftMethod(methodToDisable.id, { enabled: false });
    showToast(`${methodToDisable.name} disabled from checkout.`);
    setMethodToDisable(null);
  };

  // Reorder methods
  const handleReorderMethod = (index: number, direction: 'up' | 'down') => {
    const list = [...draftMethods];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const reordered = list.map((m, idx) => ({ ...m, displayOrder: idx + 1 }));
    setDraftMethods(reordered);
  };

  // Custom Info Blocks management
  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBlock || !editingBlock.title.trim()) return;

    const currentBlocks = draftSecurity.customInfoBlocks || [];
    const isNew = !currentBlocks.some((b) => b.id === editingBlock.id);

    let updatedBlocks: CustomInfoBlock[];
    if (isNew) {
      updatedBlocks = [
        ...currentBlocks,
        {
          ...editingBlock,
          id: editingBlock.id || `block-${Date.now()}`,
          displayOrder: currentBlocks.length + 1,
        },
      ];
    } else {
      updatedBlocks = currentBlocks.map((b) => (b.id === editingBlock.id ? editingBlock : b));
    }

    setDraftSecurity((prev) => ({ ...prev, customInfoBlocks: updatedBlocks }));
    setIsBlockModalOpen(false);
    setEditingBlock(null);
    showToast('Informational block updated in draft.');
  };

  const handleToggleBlock = (blockId: string) => {
    const currentBlocks = draftSecurity.customInfoBlocks || [];
    const updated = currentBlocks.map((b) => (b.id === blockId ? { ...b, enabled: !b.enabled } : b));
    setDraftSecurity((prev) => ({ ...prev, customInfoBlocks: updated }));
  };

  const handleDeleteBlock = (blockId: string) => {
    const currentBlocks = draftSecurity.customInfoBlocks || [];
    const updated = currentBlocks.filter((b) => b.id !== blockId);
    setDraftSecurity((prev) => ({ ...prev, customInfoBlocks: updated }));
    showToast('Informational block removed from draft.');
  };

  const handleReorderBlock = (index: number, direction: 'up' | 'down') => {
    const blocks = [...(draftSecurity.customInfoBlocks || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const temp = blocks[index];
    blocks[index] = blocks[targetIndex];
    blocks[targetIndex] = temp;

    const reordered = blocks.map((b, idx) => ({ ...b, displayOrder: idx + 1 }));
    setDraftSecurity((prev) => ({ ...prev, customInfoBlocks: reordered }));
  };

  const renderMethodIcon = (id: string, className = 'w-5 h-5') => {
    switch (id) {
      case 'cod':
        return <Banknote className={`${className} text-emerald-600`} />;
      case 'card':
        return <CreditCard className={`${className} text-blue-600`} />;
      case 'easypaisa':
        return <Smartphone className={`${className} text-emerald-500`} />;
      case 'jazzcash':
        return <Smartphone className={`${className} text-amber-500`} />;
      default:
        return <CreditCard className={`${className} text-neutral-600`} />;
    }
  };

  const selectedMethodForTab = draftMethods.find((m) => m.id === activeTab);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-neutral-500 text-sm">
          <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
          Loading payment content management system...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Banner / Breadcrumb & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>Settings</span>
            <span>/</span>
            <span className="font-semibold text-neutral-900">Payment Content CMS</span>
            <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[10px] border border-emerald-200">
              <Globe className="w-3 h-3" /> Shared Globally
            </span>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium text-[10px] border border-amber-200 animate-pulse">
                Unsaved Changes
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-950 tracking-tight">
            Checkout Payment Content Management
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Customize checkout headings, payment instructions, merchant numbers, validation rules, and security notices without editing source code.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleDiscardDraft}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              Discard
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={isSaving || !canEdit}
            className="px-3.5 py-2 rounded-xl border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Reset all settings to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving || !canEdit || !hasUnsavedChanges}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-neutral-950 hover:bg-neutral-800 text-white ring-2 ring-neutral-950/20'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving Globally...
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
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs sm:text-sm text-emerald-900 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="font-semibold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-xs sm:text-sm text-red-900 shadow-xs animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-neutral-100/80 rounded-2xl border border-neutral-200 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('global')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'global'
              ? 'bg-white text-neutral-950 shadow-xs'
              : 'text-neutral-600 hover:text-neutral-950 hover:bg-white/50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Global Content & Notices
        </button>

        {draftMethods.map((m) => {
          const isActive = activeTab === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveTab(m.id as TabKey)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white text-neutral-950 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-white/50'
              }`}
            >
              {renderMethodIcon(m.id, 'w-3.5 h-3.5')}
              <span>{m.name}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  m.enabled ? 'bg-emerald-500' : 'bg-neutral-300'
                }`}
                title={m.enabled ? 'Active on checkout' : 'Disabled from checkout'}
              />
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ml-auto ${
            activeTab === 'preview'
              ? 'bg-neutral-950 text-white shadow-xs'
              : 'bg-white text-neutral-800 hover:bg-neutral-50 border border-neutral-200/80'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Live Checkout Preview
        </button>
      </div>

      {/* TAB CONTENT: GLOBAL CONTENT & NOTICES */}
      {activeTab === 'global' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
            <div className="border-b border-neutral-100 pb-4">
              <h2 className="text-base font-bold text-neutral-950">Global Checkout Header & Text</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                These texts appear prominently at Section 4 of the customer checkout page.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Section Heading
                </label>
                <input
                  type="text"
                  value={draftSecurity.sectionHeading || ''}
                  onChange={(e) =>
                    setDraftSecurity((prev) => ({ ...prev, sectionHeading: e.target.value }))
                  }
                  placeholder="e.g. 4. Choose Payment Method"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                />
                <p className="text-[11px] text-neutral-500 mt-1">Default: 4. Choose Payment Method</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  Security / Subheading Text
                </label>
                <input
                  type="text"
                  value={draftSecurity.securitySubheading || ''}
                  onChange={(e) =>
                    setDraftSecurity((prev) => ({ ...prev, securitySubheading: e.target.value }))
                  }
                  placeholder="e.g. 100% Secure Checkout"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                />
                <p className="text-[11px] text-neutral-500 mt-1">Badge text shown next to the security shield icon.</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  General Payment Instructions (Banner above methods)
                </label>
                <textarea
                  rows={2}
                  value={draftSecurity.generalInstructions || ''}
                  onChange={(e) =>
                    setDraftSecurity((prev) => ({ ...prev, generalInstructions: e.target.value }))
                  }
                  placeholder="e.g. Select your preferred payment method below. All transactions are monitored and encrypted."
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Optional introductory note shown directly under the payment method section heading.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-neutral-700" />
                  Anti-Scam & Anti-Fraud Security Notice
                </label>
                <textarea
                  rows={3}
                  value={draftSecurity.securityNotice}
                  onChange={(e) =>
                    setDraftSecurity((prev) => ({ ...prev, securityNotice: e.target.value }))
                  }
                  placeholder="Enter official store anti-scam warning..."
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white leading-relaxed"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Reassures customers to only pay via official store channels and never disclose passwords/PINs.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-neutral-700" />
                  Order Processing Hold Message (Wallet Verification)
                </label>
                <textarea
                  rows={2}
                  value={draftSecurity.processingMessage}
                  onChange={(e) =>
                    setDraftSecurity((prev) => ({ ...prev, processingMessage: e.target.value }))
                  }
                  placeholder="Orders paid via Easypaisa or JazzCash are placed on hold..."
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white leading-relaxed"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Explains the &ldquo;Awaiting Verification&rdquo; process to customers submitting Transaction IDs.
                </p>
              </div>
            </div>
          </div>

          {/* Custom Informational Blocks Manager */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-950">Additional Notices & Informational Blocks</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Add, reorder, or toggle custom informational badges (e.g. tamper-proof parcel guarantee, bank gateway updates).
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingBlock({
                    id: `block-${Date.now()}`,
                    title: '',
                    content: '',
                    type: 'info',
                    enabled: true,
                    displayOrder: (draftSecurity.customInfoBlocks?.length || 0) + 1,
                  });
                  setIsBlockModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Informational Block
              </button>
            </div>

            {(!draftSecurity.customInfoBlocks || draftSecurity.customInfoBlocks.length === 0) ? (
              <div className="p-8 text-center rounded-2xl bg-neutral-50 border border-dashed border-neutral-300 text-neutral-500 text-xs">
                No custom informational blocks configured. Click &ldquo;Add Informational Block&rdquo; to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {draftSecurity.customInfoBlocks
                  .slice()
                  .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                  .map((block, idx) => {
                    return (
                      <div
                        key={block.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          block.enabled
                            ? 'bg-white border-neutral-200 shadow-2xs'
                            : 'bg-neutral-50/70 border-neutral-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                              block.type === 'warning'
                                ? 'bg-amber-100 text-amber-800'
                                : block.type === 'security'
                                ? 'bg-blue-100 text-blue-800'
                                : block.type === 'tip'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-neutral-100 text-neutral-800'
                            }`}
                          >
                            {block.type === 'warning' ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : block.type === 'security' ? (
                              <ShieldCheck className="w-4 h-4" />
                            ) : (
                              <Info className="w-4 h-4" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-950">{block.title}</span>
                              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-semibold">
                                {block.type || 'info'}
                              </span>
                              {!block.enabled && (
                                <span className="text-[10px] font-semibold text-neutral-400 italic">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-600 mt-1 whitespace-pre-line leading-relaxed">
                              {block.content}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleReorderBlock(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReorderBlock(idx, 'down')}
                            disabled={idx === (draftSecurity.customInfoBlocks?.length || 0) - 1}
                            className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleBlock(block.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                              block.enabled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
                            }`}
                          >
                            {block.enabled ? 'Active' : 'Disabled'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingBlock({ ...block });
                              setIsBlockModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 cursor-pointer"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(block.id)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Delete Block"
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
        </div>
      )}

      {/* TAB CONTENT: SPECIFIC PAYMENT METHOD EDITOR */}
      {selectedMethodForTab && activeTab !== 'global' && activeTab !== 'preview' && (
        <div className="space-y-6">
          {/* Method Header & Status Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-neutral-100 border border-neutral-200">
                  {renderMethodIcon(selectedMethodForTab.id, 'w-6 h-6')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-neutral-950">{selectedMethodForTab.name}</h2>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 font-bold">
                      ID: {selectedMethodForTab.id}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Core Method
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Internal payment identifier is protected to preserve historical orders and bills.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = draftMethods.findIndex((m) => m.id === selectedMethodForTab.id);
                      handleReorderMethod(idx, 'up');
                    }}
                    disabled={selectedMethodForTab.displayOrder <= 1}
                    className="p-1.5 rounded-lg hover:bg-white text-neutral-600 disabled:opacity-30 cursor-pointer"
                    title="Move Higher in Checkout List"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold px-2 text-neutral-700">
                    #{selectedMethodForTab.displayOrder}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = draftMethods.findIndex((m) => m.id === selectedMethodForTab.id);
                      handleReorderMethod(idx, 'down');
                    }}
                    disabled={selectedMethodForTab.displayOrder >= draftMethods.length}
                    className="p-1.5 rounded-lg hover:bg-white text-neutral-600 disabled:opacity-30 cursor-pointer"
                    title="Move Lower in Checkout List"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => requestToggleMethod(selectedMethodForTab)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                    selectedMethodForTab.enabled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      selectedMethodForTab.enabled ? 'bg-emerald-600' : 'bg-neutral-400'
                    }`}
                  />
                  {selectedMethodForTab.enabled ? 'Enabled at Checkout' : 'Disabled / Hidden'}
                </button>
              </div>
            </div>

            {/* Editable Content Fields */}
            <div className="space-y-6">
              {/* Group 1: Basic Display */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                  1. Checkout Card & Display Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.name}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { name: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Short Badge Label
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.badgeText || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { badgeText: e.target.value })
                      }
                      placeholder="e.g. EP, JC, COD"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">Short badge displayed in the radio card.</p>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Short Description (Summary shown on method card)
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.description}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { description: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Payment Details Heading (Shown at top of expanded panel)
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.detailsHeading || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { detailsHeading: e.target.value })
                      }
                      placeholder={`e.g. Payment Details: ${selectedMethodForTab.name}`}
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Full Payment Instructions (Preserves line breaks and steps)
                    </label>
                    <textarea
                      rows={4}
                      value={selectedMethodForTab.instructions}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { instructions: e.target.value })
                      }
                      placeholder="Enter step-by-step customer payment instructions..."
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white font-mono leading-relaxed"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Numbered lines and line breaks will be preserved exactly as entered.
                    </p>
                  </div>
                </div>
              </div>

              {/* Group 2: Official Account / Merchant Details */}
              <div className="pt-4 border-t border-neutral-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                  2. Official Account & Identifier Box
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Account Section Heading
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.accountSectionHeading || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { accountSectionHeading: e.target.value })
                      }
                      placeholder="e.g. Official Payment Account"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Account / Business Name Label
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.accountNameLabel || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { accountNameLabel: e.target.value })
                      }
                      placeholder="e.g. Account / Business Name"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Official Account Name Value
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.merchantName || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { merchantName: e.target.value })
                      }
                      placeholder="e.g. AL-HAMD-MOBILE OFFICIAL"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Official Payment Number / ID Value
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.merchantIdentifier || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { merchantIdentifier: e.target.value })
                      }
                      placeholder="e.g. 0300-1234567"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">Customers can tap to copy this number.</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Account Box Help / Note Text
                    </label>
                    <textarea
                      rows={2}
                      value={selectedMethodForTab.accountHelpText || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { accountHelpText: e.target.value })
                      }
                      placeholder="e.g. 💡 Please include your customer contact number or upcoming Order ID in the payment message..."
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Reference / Transaction ID (TID) Rules */}
              <div className="pt-4 border-t border-neutral-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                  3. Payment Reference / Transaction ID (TID) Validation
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMethodForTab.requiresReference}
                        onChange={(e) =>
                          updateDraftMethod(selectedMethodForTab.id, { requiresReference: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-neutral-950 focus:ring-neutral-950 border-neutral-300"
                      />
                      <span className="text-xs font-bold text-neutral-900">
                        Require Customer Transaction ID / Reference before order submission
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Reference Field Label
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.referenceLabel || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { referenceLabel: e.target.value })
                      }
                      placeholder="e.g. Payment Reference / Transaction ID (TID) *"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Placeholder & Format Example
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.referencePlaceholder || selectedMethodForTab.referenceFormat || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, {
                          referencePlaceholder: e.target.value,
                          referenceFormat: e.target.value,
                        })
                      }
                      placeholder="e.g. TID: 109823019 (11 digits)"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Minimum Length (Digits)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={selectedMethodForTab.minReferenceLength ?? ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, {
                          minReferenceLength: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                      placeholder="e.g. 11"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Maximum Length (Digits)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={selectedMethodForTab.maxReferenceLength ?? ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, {
                          maxReferenceLength: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                      placeholder="e.g. 11"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Custom Validation Error Message
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.referenceValidationMessage || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, {
                          referenceValidationMessage: e.target.value,
                        })
                      }
                      placeholder="e.g. Please enter a valid 11-digit Easypaisa Transaction ID (TID)."
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Reference Input Help Text
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.referenceHelpText || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, {
                          referenceHelpText: e.target.value,
                        })
                      }
                      placeholder="e.g. After sending payment from your mobile wallet, paste the reference ID from your SMS above."
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Group 4: Warning, Certification & Info Notices */}
              <div className="pt-4 border-t border-neutral-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                  4. Method Warning & Certification Notice
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Warning Box Heading
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.warningHeading || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { warningHeading: e.target.value })
                      }
                      placeholder="e.g. Card Gateway Under Banking Certification"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Optional Informational Notice
                    </label>
                    <input
                      type="text"
                      value={selectedMethodForTab.infoMessage || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { infoMessage: e.target.value })
                      }
                      placeholder="e.g. Rider verification required upon parcel handover."
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Warning / Certification Message Text
                    </label>
                    <textarea
                      rows={3}
                      value={selectedMethodForTab.warningMessage || ''}
                      onChange={(e) =>
                        updateDraftMethod(selectedMethodForTab.id, { warningMessage: e.target.value })
                      }
                      placeholder="e.g. Direct credit/debit card processing is currently undergoing banking PCI-DSS integration..."
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:bg-white leading-relaxed"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Rendered in a prominent amber alert box when this payment method is selected.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: LIVE CHECKOUT PREVIEW */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-neutral-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold">Interactive Checkout Preview</h3>
                <p className="text-xs text-neutral-400">
                  This simulates Section 4 of the customer checkout based on your current draft settings.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700 shrink-0">
              Safe Mode — No Real Orders Placed
            </span>
          </div>

          {/* Actual Rendered Customer View */}
          <div className="max-w-3xl mx-auto bg-neutral-100/60 p-4 sm:p-8 rounded-3xl border border-neutral-200/80">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-neutral-950">
                  {draftSecurity.sectionHeading || '4. Choose Payment Method'}
                </h2>
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {draftSecurity.securitySubheading || '100% Secure Checkout'}
                </span>
              </div>

              {draftSecurity.generalInstructions && (
                <div className="text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-200/60 leading-relaxed whitespace-pre-line">
                  {draftSecurity.generalInstructions}
                </div>
              )}

              {/* Method Radio Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {draftMethods
                  .filter((m) => m.enabled)
                  .map((m) => {
                    const isSelected = previewSelectedId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPreviewSelectedId(m.id);
                          setPreviewRefInput('');
                        }}
                        className={`p-4 text-left rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 relative ${
                          isSelected
                            ? 'border-neutral-950 bg-neutral-50/70 shadow-xs'
                            : 'border-neutral-200 hover:border-neutral-300 bg-white'
                        }`}
                      >
                        <div className="mt-0.5">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-neutral-950' : 'border-neutral-300'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-neutral-950" />}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              {renderMethodIcon(m.id)}
                              <span className="text-xs font-bold text-neutral-950 truncate">{m.name}</span>
                            </div>
                            {m.badgeText && (
                              <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-neutral-200/80 text-neutral-700 shrink-0 uppercase font-mono">
                                {m.badgeText}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-500 leading-snug line-clamp-2">
                            {m.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Selected Method Details Panel */}
              {(() => {
                const selectedMethod = draftMethods.find((m) => m.id === previewSelectedId) || draftMethods.find((m) => m.enabled);
                if (!selectedMethod) return null;

                return (
                  <div className="mt-4 p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-200/70 pb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                        {selectedMethod.detailsHeading || `Payment Details: ${selectedMethod.name}`}
                      </span>
                      <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest font-mono">
                        {selectedMethod.type === 'cod'
                          ? 'Cash Handover'
                          : selectedMethod.type === 'card'
                          ? 'Bank Gateway'
                          : 'Mobile Wallet'}
                      </span>
                    </div>

                    {/* Description & Instructions */}
                    <div className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-neutral-200/80">
                      {selectedMethod.description && (
                        <p className="font-semibold text-neutral-900 mb-1">{selectedMethod.description}</p>
                      )}
                      <p className="text-neutral-600">{selectedMethod.instructions}</p>
                    </div>

                    {/* Warning / Certification Notice */}
                    {(selectedMethod.warningMessage || (selectedMethod.id === 'card' && !selectedMethod.isConfigured)) && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">
                            {selectedMethod.warningHeading || 'Notice'}
                          </p>
                          <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed whitespace-pre-line">
                            {selectedMethod.warningMessage ||
                              'Direct credit/debit card processing is currently undergoing banking PCI-DSS integration with State Bank of Pakistan compliant gateways.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Info Notice */}
                    {selectedMethod.infoMessage && (
                      <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-900">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed whitespace-pre-line">
                          {selectedMethod.infoMessage}
                        </p>
                      </div>
                    )}

                    {/* Official Account Box */}
                    {(selectedMethod.merchantName || selectedMethod.merchantIdentifier) && (
                      <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                            {selectedMethod.accountSectionHeading || 'Official Payment Account'}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                            Verified Store Account
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                          {selectedMethod.merchantName && (
                            <div className="bg-white p-3 rounded-lg border border-emerald-200/60">
                              <span className="text-[10px] font-sans uppercase font-bold text-neutral-500 block mb-0.5">
                                {selectedMethod.accountNameLabel || 'Account / Business Name'}
                              </span>
                              <span className="font-bold text-neutral-900 text-xs">
                                {selectedMethod.merchantName}
                              </span>
                            </div>
                          )}

                          {selectedMethod.merchantIdentifier && (
                            <div className="bg-white p-3 rounded-lg border border-emerald-200/60 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-sans uppercase font-bold text-neutral-500 block mb-0.5">
                                  {selectedMethod.accountNumberLabel || 'Official Payment Number / ID'}
                                </span>
                                <span className="font-bold text-neutral-900 text-xs">
                                  {selectedMethod.merchantIdentifier}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewCopied(true);
                                  setTimeout(() => setPreviewCopied(false), 2000);
                                }}
                                className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                                title="Copy Account Number"
                              >
                                {previewCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {selectedMethod.accountHelpText && (
                          <p className="text-[11px] text-emerald-900/80 font-sans whitespace-pre-line">
                            {selectedMethod.accountHelpText}
                          </p>
                        )}
                      </div>
                    )}

                    {/* TID Input */}
                    {selectedMethod.requiresReference && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-neutral-800">
                            {selectedMethod.referenceLabel || 'Payment Reference / Transaction ID (TID) *'}
                          </label>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {selectedMethod.referenceFormat || 'Required for verification'}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={previewRefInput}
                          onChange={(e) => setPreviewRefInput(e.target.value)}
                          placeholder={
                            selectedMethod.referencePlaceholder ||
                            selectedMethod.referenceFormat ||
                            'e.g. TID: 109823019'
                          }
                          className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:border-neutral-950"
                        />
                        {selectedMethod.referenceHelpText && (
                          <p className="text-[11px] text-neutral-500 whitespace-pre-line">
                            {selectedMethod.referenceHelpText}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Anti-Scam Security Notice */}
                    {draftSecurity.securityNotice && (
                      <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-200/80 flex items-start gap-2.5 text-[11px] text-neutral-600 leading-relaxed">
                        <Lock className="w-3.5 h-3.5 text-neutral-700 shrink-0 mt-0.5" />
                        <p className="whitespace-pre-line">{draftSecurity.securityNotice}</p>
                      </div>
                    )}

                    {/* Custom Informational Blocks */}
                    {Array.isArray(draftSecurity.customInfoBlocks) &&
                      draftSecurity.customInfoBlocks.filter((b) => b.enabled).length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-neutral-200/70">
                          {draftSecurity.customInfoBlocks
                            .filter((b) => b.enabled)
                            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                            .map((block) => {
                              const isWarn = block.type === 'warning';
                              const isSec = block.type === 'security';
                              return (
                                <div
                                  key={block.id}
                                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                                    isWarn
                                      ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                                      : isSec
                                      ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                                      : 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                                  }`}
                                >
                                  {isWarn ? (
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  ) : isSec ? (
                                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                  ) : (
                                    <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                  )}
                                  <div>
                                    <p className="font-bold text-xs">{block.title}</p>
                                    <p className="text-[11px] mt-0.5 leading-relaxed opacity-90 whitespace-pre-line">
                                      {block.content}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Disable Confirmation Modal */}
      {methodToDisable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-950">
                Disable {methodToDisable.name}?
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Customers will no longer be able to select <strong>{methodToDisable.name}</strong> on the checkout page. Existing orders, payment history, and invoices will remain intact.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setMethodToDisable(null)}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDisableMethod}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                Yes, Disable Method
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Info Block Editor Modal */}
      {isBlockModalOpen && editingBlock && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-950">
                {editingBlock.title ? 'Edit Informational Block' : 'Add Informational Block'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsBlockModalOpen(false);
                  setEditingBlock(null);
                }}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Block Title *
                </label>
                <input
                  type="text"
                  required
                  value={editingBlock.title}
                  onChange={(e) => setEditingBlock({ ...editingBlock, title: e.target.value })}
                  placeholder="e.g. Discreet & Secure Parcel Handling"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Block Type
                </label>
                <select
                  value={editingBlock.type || 'info'}
                  onChange={(e) =>
                    setEditingBlock({
                      ...editingBlock,
                      type: e.target.value as 'info' | 'warning' | 'security' | 'tip',
                    })
                  }
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                >
                  <option value="tip">Tip / Guarantee (Emerald)</option>
                  <option value="security">Security / Anti-Fraud (Blue)</option>
                  <option value="warning">Warning / Notice (Amber)</option>
                  <option value="info">General Info (Neutral)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Content *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingBlock.content}
                  onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                  placeholder="Explain details to the customer..."
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 leading-relaxed"
                />
              </div>

              <div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingBlock.enabled}
                    onChange={(e) => setEditingBlock({ ...editingBlock, enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-neutral-950 focus:ring-neutral-950 border-neutral-300"
                  />
                  <span className="text-xs font-semibold text-neutral-800">
                    Enable this block on customer checkout
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsBlockModalOpen(false);
                    setEditingBlock(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  Apply Block to Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 rounded-2xl bg-red-50 border border-red-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-950">
                Reset Payment Settings to Default?
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              This will restore standard Pakistan payment methods (COD, Card, Easypaisa, JazzCash) and project default instructions. Any custom account numbers or notices will be reset.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
