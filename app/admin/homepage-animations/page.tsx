'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Layers,
  Tag,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Eye,
  Info,
} from 'lucide-react';
import { Tilt3D } from '@/components/ui/motion/Tilt3D';
import {
  HomepageAnimationsSettings,
  MarqueeSectionSettings,
  DEFAULT_HOMEPAGE_ANIMATIONS,
} from '@/lib/db/siteUiSettings';

const MOCK_CATEGORIES = [
  { name: 'Power Tools', icon: '⚡', count: '142 items' },
  { name: 'Hardware & Fasteners', icon: '🔩', count: '89 items' },
  { name: 'Safety Equipment', icon: '🦺', count: '54 items' },
  { name: 'Welding & Cutting', icon: '🔥', count: '67 items' },
  { name: 'Hand Tools', icon: '🔨', count: '118 items' },
  { name: 'Pneumatic Tools', icon: '💨', count: '39 items' },
];

const MOCK_BRANDS = [
  { name: 'Bosch Professional', origin: 'Germany', tag: 'Power Tools' },
  { name: 'Makita Power Tools', origin: 'Japan', tag: 'Cordless' },
  { name: 'DeWalt Industrial', origin: 'USA', tag: 'Heavy Duty' },
  { name: 'Ingco Tools', origin: 'Global', tag: 'Hand & Power' },
  { name: 'Total Tools', origin: 'Global', tag: 'Hardware' },
  { name: 'Crown Industrial', origin: 'Switzerland', tag: 'Machinery' },
];

export default function HomepageAnimationsAdminPage() {
  const [settings, setSettings] = useState<HomepageAnimationsSettings>(DEFAULT_HOMEPAGE_ANIMATIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableExists, setTableExists] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activePreviewTab, setActivePreviewTab] = useState<'categories' | 'brands'>('categories');

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
        if (data.animations) {
          setSettings(data.animations);
        }
        if (typeof data.tableExists === 'boolean') {
          setTableExists(data.tableExists);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load animation settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg('');
      setSaveSuccess(false);

      const res = await fetch('/api/admin/ui-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'homepage_animations',
          value: settings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSaveSuccess(true);
      if (typeof data.tableExists === 'boolean') {
        setTableExists(data.tableExists);
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all homepage animation settings to default?')) {
      setSettings(DEFAULT_HOMEPAGE_ANIMATIONS);
    }
  };

  const updateSection = (
    section: 'categories' | 'brands',
    field: keyof MarqueeSectionSettings,
    val: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: val,
      },
    }));
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-neutral-500 font-medium">
          <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
          Loading animation settings...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Homepage Animations</h1>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Configure marquee animations, step pacing, and 3D card tilt for Shop by Category and Shop by Brand.
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
            disabled={saving}
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

      {/* Migration / Table missing Alert */}
      {!tableExists && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Database Table `site_ui_settings` Not Detected</p>
            <p className="text-amber-800">
              Settings are currently stored safely in local file fallback (<code>data/site-ui-settings.json</code>).
              To persist across server instances and database backups, run{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-xs">
                scripts/migrations/add_site_ui_settings.sql
              </code>{' '}
              in your MySQL/MariaDB database.
            </p>
          </div>
        </div>
      )}

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium">Homepage animation settings successfully saved and applied to storefront!</p>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Section Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories Section Settings */}
        <SectionSettingsCard
          title="Shop by Category"
          icon={<Layers className="w-5 h-5 text-amber-500" />}
          settings={settings.categories}
          onChange={(field, val) => updateSection('categories', field, val)}
        />

        {/* Brands Section Settings */}
        <SectionSettingsCard
          title="Shop by Brand"
          icon={<Tag className="w-5 h-5 text-emerald-500" />}
          settings={settings.brands}
          onChange={(field, val) => updateSection('brands', field, val)}
        />
      </div>

      {/* Interactive Live Preview Box */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-neutral-700" />
            <h2 className="text-lg font-bold text-neutral-900">Interactive Storefront Preview</h2>
            <span className="text-xs bg-neutral-100 text-neutral-600 font-mono px-2 py-0.5 rounded-full">
              Live updates
            </span>
          </div>

          <div className="flex items-center bg-neutral-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActivePreviewTab('categories')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activePreviewTab === 'categories'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Category Preview
            </button>
            <button
              onClick={() => setActivePreviewTab('brands')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activePreviewTab === 'brands'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Brand Preview
            </button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200/80 overflow-hidden">
          {activePreviewTab === 'categories' ? (
            <LiveSectionPreview
              type="categories"
              items={MOCK_CATEGORIES}
              settings={settings.categories}
            />
          ) : (
            <LiveSectionPreview
              type="brands"
              items={MOCK_BRANDS}
              settings={settings.brands}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SectionSettingsCard({
  title,
  icon,
  settings,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  settings: MarqueeSectionSettings;
  onChange: (field: keyof MarqueeSectionSettings, val: any) => void;
}) {
  return (
    <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
        <div className="p-2 rounded-xl bg-neutral-100">{icon}</div>
        <div>
          <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
          <p className="text-xs text-neutral-500">Configure layout, pacing, and interaction style</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Style Selector */}
        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
            Animation Mode / Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'continuous', label: 'Continuous', desc: 'Infinite smooth scroll' },
              { id: 'step', label: 'Step by Step', desc: 'One card per tick' },
              { id: 'static', label: 'Static Row', desc: 'Row with arrows' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onChange('style', mode.id)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  settings.style === mode.id
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <div className="font-semibold text-xs">{mode.label}</div>
                <div className={`text-[10px] mt-0.5 ${settings.style === mode.id ? 'text-neutral-300' : 'text-neutral-400'}`}>
                  {mode.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Direction Selector */}
        {settings.style !== 'static' && (
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
              Scroll Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange('direction', 'ltr')}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  settings.direction === 'ltr'
                    ? 'border-neutral-900 bg-neutral-100 text-neutral-900 font-bold'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Left to Right (LTR)
              </button>
              <button
                type="button"
                onClick={() => onChange('direction', 'rtl')}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  settings.direction === 'rtl'
                    ? 'border-neutral-900 bg-neutral-100 text-neutral-900 font-bold'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Right to Left (RTL)
              </button>
            </div>
          </div>
        )}

        {/* Speed / Interval */}
        {settings.style === 'continuous' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Full Loop Duration ({settings.speedSeconds}s)
              </label>
              <div className="flex gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => onChange('speedSeconds', 60)}
                  className={`px-2 py-0.5 rounded ${settings.speedSeconds === 60 ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  Slow (60s)
                </button>
                <button
                  type="button"
                  onClick={() => onChange('speedSeconds', 40)}
                  className={`px-2 py-0.5 rounded ${settings.speedSeconds === 40 ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  Normal (40s)
                </button>
                <button
                  type="button"
                  onClick={() => onChange('speedSeconds', 20)}
                  className={`px-2 py-0.5 rounded ${settings.speedSeconds === 20 ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  Fast (20s)
                </button>
              </div>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={settings.speedSeconds}
              onChange={(e) => onChange('speedSeconds', Number(e.target.value))}
              className="w-full accent-neutral-900 cursor-pointer"
            />
          </div>
        )}

        {settings.style === 'step' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Step Interval ({settings.stepSeconds}s per card)
              </label>
              <div className="flex gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => onChange('stepSeconds', 3.5)}
                  className={`px-2 py-0.5 rounded ${settings.stepSeconds === 3.5 ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  Slow (3.5s)
                </button>
                <button
                  type="button"
                  onClick={() => onChange('stepSeconds', 2.5)}
                  className={`px-2 py-0.5 rounded ${settings.stepSeconds === 2.5 ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  Normal (2.5s)
                </button>
                <button
                  type="button"
                  onClick={() => onChange('stepSeconds', 1.5)}
                  className={`px-2 py-0.5 rounded ${settings.stepSeconds === 1.5 ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  Fast (1.5s)
                </button>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={0.5}
              value={settings.stepSeconds}
              onChange={(e) => onChange('stepSeconds', Number(e.target.value))}
              className="w-full accent-neutral-900 cursor-pointer"
            />
          </div>
        )}

        {/* Card Hover Effect */}
        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
            Card Hover Effect
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'tilt', label: '3D Tilt', desc: 'Perspective 3D angle' },
              { id: 'lift', label: 'Lift', desc: 'Smooth float (-4px)' },
              { id: 'none', label: 'None', desc: 'No hover motion' },
            ].map((effect) => (
              <button
                key={effect.id}
                type="button"
                onClick={() => onChange('cardHover', effect.id)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  settings.cardHover === effect.id
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <div className="font-semibold text-xs">{effect.label}</div>
                <div className={`text-[10px] ${settings.cardHover === effect.id ? 'text-neutral-300' : 'text-neutral-400'}`}>
                  {effect.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles: Pause on Hover & Edge Fade */}
        <div className="pt-2 border-t border-neutral-100 space-y-3">
          {settings.style !== 'static' && (
            <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/80 hover:bg-neutral-50/50 cursor-pointer transition-colors">
              <div>
                <span className="text-xs font-bold text-neutral-800 block">Pause on Hover</span>
                <span className="text-[11px] text-neutral-500 block">Stops marquee animation when cursor rests over items</span>
              </div>
              <input
                type="checkbox"
                checked={settings.pauseOnHover}
                onChange={(e) => onChange('pauseOnHover', e.target.checked)}
                className="w-4 h-4 rounded text-neutral-900 accent-neutral-900"
              />
            </label>
          )}

          <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/80 hover:bg-neutral-50/50 cursor-pointer transition-colors">
            <div>
              <span className="text-xs font-bold text-neutral-800 block">Edge Fade Mask</span>
              <span className="text-[11px] text-neutral-500 block">Soft gradient fade at the left and right screen borders</span>
            </div>
            <input
              type="checkbox"
              checked={settings.edgeFade}
              onChange={(e) => onChange('edgeFade', e.target.checked)}
              className="w-4 h-4 rounded text-neutral-900 accent-neutral-900"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function LiveSectionPreview({
  type,
  items,
  settings,
}: {
  type: 'categories' | 'brands';
  items: any[];
  settings: MarqueeSectionSettings;
}) {
  const [scrollIndex, setScrollIndex] = useState(0);

  // For step mode preview
  useEffect(() => {
    if (settings.style !== 'step') return;
    const interval = setInterval(() => {
      setScrollIndex((prev) => (prev + 1) % items.length);
    }, (settings.stepSeconds || 2.5) * 1000);
    return () => clearInterval(interval);
  }, [settings.style, settings.stepSeconds, items.length]);

  const edgeFadeMask = settings.edgeFade
    ? 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)'
    : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          Mode: <strong className="text-neutral-800">{settings.style}</strong> • Direction:{' '}
          <strong className="text-neutral-800">{settings.direction.toUpperCase()}</strong> • Hover:{' '}
          <strong className="text-neutral-800">{settings.cardHover}</strong>
        </span>
        {settings.style === 'static' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setScrollIndex((p) => Math.max(0, p - 1))}
              disabled={scrollIndex === 0}
              className="p-1 rounded-md bg-white border border-neutral-300 disabled:opacity-30 hover:bg-neutral-100"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setScrollIndex((p) => Math.min(items.length - 3, p + 1))}
              disabled={scrollIndex >= items.length - 3}
              className="p-1 rounded-md bg-white border border-neutral-300 disabled:opacity-30 hover:bg-neutral-100"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div
        className="relative overflow-hidden py-4"
        style={{
          WebkitMaskImage: edgeFadeMask,
          maskImage: edgeFadeMask,
        }}
      >
        {settings.style === 'continuous' && (
          <div
            className={`flex gap-4 w-max ${settings.pauseOnHover ? 'hover:[animation-play-state:paused]' : ''}`}
            style={{
              animation: `marquee-preview ${settings.speedSeconds}s linear infinite`,
              animationDirection: settings.direction === 'rtl' ? 'reverse' : 'normal',
            }}
          >
            {[...items, ...items, ...items].map((item, idx) => (
              <PreviewCard key={idx} item={item} type={type} hoverEffect={settings.cardHover} />
            ))}
          </div>
        )}

        {settings.style === 'step' && (
          <div
            className="flex gap-4 transition-transform duration-500 ease-out"
            style={{
              transform: `translateX(-${scrollIndex * 180}px)`,
            }}
          >
            {[...items, ...items].map((item, idx) => (
              <PreviewCard key={idx} item={item} type={type} hoverEffect={settings.cardHover} />
            ))}
          </div>
        )}

        {settings.style === 'static' && (
          <div
            className="flex gap-4 transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(-${scrollIndex * 180}px)`,
            }}
          >
            {items.map((item, idx) => (
              <PreviewCard key={idx} item={item} type={type} hoverEffect={settings.cardHover} />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes marquee-preview {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }
      `}</style>
    </div>
  );
}

function PreviewCard({
  item,
  type,
  hoverEffect,
}: {
  item: any;
  type: 'categories' | 'brands';
  hoverEffect: 'tilt' | 'lift' | 'none';
}) {
  const cardBody = (
    <div
      className={`w-44 p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-sm flex flex-col items-center text-center transition-all duration-200 ${
        hoverEffect === 'lift' ? 'hover:-translate-y-1 hover:shadow-md' : ''
      }`}
    >
      {type === 'categories' ? (
        <>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl mb-2">
            {item.icon}
          </div>
          <div className="font-bold text-xs text-neutral-900 truncate w-full">{item.name}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">{item.count}</div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 font-bold text-sm mb-2">
            {item.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="font-bold text-xs text-neutral-900 truncate w-full">{item.name}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {item.origin} • {item.tag}
          </div>
        </>
      )}
    </div>
  );

  if (hoverEffect === 'tilt') {
    return (
      <Tilt3D maxTilt={10} scaleOnHover={1.03}>
        {cardBody}
      </Tilt3D>
    );
  }

  return cardBody;
}
