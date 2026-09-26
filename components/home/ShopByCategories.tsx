'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getActiveCategories } from '@/lib/db/categories';
import { Category } from '@/types';

export function ShopByCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isTouchingRef = useRef(false);

  const loadData = () => {
    setCategories(getActiveCategories());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Smooth continuous auto-looping animation
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || categories.length === 0) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    const speed = 40; // Pixels per second for a smooth, relaxed glide

    const step = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (!isPaused && !isTouchingRef.current && container) {
        container.scrollLeft += speed * delta;

        // Loop seamlessly when half of the duplicated list has passed
        const halfWidth = container.scrollWidth / 2;
        if (halfWidth > 0 && container.scrollLeft >= halfWidth) {
          container.scrollLeft -= halfWidth;
        } else if (container.scrollLeft <= 0) {
          container.scrollLeft += halfWidth;
        }
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, categories]);


  if (categories.length === 0) {
    return null;
  }

  // Duplicate items for seamless infinite marquee loop
  const marqueeItems = [...categories, ...categories];

  return (
    <section id="categories" className="py-14 sm:py-18 bg-white border-b border-neutral-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950">
            Shop by Category
          </h2>
        </div>
      </div>

      {/* Animated Horizontal Strip Container */}
      <div className="relative w-full">
        {/* Left & Right gradient edge fade masks for high-end look */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

        {/* Scrollable / Touch-drag container */}
        <div
          ref={scrollRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => {
            isTouchingRef.current = false;
            setIsPaused(false);
          }}
          onTouchStart={() => {
            isTouchingRef.current = true;
            setIsPaused(true);
          }}
          onTouchEnd={() => {
            isTouchingRef.current = false;
            setTimeout(() => setIsPaused(false), 600);
          }}
          className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none py-3 px-4 sm:px-8 cursor-grab active:cursor-grabbing select-none"
          style={{ scrollBehavior: 'auto' }}
        >
          {marqueeItems.map((cat, idx) => (
            <Link
              key={`${cat.id}-${idx}`}
              href={`/category/${cat.slug}`}
              className="group relative shrink-0 w-44 sm:w-56 md:w-60 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-200/80 hover:border-neutral-900 shadow-xs hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 block"
            >
              {/* Category Image */}
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                <Image
                  src={
                    cat.image && typeof cat.image === 'string' && cat.image.trim()
                      ? cat.image.trim()
                      : 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=800&auto=format&fit=crop'
                  }
                  alt={cat.name}
                  fill
                  sizes="(max-width: 640px) 176px, (max-width: 768px) 224px, 240px"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                {/* Gradient Shading */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/30 to-transparent transition-opacity group-hover:opacity-95" />

                {/* Text Content Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-white">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 group-hover:text-amber-400 transition-colors block">
                    Category
                  </span>
                  <h3 className="text-sm sm:text-base font-bold tracking-tight text-white line-clamp-1 mt-0.5">
                    {cat.name}
                  </h3>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-300 font-semibold group-hover:text-white transition-colors">
                    <span>Shop Collection</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
