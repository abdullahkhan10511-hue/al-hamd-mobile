import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  hideWhenEmpty?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  reviewCount,
  size = 'sm',
  showCount = true,
  hideWhenEmpty = false,
  className,
}: StarRatingProps) {
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const hasReviews = typeof reviewCount === 'number' && reviewCount > 0;

  if (!hasReviews) {
    if (!showCount || hideWhenEmpty) return null;
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <div className="flex items-center gap-0.5 text-neutral-300">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} className={cn(iconSizes[size], 'text-neutral-200 fill-neutral-100')} />
          ))}
        </div>
        <span className="text-[11px] text-neutral-400 font-normal">No reviews yet</span>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <div className="flex items-center gap-0.5 text-amber-500">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              iconSizes[size],
              star <= Math.round(rating)
                ? 'fill-amber-400 text-amber-400'
                : 'text-neutral-200 fill-neutral-100'
            )}
          />
        ))}
      </div>
      {showCount && (
        <span className={cn('text-neutral-600 font-medium', textSizes[size])}>
          {rating.toFixed(1)} <span className="text-neutral-400">({reviewCount})</span>
        </span>
      )}
    </div>
  );
}
