'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface MarqueeProps {
  items: React.ReactNode[];
  direction?: 'ltr' | 'rtl';
  speed?: number; // seconds for one full loop
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  ariaLabel?: string;
  className?: string;
  gapClassName?: string;
}

/**
 * Recursively clone a React node to ensure accessibility safety on duplicate copies:
 * - Injects tabIndex={-1} on all interactive elements (links, buttons, inputs)
 * - Injects aria-hidden="true" so screen readers completely ignore duplicates
 */
function makeAriaHidden(node: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(node)) return node;

  const element = node as React.ReactElement<any>;
  const isHtmlInteractive =
    typeof element.type === 'string' &&
    ['a', 'button', 'input', 'select', 'textarea'].includes(element.type);
  const isInteractive =
    isHtmlInteractive ||
    (element.props && (element.props.href !== undefined || element.props.onClick !== undefined));

  const overrideProps: Record<string, any> = {
    'aria-hidden': 'true',
    tabIndex: -1,
  };

  if (element.props && element.props.children) {
    overrideProps.children = React.Children.map(element.props.children, makeAriaHidden);
  }

  return React.cloneElement(element, overrideProps);
}

export function Marquee({
  items,
  direction = 'ltr',
  speed,
  pauseOnHover = true,
  pauseOnFocus = true,
  ariaLabel = 'Continuous showcase',
  className = '',
  gapClassName = 'gap-4 sm:gap-6 pr-4 sm:pr-6',
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // If there are fewer than 8 items, repeat the group inside each half
  // so that one half is guaranteed to be wider than the viewport on all screens
  const repeatFactor = items.length > 0 && items.length < 8 ? Math.ceil(8 / items.length) : 1;

  // Derive duration: ~5s per unique item, minimum 25s
  const durationSeconds = useMemo(() => {
    if (typeof speed === 'number' && speed > 0) return speed;
    return Math.max(25, items.length * 5);
  }, [speed, items.length]);

  // Pause animation when off-screen using IntersectionObserver to save battery and CPU
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { root: null, rootMargin: '100px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Guarantee that every duplicate link and button in DOM has tabindex="-1" and aria-hidden="true"
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dupLinks = el.querySelectorAll('.marquee-copy a, .marquee-copy button');
    dupLinks.forEach((link) => {
      link.setAttribute('tabindex', '-1');
      link.setAttribute('aria-hidden', 'true');
    });
  }, [items]);

  if (!items || items.length === 0) {
    return null;
  }

  // Build original items for the primary half
  const originalHalf: React.ReactNode[] = [];
  for (let r = 0; r < repeatFactor; r++) {
    items.forEach((item, idx) => {
      originalHalf.push(
        <div key={`orig-${r}-${idx}`} className="shrink-0 flex items-center">
          {item}
        </div>
      );
    });
  }

  // Build duplicate items for the seamless second half
  const duplicateHalf: React.ReactNode[] = [];
  for (let r = 0; r < repeatFactor; r++) {
    items.forEach((item, idx) => {
      duplicateHalf.push(
        <div key={`dup-${r}-${idx}`} className="shrink-0 flex items-center" aria-hidden="true">
          {makeAriaHidden(item)}
        </div>
      );
    });
  }

  const isPaused = isPointerDown || (pauseOnHover && isHovered) || !isVisible;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={ariaLabel}
      data-pause-on-hover={pauseOnHover ? 'true' : 'false'}
      data-is-paused={isPaused ? 'true' : 'false'}
      className={`marquee-container relative w-full overflow-hidden select-none ${className}`}
      onMouseEnter={() => pauseOnHover && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={() => setIsPointerDown(true)}
      onPointerUp={() => setIsPointerDown(false)}
      onPointerCancel={() => setIsPointerDown(false)}
      onTouchStart={() => setIsPointerDown(true)}
      onTouchEnd={() => setIsPointerDown(false)}
      onTouchCancel={() => setIsPointerDown(false)}
      style={
        {
          // Edge fade subtle gradient mask that does NOT block clicks
          maskImage:
            'linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)',
        } as React.CSSProperties
      }
    >
      <div
        className={`marquee-track ${direction === 'rtl' ? 'marquee-track-rtl' : 'marquee-track-ltr'}`}
        style={
          {
            '--marquee-duration': `${durationSeconds}s`,
            animationPlayState: isPaused ? 'paused' : undefined,
          } as React.CSSProperties
        }
      >
        {/* Primary Half (Accessible to screen readers and keyboard navigation) */}
        <div className={`marquee-group flex shrink-0 items-center ${gapClassName}`}>
          {originalHalf}
        </div>

        {/* Duplicate Half (aria-hidden and tabindex -1 for seamless infinite loop) */}
        <div
          className={`marquee-group marquee-copy flex shrink-0 items-center ${gapClassName}`}
          aria-hidden="true"
        >
          {duplicateHalf}
        </div>
      </div>
    </div>
  );
}
