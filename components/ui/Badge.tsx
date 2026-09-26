import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'new' | 'sale' | 'bestseller' | 'neutral' | 'outline';
  className?: string;
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  const variants = {
    new: 'bg-emerald-600 text-white font-semibold',
    sale: 'bg-rose-600 text-white font-semibold',
    bestseller: 'bg-amber-600 text-white font-semibold',
    neutral: 'bg-neutral-100 text-neutral-800 font-medium',
    outline: 'border border-neutral-300 text-neutral-700 bg-white/80 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-xs',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
