'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import {
  WhatsAppButtonSettings,
  DEFAULT_WHATSAPP_SETTINGS,
  buildWhatsAppLink,
} from '@/lib/db/siteUiSettings';

interface FloatingWhatsAppProps {
  initialSettings?: WhatsAppButtonSettings | null;
}

export function FloatingWhatsApp({ initialSettings }: FloatingWhatsAppProps) {
  const pathname = usePathname() || '/';
  const [settings, setSettings] = useState<WhatsAppButtonSettings>(() => {
    if (initialSettings) return initialSettings;
    return { ...DEFAULT_WHATSAPP_SETTINGS, enabled: false };
  });
  const [showTooltip, setShowTooltip] = useState(true);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('');

  const isHomepage = pathname === '/';

  // Check display rules
  const isHiddenByPageRule = (() => {
    if (!settings.enabled) return true;
    if (pathname.startsWith('/admin')) return true;
    if (settings.showOn === 'except_checkout_cart') {
      if (pathname.startsWith('/checkout') || pathname.startsWith('/cart')) return true;
    }
    if (settings.showOn === 'homepage_only' && !isHomepage) {
      return true;
    }
    return false;
  })();

  // Visibility state: on homepage with after_hero, starts hidden until hero scrolled past (<25% visible)
  const [isVisible, setIsVisible] = useState(() => {
    if (isHiddenByPageRule) return false;
    if (isHomepage && settings.homepageBehavior === 'after_hero') {
      return false;
    }
    return true;
  });

  // Client-side fetch latest settings if not supplied or for live updates
  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
      return;
    }
    async function fetchSettings() {
      try {
        const res = await fetch('/api/ui-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.whatsapp) {
            setSettings(data.whatsapp);
          }
        }
      } catch {
        // silent fallback to default
      }
    }
    fetchSettings();
  }, [initialSettings]);

  // Motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Update current URL and document title for token replacement
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
      setPageTitle(document.title || (isHomepage ? 'Home' : pathname.replace(/^\//, '')));
    }
  }, [pathname, isHomepage]);

  // Intersection observer for Homepage Hero
  useEffect(() => {
    if (isHiddenByPageRule) {
      setIsVisible(false);
      return;
    }

    if (!isHomepage || settings.homepageBehavior === 'always') {
      setIsVisible(true);
      setHasAnimatedIn(true);
      return;
    }

    // Homepage with 'after_hero'
    const heroEl = document.getElementById('hero');
    if (!heroEl || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

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
  }, [isHomepage, isHiddenByPageRule, settings.homepageBehavior]);

  if (isHiddenByPageRule) {
    return null;
  }

  const whatsappUrl = buildWhatsAppLink(settings.phoneNumber, settings.defaultMessage, {
    page: pageTitle,
    url: currentUrl,
  });

  const positionClass =
    settings.position === 'bottom_left'
      ? 'left-4 sm:left-6 flex-row-reverse'
      : 'right-4 sm:right-6';

  return (
    <div
      id="floating-whatsapp-container"
      className={`fixed bottom-20 sm:bottom-6 z-40 flex items-center gap-2 group transition-all ${positionClass} ${
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
          className={`relative ${
            settings.labelText
              ? 'px-4 py-3 rounded-full'
              : 'w-13 h-13 sm:w-14 sm:h-14 rounded-full'
          } bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-300/50 cursor-pointer`}
          aria-label={`Chat with AL-HAMD SHOP on WhatsApp (${settings.phoneNumber})`}
        >
          <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 fill-white stroke-none shrink-0" />
          {settings.labelText && (
            <span className="text-xs sm:text-sm font-semibold tracking-wide pr-1 whitespace-nowrap">
              {settings.labelText}
            </span>
          )}
        </a>
      </div>
    </div>
  );
}
