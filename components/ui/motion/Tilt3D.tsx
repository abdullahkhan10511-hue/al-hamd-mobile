/**
 * Tilt3D.tsx — Lightweight 3D Pointer Tilt Component
 *
 * Usage:
 *   <Tilt3D maxTilt={6} glare liftImage className="h-full">
 *     <ProductCard ... />
 *   </Tilt3D>
 *
 * Characteristics:
 * - Max tilt: 6 degrees default (configurable) with perspective 900px.
 * - Smooth cubic-bezier return transition on mouse leave.
 * - Optional soft radial glare highlight that follows cursor position.
 * - Touch devices (coarse pointer): NO tilt listeners attached, press-scale only.
 * - prefers-reduced-motion: All 3D tilt disabled.
 * - will-change: transform applied ONLY during active hover/animation.
 * - Total zero dependencies (vanilla React & inline CSS transforms).
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

export interface Tilt3DProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number; // Maximum tilt angle in degrees (default: 6)
  perspective?: number; // Perspective distance in px (default: 900)
  glare?: boolean; // Enable soft cursor-following glare highlight (default: false)
  liftChild?: boolean; // Adds transform-style preserve-3d for deep layer lifting (default: false)
  scaleOnHover?: number; // Subtle hover scale (default: 1.01)
  disabled?: boolean;
}

export function Tilt3D({
  children,
  className = '',
  maxTilt = 6,
  perspective = 900,
  glare = false,
  liftChild = false,
  scaleOnHover = 1.01,
  disabled = false,
}: Tilt3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [transformStyle, setTransformStyle] = useState<string>('none');
  const [glareStyle, setGlareStyle] = useState<{ x: number; y: number; opacity: number }>({
    x: 50,
    y: 50,
    opacity: 0,
  });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect pure touch / coarse pointer without fine pointer
    const isTouch = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
    setIsTouchDevice(isTouch);

    // Detect reduced motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || isTouchDevice || prefersReducedMotion) return;
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Normalize between -1 and 1
      const normalizedX = (x / rect.width) * 2 - 1;
      const normalizedY = (y / rect.height) * 2 - 1;

      // Calculate tilt angles (rotateX is inverted: pointer top tilts card up)
      const tiltX = -normalizedY * maxTilt;
      const tiltY = normalizedX * maxTilt;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const nextTransform = `perspective(${perspective}px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale3d(${scaleOnHover}, ${scaleOnHover}, 1)`;
        if (el) el.style.transform = nextTransform;
        setTransformStyle(nextTransform);
        if (glare) {
          setGlareStyle({
            x: Math.round((x / rect.width) * 100),
            y: Math.round((y / rect.height) * 100),
            opacity: 0.16,
          });
        }
      });
    },
    [disabled, isTouchDevice, prefersReducedMotion, maxTilt, perspective, scaleOnHover, glare]
  );

  const handleMouseEnter = useCallback(() => {
    if (disabled || isTouchDevice || prefersReducedMotion) return;
    setIsHovered(true);
  }, [disabled, isTouchDevice, prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => {
    if (disabled || isTouchDevice || prefersReducedMotion) return;
    setIsHovered(false);
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    const el = containerRef.current;
    rafIdRef.current = requestAnimationFrame(() => {
      const restTransform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
      if (el) el.style.transform = restTransform;
      setTransformStyle(restTransform);
      if (glare) {
        setGlareStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    });
  }, [disabled, isTouchDevice, prefersReducedMotion, perspective, glare]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={!isTouchDevice ? handleMouseEnter : undefined}
      onMouseMove={!isTouchDevice ? handleMouseMove : undefined}
      onMouseLeave={!isTouchDevice ? handleMouseLeave : undefined}
      data-tilt3d="true"
      data-is-hovered={isHovered ? 'true' : 'false'}
      style={{
        transform: !disabled && !prefersReducedMotion && !isTouchDevice && isHovered ? transformStyle : undefined,
        transformStyle: liftChild ? 'preserve-3d' : undefined,
        transition: isHovered
          ? 'transform 80ms ease-out'
          : 'transform var(--motion-duration-tilt, 350ms) var(--motion-ease-tilt, cubic-bezier(0.2, 0.8, 0.2, 1))',
        willChange: isHovered ? 'transform' : 'auto',
      }}
      className={`relative min-w-0 ${isTouchDevice ? 'active:scale-[0.98] transition-transform duration-100' : ''} ${className}`}
    >
      {children}

      {/* Optional Glare Overlay */}
      {glare && !isTouchDevice && !prefersReducedMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden z-20 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 320px at ${glareStyle.x}% ${glareStyle.y}%, rgba(255, 255, 255, ${glareStyle.opacity}), transparent 70%)`,
            opacity: glareStyle.opacity > 0 ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}

