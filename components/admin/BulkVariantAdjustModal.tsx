'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Check, AlertCircle, Layers } from 'lucide-react';
import { Product, ProductModelVariant } from '@/types';

interface BulkVariantAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSaveAll: (stockMap: Record<string, number>) => Promise<boolean | void>;
}

export function BulkVariantAdjustModal({
  isOpen,
  onClose,
  product,
  onSaveAll,
}: BulkVariantAdjustModalProps) {
  const [stockMap, setStockMap] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize variant stocks when modal opens
  useEffect(() => {
    if (isOpen && product && Array.isArray(product.models)) {
      const initial: Record<string, string> = {};
      for (const m of product.models) {
        const key = m.id || m.name;
        initial[key] = (m.stock ?? 0).toString();
      }
      setStockMap(initial);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, product]);

  const models: ProductModelVariant[] = useMemo(() => {
    if (!product || !Array.isArray(product.models)) return [];
    return product.models;
  }, [product]);

  // Live total sum calculation
  const totalNewStock = useMemo(() => {
    return Object.values(stockMap).reduce((sum, str) => {
      const parsed = parseInt(str, 10);
      return sum + (isNaN(parsed) || parsed < 0 ? 0 : parsed);
    }, 0);
  }, [stockMap]);

  const totalCurrentStock = useMemo(() => {
    return models.reduce((sum, m) => sum + (m.stock ?? 0), 0);
  }, [models]);

  if (!isOpen || !product) return null;

  const handleInputChange = (key: string, val: string) => {
    setErrorMessage(null);
    const cleaned = val.replace(/[^0-9]/g, '');
    setStockMap((prev) => ({
      ...prev,
      [key]: cleaned === '' ? '0' : String(parseInt(cleaned, 10)),
    }));
  };



  const handleQuickPreset = (key: string, preset: number) => {
    setErrorMessage(null);
    setStockMap((prev) => ({ ...prev, [key]: preset.toString() }));
  };

  const handleApplyPresetToAll = (preset: number) => {
    setErrorMessage(null);
    const updated: Record<string, string> = {};
    for (const m of models) {
      const key = m.id || m.name;
      updated[key] = preset.toString();
    }
    setStockMap(updated);
  };

  const handleSave = async () => {
    if (isSubmitting) return;

    // Validate all inputs
    const numericMap: Record<string, number> = {};
    for (const m of models) {
      const key = m.id || m.name;
      const raw = stockMap[key];
      const parsed = Number(raw);
      if (
        raw === undefined ||
        raw === '' ||
        !Number.isFinite(parsed) ||
        parsed < 0 ||
        Math.floor(parsed) !== parsed ||
        parsed > 999999
      ) {
        setErrorMessage(`Invalid stock quantity for variant "${m.name}". Must be a non-negative whole number (0 - 999,999).`);
        return;
      }
      numericMap[key] = parsed;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const ok = await onSaveAll(numericMap);
      if (ok !== false) {
        onClose();
      } else {
        setErrorMessage('Failed to update variant stocks. Changes were not committed to the database.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error saving variant quantities.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isSubmitting && onClose()}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 text-neutral-900 space-y-5 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                <img
                  src={product.images?.[0] || 'https://via.placeholder.com/100'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 text-[11px] font-bold uppercase tracking-wider mb-0.5">
                  <Layers className="w-3 h-3 text-violet-600" />
                  <span>Bulk Variant Stock Adjust</span>
                </div>
                <h3 className="text-base font-bold text-neutral-950 leading-snug line-clamp-1">{product.name}</h3>
                <span className="text-[10px] font-mono text-neutral-400">
                  SKU: {product.sku || '—'} • {models.length} Model Variants
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Stats & Global Presets Bar */}
          <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Current Warehouse Total</span>
                <span className="font-mono font-bold text-neutral-800 text-sm">{totalCurrentStock} units</span>
              </div>
              <div className="h-6 w-px bg-neutral-200" />
              <div>
                <span className="text-[10px] font-bold text-violet-700 uppercase block">New Warehouse Total</span>
                <span className="font-mono font-extrabold text-violet-900 text-sm">{totalNewStock} units</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Set All To:</span>
              {[0, 50, 100, 250].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleApplyPresetToAll(preset)}
                  className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 hover:bg-neutral-100 text-[10px] font-semibold text-neutral-700 cursor-pointer transition-colors disabled:opacity-50 shadow-2xs"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium shrink-0 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Scrollable Variant List */}
          <div className="overflow-y-auto space-y-3 pr-1 divide-y divide-neutral-100 flex-1 min-h-0">
            {models.map((m) => {
              const key = m.id || m.name;
              const val = stockMap[key] || '0';
              const currStock = m.stock ?? 0;
              const diff = (parseInt(val, 10) || 0) - currStock;

              return (
                <div key={key} className="pt-3 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="min-w-44">
                    <div className="font-bold text-neutral-900 text-xs">{m.name}</div>
                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                      SKU: {m.sku || '—'} • Current: <span className="font-bold text-neutral-700">{currStock} units</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    {/* Quick presets for this variant */}
                    <div className="flex items-center gap-1">
                      {[0, 10, 50, 100, 250].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleQuickPreset(key, preset)}
                          className="px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-[10px] font-medium text-neutral-700 cursor-pointer disabled:opacity-40"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {/* Numeric Input */}
                    <div className="relative w-24">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={val}
                        disabled={isSubmitting}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        className="w-full text-center py-1.5 px-2 font-mono font-bold text-xs rounded-xl bg-neutral-50 border border-neutral-300 focus:border-neutral-900 focus:bg-white focus:outline-none transition-all text-neutral-950"
                      />
                    </div>

                    {/* Diff indicator */}
                    <span className="w-12 text-right font-mono text-[11px] font-bold">
                      {diff > 0 ? (
                        <span className="text-emerald-600">+{diff}</span>
                      ) : diff < 0 ? (
                        <span className="text-rose-600">{diff}</span>
                      ) : (
                        <span className="text-neutral-400">0</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSave}
              className="py-2.5 px-5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save All Variants ({models.length})</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
