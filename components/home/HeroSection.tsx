'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, ChevronDown } from 'lucide-react';
import { getActiveHomepageVideos, syncHomepageVideosFromApi, seedHomepageVideos } from '@/lib/db/homepageVideos';
import { HomepageVideo } from '@/types/admin';

export function HeroSection() {
  // Synchronous initial seed to prevent initial empty-render flash
  const [videos, setVideos] = useState<HomepageVideo[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const active = getActiveHomepageVideos();
        if (active.length > 0) return active;
      } catch {
        // Fall back to seed
      }
    }
    return seedHomepageVideos.filter((v) => v.active);
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [canLoadVideo, setCanLoadVideo] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // Sync fresh active videos asynchronously in background without blocking rendering
  useEffect(() => {
    let isMounted = true;

    try {
      const cached = getActiveHomepageVideos();
      if (cached.length > 0 && isMounted) {
        setVideos(cached);
      }
    } catch {
      // Ignore
    }

    // Refresh from API in background (non-blocking)
    syncHomepageVideosFromApi().then((freshList) => {
      if (isMounted && Array.isArray(freshList) && freshList.length > 0) {
        setVideos(freshList.filter((v) => v.active));
      }
    }).catch(() => {});

    // Listen for admin video updates
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent;
      const key = custom?.detail?.key;
      if (key && key !== 'homepage_videos') return;
      if (Array.isArray(custom?.detail?.value)) {
        const updated = custom.detail.value.filter((v: HomepageVideo) => v.active);
        if (updated.length > 0 && isMounted) {
          setVideos(updated);
        }
      }
    };

    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('alhamd:data-updated', handleUpdate);
    };
  }, []);

  // CRITICAL: Defer video attachment until after initial page render and hydration.
  // This guarantees that HTML, CSS, JavaScript, fonts, and critical product/category APIs
  // receive 100% priority over the heavy video media stream.
  useEffect(() => {
    let idleId: number;
    let timeoutId: NodeJS.Timeout;

    const startLoading = () => {
      setCanLoadVideo(true);
    };

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        // Wait for browser idle or max 600ms fallback
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

  const activeVideo = videos[currentIndex] || videos[0];

  // Advance to next video in sequence
  const advanceToNextVideo = useCallback(() => {
    if (videos.length <= 1) return;
    setIsReady(false);
    setHasStartedPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % videos.length);
  }, [videos.length]);

  // Video error handling - keeps container cleanly black without breaking the page
  const handleVideoError = useCallback(() => {
    console.warn(`Homepage video failed or aborted: ${activeVideo?.url}`);
    if (videos.length > 1) {
      advanceToNextVideo();
    } else {
      setHasError(true);
      setIsReady(false);
    }
  }, [activeVideo?.url, videos.length, advanceToNextVideo]);

  // Graceful stall/hang fallback: if video request hangs indefinitely (>12s), fail quietly to black
  useEffect(() => {
    if (!canLoadVideo || isReady || hasStartedPlaying || !activeVideo) return;

    const timeout = setTimeout(() => {
      if (!isReady && !hasStartedPlaying) {
        console.warn(`Homepage video timed out waiting for media stream: ${activeVideo.url}`);
        if (videos.length > 1) {
          advanceToNextVideo();
        } else {
          setHasError(true);
        }
      }
    }, 12000);

    return () => clearTimeout(timeout);
  }, [canLoadVideo, currentIndex, isReady, hasStartedPlaying, activeVideo, videos.length, advanceToNextVideo]);

  // Video media lifecycle events
  const handleLoadStart = () => {
    if (!hasStartedPlaying) {
      setIsReady(false);
    }
  };

  const handleLoadedData = () => {
    // First frame decoded successfully
    setIsReady(true);
  };

  const handleCanPlay = () => {
    setIsReady(true);
    const video = videoRef.current;
    if (video && video.paused) {
      video.muted = isMuted;
      video.play().catch(() => {
        // Autoplay policy prevented immediate playback; remains on solid ready frame
      });
    }
  };

  const handlePlaying = () => {
    setIsReady(true);
    setHasStartedPlaying(true);
    setHasError(false);
  };

  const handleWaiting = () => {
    // Preserve current frame during buffering without flashing to black
  };

  const handleStalled = () => {
    // Network stall: preserve current frame
  };

  // Attempt autoplay when ready and unmuted/muted state alters
  useEffect(() => {
    if (!canLoadVideo) return;
    const video = videoRef.current;
    if (!video || !activeVideo?.url) return;

    video.muted = isMuted;
    if (video.paused) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsReady(true);
            setHasStartedPlaying(true);
            setHasError(false);
          })
          .catch(() => {
            // Autoplay restricted by browser; controls remain usable
          });
      }
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

  // If permanently errored or no videos exist: solid clean black container without any broken icons or placeholders
  if (!activeVideo || hasError) {
    return (
      <section
        id="hero"
        className="relative w-full h-[100dvh] min-h-[500px] overflow-hidden bg-black select-none"
        aria-label="Homepage Hero Video"
      >
        <div className="absolute inset-0 bg-black z-0" aria-hidden="true" />
        {/* Subtle scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 text-white/40 pointer-events-none">
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
      className="relative w-full h-[100dvh] min-h-[500px] overflow-hidden bg-black select-none"
      aria-label="Homepage Hero Video"
    >
      {/*
        Solid black backdrop:
        Permanently present at z-0. Guarantees that the container is solid black
        prior to video frame decoding, during buffering, or if media fails.
        Never shows AI placeholders, stock photos, or broken indicators.
      */}
      <div className="absolute inset-0 bg-black z-0" aria-hidden="true" />

      {/* 
        HTML5 Video Element:
        - Non-blocking: 'src' is attached only after client hydration/idle queue.
        - preload="metadata" ensures minimal network footprint.
        - muted + playsInline conforms strictly with mobile autoplay standards.
        - opacity-0 until first frame decoded, transitioning smoothly to opacity-100.
        - NO poster attribute to prevent unwanted picture flashes.
      */}
      <video
        ref={videoRef}
        key={activeVideo.id || `hero-vid-${currentIndex}`}
        src={canLoadVideo ? activeVideo.url : undefined}
        autoPlay
        muted={isMuted}
        playsInline
        preload="metadata"
        onLoadStart={handleLoadStart}
        onLoadedData={handleLoadedData}
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onWaiting={handleWaiting}
        onStalled={handleStalled}
        onEnded={advanceToNextVideo}
        onError={handleVideoError}
        loop={videos.length === 1}
        className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity ${
          prefersReducedMotion ? 'duration-0' : 'duration-700'
        } ease-out ${isReady ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Subtle bottom vignette to blend naturally into following sections */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none z-20" />

      {/* Multiple Video Sequence Navigation Indicators - Fades in only once video is ready */}
      {videos.length > 1 && (
        <div
          className={`absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 transition-opacity duration-500 ${
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
                    ? 'w-8 bg-white shadow-md'
                    : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
                title={vid.title}
              />
            );
          })}
        </div>
      )}

      {/* Audio Mute/Unmute Toggle - Fades in only once video is ready */}
      <div
        className={`absolute bottom-8 right-6 sm:right-10 z-30 transition-opacity duration-500 ${
          isReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={toggleMute}
          className="p-3 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 transition-all shadow-lg hover:scale-105 cursor-pointer"
          title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
          aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
