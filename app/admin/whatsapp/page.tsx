'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Phone,
  MessageCircle,
  Eye,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  WhatsAppButtonSettings,
  DEFAULT_WHATSAPP_SETTINGS,
  normalizePakistaniMobileNumber,
  buildWhatsAppLink,
} from '@/lib/db/siteUiSettings';

export default function WhatsAppButtonAdminPage() {
  const [settings, setSettings] = useState<WhatsAppButtonSettings>(DEFAULT_WHATSAPP_SETTINGS);
  const [rawPhoneInput, setRawPhoneInput] = useState(DEFAULT_WHATSAPP_SETTINGS.phoneNumber);
  const [phoneError, setPhoneError] = useState('');
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
        if (data.whatsapp) {
          setSettings(data.whatsapp);
          setRawPhoneInput(data.whatsapp.phoneNumber || '');
        }
        if (typeof data.tableExists === 'boolean') {
          setTableExists(data.tableExists);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load WhatsApp settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handlePhoneChange = (val: string) => {
    setRawPhoneInput(val);
    const normalized = normalizePakistaniMobileNumber(val);
    if (!normalized) {
      setPhoneError('Please enter a valid Pakistani mobile number (e.g. 0343 2200995 or 923432200995)');
    } else {
      setPhoneError('');
      setSettings((prev) => ({ ...prev, phoneNumber: normalized }));
    }
  };

  const handleSave = async () => {
    const normalized = normalizePakistaniMobileNumber(rawPhoneInput);
    if (!normalized) {
      setPhoneError('Please enter a valid Pakistani mobile number before saving');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      setSaveSuccess(false);

      const payload = {
        ...settings,
        phoneNumber: normalized,
      };

      const res = await fetch('/api/admin/ui-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'whatsapp_button',
          value: payload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSettings(data.settings);
      setRawPhoneInput(data.settings.phoneNumber);
      setSaveSuccess(true);
      if (typeof data.tableExists === 'boolean') {
        setTableExists(data.tableExists);
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving WhatsApp settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset WhatsApp button settings to defaults?')) {
      setSettings(DEFAULT_WHATSAPP_SETTINGS);
      setRawPhoneInput(DEFAULT_WHATSAPP_SETTINGS.phoneNumber);
      setPhoneError('');
    }
  };

  const currentNormalized = normalizePakistaniMobileNumber(rawPhoneInput);
  const sampleUrl = currentNormalized
    ? buildWhatsAppLink(currentNormalized, settings.defaultMessage, {
        page: 'DeWalt Cordless Drill (Sample)',
        url: 'https://alhamdshop.com/product/dewalt-drill',
      })
    : '#';

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-neutral-500 font-medium">
          <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
          Loading WhatsApp settings...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <MessageSquare className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">WhatsApp Button Settings</h1>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Manage your store-wide floating WhatsApp contact button, automated greeting message, and page visibility rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving || Boolean(phoneError)}
            className="px-5 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* Migration / Table Missing Alert */}
      {!tableExists && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Database Table `site_ui_settings` Not Detected</p>
            <p className="text-amber-800">
              Settings are stored safely in local file fallback (<code>data/site-ui-settings.json</code>).
              To persist settings in MySQL/MariaDB across deployments, run{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">
                scripts/migrations/add_site_ui_settings.sql
              </code>.
            </p>
          </div>
        </div>
      )}

      {/* Feedback alerts */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium">WhatsApp settings saved and updated across the storefront!</p>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-6">
            {/* Master Toggle */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <span className="font-bold text-neutral-900 text-base block">Enable WhatsApp Button</span>
                <span className="text-xs text-neutral-500 block">
                  Show the floating WhatsApp button on storefront pages
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                WhatsApp Business Phone Number
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={rawPhoneInput}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="e.g. 03432200995 or 923432200995"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-mono transition-colors ${
                      phoneError
                        ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900'
                    }`}
                  />
                </div>
                {currentNormalized && (
                  <a
                    href={`https://wa.me/${currentNormalized}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Test Link
                  </a>
                )}
              </div>
              {phoneError ? (
                <p className="text-xs text-red-600 font-medium">{phoneError}</p>
              ) : (
                <p className="text-xs text-neutral-400">
                  Normalized to standard 12-digit international format: <code className="text-neutral-700 font-mono font-semibold">{currentNormalized}</code>
                </p>
              )}
            </div>

            {/* Default Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Default Pre-filled Message
                </label>
                <span className="text-[11px] font-mono text-neutral-400">
                  {settings.defaultMessage.length} / 300
                </span>
              </div>
              <textarea
                value={settings.defaultMessage}
                maxLength={300}
                rows={3}
                onChange={(e) => setSettings({ ...settings, defaultMessage: e.target.value })}
                placeholder="Hi AL-HAMD SHOP! I am inquiring about {page}: {url}"
                className="w-full p-3 rounded-xl border border-neutral-300 text-sm focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-colors"
              />
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs text-neutral-600 space-y-1">
                <p className="font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-neutral-500" />
                  Dynamic message tokens available:
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-neutral-500">
                  <li>
                    <code className="font-mono text-neutral-800">{'{page}'}</code> - Replaced with current page name (e.g. &quot;Power Tools&quot; or &quot;Checkout&quot;).
                  </li>
                  <li>
                    <code className="font-mono text-neutral-800">{'{url}'}</code> - Replaced with current full page URL.
                  </li>
                </ul>
              </div>
            </div>

            {/* Display / Show-On Rules */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Storefront Page Display Rules
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'all', title: 'All Pages', desc: 'Visible everywhere' },
                  { id: 'except_checkout_cart', title: 'Hide on Cart & Checkout', desc: 'Prevents checkout distraction' },
                  { id: 'homepage_only', title: 'Homepage Only', desc: 'Visible on landing page only' },
                ].map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, showOn: rule.id as any })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      settings.showOn === rule.id
                        ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                    }`}
                  >
                    <div className="font-semibold text-xs">{rule.title}</div>
                    <div className={`text-[10px] mt-0.5 ${settings.showOn === rule.id ? 'text-neutral-300' : 'text-neutral-400'}`}>
                      {rule.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Homepage Hero Behavior */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Homepage Hero Visibility Behavior
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, homepageBehavior: 'after_hero' })}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    settings.homepageBehavior === 'after_hero'
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                  }`}
                >
                  <div className="font-semibold text-xs">After Hero (Step 13)</div>
                  <div className={`text-[10px] mt-0.5 ${settings.homepageBehavior === 'after_hero' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                    Appears once visitor scrolls past hero section
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, homepageBehavior: 'always' })}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    settings.homepageBehavior === 'always'
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                  }`}
                >
                  <div className="font-semibold text-xs">Always Visible</div>
                  <div className={`text-[10px] mt-0.5 ${settings.homepageBehavior === 'always' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                    Visible from the very top of the homepage
                  </div>
                </button>
              </div>
            </div>

            {/* Position & Label Text */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Screen Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, position: 'bottom_right' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      settings.position === 'bottom_right'
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Bottom Right
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, position: 'bottom_left' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      settings.position === 'bottom_left'
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Bottom Left
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Button Label Text (Optional)
                </label>
                <input
                  type="text"
                  value={settings.labelText || ''}
                  onChange={(e) => setSettings({ ...settings, labelText: e.target.value })}
                  placeholder="e.g. Chat with us (leave blank for icon only)"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-sm focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
              <Eye className="w-5 h-5 text-neutral-700" />
              <h2 className="text-base font-bold text-neutral-900">Live Button Preview</h2>
            </div>

            {/* Phone Simulator Frame */}
            <div className="relative h-96 bg-neutral-100 rounded-2xl border-2 border-neutral-300 p-4 flex flex-col justify-between overflow-hidden shadow-inner">
              {/* Fake Page Content */}
              <div className="space-y-2 opacity-50 select-none">
                <div className="h-4 bg-neutral-300 rounded w-2/3" />
                <div className="h-20 bg-neutral-200 rounded-xl" />
                <div className="h-3 bg-neutral-300 rounded w-full" />
                <div className="h-3 bg-neutral-300 rounded w-4/5" />
                <div className="h-16 bg-neutral-200 rounded-xl" />
              </div>

              {/* Floating WhatsApp Button Preview */}
              {settings.enabled ? (
                <div
                  className={`absolute bottom-4 ${
                    settings.position === 'bottom_left' ? 'left-4' : 'right-4'
                  } transition-all duration-300 z-10`}
                >
                  <a
                    href={sampleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#25D366] text-white font-medium px-3.5 py-3 rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-transform"
                  >
                    <MessageCircle className="w-5 h-5 fill-white stroke-none" />
                    {settings.labelText && (
                      <span className="text-xs font-semibold pr-1 whitespace-nowrap">
                        {settings.labelText}
                      </span>
                    )}
                  </a>
                </div>
              ) : (
                <div className="absolute inset-0 bg-neutral-200/60 backdrop-blur-[1px] flex items-center justify-center p-4 text-center">
                  <span className="text-xs font-semibold text-neutral-500 bg-white/90 px-3 py-1.5 rounded-full border border-neutral-300 shadow-sm">
                    Button Disabled
                  </span>
                </div>
              )}
            </div>

            {/* Sample Link Output */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Sample Generated Link:
              </span>
              <p className="text-[11px] font-mono bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 break-all text-neutral-700">
                {sampleUrl}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

