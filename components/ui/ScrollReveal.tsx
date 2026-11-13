'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

/**
 * Subtle translate-only reveal that ALWAYS maintains opacity: 1 so cards and
 * trust items are never hidden or faded if IntersectionObserver is slow,
 * JavaScript lags, or reduced motion is active.
 */
export function ScrollReveal({ children, className = '', delayMs = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSettled(true);
      return;
    }

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setSettled(true);
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setSettled(true);
    }, 850);

    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSettled(true);
      return () => window.clearTimeout(fallbackTimer);
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 80) {
      setSettled(true);
      window.clearTimeout(fallbackTimer);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSettled(true);
          window.clearTimeout(fallbackTimer);
          observer.disconnect();
        }
      },
      { rootMargin: '80px 0px', threshold: 0.01 }
    );

    observer.observe(el);
    return () => {
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: 1,
        transitionDelay: settled ? '0ms' : `${Math.min(delayMs, 120)}ms`,
      }}
      className={`transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
        settled ? 'translate-y-0' : 'translate-y-2'
      } ${className}`}
    >
      {children}
    </div>
  );
}

