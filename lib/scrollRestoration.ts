/**
 * scrollRestoration.ts
 *
 * Universal scroll position and listing state preservation manager for AL-HAMD SHOP.
 * Ensures that when a customer scrolls through any product listing (Shop, Best Sellers,
 * New Arrivals, Search, Categories, Brands, Homepage All Products), views a product,
 * and navigates back (via browser Back/Forward or website links), the exact scroll
 * position, loaded product count, and filter options are faithfully restored.
 *
 * Fresh visits intentionally start at the top without stale scroll positions.
 */

export interface ListingState {
  scrollY: number;
  visibleCount: number;
  selectedCategory?: string;
  selectedBrands?: string[];
  maxPrice?: number;
  minRating?: number | null;
  sortBy?: string;
  searchQuery?: string;
  inStockOnly?: boolean;
  timestamp: number;
}

const STORAGE_PREFIX = 'alhamd_listing_state:';
const RETURN_FLAG_KEY = 'alhamd_return_from_product';
const LAST_LISTING_URL_KEY = 'alhamd_last_listing_url';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function normalizeListingUrl(rawUrl?: string): string {
  if (!rawUrl && typeof window !== 'undefined') {
    rawUrl = window.location.pathname + window.location.search;
  }
  if (!rawUrl) return '/shop';
  try {
    const url = new URL(rawUrl, 'http://localhost');
    const path = url.pathname.replace(/\/$/, '') || '/';
    return `${path}${url.search}`;
  } catch {
    return rawUrl;
  }
}

/**
 * Checks whether the current navigation is a return from a product detail page.
 */
export function isReturningFromProduct(currentUrl?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const flag = sessionStorage.getItem(RETURN_FLAG_KEY);
    if (!flag) return false;

    const lastListing = sessionStorage.getItem(LAST_LISTING_URL_KEY);
    if (!lastListing) return flag === 'true';

    const normalizedCurrent = normalizeListingUrl(currentUrl);
    const normalizedLast = normalizeListingUrl(lastListing);

    const currentPath = normalizedCurrent.split('?')[0];
    const lastPath = normalizedLast.split('?')[0];

    // If base listing path matches (e.g. /shop, /category/..., /best-sellers)
    if (currentPath === lastPath) {
      return true;
    }

    return flag === 'true';
  } catch {
    return false;
  }
}

/**
 * Saves listing state including scroll position, visible product count, and filters.
 */
export function saveListingState(url: string, state: Partial<ListingState>): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeListingUrl(url);
    const key = `${STORAGE_PREFIX}${normalized}`;

    let existing: Partial<ListingState> = {};
    const raw = sessionStorage.getItem(key);
    if (raw) {
      try {
        existing = JSON.parse(raw);
      } catch { }
    }

    const currentScrollY =
      state.scrollY !== undefined
        ? state.scrollY
        : typeof window !== 'undefined' && window.scrollY > 0
          ? window.scrollY
          : existing.scrollY !== undefined
            ? existing.scrollY
            : typeof window !== 'undefined'
              ? window.scrollY
              : 0;

    const merged: ListingState = {
      scrollY: currentScrollY,
      visibleCount: state.visibleCount || existing.visibleCount || 12,
      selectedCategory: state.selectedCategory ?? existing.selectedCategory,
      selectedBrands: state.selectedBrands ?? existing.selectedBrands,
      maxPrice: state.maxPrice ?? existing.maxPrice,
      minRating: state.minRating !== undefined ? state.minRating : existing.minRating,
      sortBy: state.sortBy ?? existing.sortBy,
      searchQuery: state.searchQuery ?? existing.searchQuery,
      inStockOnly: state.inStockOnly ?? existing.inStockOnly,
      timestamp: Date.now(),
    };

    sessionStorage.setItem(key, JSON.stringify(merged));
    sessionStorage.setItem(LAST_LISTING_URL_KEY, normalized);
  } catch (err) {
    console.warn('Failed to save listing state to sessionStorage:', err);
  }
}

/**
 * Marks that the customer is navigating to a product page from the current listing.
 */
export function markNavigatingToProduct(currentUrl: string, state?: Partial<ListingState>): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeListingUrl(currentUrl);
    saveListingState(normalized, state || {});
    sessionStorage.setItem(RETURN_FLAG_KEY, 'true');
    sessionStorage.setItem(LAST_LISTING_URL_KEY, normalized);
  } catch { }
}

/**
 * Retrieves saved listing state if returning from a product page.
 * Returns null on fresh visits.
 */
export function getSavedListingState(currentUrl?: string): ListingState | null {
  if (typeof window === 'undefined') return null;
  if (!isReturningFromProduct(currentUrl)) return null;

  try {
    const normalized = normalizeListingUrl(currentUrl);
    const key = `${STORAGE_PREFIX}${normalized}`;
    let raw = sessionStorage.getItem(key);

    // Fallback: If query params changed slightly, check base path
    if (!raw) {
      const basePath = normalized.split('?')[0];
      const lastUrl = sessionStorage.getItem(LAST_LISTING_URL_KEY);
      if (lastUrl && lastUrl.split('?')[0] === basePath) {
        raw = sessionStorage.getItem(`${STORAGE_PREFIX}${normalizeListingUrl(lastUrl)}`);
      }
    }

    if (!raw) return null;

    const parsed: ListingState = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    if (Date.now() - parsed.timestamp > MAX_AGE_MS) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clears the return flag so subsequent navigations/reloads behave as fresh visits.
 */
export function clearListingReturnFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(RETURN_FLAG_KEY);
  } catch { }
}

/**
 * Safely restores the scroll position across desktop and mobile devices.
 * Uses requestAnimationFrame and verification frames to avoid layout jumps.
 */
export function restoreScrollPosition(targetY: number, onDone?: () => void): () => void {
  if (typeof window === 'undefined' || targetY <= 0) {
    if (onDone) onDone();
    return () => { };
  }

  let cancelled = false;
  let attempts = 0;
  const maxAttempts = 6;

  const attemptScroll = () => {
    if (cancelled) return;

    window.scrollTo({ top: targetY, behavior: 'instant' });
    attempts++;

    // Check if target was reached or if content is still rendering
    const diff = Math.abs(window.scrollY - targetY);
    if (diff > 5 && attempts < maxAttempts) {
      requestAnimationFrame(attemptScroll);
    } else {
      if (onDone) onDone();
    }
  };

  requestAnimationFrame(attemptScroll);

  return () => {
    cancelled = true;
  };
}

/**
 * Initializes browser scroll restoration mode.
 * Disables default premature browser scroll reset so controlled restoration can apply.
 */
export function initScrollRestoration(): () => void {
  if (typeof window === 'undefined') return () => { };

  if ('scrollRestoration' in window.history) {
    try {
      window.history.scrollRestoration = 'manual';
    } catch { }
  }

  // Global click interceptor: When customer clicks any link to /product/...
  const handleDocumentClick = (e: MouseEvent) => {
    try {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      if (href.startsWith('/product/') || href.includes('/product/')) {
        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;
        const currentUrl = `${currentPath}${currentSearch}`;

        // Only save if navigating away from a listing/home page (not already on product)
        if (!currentPath.startsWith('/product/')) {
          saveListingState(currentUrl, { scrollY: window.scrollY });
          sessionStorage.setItem(RETURN_FLAG_KEY, 'true');
          sessionStorage.setItem(LAST_LISTING_URL_KEY, normalizeListingUrl(currentUrl));
        }
      }
    } catch { }
  };

  // Listen to popstate (browser back/forward)
  const handlePopState = () => {
    try {
      const lastUrl = sessionStorage.getItem(LAST_LISTING_URL_KEY);
      if (lastUrl) {
        sessionStorage.setItem(RETURN_FLAG_KEY, 'true');
      }
    } catch { }
  };

  document.addEventListener('click', handleDocumentClick, { capture: true });
  window.addEventListener('popstate', handlePopState);

  return () => {
    document.removeEventListener('click', handleDocumentClick, { capture: true });
    window.removeEventListener('popstate', handlePopState);
  };
}
