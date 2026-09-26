'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LoginPageMediaItem,
  LoginPageSettings,
  MediaTransitionType,
} from '@/lib/db/loginPage';

interface LoginMediaShowcaseProps {
  settings: LoginPageSettings;
  mediaItems: LoginPageMediaItem[];
  isPreview?: boolean;
}

export default function LoginMediaShowcase({
  settings,
  mediaItems,
}: LoginMediaShowcaseProps) {
  // Only active items in sorted order
  const activeSlides = mediaItems
    .filter((item) => item.isActive)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Reset index if it exceeds active items length
  useEffect(() => {
    if (currentIndex >= activeSlides.length) {
      setCurrentIndex(0);
    }
  }, [activeSlides.length, currentIndex]);

  const currentSlide: LoginPageMediaItem | undefined = activeSlides[currentIndex];

  // Transition type resolution
  const resolvedTransition: MediaTransitionType =
    currentSlide?.transition && currentSlide.transition !== 'default'
      ? currentSlide.transition
      : settings.defaultTransition || 'zoom';

  // Duration resolution (per item override or global)
  const resolvedDuration: number =
    currentSlide?.duration && currentSlide.duration >= 2000
      ? currentSlide.duration
      : settings.slideDuration || 5000;

  // Auto-play slideshow timer
  useEffect(() => {
    if (!settings.autoPlaySlideshow || activeSlides.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, resolvedDuration);

    return () => clearInterval(timer);
  }, [
    settings.autoPlaySlideshow,
    activeSlides.length,
    resolvedDuration,
    currentIndex,
  ]);

  // Video performance control: play active video, pause inactive ones
  useEffect(() => {
    activeSlides.forEach((slide, idx) => {
      const vid = videoRefs.current[slide.id];
      if (vid) {
        if (idx === currentIndex) {
          vid.currentTime = 0;
          vid.play().catch(() => {
            // Autoplay policy fallback
          });
        } else {
          vid.pause();
        }
      }
    });
  }, [currentIndex, activeSlides]);

  const nextSlide = () => {
    if (activeSlides.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }
  };

  // Framer motion transition animation variants
  const getVariants = () => {
    switch (resolvedTransition) {
      case 'slide':
        return {
          initial: { opacity: 0, x: 60 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -60 },
        };
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
      case 'crossfade':
        return {
          initial: { opacity: 0, scale: 1.02, filter: 'blur(3px)' },
          animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, scale: 0.98, filter: 'blur(3px)' },
        };
      case 'zoom':
      default:
        return {
          initial: { opacity: 0, scale: 1.06 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.96 },
        };
    }
  };

  const variants = getVariants();

  return (
    <div className="relative w-full h-full min-h-[500px] lg:min-h-[640px] bg-neutral-950 overflow-hidden select-none">
      {/* Background Media Layer - CLEAN IMAGE ONLY (No overlays, no text, no cards, no controls) */}
      <AnimatePresence mode="wait">
        {currentSlide ? (
          <motion.div
            key={currentSlide.id}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 w-full h-full"
          >
            {currentSlide.type === 'video' ? (
              <video
                ref={(el) => {
                  videoRefs.current[currentSlide.id] = el;
                }}
                src={currentSlide.url}
                poster={currentSlide.thumbnailUrl}
                muted
                playsInline
                autoPlay={currentSlide.autoPlay ?? true}
                loop={currentSlide.loop ?? true}
                onEnded={() => {
                  if (!currentSlide.loop && activeSlides.length > 1) {
                    nextSlide();
                  }
                }}
                className={`w-full h-full ${
                  settings.mediaFit === 'contain' ? 'object-contain' : 'object-cover'
                } object-center`}
              />
            ) : (
              <img
                src={currentSlide.url}
                alt={currentSlide.title || 'Login Visual'}
                className={`w-full h-full ${
                  settings.mediaFit === 'contain' ? 'object-contain' : 'object-cover'
                } object-center`}
              />
            )}
          </motion.div>
        ) : (
          <div className="w-full h-full bg-neutral-950 flex items-center justify-center">
            <div className="w-80 h-80 rounded-full bg-amber-500/5 blur-3xl" />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
