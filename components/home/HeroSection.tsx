'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Volume2, VolumeX, Play, Pause, ArrowRight } from 'lucide-react';
import {
  syncHomepageVideosFromApi,
  getHeroMediaType,
  getHeroSlideDuration,
  HeroMediaType,
} from '@/lib/db/homepageVideos';
import { DEFAULT_HERO_BLUR_DATA_URL } from '@/lib/heroMedia';
import { HomepageVideo } from '@/types/admin';
import { ParallaxLayer } from '@/components/ui/motion/ParallaxLayer';

function isValidActiveHeroItem(v: HomepageVideo | null | undefined): boolean {
  if (!v) return false;
  const isActive =
    (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') &&
    v.active !== false &&
    (v.active as any) !== 0 &&
    (v.active as any) !== '0';
  return Boolean(isActive && v.url && v.url.trim());
}

function normalizeActiveHeroItems(list: HomepageVideo[] | null | undefined): HomepageVideo[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(isValidActiveHeroItem)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
}

interface HeroSectionProps {
  initialVideos?: HomepageVideo[];
  showText?: boolean;
}

export function HeroSection({ initialVideos, showText = false }: HeroSectionProps) {
  const [items, setItems] = useState<HomepageVideo[]>(() => normalizeActiveHeroItems(initialVideos));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isVideoStalled, setIsVideoStalled] = useState(false);
  const [videoAttempt, setVideoAttempt] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isVideoMounted, setIsVideoMounted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isPausedManual, setIsPausedManual] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [isIntersecting, setIsIntersecting] = useState(true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null);
  const [frozenGifSrc, setFrozenGifSrc] = useState<string | null>(null);

  const heroRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxVideoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track viewport breakpoint (< 768px mobile vs >= 768px desktop)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobileViewport(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Track window load completion (guarantees zero video/GIF bytes before load event)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'complete') {
      setIsPageLoaded(true);
      return;
    }
    const onLoad = () => setIsPageLoaded(true);
    window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);

  // Detect network conditions & data saver
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        const updateConn = () => {
          const isSaveData = Boolean(conn.saveData);
          const isSlow =
            conn.effectiveType === 'slow-2g' ||
            conn.effectiveType === '2g' ||
            conn.effectiveType === '3g';
          setIsSlowConnection(isSaveData || isSlow);
        };
        updateConn();
        conn.addEventListener?.('change', updateConn);
        return () => conn.removeEventListener?.('change', updateConn);
      }
    }
  }, []);

  // Detect reduced motion preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Sync background updates from API or admin events
  useEffect(() => {
    let isMounted = true;
    syncHomepageVideosFromApi()
      .then((fresh) => {
        if (isMounted && Array.isArray(fresh)) {
          setItems(normalizeActiveHeroItems(fresh));
        }
      })
      .catch(() => {});

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent;
      const key = custom?.detail?.key;
      if (key && key !== 'homepage_videos' && key !== 'homepage_active_videos') return;
      if (Array.isArray(custom?.detail?.value) && isMounted) {
        setItems(normalizeActiveHeroItems(custom.detail.value));
      }
    };

    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('alhamd:data-updated', handleUpdate);
    };
  }, []);

  // Track tab visibility
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVis = () => {
      setIsDocumentVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  // Track viewport visibility (IntersectionObserver)
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsIntersecting(entry.isIntersecting && entry.intersectionRatio >= 0.15);
      },
      { threshold: [0, 0.15, 0.5] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const safeIndex = items.length > 0 ? currentIndex % items.length : 0;
  const currentItem: HomepageVideo | undefined = items[safeIndex] || items[0];

  // Pick viewport-specific media (mobile < 768px falls back to desktop if mobileUrl absent)
  const useMobileVariant = Boolean(isMobileViewport && currentItem?.mobileUrl?.trim());
  const activeMediaUrl = useMobileVariant
    ? currentItem!.mobileUrl!.trim()
    : currentItem?.url?.trim() || '';
  const activeMediaMime = useMobileVariant
    ? currentItem?.mobileMimeType || currentItem?.mimeType
    : currentItem?.mimeType;

  const currentMediaType: HeroMediaType = currentItem
    ? getHeroMediaType(activeMediaUrl, activeMediaMime)
    : 'video';

  const desktopPosterSrc = useMemo(() => {
    if (!currentItem) return null;
    const type = getHeroMediaType(currentItem.url, currentItem.mimeType);
    if (type === 'image') return currentItem.url?.trim() || null;
    return currentItem.thumbnailUrl?.trim() || null;
  }, [currentItem]);

  const mobilePosterSrc = useMemo(() => {
    if (!currentItem) return null;
    if (currentItem.mobileUrl?.trim()) {
      const mType = getHeroMediaType(currentItem.mobileUrl, currentItem.mobileMimeType);
      if (mType === 'image') return currentItem.mobileUrl.trim();
      if (currentItem.mobileThumbnailUrl?.trim()) return currentItem.mobileThumbnailUrl.trim();
    }
    return currentItem.mobileThumbnailUrl?.trim() || null;
  }, [currentItem]);

  const currentBlurDataUrl = useMemo(() => {
    if (!currentItem) return DEFAULT_HERO_BLUR_DATA_URL;
    if (isMobileViewport && currentItem.mobileBlurDataUrl) return currentItem.mobileBlurDataUrl;
    return currentItem.blurDataUrl || DEFAULT_HERO_BLUR_DATA_URL;
  }, [currentItem, isMobileViewport]);

  // Advance to next slide
  const advance = useCallback(() => {
    if (items.length <= 1) return;
    setIsVideoPlaying(false);
    setIsVideoMounted(false);
    setFrozenGifSrc(null);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  // Previous slide
  const goPrev = useCallback(() => {
    if (items.length <= 1) return;
    setIsVideoPlaying(false);
    setIsVideoMounted(false);
    setFrozenGifSrc(null);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const shouldSkipAnimation = isSlowConnection || prefersReducedMotion || !isDocumentVisible;

  // Lazy Video Mounting Logic: mount ONLY after load + idle + viewport known
  useEffect(() => {
    if (currentMediaType !== 'video' || !activeMediaUrl || isMobileViewport === null) {
      setIsVideoMounted(false);
      setIsVideoPlaying(false);
      return;
    }

    if (shouldSkipAnimation || !isPageLoaded) {
      setIsVideoMounted(false);
      setIsVideoPlaying(false);
      return;
    }

    let isCancelled = false;
    const scheduleMount = () => {
      const idleCallback =
        typeof window !== 'undefined' && 'requestIdleCallback' in window
          ? (window as any).requestIdleCallback
          : (cb: () => void) => setTimeout(cb, 100);

      idleCallback(
        () => {
          if (!isCancelled && !document.hidden) {
            setIsVideoMounted(true);
          }
        },
        { timeout: 400 }
      );
    };

    scheduleMount();

    return () => {
      isCancelled = true;
    };
  }, [activeMediaUrl, currentMediaType, shouldSkipAnimation, isPageLoaded, isMobileViewport]);

  // Pause/Resume <video> when off-screen, tab hidden, or manually paused
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || currentMediaType !== 'video') return;
    if (isPausedManual || !isDocumentVisible || !isIntersecting) {
      if (!vid.paused) vid.pause();
    } else if (!videoFailed && !isVideoStalled) {
      if (vid.paused) vid.play().catch(() => {});
    }
  }, [isPausedManual, isDocumentVisible, isIntersecting, currentMediaType, videoFailed, isVideoStalled]);

  // Auto-slide Timer for Images & Animated GIFs
  useEffect(() => {
    if (items.length <= 1) return;
    if (prefersReducedMotion || isPausedManual || !isDocumentVisible || !isIntersecting) return;

    if (currentMediaType === 'image' || currentMediaType === 'animated') {
      const slideSeconds = getHeroSlideDuration(currentItem?.duration);
      const timer = setTimeout(() => {
        advance();
      }, slideSeconds * 1000);

      return () => clearTimeout(timer);
    }
  }, [items.length, prefersReducedMotion, isPausedManual, isDocumentVisible, isIntersecting, currentMediaType, currentItem?.duration, advance]);

  // Maximum 15-second cap for video playback before auto-advancing
  useEffect(() => {
    if (items.length <= 1) return;
    if (currentMediaType !== 'video') return;
    if (isPausedManual || !isDocumentVisible || !isIntersecting) return;

    if (maxVideoTimerRef.current) clearTimeout(maxVideoTimerRef.current);

    maxVideoTimerRef.current = setTimeout(() => {
      advance();
    }, 15000);

    return () => {
      if (maxVideoTimerRef.current) clearTimeout(maxVideoTimerRef.current);
    };
  }, [items.length, currentMediaType, isPausedManual, isDocumentVisible, isIntersecting, safeIndex, advance]);

  const scheduleVideoRetry = useCallback(() => {
    if (retryCountRef.current >= 1 || retryTimerRef.current) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      retryCountRef.current += 1;
      setVideoFailed(false);
      setIsVideoStalled(false);
      setVideoAttempt((a) => a + 1);
      setIsVideoMounted(true);
    }, 2500);
  }, []);

  // Video stall / error detection (if video fails or doesn't start in 6s, keep black background)
  const handleWaiting = () => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      setIsVideoPlaying(false);
      setIsVideoStalled(true);
      scheduleVideoRetry();
    }, 6000);
  };

  const handlePlaying = () => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setIsVideoStalled(false);
    setVideoFailed(false);
    setIsVideoPlaying(true);
  };

  const handleVideoError = () => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    setVideoFailed(true);
    setIsVideoStalled(false);
    setIsVideoPlaying(false);
    setIsVideoMounted(false);
    scheduleVideoRetry();
  };

  const handleVideoEnded = () => {
    if (items.length === 1) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    } else {
      advance();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        advance();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advance, goPrev]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - (touchStartYRef.current || 0);

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        advance();
      } else {
        goPrev();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Preload NEXT item's poster/image only (never next video)
  const nextItem = items.length > 1 ? items[(safeIndex + 1) % items.length] : null;
  const nextPosterUrl = useMemo(() => {
    if (!nextItem) return null;
    const type = getHeroMediaType(nextItem.url, nextItem.mimeType);
    // Never prefetch poster for video items in plain black mode
    if (type === 'video') return null;

    if (isMobileViewport && nextItem.mobileUrl) {
      const mType = getHeroMediaType(nextItem.mobileUrl, nextItem.mobileMimeType);
      if (mType === 'image') return nextItem.mobileUrl.trim();
      return null;
    }
    if (type === 'image') return nextItem.url?.trim() || null;
    return null;
  }, [nextItem, isMobileViewport]);

  const hasActiveItem = Boolean(currentItem && items.length > 0);
  const activePoster = (isMobileViewport && mobilePosterSrc) ? mobilePosterSrc : desktopPosterSrc;
  const hasSeparateMobilePoster = Boolean(
    desktopPosterSrc && mobilePosterSrc && mobilePosterSrc !== desktopPosterSrc
  );

  // Fallback triggers ONLY when no active items exist or media permanently failed without active source
  const isMediaUnavailable =
    !hasActiveItem ||
    (currentMediaType === 'video' && videoFailed && !activeMediaUrl) ||
    (currentMediaType !== 'video' && posterFailed);

  const shouldShowHeroText = isMediaUnavailable || showText;

  // Never show poster for video items; picture/GIF items show their own image
  const showPosterLayer = Boolean(
    hasActiveItem &&
      !isMediaUnavailable &&
      currentMediaType === 'image' &&
      (desktopPosterSrc || mobilePosterSrc) &&
      !posterFailed
  );

  const showVideoElement = Boolean(
    hasActiveItem &&
      currentMediaType === 'video' &&
      isVideoMounted &&
      !videoFailed &&
      !shouldSkipAnimation &&
      activeMediaUrl
  );
  const showAnimatedGif = Boolean(
    hasActiveItem &&
      currentMediaType === 'animated' &&
      isPageLoaded &&
      !posterFailed &&
      activeMediaUrl
  );

  // Reset per-slide state when active item changes
  useEffect(() => {
    setPosterFailed(false);
    setVideoFailed(false);
    setIsVideoStalled(false);
    setFrozenGifSrc(null);
    retryCountRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, [activeMediaUrl, currentItem?.id]);

  // Ensure mounted video initiates muted autoplay reliably
  useEffect(() => {
    if (!showVideoElement || !videoRef.current || isPausedManual || !isIntersecting || !isDocumentVisible) return;
    const vid = videoRef.current;
    if (vid.paused) {
      vid.play().catch(() => {});
    }
  }, [showVideoElement, isPausedManual, isIntersecting, isDocumentVisible, activeMediaUrl, videoAttempt]);

  // Freeze animated GIF to its first frame when Save-Data, slow connection, reduced motion, or hidden tab
  const handleGifLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!shouldSkipAnimation || frozenGifSrc) return;
    try {
      const img = e.currentTarget;
      if (!img.naturalWidth || !img.naturalHeight) return;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setFrozenGifSrc(canvas.toDataURL('image/png'));
      }
    } catch {
      // Cross-origin GIF fallback: keep poster if available
    }
  };

  return (
    <section
      id="hero"
      ref={heroRef}
      data-hero-fallback={isMediaUnavailable ? 'true' : 'false'}
      className="relative w-full h-[min(100dvh,680px)] min-h-[480px] md:h-[min(100vh,820px)] md:min-h-[520px] overflow-hidden bg-black select-none"
      aria-label="Homepage Hero"
      onTouchStart={hasActiveItem ? handleTouchStart : undefined}
      onTouchEnd={hasActiveItem ? handleTouchEnd : undefined}
    >
      {/* Hidden <h1> for SEO and accessibility (visually hidden, exactly one h1 on homepage) */}
      <h1 className="sr-only">AL-HAMD SHOP — Premium Mobile Accessories</h1>

      {/* Branded ambient gradient glow & decorative shapes: rendered ONLY in branded fallback mode */}
      {isMediaUnavailable && (
        <>
          <ParallaxLayer depth={-0.08} pointerDepth={-15} className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-gradient-to-br from-slate-900 via-[#121c2d] to-zinc-900">
            <div
              aria-hidden="true"
              className="hero-ambient-glow pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] sm:w-[560px] sm:h-[560px] rounded-full bg-indigo-500/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="hero-ambient-glow pointer-events-none absolute -bottom-32 -left-24 w-[380px] h-[380px] sm:w-[520px] sm:h-[520px] rounded-full bg-sky-500/15 blur-3xl"
            />
          </ParallaxLayer>

          {/* Decorative floating 3D shapes */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-15 overflow-hidden">
            <ParallaxLayer depth={-0.12} pointerDepth={-22} className="absolute right-8 sm:right-20 top-24 sm:top-28">
              <div className="hero-shape-cube w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-sky-400/15 to-transparent border border-white/10 shadow-2xl backdrop-blur-xs" />
            </ParallaxLayer>

            <ParallaxLayer depth={-0.06} pointerDepth={16} className="absolute right-16 sm:right-44 bottom-20 sm:bottom-28">
              <div className="hero-shape-ring w-28 h-28 sm:w-40 sm:h-40 rounded-full border-4 border-indigo-400/25 bg-gradient-to-tr from-sky-400/10 to-transparent shadow-lg" />
            </ParallaxLayer>
          </div>
        </>
      )}

      {/* Picture layer (only for IMAGE media items, never for video items) */}
      {showPosterLayer && (
        hasSeparateMobilePoster && desktopPosterSrc && mobilePosterSrc ? (
          <picture
            className="absolute inset-0 w-full h-full z-10 transition-opacity duration-500 ease-out opacity-100"
          >
            <source media="(min-width: 768px)" srcSet={desktopPosterSrc} />
            <img
              src={mobilePosterSrc}
              alt={currentItem?.title || 'AL-HAMD SHOP Hero'}
              fetchPriority="high"
              loading="eager"
              decoding="async"
              onError={() => setPosterFailed(true)}
              className="w-full h-full object-cover object-center"
            />
          </picture>
        ) : desktopPosterSrc ? (
          <Image
            src={desktopPosterSrc}
            alt={currentItem?.title || 'AL-HAMD SHOP Hero'}
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            placeholder="blur"
            blurDataURL={currentBlurDataUrl}
            unoptimized={
              desktopPosterSrc.startsWith('http://') ||
              desktopPosterSrc.startsWith('https://') ||
              desktopPosterSrc.toLowerCase().endsWith('.svg') ||
              desktopPosterSrc.startsWith('data:')
            }
            onError={() => setPosterFailed(true)}
            className="object-cover object-center z-10 transition-opacity duration-500 ease-out opacity-100"
          />
        ) : null
      )}

      {/* Animated GIF / Animated WebP layer (mounted after load; frozen on reduced-motion/save-data) */}
      {showAnimatedGif && (
        <img
          src={shouldSkipAnimation && frozenGifSrc ? frozenGifSrc : activeMediaUrl}
          alt={currentItem?.title || 'AL-HAMD SHOP Hero'}
          loading={safeIndex === 0 ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleGifLoad}
          onError={() => setPosterFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover object-center z-10 transition-opacity duration-500 ease-out ${
            shouldSkipAnimation && activePoster && !frozenGifSrc ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        />
      )}

      {/* Single Lazy Video Layer (one source for current viewport; solid black until playing event) */}
      {showVideoElement && currentItem && (
        <video
          ref={videoRef}
          key={`${activeMediaUrl}-${videoAttempt}`}
          src={activeMediaUrl}
          autoPlay
          muted={isMuted}
          playsInline
          preload="none"
          loop={items.length === 1}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          className={`absolute inset-0 w-full h-full object-cover object-center z-10 transition-opacity duration-400 ease-out ${
            isVideoPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />
      )}

      {/* Soft dark top gradient (~140px) so header menu stays readable */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none z-20"
      />

      {/* Visible Hero Foreground Text (only rendered in branded fallback or if showText is explicitly enabled) */}
      {shouldShowHeroText && (
        <>
          {/* Bottom & left contrast gradients */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent pointer-events-none z-20"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-full md:w-3/4 bg-gradient-to-r from-slate-950/80 via-slate-950/35 to-transparent pointer-events-none z-20"
          />

          <div className="relative z-30 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center pt-16 pb-20 sm:pt-24 sm:pb-24">
            <div className="max-w-2xl space-y-4 sm:space-y-6">
              <ParallaxLayer depth={0.03} pointerDepth={8}>
                <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-neutral-100">
                  Mandi Bahauddin &bull; Nationwide Shipping
                </p>
              </ParallaxLayer>

              <ParallaxLayer depth={0.06} pointerDepth={14}>
                <p className="text-[clamp(1.875rem,4.5vw,3.75rem)] font-extrabold tracking-tight text-white leading-[1.06]">
                  AL-HAMD SHOP
                </p>
              </ParallaxLayer>

              <ParallaxLayer depth={0.08} pointerDepth={18}>
                <p className="text-[clamp(0.95rem,1.8vw,1.25rem)] text-neutral-200 font-normal leading-relaxed max-w-xl">
                  Premium Mobile Accessories — Delivered Across Pakistan
                </p>
              </ParallaxLayer>

              <ParallaxLayer depth={0.11} pointerDepth={24}>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1 pr-12 sm:pr-0">
                  <Link
                    href="/shop"
                    className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 min-h-[44px] py-3 rounded-full bg-white text-neutral-950 hover:bg-neutral-100 btn-motion-depth font-bold text-sm tracking-tight transition-all shadow-lg"
                  >
                    <span>Shop Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/deals"
                    className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 min-h-[44px] py-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/25 backdrop-blur-md btn-motion-depth font-semibold text-sm tracking-tight transition-all"
                  >
                    <span>View Deals</span>
                  </Link>
                </div>
              </ParallaxLayer>

              <ParallaxLayer depth={0.04} pointerDepth={10}>
                <p className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wide pt-1">
                  Cash on Delivery &bull; Fast Delivery &bull; Mandi Bahauddin
                </p>
              </ParallaxLayer>
            </div>
          </div>
        </>
      )}

      {/* Preload only NEXT item's poster/image (never for video) */}
      {hasActiveItem && nextPosterUrl && (
        <link rel="prefetch" as="image" href={nextPosterUrl} />
      )}

      {/* Multiple Items Indicators & Subtle Pause/Play Button (60% opacity, 100% on hover/focus) */}
      {hasActiveItem && items.length > 1 && (
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={() => setIsPausedManual(!isPausedManual)}
            className="p-1.5 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white/90 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label={isPausedManual ? 'Play hero slideshow' : 'Pause hero slideshow'}
            title={isPausedManual ? 'Play slideshow' : 'Pause slideshow'}
          >
            {isPausedManual ? <Play className="w-2.5 h-2.5 fill-current ml-0.5" /> : <Pause className="w-2.5 h-2.5 fill-current" />}
          </button>

          <div className="flex items-center gap-1.5">
            {items.map((it, idx) => {
              const isActive = idx === safeIndex;
              return (
                <button
                  key={it.id || idx}
                  type="button"
                  onClick={() => {
                    if (idx === safeIndex) return;
                    setIsVideoPlaying(false);
                    setIsVideoMounted(false);
                    setFrozenGifSrc(null);
                    setCurrentIndex(idx);
                  }}
                  aria-label={`Go to slide ${idx + 1}: ${it.title || 'Slide'}`}
                  className={`transition-all duration-300 rounded-full cursor-pointer h-1.5 ${
                    isActive
                      ? 'w-5 sm:w-6 bg-white shadow-md'
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                  title={it.title}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Single Item Pause/Play Button when items.length === 1 and video active */}
      {hasActiveItem && items.length === 1 && currentMediaType === 'video' && (
        <div className="absolute bottom-6 sm:bottom-8 left-6 z-30 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={() => setIsPausedManual(!isPausedManual)}
            className="p-1.5 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white/90 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label={isPausedManual ? 'Play video' : 'Pause video'}
            title={isPausedManual ? 'Play video' : 'Pause video'}
          >
            {isPausedManual ? <Play className="w-2.5 h-2.5 fill-current ml-0.5" /> : <Pause className="w-2.5 h-2.5 fill-current" />}
          </button>
        </div>
      )}

      {/* Audio Mute/Unmute Toggle (only visible when video is actively playing) */}
      {currentMediaType === 'video' && isVideoPlaying && (
        <div className="absolute bottom-6 sm:bottom-8 right-4 sm:right-6 md:right-10 z-30 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={() => {
              const newMuted = !isMuted;
              setIsMuted(newMuted);
              if (videoRef.current) {
                videoRef.current.muted = newMuted;
              }
            }}
            className="p-2 sm:p-2.5 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 transition-all shadow-lg hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/40"
            title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
            aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
          >
            {isMuted ? <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
          </button>
        </div>
      )}
    </section>
  );
}
