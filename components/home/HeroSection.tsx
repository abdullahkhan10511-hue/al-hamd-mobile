'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Volume2, VolumeX, ChevronDown } from 'lucide-react';
import { getActiveHomepageVideos, syncHomepageVideosFromApi } from '@/lib/db/homepageVideos';
import { HomepageVideo } from '@/types/admin';

export function HeroSection() {
  // Safe SSR initialization - identical on server and client to avoid hydration mismatch
  const [videos, setVideos] = useState<HomepageVideo[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [canLoadVideo, setCanLoadVideo] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const failedVideoIdsRef = useRef<Set<string>>(new Set());
  const activeVideoIdRef = useRef<string | null>(null);

  // Detect slow network or Data Saver mode to conserve bandwidth
  useEffect(() => {
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        const checkSlow = () => {
          const isSaveData = Boolean(conn.saveData);
          const isSlow =
            conn.effectiveType === 'slow-2g' ||
            conn.effectiveType === '2g' ||
            conn.effectiveType === '3g';
          setIsSlowConnection(isSaveData || isSlow);
        };
        checkSlow();
        conn.addEventListener?.('change', checkSlow);
        return () => conn.removeEventListener?.('change', checkSlow);
      }
    }
  }, []);

  // Check reduced-motion preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mq.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, []);

  // Sync fresh active videos in background without blocking rendering
  useEffect(() => {
    let isMounted = true;

    // Immediately restore cached local active videos after client mount
    try {
      const cached = getActiveHomepageVideos();
      const valid = cached.filter((v) => {
        const isActive =
          v &&
          (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') &&
          v.active !== false &&
          (v.active as any) !== 0 &&
          (v.active as any) !== '0';
        return Boolean(isActive && v.url && v.url.trim());
      });
      if (valid.length > 0 && isMounted) {
        setVideos(valid);
      }
    } catch {}

    // Refresh authoritative active playlist from API
    syncHomepageVideosFromApi()
      .then((freshList) => {
        if (isMounted) {
          setVideos(freshList);
        }
      })
      .catch(() => {});

    // Listen for admin video updates
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent;
      const key = custom?.detail?.key;
      if (key && key !== 'homepage_videos' && key !== 'homepage_active_videos') return;
      if (Array.isArray(custom?.detail?.value) && isMounted) {
        const valid = custom.detail.value
          .filter((v: HomepageVideo) => {
            if (!v) return false;
            const isActive =
              (v.active === true || (v.active as any) === 1 || (v.active as any) === '1' || (v.active as any) === 'true') &&
              v.active !== false &&
              (v.active as any) !== 0 &&
              (v.active as any) !== '0' &&
              (v.active as any) !== 'false';
            const hasUrl = typeof v.url === 'string' && v.url.trim().length > 0;
            return Boolean(isActive && hasUrl);
          })
          .sort(
            (a: HomepageVideo, b: HomepageVideo) =>
              ((a.displayOrder || 0) - (b.displayOrder || 0)) || (a.id || '').localeCompare(b.id || '')
          );
        setVideos(valid);
      }
    };

    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('alhamd:data-updated', handleUpdate);
    };
  }, []);

  // CRITICAL: Defer video attachment until after initial page render and hydration.
  useEffect(() => {
    let idleId: number;
    let timeoutId: NodeJS.Timeout;

    const startLoading = () => {
      setCanLoadVideo(true);
    };

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        idleId = (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => number }).requestIdleCallback(startLoading, { timeout: 600 });
      } else {
        timeoutId = setTimeout(startLoading, 200);
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
    };
  }, []);

  // Reconcile playback index when videos array changes
  useEffect(() => {
    if (videos.length === 0) {
      setCurrentIndex(0);
      setIsReady(false);
      setHasStartedPlaying(false);
      activeVideoIdRef.current = null;
      return;
    }

    // Clean up failed set for removed items
    const currentIdSet = new Set(videos.map((v) => v.id));
    for (const failedId of failedVideoIdsRef.current) {
      if (!currentIdSet.has(failedId)) {
        failedVideoIdsRef.current.delete(failedId);
      }
    }

    const currentActiveId = activeVideoIdRef.current;
    if (currentActiveId) {
      const existingIdx = videos.findIndex((v) => v.id === currentActiveId);
      if (existingIdx !== -1) {
        if (existingIdx !== currentIndex) {
          setCurrentIndex(existingIdx);
        }
        return;
      }
    }

    // Previous active video is no longer active; select lowest numbered active video
    setCurrentIndex(0);
    setIsReady(false);
    setHasStartedPlaying(false);
    setHasError(false);
    activeVideoIdRef.current = videos[0]?.id || null;
  }, [videos]);

  const activeVideo: HomepageVideo | undefined = videos[currentIndex] || videos[0];

  useEffect(() => {
    if (activeVideo?.id) {
      activeVideoIdRef.current = activeVideo.id;
    }
  }, [activeVideo?.id]);

  // Advance to next video in sequential playlist
  const advanceToNextVideo = useCallback(() => {
    if (videos.length <= 1) return;

    let nextIdx = (currentIndex + 1) % videos.length;
    let attempts = 0;

    // Skip any videos that have permanently failed during this session
    while (
      failedVideoIdsRef.current.has(videos[nextIdx]?.id) &&
      attempts < videos.length
    ) {
      nextIdx = (nextIdx + 1) % videos.length;
      attempts++;
    }

    if (attempts >= videos.length) {
      // All active videos have failed; fail quietly to solid black
      setHasError(true);
      setIsReady(false);
      return;
    }

    setIsReady(false);
    setHasStartedPlaying(false);
    setCurrentIndex(nextIdx);
  }, [currentIndex, videos]);

  // Video error handling - safely attempts next eligible video without infinite loop
  const handleVideoError = useCallback(() => {
    if (!activeVideo) return;
    console.warn(`Homepage video failed or aborted: ${activeVideo.url}`);
    failedVideoIdsRef.current.add(activeVideo.id);

    const remaining = videos.filter((v) => !failedVideoIdsRef.current.has(v.id));
    if (remaining.length > 0) {
      advanceToNextVideo();
    } else {
      setHasError(true);
      setIsReady(false);
    }
  }, [activeVideo, videos, advanceToNextVideo]);

  // Watchdog fallback for hanging video requests
  useEffect(() => {
    if (!canLoadVideo || isReady || hasStartedPlaying || !activeVideo) return;

    const timeout = setTimeout(() => {
      if (!isReady && !hasStartedPlaying) {
        console.warn(`Homepage video timed out waiting for media stream: ${activeVideo.url}`);
        handleVideoError();
      }
    }, 12000);

    return () => clearTimeout(timeout);
  }, [canLoadVideo, currentIndex, isReady, hasStartedPlaying, activeVideo, handleVideoError]);

  // Media lifecycle events
  const handleLoadStart = () => {
    if (!hasStartedPlaying) {
      setIsReady(false);
    }
  };

  const handleLoadedData = () => {
    setIsReady(true);
  };

  const handleCanPlay = () => {
    setIsReady(true);
    const video = videoRef.current;
    if (video && video.paused) {
      video.muted = isMuted;
      video.play().catch(() => {
        // Autoplay policy prevented immediate playback; try muted fallback
        if (!video.muted) {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        }
      });
    }
  };

  const handlePlaying = () => {
    setIsReady(true);
    setHasStartedPlaying(true);
    setHasError(false);
  };

  const handleWaiting = () => {};
  const handleStalled = () => {};

  // Video ended event: single video loops seamlessly, multiple videos advance
  const handleEnded = useCallback(() => {
    if (videos.length === 1) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
      return;
    }
    advanceToNextVideo();
  }, [videos.length, advanceToNextVideo]);

  // Autoplay attempt with resilient muted fallback
  useEffect(() => {
    if (!canLoadVideo) return;
    const video = videoRef.current;
    if (!video || !activeVideo?.url) return;

    video.muted = isMuted;
    setIsReady(false);
    setHasStartedPlaying(false);

    try {
      video.load();
    } catch {}

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsReady(true);
          setHasStartedPlaying(true);
          setHasError(false);
        })
        .catch(() => {
          // Autoplay restricted by browser; retry muted
          if (!video.muted) {
            video.muted = true;
            setIsMuted(true);
            video.play()
              .then(() => {
                setIsReady(true);
                setHasStartedPlaying(true);
                setHasError(false);
              })
              .catch(() => {});
          }
        });
    }
  }, [canLoadVideo, currentIndex, activeVideo?.url, isMuted]);

  // Toggle audio
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
  };

  // Switch video from indicators
  const handleSelectVideo = (idx: number) => {
    if (idx === currentIndex) return;
    setIsReady(false);
    setHasStartedPlaying(false);
    setCurrentIndex(idx);
  };

  // If permanently errored or no active videos exist: solid clean black container
  if (!activeVideo || hasError || videos.length === 0) {
    return (
      <section
        id="hero"
        className="relative w-full h-[48vh] min-h-[290px] max-h-[420px] sm:h-[60vh] sm:min-h-[380px] sm:max-h-none md:h-[100dvh] md:min-h-[500px] overflow-hidden bg-black select-none"
        aria-label="Homepage Hero Video"
      >
        <div className="absolute inset-0 bg-black z-0" aria-hidden="true" />
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 text-white/40 pointer-events-none">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            Scroll Down
          </span>
          <ChevronDown className="w-4 h-4 text-white/40 animate-bounce" />
        </div>
      </section>
    );
  }

  return (
    <section
      id="hero"
      className="relative w-full h-[48vh] min-h-[290px] max-h-[420px] sm:h-[60vh] sm:min-h-[380px] sm:max-h-none md:h-[100dvh] md:min-h-[500px] overflow-hidden bg-black select-none"
      aria-label="Homepage Hero Video"
    >
      {/*
        Solid black backdrop:
        Permanently present at z-0. Guarantees that the container is solid black
        prior to video frame decoding, during buffering, or if media fails.
      */}
      <div className="absolute inset-0 bg-black z-0" aria-hidden="true" />

      {/* Lightweight poster image fallback on slow connections or prior to playback */}
      {activeVideo.thumbnailUrl && (
        <Image
          src={activeVideo.thumbnailUrl}
          alt={activeVideo.title || 'Homepage Hero'}
          fill
          priority
          sizes="100vw"
          className={`absolute inset-0 w-full h-full object-cover z-5 transition-opacity duration-700 ${
            isReady ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        />
      )}

      {/* 
        HTML5 Video Element:
        - Non-blocking: 'src' is attached only after client hydration/idle queue.
        - preload is "none" on slow/data-saver connections, "metadata" on standard.
        - muted + playsInline conforms strictly with mobile autoplay standards.
        - opacity-0 until first frame decoded, transitioning smoothly to opacity-100.
      */}
      <video
        ref={videoRef}
        src={canLoadVideo ? activeVideo.url : undefined}
        poster={activeVideo.thumbnailUrl || undefined}
        autoPlay={!prefersReducedMotion}
        muted={isMuted}
        playsInline
        preload={isSlowConnection || prefersReducedMotion ? 'none' : 'metadata'}
        onLoadStart={handleLoadStart}
        onLoadedData={handleLoadedData}
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onWaiting={handleWaiting}
        onStalled={handleStalled}
        onEnded={handleEnded}
        onError={handleVideoError}
        loop={videos.length === 1}
        className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity ${
          prefersReducedMotion ? 'duration-0' : 'duration-700'
        } ease-out ${isReady ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Subtle bottom vignette to blend naturally into following sections */}
      <div className="absolute inset-x-0 bottom-0 h-20 sm:h-28 md:h-32 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none z-20" />

      {/* Multiple Video Sequence Navigation Indicators - Fades in only once video is ready */}
      {videos.length > 1 && (
        <div
          className={`absolute bottom-3 sm:bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 transition-opacity duration-500 ${
            isReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {videos.map((vid, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={vid.id || idx}
                type="button"
                onClick={() => handleSelectVideo(idx)}
                aria-label={`Switch to video ${idx + 1}: ${vid.title || 'Video'}`}
                className={`transition-all duration-300 rounded-full cursor-pointer h-1.5 ${
                  isActive
                    ? 'w-6 sm:w-8 bg-white shadow-md'
                    : 'w-1.5 sm:w-2 bg-white/40 hover:bg-white/70'
                }`}
                title={vid.title}
              />
            );
          })}
        </div>
      )}

      {/* Audio Mute/Unmute Toggle - Fades in only once video is ready */}
      <div
        className={`absolute bottom-3 sm:bottom-6 md:bottom-8 right-3 sm:right-6 md:right-10 z-30 transition-opacity duration-500 ${
          isReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={toggleMute}
          className="p-2.5 sm:p-3 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 transition-all shadow-lg hover:scale-105 cursor-pointer"
          title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
          aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </button>
      </div>

      {/* Minimalist scroll indicator */}
      <div className="absolute bottom-8 left-6 sm:left-10 z-30 hidden sm:flex items-center gap-2 text-white/60 pointer-events-none">
        <div className="w-4 h-7 rounded-full border-2 border-white/50 flex items-start justify-center p-1">
          <div className="w-1 h-1.5 rounded-full bg-white animate-bounce" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          Scroll
        </span>
      </div>
    </section>
  );
}
