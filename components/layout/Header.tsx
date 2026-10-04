'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Heart,
  User,
  ShoppingBag,
  Menu,
  X,
  ChevronRight,
  ArrowUpRight,
  MapPin,
  Package,
  LogOut,
  Star,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useSearch } from '@/context/SearchContext';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getNavigation } from '@/lib/db/navigation';
import { getActiveCategories, syncCategoriesFromApi, deduplicateCategoriesById } from '@/lib/db/categories';
import { getStoreSettings, getActiveSocialAccounts, syncStoreSettingsFromApi } from '@/lib/db/settings';
import { getActiveShopLocation } from '@/lib/db/locations';
import { getPages } from '@/lib/db/pages';
import { NavigationItem, StoreSettings, ShopLocation, CustomPage } from '@/types/admin';
import { Category } from '@/types';
import { AnnouncementBar } from './AnnouncementBar';

export function Header() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const isHomePage = pathname === '/';
  const isTransparent = isHomePage && !isScrolled;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [navItems, setNavItems] = useState<NavigationItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [activeLocation, setActiveLocation] = useState<ShopLocation | null>(null);
  const [mobilePages, setMobilePages] = useState<CustomPage[]>([]);

  const { customer, isAuthenticated, logout } = useCustomerAuth();
  const { totalItems, setIsCartOpen } = useCart();
  const { wishlistCount } = useWishlist();
  const { openSearch } = useSearch();
  const activeSocialAccounts = getActiveSocialAccounts(settings);

  // Close account dropdown on route change
  useEffect(() => {
    setAccountDropdownOpen(false);
  }, [pathname]);


  const loadData = async () => {
    const baseNav = getNavigation().filter((n) => n.visible);
    try {
      const allPages = await getPages();
      const headerPages = allPages.filter((p) => p.status === 'Published' && p.showInHeader);
      const pageNavItems: NavigationItem[] = headerPages
        .filter((p) => !baseNav.some((b) => b.href === `/${p.slug}`))
        .map((p) => ({
          id: `page-nav-${p.id}`,
          label: p.title.replace('AL·HAMD', '').replace('Mobile Accessories', '').trim() || p.title,
          href: `/${p.slug}`,
          displayOrder: 50 + p.order,
          visible: true,
        }));
      setNavItems([...baseNav, ...pageNavItems].sort((a, b) => a.displayOrder - b.displayOrder));
      setMobilePages(allPages.filter((p) => p.status === 'Published' && p.showInMobile));
    } catch {
      setNavItems(baseNav);
    }
    setCategories(deduplicateCategoriesById(getActiveCategories()));
    setSettings(getStoreSettings());
    setActiveLocation(getActiveShopLocation());
  };

  useEffect(() => {
    loadData();
    syncCategoriesFromApi().then(() => {
      setCategories(deduplicateCategoriesById(getActiveCategories()));
    }).catch(() => {});
    syncStoreSettingsFromApi().then((fresh) => {
      if (fresh) setSettings(fresh);
    }).catch(() => {});

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      // Header cares about nav, categories, settings, locations, pages — not product stock or order events
      const HEADER_KEYS = ['categories', 'navigation', 'store_settings', 'shop_locations', 'announcements', 'pages'];
      if (key && !HEADER_KEYS.includes(key)) return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [mobileMenuOpen]);

  const hasLogo = Boolean(settings?.logoUrl && settings.logoUrl.trim());
  const rawStoreName = settings?.storeName !== undefined ? settings.storeName.trim() : 'AL-HAMD-MOBILE';
  const storeName = rawStoreName || (!hasLogo ? 'AL-HAMD-MOBILE' : '');
  const logoUrl = settings?.logoUrl?.trim();

  const browserTitle =
    settings?.websiteTitle ||
    settings?.seo?.websiteTitle ||
    settings?.seo?.metaTitle ||
    (storeName ? `${storeName} | Mobile Accessories in Pakistan` : '');

  // Sync document title on client only for home page if not set
  useEffect(() => {
    if (typeof document !== 'undefined' && browserTitle) {
      if (pathname === '/' && !document.title.includes('Admin')) {
        document.title = browserTitle;
      }
    }
  }, [browserTitle, pathname]);

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      <AnnouncementBar />
      <header
        className={`w-full transition-all duration-300 ${
          isHomePage
            ? `fixed top-0 left-0 right-0 z-40 ${
                isTransparent
                  ? 'bg-transparent border-transparent py-4 sm:py-4.5'
                  : 'bg-white/95 backdrop-blur-md shadow-xs border-b border-neutral-200/70 py-3'
              }`
            : `sticky top-0 z-40 ${
                isScrolled
                  ? 'bg-white/95 backdrop-blur-md shadow-xs border-b border-neutral-200/70 py-3'
                  : 'bg-white border-b border-neutral-100 py-4 sm:py-4.5'
              }`
        }`}
      >
        {/* Cinematic gradient overlay when navbar is transparent over video hero */}
        <div
          className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/25 to-transparent transition-opacity duration-500 ${
            isTransparent ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Mobile hamburger & Brand Logo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className={`lg:hidden p-2 -ml-2 rounded-full transition-colors cursor-pointer ${
                  isTransparent
                    ? 'text-white hover:text-white hover:bg-white/15'
                    : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
                aria-label="Open mobile menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link
                href="/"
                className="group flex items-center gap-2 sm:gap-2.5 md:gap-3 shrink-0"
                aria-label="Home"
              >
                {/* Logo Image */}
                {hasLogo && logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={storeName || 'Brand Logo'}
                    className="h-7 sm:h-8 md:h-9 w-auto max-w-[80px] sm:max-w-[120px] md:max-w-[150px] object-contain object-center transition-opacity group-hover:opacity-90 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}

                {/* Brand Name */}
                {storeName ? (
                  <span className="flex items-center shrink-0">
                    <span
                      className={`font-bold text-base sm:text-lg md:text-xl tracking-tight uppercase truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[260px] md:max-w-none transition-colors ${
                        isTransparent
                          ? 'text-white drop-shadow-sm group-hover:text-white/80'
                          : 'text-neutral-950 group-hover:opacity-80'
                      }`}
                    >
                      {storeName}
                    </span>
                  </span>
                ) : null}
              </Link>
            </div>

            {/* Center: Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1 xl:space-x-2">
              {navItems.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.id || link.label}
                    href={link.href}
                    className={`relative px-3 py-1.5 text-xs xl:text-sm font-medium transition-colors ${
                      isTransparent
                        ? isActive
                          ? 'text-white font-bold'
                          : 'text-white/85 hover:text-white drop-shadow-xs'
                        : isActive
                        ? 'text-neutral-950 font-semibold'
                        : 'text-neutral-600 hover:text-neutral-950'
                    }`}
                  >
                    <span>{link.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeNavIndicator"
                        className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full ${
                          isTransparent ? 'bg-white shadow-sm' : 'bg-neutral-950'
                        }`}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Search */}
              <button
                type="button"
                onClick={openSearch}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  isTransparent
                    ? 'text-white hover:text-white hover:bg-white/15'
                    : 'text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100'
                }`}
                aria-label="Search products"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Wishlist */}
              <Link
                href="/wishlist"
                className={`relative p-2 rounded-full transition-colors hidden sm:inline-flex cursor-pointer ${
                  isTransparent
                    ? 'text-white hover:text-white hover:bg-white/15'
                    : 'text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100'
                }`}
                aria-label="View wishlist"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none shadow-xs"
                  >
                    {wishlistCount}
                  </motion.span>
                )}
              </Link>

              {/* Customer Account Button & Dropdown */}
              <div className="relative hidden sm:inline-block">
                {isAuthenticated && customer ? (
                  <div>
                    <button
                      type="button"
                      id="header-customer-profile-btn"
                      onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                      className={`p-1.5 pl-2.5 pr-3 rounded-full transition-colors flex items-center gap-2 cursor-pointer border ${
                        isTransparent
                          ? 'text-white hover:bg-white/15 border-white/40'
                          : 'text-neutral-800 hover:text-neutral-950 hover:bg-neutral-100 border-neutral-200/80'
                      }`}
                      aria-label="Customer account menu"
                    >
                      <div
                        className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center uppercase ${
                          isTransparent ? 'bg-white text-neutral-950' : 'bg-neutral-900 text-white'
                        }`}
                      >
                        {customer.firstName?.[0] || 'C'}
                      </div>
                      <span className="text-xs font-bold max-w-[100px] truncate">
                        {customer.firstName}
                      </span>
                    </button>

                    {/* Dropdown */}
                    <AnimatePresence>
                      {accountDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setAccountDropdownOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-neutral-200/90 shadow-xl p-2 z-50 text-xs space-y-1 text-neutral-900"
                          >
                            <div className="px-3 py-2 border-b border-neutral-100 mb-1">
                              <p className="font-bold text-neutral-950 truncate">
                                {customer.firstName} {customer.lastName}
                              </p>
                              {customer.customerType === 'SUPER_WHOLESALE' ? (
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[9px] uppercase tracking-wider border border-purple-200">
                                  Super Wholesale Partner
                                </span>
                              ) : customer.customerType === 'WHOLESALE' ? (
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 font-bold text-[9px] uppercase tracking-wider">
                                  Wholesale Partner
                                </span>
                              ) : (
                                <p className="text-[11px] text-neutral-500 truncate">{customer.email}</p>
                              )}
                            </div>

                            <Link
                              href="/account"
                              id="dropdown-link-account"
                              onClick={() => setAccountDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-100 font-semibold transition-colors"
                            >
                              <User className="w-3.5 h-3.5 text-neutral-500" />
                              <span>My Account</span>
                            </Link>

                            <Link
                              href="/account?tab=orders"
                              id="dropdown-link-orders"
                              onClick={() => setAccountDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-100 font-semibold transition-colors"
                            >
                              <Package className="w-3.5 h-3.5 text-neutral-500" />
                              <span>My Orders</span>
                            </Link>

                            <Link
                              href="/account?tab=wishlist"
                              id="dropdown-link-wishlist"
                              onClick={() => setAccountDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-100 font-semibold transition-colors"
                            >
                              <Heart className="w-3.5 h-3.5 text-rose-500" />
                              <span>Wishlist</span>
                            </Link>

                            <Link
                              href="/account?tab=reviews"
                              id="dropdown-link-reviews"
                              onClick={() => setAccountDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-100 font-semibold transition-colors"
                            >
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              <span>My Reviews</span>
                            </Link>

                            <div className="pt-1 border-t border-neutral-100">
                              <button
                                type="button"
                                id="dropdown-btn-logout"
                                onClick={() => {
                                  setAccountDropdownOpen(false);
                                  logout();
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold transition-colors cursor-pointer text-left"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Logout</span>
                              </button>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    id="header-customer-login-link"
                    className={`p-2 rounded-full transition-colors inline-flex cursor-pointer ${
                      isTransparent
                        ? 'text-white hover:text-white hover:bg-white/15'
                        : 'text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100'
                    }`}
                    title="Customer Sign In"
                    aria-label="Account profile"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                )}
              </div>

              {/* Store Location */}
              {activeLocation && activeLocation.isActive && activeLocation.googleMapsUrl && (
                <a
                  href={activeLocation.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-full transition-colors hidden sm:inline-flex cursor-pointer ${
                    isTransparent
                      ? 'text-white hover:text-amber-300 hover:bg-white/15'
                      : 'text-neutral-700 hover:text-amber-600 hover:bg-neutral-100'
                  }`}
                  title={`Visit Our Store: ${activeLocation.shopName}`}
                  aria-label="View Shop Location"
                >
                  <MapPin className={`w-5 h-5 ${isTransparent ? 'text-amber-300' : 'text-amber-600'}`} />
                </a>
              )}

              {/* Cart Button */}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className={`relative p-2 rounded-full transition-colors flex items-center cursor-pointer ${
                  isTransparent
                    ? 'text-white hover:bg-white/15'
                    : 'text-neutral-950 hover:bg-neutral-100'
                }`}
                aria-label="Open cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <motion.span
                    key={totalItems}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`absolute top-1 right-1 w-4 h-4 text-[10px] font-bold rounded-full flex items-center justify-center leading-none shadow-xs ${
                      isTransparent ? 'bg-white text-neutral-950' : 'bg-neutral-950 text-white'
                    }`}
                  >
                    {totalItems}
                  </motion.span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-4/5 max-w-sm bg-white shadow-2xl z-50 flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <div className="p-5 border-b border-neutral-100 flex items-center justify-between gap-3">
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 min-w-0"
                  >
                    {hasLogo && logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={storeName || 'Brand Logo'}
                        className="h-7 w-auto max-w-[80px] sm:max-w-[100px] object-contain object-left shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    {storeName ? (
                      <span className="font-bold text-base sm:text-lg tracking-tight uppercase truncate text-neutral-900">
                        {storeName}
                      </span>
                    ) : null}
                  </Link>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 cursor-pointer shrink-0"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Search Button in Mobile Menu */}
                <div className="px-4 pt-3 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openSearch();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-500 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-neutral-400" />
                    <span>Search products...</span>
                  </button>
                </div>

                {/* Main links */}
                <div className="py-2 px-4 space-y-1">
                  {navItems.map((link) => (
                    <Link
                      key={link.id || link.label}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
                    >
                      <span>{link.label}</span>
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    </Link>
                  ))}
                </div>

                {/* Categories Accordion/List */}
                <div className="px-4 py-3 border-t border-neutral-100">
                  <div className="flex items-center justify-between px-3 mb-2">
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Shop Categories
                    </p>
                    <Link
                      href="/categories"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[11px] font-bold text-neutral-900 hover:text-neutral-600 transition-colors"
                    >
                      View All →
                    </Link>
                  </div>
                  <div className="space-y-1">
                    {categories.slice(0, 10).map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/category/${cat.slug}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50"
                      >
                        <span>{cat.name}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
                      </Link>
                    ))}
                    {categories.length > 10 && (
                      <Link
                        href="/categories"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-neutral-950 bg-neutral-100/60 hover:bg-neutral-100 mt-1"
                      >
                        <span>Explore All {categories.length} Categories</span>
                        <ChevronRight className="w-4 h-4 text-neutral-500" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Mobile Pages Section */}
                {mobilePages.length > 0 && (
                  <div className="px-4 py-3 border-t border-neutral-100">
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">
                      Information & Policies
                    </p>
                    <div className="space-y-1">
                      {mobilePages.map((page) => (
                        <Link
                          key={page.id}
                          href={`/${page.slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50"
                        >
                          <span>{page.title}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Drawer Actions */}
              <div className="p-5 border-t border-neutral-100 bg-neutral-50/50 space-y-2">
                {activeLocation && activeLocation.isActive && activeLocation.googleMapsUrl && (
                  <a
                    href={activeLocation.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-sm font-semibold text-amber-950 hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-700" />
                      <span>📍 Visit Our Store</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-amber-700" />
                  </a>
                )}

                <Link
                  href="/wishlist"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-neutral-200/80 text-sm font-medium text-neutral-800"
                >
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500" />
                    <span>My Wishlist</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100">
                    {wishlistCount}
                  </span>
                </Link>

                {/* Mobile Customer Account Section */}
                {isAuthenticated && customer ? (
                  <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-neutral-950 text-white text-xs font-bold flex items-center justify-center uppercase">
                        {customer.firstName?.[0] || 'C'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-neutral-950 truncate">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <p className="text-[10px] text-neutral-500 truncate">{customer.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href="/account"
                        onClick={() => setMobileMenuOpen(false)}
                        className="py-1.5 px-2.5 rounded-lg bg-white border border-neutral-200 text-center text-xs font-bold text-neutral-800"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/account?tab=orders"
                        onClick={() => setMobileMenuOpen(false)}
                        className="py-1.5 px-2.5 rounded-lg bg-white border border-neutral-200 text-center text-xs font-bold text-neutral-800"
                      >
                        My Orders
                      </Link>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logout();
                      }}
                      className="w-full py-1.5 text-center text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Customer Sign In / Register</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  </Link>
                )}

                {activeSocialAccounts.length > 0 && (
                  <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-center gap-2">
                    {activeSocialAccounts.map((account) => {
                      const p = account.platform.toLowerCase();
                      const href =
                        p === 'whatsapp' && !account.url.startsWith('http')
                          ? `https://wa.me/${account.url.replace(/\D/g, '')}`
                          : account.url;

                      const badgeText =
                        p === 'instagram'
                          ? 'IG'
                          : p === 'facebook'
                          ? 'FB'
                          : p === 'tiktok'
                          ? 'TK'
                          : p === 'youtube'
                          ? 'YT'
                          : p === 'whatsapp'
                          ? 'WA'
                          : account.name.slice(0, 2).toUpperCase();

                      return (
                        <a
                          key={account.platform}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          id={`mobile-social-${account.platform}`}
                          className="w-8 h-8 rounded-full bg-neutral-200/80 hover:bg-neutral-900 hover:text-white text-neutral-700 flex items-center justify-center transition-all text-[11px] font-bold"
                          aria-label={account.name || account.platform}
                          title={account.name || account.platform}
                        >
                          {badgeText}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
