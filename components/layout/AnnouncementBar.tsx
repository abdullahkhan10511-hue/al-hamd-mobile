'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAnnouncements } from '@/lib/db/announcements';
import { getStoreSettings } from '@/lib/db/settings';
import { AnnouncementItem, StoreSettings } from '@/types/admin';

export function AnnouncementBar() {
  const pathname = usePathname();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const loadData = () => {
    const list = getAnnouncements().filter((a) => a.active);
    setAnnouncements(list);
    setSettings(getStoreSettings());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'announcements' && key !== 'store_settings') return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (pathname === '/' || announcements.length === 0) return null;

  const current = announcements[currentIndex] || announcements[0];

  return (
    <div className="bg-neutral-950 text-white text-xs py-2 px-4 select-none relative z-50 overflow-hidden border-b border-neutral-900">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="hidden sm:flex items-center gap-1.5 text-neutral-400 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>{settings?.storeTagline || 'Curated Modern Essentials'}</span>
        </div>

        <div className="flex-1 flex justify-center items-center overflow-hidden h-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id || currentIndex}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="text-center truncate"
            >
              <Link
                href={current.link || '/shop'}
                className="hover:text-neutral-300 transition-colors inline-flex items-center gap-1 font-medium tracking-wide"
              >
                <span>{current.text}</span>
                {current.linkText && (
                  <span className="text-amber-400 text-[11px] underline ml-1 font-semibold">
                    {current.linkText}
                  </span>
                )}
                <ChevronRight className="w-3 h-3 inline-block opacity-70" />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-[11px] text-neutral-400">
          <Link href="/contact" className="hover:text-white transition-colors">
            24/7 Support
          </Link>
          <span className="text-neutral-700">|</span>
          <span className="text-neutral-300 font-mono font-semibold">
            {settings?.currency || 'PKR'} ({settings?.currencySymbol || 'Rs.'})
          </span>
        </div>
      </div>
    </div>
  );
}
