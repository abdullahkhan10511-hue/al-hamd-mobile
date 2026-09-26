'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, X, Delete, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { Product } from '@/types';

interface NumericKeypadModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  mode: 'stock' | 'warning';
  currentValue: number;
  onSave: (newValue: number) => Promise<boolean | void>;
}

export function NumericKeypadModal({
  isOpen,
  onClose,
  product,
  mode,
  currentValue,
  onSave,
}: NumericKeypadModalProps) {
  const [valStr, setValStr] = useState<string>(currentValue.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever modal opens or currentValue changes
  useEffect(() => {
    if (isOpen) {
      setValStr(currentValue.toString());
      setErrorMessage(null);
      setIsSubmitting(false);
      // Focus input after opening
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, currentValue]);

  if (!isOpen || !product) return null;

  const title = mode === 'stock' ? 'Set Available Stock' : 'Set Stock Warning Threshold';
  const description =
    mode === 'stock'
      ? 'Enter the exact quantity of available inventory in the warehouse.'
      : 'Alerts when stock drops to or below this minimum quantity.';

  const handleDigitClick = (digit: string) => {
    setErrorMessage(null);
    setValStr((prev) => {
      // If previous was '0', replace with digit unless digit is '0'
      if (prev === '0') {
        return digit;
      }
      // Max 6 digits (999,999 units)
      if (prev.length >= 6) return prev;
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    setErrorMessage(null);
    setValStr((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setErrorMessage(null);
    setValStr('0');
  };

  const handleDirectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setErrorMessage(null);
    if (!raw) {
      setValStr('0');
    } else {
      // Remove leading zeros
      const cleaned = String(parseInt(raw, 10));
      setValStr(cleaned.slice(0, 6));
    }
  };

  const handleQuickAdd = (delta: number) => {
    setErrorMessage(null);
    const curr = parseInt(valStr, 10) || 0;
    const next = Math.max(0, curr + delta);
    setValStr(next.toString());
  };

  const handleQuickPreset = (preset: number) => {
    setErrorMessage(null);
    setValStr(preset.toString());
  };

  const handleSave = async () => {
    const parsed = parseInt(valStr, 10);
    if (isNaN(parsed) || parsed < 0) {
      setErrorMessage('Please enter a valid non-negative whole number.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const ok = await onSave(parsed);
      if (ok !== false) {
        onClose();
      } else {
        setErrorMessage('Failed to update. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error updating value.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (!isSubmitting) onClose();
    }
  };

  const numVal = parseInt(valStr, 10) || 0;

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

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          onKeyDown={handleKeyDown}
          className="relative z-10 bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 text-neutral-900 space-y-4"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-100 text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                <Hash className="w-3 h-3 text-neutral-500" />
                <span>{mode === 'stock' ? 'Direct Stock Set' : 'Warning Threshold'}</span>
              </div>
              <h3 className="text-base font-bold text-neutral-950 leading-snug">{title}</h3>
              <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5" title={product.name}>
                {product.name}
              </p>
              {product.sku && (
                <span className="text-[10px] font-mono text-neutral-400">SKU: {product.sku}</span>
              )}
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

          {/* Value Display / Direct Input */}
          <div className="space-y-1.5">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={valStr}
                onChange={handleDirectInput}
                disabled={isSubmitting}
                className="w-full text-center py-3.5 px-4 font-mono font-extrabold text-3xl rounded-2xl bg-neutral-50 border-2 border-neutral-200 focus:border-neutral-950 focus:bg-white focus:outline-none transition-all text-neutral-950 shadow-inner"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 font-sans pointer-events-none">
                units
              </span>
            </div>

            <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
              {description}
            </p>

            {errorMessage && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Quick Presets / Modifiers */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
            {mode === 'stock' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(0)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-semibold text-neutral-700 cursor-pointer transition-colors"
                >
                  Out (0)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(10)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-semibold text-neutral-700 cursor-pointer transition-colors"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(50)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-semibold text-neutral-700 cursor-pointer transition-colors"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(100)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-semibold text-neutral-700 cursor-pointer transition-colors"
                >
                  +100
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(5)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-semibold text-neutral-700 cursor-pointer transition-colors"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(10)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-semibold text-neutral-700 cursor-pointer transition-colors"
                >
                  10
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(20)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-semibold text-neutral-700 cursor-pointer transition-colors"
                >
                  20
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(50)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-semibold text-neutral-700 cursor-pointer transition-colors"
                >
                  50
                </button>
              </>
            )}
          </div>

          {/* Interactive Keypad Grid */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDigitClick(digit)}
                className="py-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100 active:scale-95 border border-neutral-200 text-lg font-bold font-mono text-neutral-900 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClear}
              className="py-3 rounded-2xl bg-neutral-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 active:scale-95 border border-neutral-200 text-xs font-bold text-neutral-600 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDigitClick('0')}
              className="py-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100 active:scale-95 border border-neutral-200 text-lg font-bold font-mono text-neutral-900 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              0
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleBackspace}
              className="py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:scale-95 border border-neutral-200 text-neutral-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Backspace"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-neutral-100">
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
              className="py-2.5 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Confirm &amp; Save</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
