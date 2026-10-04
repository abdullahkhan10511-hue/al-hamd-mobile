'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail, Phone, MapPin } from 'lucide-react';
import { getStoreSettings, getActiveSocialAccounts, syncStoreSettingsFromApi } from '@/lib/db/settings';
import { getActiveShopLocation } from '@/lib/db/locations';
import { StoreSettings, ShopLocation } from '@/types/admin';

// Clean, accessible SVG brand icons for supported social networks
function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  switch (p) {
    case 'whatsapp':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.76 1.44-.03 2.76-.98 3.25-2.33.22-.58.28-1.21.27-1.83.02-4.87.01-9.74.01-14.61z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    default:
      return null;
  }
}

export function Footer() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [activeLocation, setActiveLocation] = useState<ShopLocation | null>(null);

  const loadData = () => {
    setSettings(getStoreSettings());
    setActiveLocation(getActiveShopLocation());
  };

  useEffect(() => {
    loadData();
    syncStoreSettingsFromApi().then((fresh) => {
      if (fresh) setSettings(fresh);
    }).catch(() => {});

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      // Footer only cares about settings and location changes
      if (key && key !== 'store_settings' && key !== 'shop_locations') return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Do not render public footer on admin pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  // Official Business Details
  const officialStoreName = 'AL-HAMD MOBILE ACCESSORIES';
  const officialDescription =
    'Quality mobile accessories, chargers, cables, cases, audio products and everyday smartphone essentials, serving customers across Pakistan.';
  const officialPhone = '+92 343 2200995';
  const officialEmail = 'support@alhamd-mobile.com';
  const officialAddress = 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan';

  // Google Maps link from active location setting or official address query
  const googleMapsHref =
    activeLocation && activeLocation.isActive && activeLocation.googleMapsUrl
      ? activeLocation.googleMapsUrl
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officialAddress)}`;

  // Social media accounts from Admin Settings
  const activeSocialAccounts = getActiveSocialAccounts(settings);

  return (
    <footer
      className="bg-neutral-950 text-white border-t border-neutral-900 pt-14 pb-8 overflow-hidden"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 4 Logical Production Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 pb-12">
          {/* Column 1: BRAND / ABOUT & REAL CONTACT DETAILS */}
          <div className="space-y-4">
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.storeName || officialStoreName}
                className="h-8 w-auto max-w-[150px] object-contain mb-2 brightness-0 invert"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              {settings?.storeName || officialStoreName}
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
              {officialDescription}
            </p>

            <ul className="space-y-2.5 pt-1 text-xs text-neutral-300">
              {/* Phone Link */}
              <li className="flex items-center gap-2.5">
                <Phone
                  className="w-3.5 h-3.5 text-neutral-400 shrink-0"
                  aria-hidden="true"
                  focusable="false"
                />
                <a
                  href={`tel:${officialPhone.replace(/\s+/g, '')}`}
                  className="hover:text-white transition-colors font-medium tracking-wide"
                >
                  {officialPhone}
                </a>
              </li>

              {/* Email Link */}
              <li className="flex items-center gap-2.5">
                <Mail
                  className="w-3.5 h-3.5 text-neutral-400 shrink-0"
                  aria-hidden="true"
                  focusable="false"
                />
                <a
                  href={`mailto:${officialEmail}`}
                  className="hover:text-white transition-colors truncate"
                >
                  {officialEmail}
                </a>
              </li>

              {/* Location Link */}
              <li className="flex items-start gap-2.5">
                <MapPin
                  className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                  focusable="false"
                />
                <a
                  href={googleMapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors leading-relaxed text-neutral-300"
                  title="View store location on Google Maps"
                >
                  {officialAddress}
                </a>
              </li>
            </ul>

            {/* Social Media Row (Dynamically integrated from Admin Settings) */}
            {activeSocialAccounts.length > 0 && (
              <div className="pt-2">
                <div
                  className="flex flex-wrap items-center gap-2 text-neutral-400"
                  aria-label="Follow AL-HAMD on Social Media"
                >
                  {activeSocialAccounts.map((account) => {
                    const p = account.platform.toLowerCase();
                    const href =
                      p === 'whatsapp'
                        ? 'https://wa.me/923432200995'
                        : account.url;

                    return (
                      <a
                        key={account.platform}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        id={`footer-social-${p}`}
                        className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 hover:border-neutral-700 flex items-center justify-center transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                        aria-label={account.name || account.platform}
                        title={account.name || account.platform}
                      >
                        <SocialIcon platform={account.platform} />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Column 2: SHOP */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              Shop
            </h4>
            <ul className="space-y-2.5 text-xs text-neutral-400">
              <li>
                <Link
                  href="/shop"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  All Products
                </Link>
              </li>
              <li>
                <Link
                  href="/new-arrivals"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link
                  href="/best-sellers"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  Best Sellers
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  Categories
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: CUSTOMER CARE */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              Customer Care
            </h4>
            <ul className="space-y-2.5 text-xs text-neutral-400">
              <li>
                <Link
                  href="/contact"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/shipping-policy"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/refund-policy"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  Refund & Return Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: INFORMATION / LEGAL (Strictly public customer pages) */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              Information
            </h4>
            <ul className="space-y-2.5 text-xs text-neutral-400">
              <li>
                <Link
                  href="/privacy-policy"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-white transition-colors inline-block py-0.5"
                >
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="pt-8 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <p>© 2026 AL-HAMD MOBILE ACCESSORIES. All Rights Reserved.</p>
          <div className="flex items-center gap-4 text-neutral-600 text-[11px]">
            <Link href="/wholesale/login" className="hover:text-neutral-400 transition-colors">
              Wholesale Portal
            </Link>
            <span>•</span>
            <Link href="/super-wholesale/login" className="hover:text-neutral-400 transition-colors">
              Super Wholesale
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
