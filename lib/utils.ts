export function formatPrice(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rs. 0';
  const rounded = Math.round(amount);
  return `Rs. ${rounded.toLocaleString('en-PK')}`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const DEFAULT_PRODUCT_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23f5f5f5"/><path d="M160 140h80a20 20 0 0 1 20 20v100a20 20 0 0 1-20 20h-80a20 20 0 0 1-20-20V160a20 20 0 0 1 20-20z" fill="%23e5e5e5"/><circle cx="200" cy="250" r="10" fill="%23d4d4d4"/><rect x="180" y="155" width="40" height="6" rx="3" fill="%23d4d4d4"/><text x="200" y="315" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="600" fill="%23a3a3a3">AL-HAMD MOBILE</text></svg>';

export function getValidImageSrc(images?: string[] | null): string | null {
  if (!images || !Array.isArray(images) || images.length === 0) return null;
  const first = images.find((img) => typeof img === 'string' && img.trim().length > 0);
  return first ? first.trim() : null;
}

export function getProductImage(
  productOrImages?:
    | { images?: string[] | null; media?: any[] | null; models?: any[] | null }
    | string[]
    | string
    | null
): string {
  if (!productOrImages) return DEFAULT_PRODUCT_IMAGE;

  if (typeof productOrImages === 'string') {
    return productOrImages.trim() || DEFAULT_PRODUCT_IMAGE;
  }

  if (Array.isArray(productOrImages)) {
    const valid = getValidImageSrc(productOrImages);
    return valid || DEFAULT_PRODUCT_IMAGE;
  }

  if (typeof productOrImages === 'object') {
    if (productOrImages.images) {
      const valid = getValidImageSrc(productOrImages.images);
      if (valid) return valid;
    }
    if (productOrImages.media && Array.isArray(productOrImages.media)) {
      const firstMedia = productOrImages.media.find(
        (m: any) =>
          m &&
          (m.type === 'image' || !m.type) &&
          typeof (typeof m === 'string' ? m : m.url) === 'string' &&
          (typeof m === 'string' ? m : m.url).trim().length > 0
      );
      if (firstMedia) {
        return (typeof firstMedia === 'string' ? firstMedia : firstMedia.url).trim();
      }
    }
    if (productOrImages.models && Array.isArray(productOrImages.models)) {
      for (const mod of productOrImages.models) {
        if (mod && Array.isArray(mod.images)) {
          const valid = getValidImageSrc(mod.images);
          if (valid) return valid;
        }
      }
    }
  }

  return DEFAULT_PRODUCT_IMAGE;
}

export function normalizeSearchText(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\-_/\\.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplicate category collections using the unique database category ID.
 * The production database ID is the ONLY source of truth.
 * Each ID appears exactly once in the returned collection.
 * Does not use category name as primary identity.
 */
export function deduplicateCategoriesById<T extends { id?: string | number }>(categories: T[]): T[] {
  if (!Array.isArray(categories)) return [];
  const seenIds = new Set<string>();
  const result: T[] = [];
  for (const cat of categories) {
    if (!cat) continue;
    const rawId = cat.id !== undefined && cat.id !== null ? String(cat.id).trim() : '';
    if (!rawId) continue;
    if (!seenIds.has(rawId)) {
      seenIds.add(rawId);
      result.push(cat);
    }
  }
  return result;
}

/**
 * Formats a personalized welcome message for the admin panel header.
 * Uses the authenticated user's actual name (e.g. "Welcome Abdullah", "Welcome Ahmed", "Welcome Ali").
 * Removes email addresses, role names, and access levels.
 * Falls back safely to "Welcome" if name is missing, empty, or a role/email placeholder.
 */
export function getAdminGreeting(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'Welcome';
  const clean = name.trim();
  if (!clean) return 'Welcome';

  const upper = clean.toUpperCase();
  // If the name is an email address or generic role title, fall back to "Welcome"
  if (
    clean.includes('@') ||
    upper === 'SUPER_ADMIN' ||
    upper === 'SUPER ADMIN' ||
    upper === 'ADMIN' ||
    upper === 'ADMINISTRATOR' ||
    upper === 'STAFF' ||
    upper === 'STAFF MEMBER' ||
    upper === 'MANAGER' ||
    upper === 'OWNER' ||
    upper === 'ROOT'
  ) {
    return 'Welcome';
  }

  return `Welcome ${clean}`;
}

/**
 * Shared storefront product visibility predicate:
 * Excludes products whose status is draft/inactive/hidden/archived, isActive is false,
 * or whose price is 0 or less.
 */
export function isStorefrontVisibleProduct(product: any): boolean {
  if (!product || typeof product !== 'object') return false;
  if (product.isActive === false) return false;
  const status = typeof product.status === 'string' ? product.status.trim().toLowerCase() : 'active';
  if (status === 'draft' || status === 'inactive' || status === 'hidden' || status === 'archived') {
    return false;
  }
  const price = Number(product.price);
  if (!Number.isFinite(price) || price <= 0) return false;
  return true;
}

/**
 * Computes verified/approved review count & average rating purely from real reviews data.
 * Never returns seeded/synthetic product.reviewCount when reviews data is empty.
 */
export function getVerifiedReviewStats(product: any): { count: number; rating: number } {
  if (!product || typeof product !== 'object') {
    return { count: 0, rating: 0 };
  }

  if (Array.isArray(product.reviews)) {
    const approved = product.reviews.filter((r: any) => r && r.verified !== false);
    if (approved.length === 0) return { count: 0, rating: 0 };
    const totalRating = approved.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0);
    return {
      count: approved.length,
      rating: Number((totalRating / approved.length).toFixed(1)),
    };
  }

  if (typeof product.approvedReviewCount === 'number') {
    const count = Math.max(0, Math.floor(product.approvedReviewCount));
    if (count === 0) return { count: 0, rating: 0 };
    const rating =
      typeof product.approvedRating === 'number' && product.approvedRating > 0
        ? Number(Number(product.approvedRating).toFixed(1))
        : Number(Number(product.rating || 5).toFixed(1));
    return { count, rating };
  }

  return { count: 0, rating: 0 };
}

/**
 * Returns real discount percentage (> 0) only when compareAtPrice strictly exceeds price.
 */
export function getRealDiscountPercentage(product: any): number {
  if (!product || typeof product !== 'object') return 0;
  const price = Number(product.price);
  const compareAt = Number(product.compareAtPrice);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(compareAt) || compareAt <= price) {
    return 0;
  }
  const pct = Math.round(((compareAt - price) / compareAt) * 100);
  return pct > 0 ? pct : 0;
}

/**
 * Returns true if the product has the admin New flag OR was created within the last 30 days.
 */
export function isProductNewBadgeEligible(product: any): boolean {
  if (!product || typeof product !== 'object') return false;
  if (Boolean(product.isNew || product.isNewArrival)) return true;
  if (!product.createdAt) return false;
  const createdMs = new Date(product.createdAt).getTime();
  if (Number.isNaN(createdMs)) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const ageMs = Date.now() - createdMs;
  return ageMs >= -86400000 && ageMs <= thirtyDaysMs;
}

