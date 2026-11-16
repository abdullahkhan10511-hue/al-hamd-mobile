'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface MarqueeProps {
  items: React.ReactNode[];
  style?: 'continuous' | 'step' | 'static';
  direction?: 'ltr' | 'rtl';
  speed?: number; // Visual speed in pixels per second (px/s, e.g. 10 - 150 px/s, default ~35)
  stepSeconds?: number; // interval between steps in 'step' mode
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  edgeFade?: boolean;
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
  style = 'continuous',
  direction = 'ltr',
  speed,
  stepSeconds = 2.5,
  pauseOnHover = true,
  pauseOnFocus = true,
  edgeFade = true,
  ariaLabel = 'Showcase',
  className = '',
  gapClassName = 'gap-4 sm:gap-6 pr-4 sm:pr-6',
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryGroupRef = useRef<HTMLDivElement>(null);
  const staticScrollRef = useRef<HTMLDivElement>(null);
  const [measuredTrackWidth, setMeasuredTrackWidth] = useState<number>(0);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Step mode state
  const [stepIndex, setStepIndex] = useState(0);

  // Reduced motion detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // If there are fewer than 8 items, repeat the group inside each half
  const repeatFactor = items.length > 0 && items.length < 8 ? Math.ceil(8 / items.length) : 1;

  // Speed in pixels per second (px/s). Default is comfortable slow speed (35 px/s). Limits: 10 - 150 px/s.
  const pxPerSecond = useMemo(() => {
    const val = typeof speed === 'number' && speed > 0 ? speed : 35;
    return Math.min(150, Math.max(10, val));
  }, [speed]);

  // Estimated width for initial paint / SSR before ResizeObserver measures
  const estimatedWidth = useMemo(() => {
    return Math.max(1200, items.length * repeatFactor * 240);
  }, [items.length, repeatFactor]);

  // Compute CSS animation duration from real track width (duration = trackWidth / pxPerSecond)
  // using ResizeObserver so visual speed is identical regardless of item count or screen size.
  useEffect(() => {
    const el = primaryGroupRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width || el.scrollWidth || 0;
      if (w > 0) {
        setMeasuredTrackWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width || el.scrollWidth || 0;
          if (w > 0) {
            setMeasuredTrackWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
          }
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [items, repeatFactor]);

  const durationSeconds = useMemo(() => {
    const width = measuredTrackWidth > 0 ? measuredTrackWidth : estimatedWidth;
    const dur = width / pxPerSecond;
    return Math.max(1, Math.round(dur * 10) / 10);
  }, [measuredTrackWidth, estimatedWidth, pxPerSecond]);

  // Pause animation when off-screen using IntersectionObserver
  useEffect(() => {
    const el = containerRef.current || staticScrollRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { root: null, rootMargin: '100px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [style]);

  // Step mode timer
  useEffect(() => {
    if (style !== 'step' || prefersReducedMotion || !isVisible) return;
    if (pauseOnHover && isHovered) return;
    if (isPointerDown) return;

    const intervalMs = Math.max(1000, (stepSeconds || 2.5) * 1000);
    const timer = setInterval(() => {
      setStepIndex((prev) => {
        if (direction === 'rtl') {
          return prev <= 0 ? items.length - 1 : prev - 1;
        }
        return (prev + 1) % items.length;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [style, prefersReducedMotion, isVisible, pauseOnHover, isHovered, isPointerDown, stepSeconds, direction, items.length]);

  // Guarantee duplicate copies have tabindex="-1" and aria-hidden="true"
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dupLinks = el.querySelectorAll('.marquee-copy a, .marquee-copy button');
    dupLinks.forEach((link) => {
      link.setAttribute('tabindex', '-1');
      link.setAttribute('aria-hidden', 'true');
    });
  }, [items, style]);

  if (!items || items.length === 0) {
    return null;
  }

  // Edge fade CSS mask
  const maskStyle = edgeFade
    ? ({
        maskImage: 'linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)',
      } as React.CSSProperties)
    : undefined;

  // ---------------------------------------------------------------------------
  // STATIC MODE (or fallback when prefers-reduced-motion is true)
  // ---------------------------------------------------------------------------
  if (style === 'static' || prefersReducedMotion) {
    const scrollByAmount = (delta: number) => {
      if (staticScrollRef.current) {
        staticScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
      }
    };

    return (
      <div className={`relative group/static w-full select-none ${className}`}>
        {/* Left Arrow Button (Desktop) */}
        <button
          type="button"
          onClick={() => scrollByAmount(-320)}
          aria-label="Scroll left"
          className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/95 border border-neutral-300 text-neutral-800 shadow-md items-center justify-center opacity-0 group-hover/static:opacity-100 hover:bg-neutral-100 focus:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={staticScrollRef}
          role="region"
          aria-label={ariaLabel}
          style={maskStyle}
          className="w-full overflow-x-auto scrollbar-none scroll-smooth flex items-center py-2 px-2"
        >
          <div className={`flex shrink-0 items-center ${gapClassName}`}>
            {items.map((item, idx) => (
              <div key={`static-${idx}`} className="shrink-0 flex items-center">
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Right Arrow Button (Desktop) */}
        <button
          type="button"
          onClick={() => scrollByAmount(320)}
          aria-label="Scroll right"
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/95 border border-neutral-300 text-neutral-800 shadow-md items-center justify-center opacity-0 group-hover/static:opacity-100 hover:bg-neutral-100 focus:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP-BY-STEP MODE
  // ---------------------------------------------------------------------------
  if (style === 'step') {
    return (
      <div
        ref={containerRef}
        role="region"
        aria-label={ariaLabel}
        data-pause-on-hover={pauseOnHover ? 'true' : 'false'}
        data-is-paused={pauseOnHover && isHovered ? 'true' : 'false'}
        className={`relative w-full overflow-hidden select-none py-2 ${className}`}
        onMouseEnter={() => pauseOnHover && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerDown={() => setIsPointerDown(true)}
        onPointerUp={() => setIsPointerDown(false)}
        onTouchStart={() => setIsPointerDown(true)}
        onTouchEnd={() => setIsPointerDown(false)}
        style={maskStyle}
      >
        <div
          className="flex shrink-0 items-center transition-transform duration-500 ease-out will-change-transform"
          style={{
            transform: `translateX(-${stepIndex * 210}px)`,
          }}
        >
          {/* Double list to allow smooth wrap-around */}
          {[...items, ...items].map((item, idx) => (
            <div
              key={`step-${idx}`}
              className={`shrink-0 flex items-center ${gapClassName}`}
              aria-hidden={idx >= items.length ? 'true' : undefined}
            >
              {idx >= items.length ? makeAriaHidden(item) : item}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CONTINUOUS MARQUEE MODE
  // ---------------------------------------------------------------------------
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
      style={maskStyle}
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
        {/* Primary Half */}
        <div ref={primaryGroupRef} className={`marquee-group flex shrink-0 items-center ${gapClassName}`}>
          {originalHalf}
        </div>

        {/* Duplicate Half */}
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
