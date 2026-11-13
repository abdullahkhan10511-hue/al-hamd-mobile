'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';

export function FloatingWhatsApp() {
  const pathname = usePathname();
  const [showTooltip, setShowTooltip] = useState(true);
  const isHomepage = pathname === '/';

  // Visibility state: on homepage, starts hidden until hero scrolled past (<25% visible)
  const [isVisible, setIsVisible] = useState(!isHomepage);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (!isHomepage) {
      setIsVisible(true);
      setHasAnimatedIn(true);
      return;
    }

    // On homepage, observe the hero element
    const heroEl = document.getElementById('hero');
    if (!heroEl || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    // When hero is less than 25% visible, button appears.
    // When hero is >= 25% visible, button hides.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const heroRatio = entry.intersectionRatio;
        const isPastHero = !entry.isIntersecting || heroRatio < 0.25;

        if (isPastHero) {
          setIsVisible(true);
          setHasAnimatedIn(true);
        } else {
          setIsVisible(false);
        }
      },
      {
        threshold: [0, 0.1, 0.24, 0.25, 0.5, 0.75, 1.0],
      }
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, [isHomepage]);

  // Do not render on admin dashboard pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const phoneNumber = '923432200995';
  const defaultMessage = encodeURIComponent(
    'Salam! I want to inquire about products on AL-HAMD SHOP.'
  );
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${defaultMessage}`;

  return (
    <div
      id="floating-whatsapp-container"
      className={`fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2 group transition-all ${
        prefersReducedMotion
          ? isVisible
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
          : `duration-350 ease-out ${
              isVisible
                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                : 'opacity-0 translate-y-4 scale-80 pointer-events-none'
            }`
      }`}
      aria-hidden={!isVisible}
      aria-label="WhatsApp Support"
    >
      {/* Tooltip / Prompt bubble */}
      {showTooltip && isVisible && (
        <div className="hidden xs:flex items-center gap-1.5 bg-white text-neutral-900 border border-neutral-200/90 shadow-lg px-3 py-1.5 rounded-full text-xs font-semibold animate-fade-in transition-all">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Need help? Chat with us</span>
          <button
            type="button"
            tabIndex={isVisible ? 0 : -1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowTooltip(false);
            }}
            className="text-neutral-400 hover:text-neutral-600 p-0.5 ml-0.5 rounded-full cursor-pointer"
            aria-label="Dismiss chat hint"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Floating Button Wrapper */}
      <div className="relative">
        {/* Pulse ring after entrance on homepage/first show */}
        {isVisible && hasAnimatedIn && !prefersReducedMotion && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[#25D366] whatsapp-pulse-ring pointer-events-none"
          />
        )}

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={isVisible ? 0 : -1}
          className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-300/50 cursor-pointer"
          aria-label="Chat with AL-HAMD SHOP on WhatsApp (+92 343 2200995)"
        >
          <MessageCircle className="w-7 h-7 fill-white stroke-none" />
        </a>
      </div>
    </div>
  );
}

