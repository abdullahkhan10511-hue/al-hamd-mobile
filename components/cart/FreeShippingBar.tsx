'use client';

import React from 'react';
import { Truck, Check } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface FreeShippingBarProps {
  subtotal: number;
  threshold?: number;
}

export function FreeShippingBar({ subtotal, threshold = 5000 }: FreeShippingBarProps) {
  const percentage = Math.min(100, Math.round((subtotal / threshold) * 100));
  const remaining = Math.max(0, threshold - subtotal);
  const isUnlocked = percentage >= 100;

  return (
    <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200/80">
      <div className="flex items-center justify-between text-xs mb-2">
        <div className="flex items-center gap-1.5 font-medium text-neutral-800">
          <Truck className="w-3.5 h-3.5 text-neutral-600" />
          {isUnlocked ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3 stroke-[3]" /> Unlocked Free Delivery Across Pakistan!
            </span>
          ) : (
            <span>
              Add <strong className="text-neutral-950 font-bold">{formatPrice(remaining)}</strong> more for Free Delivery
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-neutral-500 font-semibold">{percentage}%</span>
      </div>

      <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isUnlocked ? 'bg-emerald-600' : 'bg-neutral-900'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
