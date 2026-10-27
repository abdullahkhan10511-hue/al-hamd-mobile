'use client';

import React, { useState } from 'react';
import {
  Award,
  Truck,
  Lock,
  Headphones,
  ThumbsUp,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  CreditCard,
  Zap,
  Clock,
  Phone,
  Package,
  Shield,
  Star,
  Heart,
  Smile,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { TrustBenefitItem } from '@/types/admin';

import type { LucideIcon } from 'lucide-react';

export const AVAILABLE_ICONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'Award', label: 'Quality / Award', icon: Award },
  { id: 'Truck', label: 'Fast Delivery', icon: Truck },
  { id: 'Lock', label: 'Safe & Secure', icon: Lock },
  { id: 'Headphones', label: 'Customer Support', icon: Headphones },
  { id: 'ThumbsUp', label: 'Satisfaction', icon: ThumbsUp },
  { id: 'ShieldCheck', label: 'Warranty & Shield', icon: ShieldCheck },
  { id: 'RotateCcw', label: 'Easy Returns', icon: RotateCcw },
  { id: 'Sparkles', label: 'Premium / Curated', icon: Sparkles },
  { id: 'CheckCircle2', label: 'Verified Authentic', icon: CheckCircle2 },
  { id: 'CreditCard', label: 'Secure Payments', icon: CreditCard },
  { id: 'Zap', label: 'High Speed / Express', icon: Zap },
  { id: 'Clock', label: '24/7 Availability', icon: Clock },
  { id: 'Phone', label: 'Direct Helpline', icon: Phone },
  { id: 'Package', label: 'Protective Packaging', icon: Package },
  { id: 'Shield', label: 'Buyer Protection', icon: Shield },
  { id: 'Star', label: 'Top Rated', icon: Star },
  { id: 'Heart', label: 'Customer Care', icon: Heart },
  { id: 'Smile', label: 'Happy Customers', icon: Smile },
];

export const ICON_MAP: Record<string, LucideIcon> = {
  Award,
  Truck,
  Lock,
  Headphones,
  ThumbsUp,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  CreditCard,
  Zap,
  Clock,
  Phone,
  Package,
  Shield,
  Star,
  Heart,
  Smile,
};

export const DEFAULT_TRUST_BENEFITS: TrustBenefitItem[] = [
  {
    id: 'tb-1',
    icon: 'Award',
    title: 'Quality You Can Trust',
    description: 'Shop carefully selected mobile accessories for everyday use.',
    displayOrder: 1,
    visible: true,
  },
  {
    id: 'tb-2',
    icon: 'Truck',
    title: 'Delivery Across Pakistan',
    description: 'Convenient delivery options for customers across Pakistan.',
    displayOrder: 2,
    visible: true,
  },
  {
    id: 'tb-3',
    icon: 'Lock',
    title: 'Secure Shopping Experience',
    description: 'A straightforward checkout experience with the payment options currently supported by the store.',
    displayOrder: 3,
    visible: true,
  },
  {
    id: 'tb-4',
    icon: 'Headphones',
    title: 'Customer Support',
    description: 'Get help with your questions, orders and product information.',
    displayOrder: 4,
    visible: true,
  },
];

interface TrustBenefitsEditorProps {
  benefits: TrustBenefitItem[];
  onChange: (items: TrustBenefitItem[]) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  hasUnsavedChanges: boolean;
  isSaved: boolean;
}

export function TrustBenefitsEditor({
  benefits,
  onChange,
  onSave,
  onCancel,
  hasUnsavedChanges,
  isSaved,
}: TrustBenefitsEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, { title?: string; description?: string }>>({});

  const handleFieldChange = (id: string, field: 'title' | 'description' | 'icon', value: string) => {
    const updated = benefits.map((item) => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });

    // Clear validation error on change
    if (validationErrors[id]?.[field as 'title' | 'description']) {
      setValidationErrors((prev) => {
        const copy = { ...prev };
        if (copy[id]) {
          delete copy[id][field as 'title' | 'description'];
          if (Object.keys(copy[id]).length === 0) {
            delete copy[id];
          }
        }
        return copy;
      });
    }

    onChange(updated);
  };

  const handleToggleVisible = (id: string) => {
    const updated = benefits.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item));
    onChange(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= benefits.length) return;

    const copy = [...benefits];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reordered = copy.map((item, idx) => ({ ...item, displayOrder: idx + 1 }));
    onChange(reordered);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all 4 benefit cards back to the suggested default copy?')) {
      onChange(JSON.parse(JSON.stringify(DEFAULT_TRUST_BENEFITS)));
      setValidationErrors({});
    }
  };

  const validateAndSave = async () => {
    const errors: Record<string, { title?: string; description?: string }> = {};
    let hasError = false;

    benefits.forEach((item, index) => {
      const cardErrors: { title?: string; description?: string } = {};
      const cleanTitle = (item.title || '').trim();
      const cleanDesc = (item.description || '').trim();

      if (!cleanTitle) {
        cardErrors.title = `Card #${index + 1} heading cannot be empty.`;
        hasError = true;
      } else if (cleanTitle.length < 2) {
        cardErrors.title = 'Heading is too short (min 2 characters).';
        hasError = true;
      } else if (cleanTitle.length > 60) {
        cardErrors.title = 'Heading exceeds maximum 60 characters.';
        hasError = true;
      }

      if (!cleanDesc) {
        cardErrors.description = `Card #${index + 1} description cannot be empty.`;
        hasError = true;
      } else if (cleanDesc.length < 5) {
        cardErrors.description = 'Description is too short (min 5 characters).';
        hasError = true;
      } else if (cleanDesc.length > 180) {
        cardErrors.description = 'Description exceeds maximum 180 characters.';
        hasError = true;
      }

      if (Object.keys(cardErrors).length > 0) {
        errors[item.id] = cardErrors;
      }
    });

    if (hasError) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Customer Assurance Pillars
              </span>
              {hasUnsavedChanges ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                  ● Unsaved Changes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  ✓ Published & Live
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-950 tracking-tight mt-1">
              Homepage Benefit & Trust Cards
            </h2>
            <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
              Edit the 4 core customer benefit cards displayed across the storefront. Customize headings, descriptions, icons, toggle card visibility, and adjust display sequence. Changes reflect live in the preview below.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Reset to suggested default copy"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Defaults</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={!hasUnsavedChanges || isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>

            <button
              type="button"
              onClick={validateAndSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold tracking-wider uppercase transition-colors shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  <span>Saved!</span>
                </>
              ) : isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Benefit Cards</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Interactive Preview Box */}
        <div className="mt-6 pt-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                Interactive Live Preview
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">
                ({benefits.filter((b) => b.visible).length} of {benefits.length} cards visible to shoppers)
              </span>
            </div>
            {hasUnsavedChanges && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Previewing Unsaved Changes — click Save to apply to public store
              </span>
            )}
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-neutral-50/70 border border-neutral-200/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {benefits.map((item, idx) => {
                const IconComponent = ICON_MAP[item.icon] || Award;
                const isHidden = !item.visible;

                return (
                  <div
                    key={item.id || idx}
                    className={`relative p-4 rounded-2xl border transition-all duration-200 ${
                      isHidden
                        ? 'bg-neutral-100/60 border-dashed border-neutral-300 opacity-60'
                        : 'bg-white border-neutral-200/90 shadow-2xs hover:shadow-sm'
                    }`}
                  >
                    {isHidden && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-neutral-200 text-neutral-600">
                        Hidden
                      </span>
                    )}
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-neutral-950 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <IconComponent className="w-5 h-5 stroke-[2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-950 tracking-tight line-clamp-1">
                          {item.title || '(Untitled card)'}
                        </h4>
                        <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed line-clamp-3">
                          {item.description || '(No description entered)'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* The 4 Card Editors */}
      <div className="space-y-4">
        {benefits.map((card, index) => {
          const errors = validationErrors[card.id] || {};

          return (
            <div
              key={card.id}
              className={`bg-white rounded-3xl border transition-all duration-200 p-5 sm:p-6 shadow-xs ${
                card.visible ? 'border-neutral-200/90' : 'border-neutral-200/60 bg-neutral-50/40'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-neutral-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                      <span>Card #{index + 1}</span>
                      <span className="text-xs font-normal text-neutral-400">
                        ({card.title || 'Untitled'})
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Reorder Buttons */}
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move card up"
                    aria-label="Move card up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === benefits.length - 1}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move card down"
                    aria-label="Move card down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Visibility Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleVisible(card.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ml-1 ${
                      card.visible
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200'
                    }`}
                  >
                    {card.visible ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Card Inputs Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Heading (Title) */}
                <div className="lg:col-span-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Card Heading <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {card.title.length}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    value={card.title}
                    maxLength={60}
                    onChange={(e) => handleFieldChange(card.id, 'title', e.target.value)}
                    placeholder="e.g., Quality You Can Trust"
                    className={`w-full px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border bg-white focus:outline-none transition-colors ${
                      errors.title
                        ? 'border-rose-400 focus:border-rose-600 ring-1 ring-rose-200'
                        : 'border-neutral-200 focus:border-neutral-900'
                    }`}
                  />
                  {errors.title && (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{errors.title}</span>
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="lg:col-span-7 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Description <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {card.description.length}/180
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={card.description}
                    maxLength={180}
                    onChange={(e) => handleFieldChange(card.id, 'description', e.target.value)}
                    placeholder="e.g., Shop carefully selected mobile accessories for everyday use."
                    className={`w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border bg-white focus:outline-none transition-colors resize-none ${
                      errors.description
                        ? 'border-rose-400 focus:border-rose-600 ring-1 ring-rose-200'
                        : 'border-neutral-200 focus:border-neutral-900'
                    }`}
                  />
                  {errors.description && (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{errors.description}</span>
                    </p>
                  )}
                </div>

                {/* Icon Selection */}
                <div className="lg:col-span-12 space-y-2 pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Card Icon
                    </label>
                    <span className="text-[11px] text-neutral-400">
                      Currently selected: <span className="font-semibold text-neutral-900">{card.icon || 'Award'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                    {AVAILABLE_ICONS.map((opt) => {
                      const IconItem = opt.icon;
                      const isSelected = (card.icon || 'Award') === opt.id;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleFieldChange(card.id, 'icon', opt.id)}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs'
                              : 'bg-white text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 border-neutral-200'
                          }`}
                        >
                          <IconItem className="w-3.5 h-3.5" />
                          <span>{opt.label.split(' / ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
