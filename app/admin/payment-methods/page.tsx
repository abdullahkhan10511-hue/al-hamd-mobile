'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Banknote,
  Smartphone,
  ShieldCheck,
  Edit2,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  RotateCcw,
  Save,
  Lock,
  ExternalLink,
  Info,
} from 'lucide-react';
import { PaymentMethodConfig, PaymentSecuritySettings } from '@/types/admin';
import {
  getPaymentMethods,
  updatePaymentMethod,
  togglePaymentMethod,
  reorderPaymentMethods,
  getPaymentSecuritySettings,
  updatePaymentSecuritySettings,
  resetPaymentMethodsToDefault,
} from '@/lib/db/paymentMethods';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function AdminPaymentMethodsPage() {
  const { admin } = useAdminAuth();
  const adminEmail = admin?.email || 'admin@alhamd.com';

  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [securitySettings, setSecuritySettings] = useState<PaymentSecuritySettings | null>(null);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Security Notice Edit State
  const [securityNoticeText, setSecurityNoticeText] = useState('');
  const [processingMessageText, setProcessingMessageText] = useState('');
  const [manualVerificationEnabled, setManualVerificationEnabled] = useState(true);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  const loadData = () => {
    const list = getPaymentMethods();
    setMethods(list);
    const sec = getPaymentSecuritySettings();
    setSecuritySettings(sec);
    setSecurityNoticeText(sec.securityNotice);
    setProcessingMessageText(sec.processingMessage);
    setManualVerificationEnabled(sec.manualVerificationEnabled);
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerNotice = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  const handleToggle = async (id: string) => {
    await togglePaymentMethod(id, adminEmail);
    loadData();
    triggerNotice('Payment method visibility updated.');
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newMethods = [...methods];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newMethods.length) return;

    const temp = newMethods[index];
    newMethods[index] = newMethods[targetIndex];
    newMethods[targetIndex] = temp;

    const orderedIds = newMethods.map((m) => m.id);
    await reorderPaymentMethods(orderedIds, adminEmail);
    loadData();
    triggerNotice('Display order updated.');
  };

  const handleOpenEdit = (method: PaymentMethodConfig) => {
    setEditingMethod({ ...method });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMethod) return;

    setIsSaving(true);
    try {
      await updatePaymentMethod(
        editingMethod.id,
        {
          name: editingMethod.name.trim(),
          description: editingMethod.description.trim(),
          instructions: editingMethod.instructions.trim(),
          merchantName: editingMethod.merchantName?.trim() || undefined,
          merchantIdentifier: editingMethod.merchantIdentifier?.trim() || undefined,
          requiresReference: editingMethod.requiresReference,
          referenceFormat: editingMethod.referenceFormat?.trim() || undefined,
          displayOrder: Number(editingMethod.displayOrder) || 1,
        },
        adminEmail
      );
      loadData();
      setEditingMethod(null);
      triggerNotice(`Updated "${editingMethod.name}" successfully.`);
    } catch (err) {
      console.error(err);
      alert('Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSecuritySettings = async () => {
    setIsSavingSecurity(true);
    try {
      await updatePaymentSecuritySettings(
        {
          securityNotice: securityNoticeText.trim(),
          processingMessage: processingMessageText.trim(),
          manualVerificationEnabled,
        },
        adminEmail
      );
      loadData();
      triggerNotice('Security notice and anti-fraud rules saved.');
    } catch (err) {
      console.error(err);
      alert('Failed to save security settings.');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleResetDefaults = async () => {
    if (
      confirm(
        'Reset all payment methods and security notices to standard default Pakistan settings? Custom descriptions will be replaced.'
      )
    ) {
      await resetPaymentMethodsToDefault(adminEmail);
      loadData();
      triggerNotice('Payment methods reset to default settings.');
    }
  };

  const getMethodIcon = (id: string) => {
    if (id === 'cod') return <Banknote className="w-5 h-5 text-emerald-600" />;
    if (id === 'card') return <CreditCard className="w-5 h-5 text-blue-600" />;
    if (id === 'easypaisa') return <Smartphone className="w-5 h-5 text-emerald-700" />;
    if (id === 'jazzcash') return <Smartphone className="w-5 h-5 text-rose-600" />;
    return <CreditCard className="w-5 h-5 text-neutral-600" />;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 uppercase">
            Payment Methods
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Configure Pakistan payment options, merchant accounts, customer instructions, and security rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Restore Defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {successNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-medium flex items-center gap-2 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Security Architecture Notice (PCI-DSS & Safe Payment Standards) */}
      <div className="p-4 bg-neutral-900 text-white rounded-2xl flex items-start gap-3.5 shadow-md">
        <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-white tracking-wide uppercase">
            PCI-DSS Compliance & Anti-Fraud Architecture
          </p>
          <p className="text-neutral-300 leading-relaxed">
            Raw Credit/Debit card numbers, CVVs, or card PINs are <strong>never collected or stored</strong> in our database.
            Online card payments utilize server-side gateway abstractions. Wallet transfers (Easypaisa &amp; JazzCash)
            only require customer transaction references (TID) for manual reconciliation.
          </p>
        </div>
      </div>

      {/* Payment Methods Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
            Active Payment Channels ({methods.length})
          </h2>
          <span className="text-xs text-neutral-500">
            Reorder determines display sequence on customer checkout
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {methods.map((method, index) => (
            <div
              key={method.id}
              className={`p-5 rounded-2xl border transition-all ${
                method.enabled
                  ? 'bg-white border-neutral-200/90 shadow-xs'
                  : 'bg-neutral-50/70 border-neutral-200 opacity-75'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
                    {getMethodIcon(method.id)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-neutral-950 text-sm">{method.name}</span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                        {method.type}
                      </span>
                      {method.enabled ? (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active in Checkout
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-neutral-200 text-neutral-600">
                          Disabled
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-neutral-400">
                        Order #{method.displayOrder}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-600 line-clamp-1">{method.description}</p>

                    {(method.merchantName || method.merchantIdentifier) && (
                      <div className="pt-1 flex items-center gap-3 text-[11px] font-mono text-neutral-700">
                        {method.merchantName && (
                          <span>
                            Account: <strong>{method.merchantName}</strong>
                          </span>
                        )}
                        {method.merchantIdentifier && (
                          <span>
                            No/ID: <strong>{method.merchantIdentifier}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {/* Move Up/Down */}
                  <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50 overflow-hidden">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="p-2 hover:bg-neutral-200 text-neutral-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-[1px] h-4 bg-neutral-200" />
                    <button
                      type="button"
                      disabled={index === methods.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="p-2 hover:bg-neutral-200 text-neutral-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Enable/Disable Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggle(method.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                      method.enabled
                        ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    }`}
                  >
                    {method.enabled ? 'Disable' : 'Enable'}
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(method)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              {/* Instructions preview */}
              <div className="mt-3 pt-3 border-t border-neutral-100 text-[11px] text-neutral-500">
                <span className="font-semibold text-neutral-700">Checkout Instructions:</span>{' '}
                <span className="italic">{method.instructions.slice(0, 120)}...</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security & Anti-Scam Notice Editor (Requirement 12) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Anti-Scam &amp; Security Notice Management
              </h2>
              <p className="text-xs text-neutral-500">
                Customer-facing notice displayed near online payment instructions on checkout
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Customer Anti-Scam Security Notice *
            </label>
            <textarea
              rows={3}
              value={securityNoticeText}
              onChange={(e) => setSecurityNoticeText(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-950 font-sans"
              placeholder="Enter official payment warning to protect customers against fraud..."
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Warns customers to only transfer funds to official store accounts and never share OTP/PINs.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Payment Processing &amp; Verification Notice
            </label>
            <textarea
              rows={2}
              value={processingMessageText}
              onChange={(e) => setProcessingMessageText(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-950 font-sans"
              placeholder="Explanation for manual wallet verification workflow..."
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-800">
              <input
                type="checkbox"
                checked={manualVerificationEnabled}
                onChange={(e) => setManualVerificationEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950"
              />
              <span>Enable Manual Payment Verification Workflow (Awaiting Verification)</span>
            </label>

            <button
              type="button"
              onClick={handleSaveSecuritySettings}
              disabled={isSavingSecurity}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingSecurity ? 'Saving...' : 'Save Security Notice'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Edit Payment Method Modal */}
      {editingMethod && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center">
                  {getMethodIcon(editingMethod.id)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-950">
                    Edit Payment Method: {editingMethod.name}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    ID: <code className="font-mono text-neutral-800">{editingMethod.id}</code>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingMethod(null)}
                className="w-8 h-8 rounded-lg hover:bg-neutral-100 text-neutral-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Display Name / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMethod.name}
                    onChange={(e) => setEditingMethod({ ...editingMethod, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Short Description (Checkout Card Tagline) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMethod.description}
                    onChange={(e) =>
                      setEditingMethod({ ...editingMethod, description: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Full Customer Instructions (Shown in Expandable Panel) *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={editingMethod.instructions}
                    onChange={(e) =>
                      setEditingMethod({ ...editingMethod, instructions: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  />
                </div>

                {/* Specific Fields for Wallet or Direct Accounts */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Official Merchant / Account Name
                  </label>
                  <input
                    type="text"
                    value={editingMethod.merchantName || ''}
                    onChange={(e) =>
                      setEditingMethod({ ...editingMethod, merchantName: e.target.value })
                    }
                    placeholder="e.g. AL-HAMD-MOBILE TRADING"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Official Payment Number / Merchant ID
                  </label>
                  <input
                    type="text"
                    value={editingMethod.merchantIdentifier || ''}
                    onChange={(e) =>
                      setEditingMethod({ ...editingMethod, merchantIdentifier: e.target.value })
                    }
                    placeholder="e.g. 0300-1234567"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editingMethod.displayOrder}
                    onChange={(e) =>
                      setEditingMethod({
                        ...editingMethod,
                        displayOrder: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Reference Placeholder Format
                  </label>
                  <input
                    type="text"
                    value={editingMethod.referenceFormat || ''}
                    onChange={(e) =>
                      setEditingMethod({ ...editingMethod, referenceFormat: e.target.value })
                    }
                    placeholder="e.g. 11-digit TID / Ref ID"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  />
                </div>

                <div className="sm:col-span-2 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-neutral-800">
                    <input
                      type="checkbox"
                      checked={editingMethod.requiresReference}
                      onChange={(e) =>
                        setEditingMethod({
                          ...editingMethod,
                          requiresReference: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950"
                    />
                    <span>Require Customer Transaction ID / Reference (TID) at Checkout</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingMethod(null)}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving Changes...' : 'Save Payment Method'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
