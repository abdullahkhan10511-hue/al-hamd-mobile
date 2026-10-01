'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Flame, Sparkles } from 'lucide-react';
import { getBanners } from '@/lib/db/banners';
import { Banner } from '@/types/admin';

function BannerCountdown({ targetDateStr }: { targetDateStr: string }) {
  const [isExpired, setIsExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
  });

  useEffect(() => {
    const target = new Date(targetDateStr).getTime();
    if (isNaN(target)) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: '00', hours: '00', minutes: '00', seconds: '00' });
      } else {
        setIsExpired(false);
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({
          days: days < 10 ? `0${days}` : `${days}`,
          hours: hours < 10 ? `0${hours}` : `${hours}`,
          minutes: minutes < 10 ? `0${minutes}` : `${minutes}`,
          seconds: seconds < 10 ? `0${seconds}` : `${seconds}`,
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr]);

  if (isExpired) {
    return (
      <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-700/80 rounded-2xl p-4 max-w-sm">
        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>Deal Concluded</span>
        </p>
        <p className="text-xs text-neutral-300 mt-1">
          This flash promotion has ended. Explore our full catalog for the latest deals and new arrivals.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase mb-2">
        Sale Ends In:
      </p>
      <div className="flex items-center gap-2 sm:gap-3 text-center font-mono">
        <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-700 rounded-xl px-3 py-2 min-w-[54px]">
          <span className="text-xl sm:text-2xl font-bold block">{timeLeft.days}</span>
          <span className="text-[9px] text-neutral-400 uppercase font-sans font-medium">Days</span>
        </div>
        <span className="text-xl font-bold text-neutral-500">:</span>
        <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-700 rounded-xl px-3 py-2 min-w-[54px]">
          <span className="text-xl sm:text-2xl font-bold block">{timeLeft.hours}</span>
          <span className="text-[9px] text-neutral-400 uppercase font-sans font-medium">Hours</span>
        </div>
        <span className="text-xl font-bold text-neutral-500">:</span>
        <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-700 rounded-xl px-3 py-2 min-w-[54px]">
          <span className="text-xl sm:text-2xl font-bold block">{timeLeft.minutes}</span>
          <span className="text-[9px] text-neutral-400 uppercase font-sans font-medium">Mins</span>
        </div>
        <span className="text-xl font-bold text-neutral-500">:</span>
        <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-700 rounded-xl px-3 py-2 min-w-[54px]">
          <span className="text-xl sm:text-2xl font-bold block text-rose-400">{timeLeft.seconds}</span>
          <span className="text-[9px] text-neutral-400 uppercase font-sans font-medium">Secs</span>
        </div>
      </div>
    </>
  );
}

export function PromoBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);

  const loadData = () => {
    const list = getBanners().filter((b) => b.status === 'active');
    setBanners(list);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'homepage_banners' && key !== 'banners') return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  if (banners.length === 0) {
    return null;
  }

  return (
    <section className="py-16 sm:py-20 bg-neutral-50/60 border-b border-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {banners.map((banner, index) => {
            const hasCountdown = Boolean(banner.countdownEndTime);

            return (
              <motion.div
                key={banner.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="group relative rounded-3xl overflow-hidden min-h-[380px] sm:min-h-[420px] flex flex-col justify-between p-7 sm:p-10 bg-neutral-950 text-white shadow-xl"
              >
                {/* Background Image */}
                <div className="absolute inset-0 z-0 bg-neutral-950">
                  <img
                    src={
                      banner.image ||
                      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop'
                    }
                    alt={banner.title}
                    className="w-full h-full object-cover object-center opacity-40 group-hover:scale-105 transition-transform duration-700 ease-out"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
                </div>

                {/* Top Label */}
                <div className="relative z-10">
                  {banner.subtitle && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        hasCountdown
                          ? 'bg-rose-600/90 text-white'
                          : 'bg-white/20 backdrop-blur-md text-white'
                      }`}
                    >
                      {hasCountdown ? (
                        <Flame className="w-3.5 h-3.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      <span>{banner.subtitle}</span>
                    </span>
                  )}
                  <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">
                    {banner.title}
                  </h3>
                  {banner.description && (
                    <p className="text-neutral-300 text-xs sm:text-sm mt-1 max-w-sm leading-relaxed">
                      {banner.description}
                    </p>
                  )}
                </div>

                {/* Bottom Countdown & Action Button */}
                <div className="relative z-10 mt-6 sm:mt-8">
                  {hasCountdown && banner.countdownEndTime && (
                    <div className="mb-6">
                      <BannerCountdown targetDateStr={banner.countdownEndTime} />
                    </div>
                  )}

                  <div>
                    <Link
                      href={banner.buttonLink || '/shop'}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-neutral-950 text-xs sm:text-sm font-semibold hover:bg-neutral-200 transition-colors shadow-lg cursor-pointer"
                    >
                      <span>{banner.buttonText || 'Shop Collection'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
