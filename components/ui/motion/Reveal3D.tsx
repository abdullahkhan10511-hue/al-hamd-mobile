/**
 * Reveal3D.tsx — Lightweight 3D Scroll Entrance Component
 *
 * Usage:
 *   <Reveal3D delayMs={index * 40} className="h-full">
 *     <ProductCard ... />
 *   </Reveal3D>
 *
 * Characteristics:
 * - IntersectionObserver fires ONCE per element, then disconnects immediately.
 * - Entrance: rises smoothly from translateY(16px) rotateX(6deg) to translateY(0) rotateX(0).
 * - Bulletproof visibility: Content is fully visible (opacity 1) by default on SSR,
 *   with JavaScript disabled, or after a 1000ms safety timeout if the observer never fires.
 * - prefers-reduced-motion: Instantly settled with zero transform or transition delay.
 * - will-change: transform applied ONLY while actively animating, resets to 'auto' upon settling.
 * - Zero external animation libraries (vanilla CSS transition).
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface Reveal3DProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number; // Entrance stagger delay in milliseconds (capped at 320ms)
  threshold?: number; // IntersectionObserver threshold (default: 0.08)
  rootMargin?: string; // IntersectionObserver rootMargin (default: '60px 0px')
}

export function Reveal3D({
  children,
  className = '',
  delayMs = 0,
  threshold = 0.08,
  rootMargin = '60px 0px',
}: Reveal3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Default to true on server so initial HTML is fully visible without JS
  const [isSettled, setIsSettled] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Cap stagger delay to 320ms (max 8 items * 40ms) to ensure instant perceived speed
  const safeDelay = Math.min(Math.max(0, delayMs), 320);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSettled(true);
      return;
    }

    // Immediate settle if reduced motion is preferred
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setIsSettled(true);
      return;
    }

    // Safety fallback: ensure element is 100% visible after 1000ms even if observer never triggers
    const safetyTimer = window.setTimeout(() => {
      setIsSettled(true);
    }, 1000);

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsSettled(true);
      return () => window.clearTimeout(safetyTimer);
    }

    // If element is already inside viewport upon load, settle immediately
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 60 && rect.bottom > -60) {
      setIsSettled(true);
      window.clearTimeout(safetyTimer);
      return;
    }

    // Mark that client animation is active
    setHasStarted(true);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsSettled(true);
          window.clearTimeout(safetyTimer);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      window.clearTimeout(safetyTimer);
    };
  }, [rootMargin, threshold]);

  // When not yet settled on client, start with subtle 3D transform; once settled, transition to rest
  const isAnimatedClient = hasStarted && !isSettled;

  return (
    <div
      ref={containerRef}
      data-reveal3d={isSettled ? 'settled' : 'pending'}
      style={{
        transform: isAnimatedClient
          ? 'perspective(900px) translateY(16px) rotateX(6deg)'
          : 'perspective(900px) translateY(0) rotateX(0deg)',
        opacity: isAnimatedClient ? 0.88 : 1,
        transition: isSettled
          ? `transform var(--motion-duration-reveal, 600ms) var(--motion-ease-reveal, cubic-bezier(0.16, 1, 0.3, 1)) ${safeDelay}ms, opacity var(--motion-duration-reveal, 600ms) ease-out ${safeDelay}ms`
          : undefined,
        willChange: isAnimatedClient ? 'transform, opacity' : 'auto',
      }}
      className={`min-w-0 ${className}`}
    >
      {children}
    </div>
  );
}

