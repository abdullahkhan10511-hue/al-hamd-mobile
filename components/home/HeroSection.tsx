'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, ChevronDown, Sparkles } from 'lucide-react';
import { getActiveHomepageVideos, syncHomepageVideosFromApi } from '@/lib/db/homepageVideos';
import { HomepageVideo } from '@/types/admin';

export function HeroSection() {
  const [videos, setVideos] = useState<HomepageVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Dual video refs for seamless crossfade with zero flicker
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const [isSlowOrDataSaver, setIsSlowOrDataSaver] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const conn = (navigator as any).connection;
      if (conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') {
        setIsSlowOrDataSaver(true);
      }
    }
  }, []);

  const loadData = (customList?: HomepageVideo[]) => {
    const list = customList ? customList.filter((v) => v.active) : getActiveHomepageVideos();
    if (list.length > 0) {
      setVideos(list);
      setHasError(false);
      if (currentIndex >= list.length) {
        setCurrentIndex(0);
      }
    } else {
      setVideos([]);
      setHasError(true);
    }
  };

  useEffect(() => {
    // 1. Initial load from client storage immediately
    loadData();

    // 2. Fetch fresh active videos asynchronously on mount
    syncHomepageVideosFromApi().then((freshList) => {
      if (Array.isArray(freshList) && freshList.length > 0) {
        loadData(freshList);
      }
    });

    // 3. Listen for broadcast data updates
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent;
      const key = custom?.detail?.key;
      if (key && key !== 'homepage_videos') return;
      if (Array.isArray(custom?.detail?.value)) {
        loadData(custom.detail.value);
        return;
      }
      loadData();
    };

    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const activeVideo = videos[currentIndex] || videos[0];
  const nextIndex = (currentIndex + 1) % (videos.length || 1);
  const nextVideo = videos[nextIndex];

  // Advance to next video in sequence
  const handleVideoEnded = () => {
    if (videos.length <= 1) return;

    const nextIdx = (currentIndex + 1) % videos.length;
    const targetSlot = activeSlot === 'A' ? 'B' : 'A';
    const nextPlayer = targetSlot === 'A' ? videoRefA.current : videoRefB.current;

    if (nextPlayer) {
      nextPlayer.currentTime = 0;
      nextPlayer.muted = isMuted;
      nextPlayer.play().catch(() => {});
    }

    setActiveSlot(targetSlot);
    setCurrentIndex(nextIdx);
  };

  // Video error handler - graceful fallback
  const handleVideoError = () => {
    console.warn(`Video failed to load: ${activeVideo?.url}`);
    if (videos.length > 1) {
      // Remove failed video from active state playlist so we don't loop back to it
      setVideos((prev) => prev.filter((v) => v.id !== activeVideo?.id));
      handleVideoEnded();
    } else {
      setHasError(true);
    }
  };

  // Ensure autoplay on mount and when active video changes
  useEffect(() => {
    if (!activeVideo) return;

    const currentPlayer = activeSlot === 'A' ? videoRefA.current : videoRefB.current;
    if (currentPlayer) {
      currentPlayer.muted = isMuted;
      const playPromise = currentPlayer.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsVideoLoaded(true);
            setHasError(false);
          })
          .catch(() => {
            // Browser autoplay restrictions handled by muted: true
          });
      }
    }
  }, [currentIndex, activeSlot, activeVideo]);

  // Toggle sound
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRefA.current) videoRefA.current.muted = newMuted;
    if (videoRefB.current) videoRefB.current.muted = newMuted;
  };

  // Jump to specific video
  const handleSelectVideo = (idx: number) => {
    if (idx === currentIndex) return;
    const targetSlot = activeSlot === 'A' ? 'B' : 'A';
    const targetPlayer = targetSlot === 'A' ? videoRefA.current : videoRefB.current;

    setCurrentIndex(idx);
    setActiveSlot(targetSlot);

    if (targetPlayer) {
      targetPlayer.currentTime = 0;
      targetPlayer.muted = isMuted;
      targetPlayer.play().catch(() => {});
    }
  };

  // Fallback view when no videos are active or error occurred
  if (!activeVideo || hasError) {
    return (
      <section
        id="hero"
        className="relative w-full h-[100dvh] min-h-[500px] flex items-center justify-center overflow-hidden bg-neutral-950 text-white selection:bg-white selection:text-neutral-950"
      >
        {/* Subtle cinematic tech background */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=1920&auto=format&fit=crop)',
          }}
        />
        {/* Mesh gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-950/40" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-neutral-800/40 blur-3xl pointer-events-none" />

        {/* Minimal clean fallback badge */}
        <div className="relative z-10 text-center space-y-3 px-4 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/90 text-xs font-semibold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AL-HAMD MOBILE ACCESSORIES</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight uppercase">
            Curated Tech Essentials
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 font-light tracking-wide">
            Precision smartphone engineering & nationwide delivery across Pakistan
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 text-white/70 animate-bounce">
          <span className="text-[10px] font-bold tracking-widest uppercase text-white/60">
            Scroll
          </span>
          <ChevronDown className="w-4 h-4 text-white/70" />
        </div>
      </section>
    );
  }

  return (
    <section
      id="hero"
      className="relative w-full h-[100dvh] min-h-[500px] overflow-hidden bg-neutral-950 select-none"
      aria-label="Homepage Full-Screen Video Hero"
    >
      {/* 
        Dual Video Elements for seamless crossfading:
        Player A & Player B alternate on video transitions, ensuring zero black flash or delay.
      */}
      <video
        ref={videoRefA}
        key={`video-slot-a-${activeSlot === 'A' ? activeVideo.id : nextVideo?.id}`}
        src={activeSlot === 'A' ? activeVideo.url : nextVideo?.url}
        autoPlay={!isSlowOrDataSaver}
        muted={isMuted}
        playsInline
        poster="https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=1920&auto=format&fit=crop"
        preload={activeSlot === 'A' ? (isSlowOrDataSaver ? 'none' : 'metadata') : 'none'}
        onEnded={handleVideoEnded}
        onError={handleVideoError}
        onLoadedData={() => setIsVideoLoaded(true)}
        loop={videos.length === 1}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
          activeSlot === 'A' ? 'opacity-100 z-10' : 'opacity-0 z-0'
        }`}
      />

      {videos.length > 1 && (
        <video
          ref={videoRefB}
          key={`video-slot-b-${activeSlot === 'B' ? activeVideo.id : nextVideo?.id}`}
          src={activeSlot === 'B' ? activeVideo.url : nextVideo?.url}
          autoPlay={!isSlowOrDataSaver}
          muted={isMuted}
          playsInline
          poster="https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=1920&auto=format&fit=crop"
          preload={activeSlot === 'B' ? (isSlowOrDataSaver ? 'none' : 'metadata') : 'none'}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          onLoadedData={() => setIsVideoLoaded(true)}
          loop={videos.length === 1}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            activeSlot === 'B' ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        />
      )}

      {/* Subtle bottom vignette to blend naturally into following sections */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-neutral-950/80 via-neutral-950/30 to-transparent pointer-events-none z-20" />

      {/* Multiple Video Sequence Navigation Indicators */}
      {videos.length > 1 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          {videos.map((vid, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={vid.id || idx}
                type="button"
                onClick={() => handleSelectVideo(idx)}
                aria-label={`Switch to video ${idx + 1}: ${vid.title}`}
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

      {/* Audio Mute/Unmute Toggle */}
      <div className="absolute bottom-8 right-6 sm:right-10 z-30">
        <button
          type="button"
          onClick={toggleMute}
          className="p-3 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white border border-white/20 transition-all shadow-lg hover:scale-105 cursor-pointer"
          title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
          aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Subtle minimalist scroll indicator */}
      <div className="absolute bottom-8 left-6 sm:left-10 z-30 hidden sm:flex items-center gap-2 text-white/75">
        <div className="w-4 h-7 rounded-full border-2 border-white/60 flex items-start justify-center p-1">
          <div className="w-1 h-1.5 rounded-full bg-white animate-bounce" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
          Scroll
        </span>
      </div>
    </section>
  );
}
