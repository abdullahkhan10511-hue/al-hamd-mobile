/**
 * ParallaxLayer.tsx — Lightweight Depth Layer Component
 *
 * Usage:
 *   <ParallaxLayer depth={0.12} pointerDepth={15}>
 *     <h1>Hero Title</h1>
 *   </ParallaxLayer>
 *
 * Characteristics:
 * - Depth factor drives subtle translateY relative to scroll position.
 * - Desktop pointer movement drives subtle translate3d(x, y, 0).
 * - RAF throttling ensures maximum 60fps rendering without jank.
 * - Automatically pauses motion when tab is hidden or element is off-screen.
 * - prefers-reduced-motion: 0 movement, renders in standard rest position.
 * - Animate ONLY transform (translate3d).
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

export interface ParallaxLayerProps {
  children: React.ReactNode;
  className?: string;
  depth?: number; // Scroll parallax depth factor (-0.5 to 0.5, default: 0.1)
  pointerDepth?: number; // Desktop pointer parallax offset in px (default: 12)
  disabled?: boolean;
}

export function ParallaxLayer({
  children,
  className = '',
  depth = 0.1,
  pointerDepth = 12,
  disabled = false,
}: ParallaxLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const isIntersectingRef = useRef(true);
  const isTabVisibleRef = useRef(true);
  const prefersReducedMotionRef = useRef(false);
  const isTouchDeviceRef = useRef(false);

  const scrollYRef = useRef(0);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  const applyTransform = useCallback(() => {
    if (disabled || prefersReducedMotionRef.current || !isIntersectingRef.current || !isTabVisibleRef.current) return;
    const el = layerRef.current;
    if (!el) return;

    const scrollOffset = scrollYRef.current * depth;
    const pX = isTouchDeviceRef.current ? 0 : pointerXRef.current * pointerDepth;
    const pY = isTouchDeviceRef.current ? 0 : pointerYRef.current * pointerDepth;

    const x = Math.round(pX * 10) / 10;
    const y = Math.round((scrollOffset + pY) * 10) / 10;

    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [disabled, depth, pointerDepth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect pure touch / coarse pointer without fine pointer
    isTouchDeviceRef.current = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;

    // Detect reduced motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
      if (e.matches && layerRef.current) layerRef.current.style.transform = '';
    };
    motionQuery.addEventListener('change', handleMotionChange);

    // Visibility change listener
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // IntersectionObserver to pause when off-screen
    const el = layerRef.current;
    let observer: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]) {
            isIntersectingRef.current = entries[0].isIntersecting;
            if (el) {
              el.style.willChange = entries[0].isIntersecting && !prefersReducedMotionRef.current ? 'transform' : 'auto';
            }
          }
        },
        { threshold: 0 }
      );
      observer.observe(el);
    }

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (observer) observer.disconnect();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Scroll listener
  useEffect(() => {
    if (typeof window === 'undefined' || disabled) return;

    const handleScroll = () => {
      if (!isIntersectingRef.current || !isTabVisibleRef.current || prefersReducedMotionRef.current) return;
      scrollYRef.current = window.scrollY;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(applyTransform);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [disabled, applyTransform]);

  // Desktop pointer listener
  useEffect(() => {
    if (typeof window === 'undefined' || disabled) return;

    const handlePointerMove = (e: MouseEvent) => {
      if (!isIntersectingRef.current || !isTabVisibleRef.current || prefersReducedMotionRef.current || isTouchDeviceRef.current) return;
      pointerXRef.current = (e.clientX / window.innerWidth) * 2 - 1;
      pointerYRef.current = (e.clientY / window.innerHeight) * 2 - 1;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(applyTransform);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('mousemove', handlePointerMove);
  }, [disabled, applyTransform]);

  return (
    <div
      ref={layerRef}
      data-parallax-layer="true"
      style={{
        transition: 'transform 120ms ease-out',
      }}
      className={className}
    >
      {children}
    </div>
  );
}

