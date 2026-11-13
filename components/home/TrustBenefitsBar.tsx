'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  ShieldCheck,
  RotateCcw,
  Headphones,
  Sparkles,
  CheckCircle2,
  Banknote,
  Award,
  Lock,
  CreditCard,
  Package,
  ThumbsUp,
  Zap,
  Clock,
  Phone,
  Shield,
  Star,
  Heart,
  Smile,
} from 'lucide-react';
import { getTrustBenefits } from '@/lib/db/homepage';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { TrustBenefitItem } from '@/types/admin';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Truck,
  ShieldCheck,
  RotateCcw,
  Headphones,
  Sparkles,
  CheckCircle2,
  Banknote,
  Award,
  Lock,
  CreditCard,
  Package,
  ThumbsUp,
  Zap,
  Clock,
  Phone,
  Shield,
  Star,
  Heart,
  Smile,
};

export const CANONICAL_TRUST_BENEFITS: TrustBenefitItem[] = [
  {
    id: 'tb-1',
    icon: 'Banknote',
    title: 'Cash on Delivery',
    description: 'Pay conveniently at your doorstep anywhere in Pakistan.',
    displayOrder: 1,
    visible: true,
  },
  {
    id: 'tb-2',
    icon: 'Truck',
    title: 'Fast Delivery Across Pakistan',
    description: 'Prompt courier dispatch with tracking to all major cities.',
    displayOrder: 2,
    visible: true,
  },
  {
    id: 'tb-3',
    icon: 'ShieldCheck',
    title: 'Original Products',
    description: '100% genuine accessories sourced directly from verified brands.',
    displayOrder: 3,
    visible: true,
  },
  {
    id: 'tb-4',
    icon: 'RotateCcw',
    title: 'Easy Returns',
    description: 'Simple replacement or return if an item arrives damaged.',
    displayOrder: 4,
    visible: true,
  },
];

export function TrustBenefitsBar({
  initialBenefits,
}: {
  initialBenefits?: TrustBenefitItem[];
}) {
  const [benefits, setBenefits] = useState<TrustBenefitItem[]>(() => {
    if (initialBenefits && initialBenefits.length > 0) {
      const visible = initialBenefits.filter((b) => b.visible !== false);
      if (visible.length > 0) return visible.slice(0, 4);
    }
    return CANONICAL_TRUST_BENEFITS;
  });

  useEffect(() => {
    if (initialBenefits && initialBenefits.length > 0) {
      return;
    }
    const loadData = () => {
      const list = getTrustBenefits().filter((b) => b.visible);
      setBenefits(list.length > 0 ? list.slice(0, 4) : CANONICAL_TRUST_BENEFITS);
    };
    loadData();

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'trust_benefits') return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [initialBenefits]);

  if (benefits.length === 0) return null;

  return (
    <section className="bg-white border-b border-neutral-200/80 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {benefits.map((benefit, index) => {
            const Icon = iconMap[benefit.icon] || ShieldCheck;
            return (
              <ScrollReveal
                key={benefit.id || benefit.title}
                delayMs={Math.min(index * 40, 120)}
                className="flex items-start gap-3.5 group p-3 sm:p-0 rounded-xl bg-neutral-50/70 sm:bg-transparent border border-neutral-100 sm:border-none"
              >
                <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-neutral-950 group-hover:text-white text-neutral-900 flex items-center justify-center shrink-0 transition-colors duration-300">
                  <Icon className="w-5 h-5 stroke-[1.75]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-bold text-neutral-950 tracking-tight break-words">
                    {benefit.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5 leading-normal break-words">
                    {benefit.description}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
