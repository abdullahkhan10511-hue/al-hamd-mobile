export function formatPrice(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rs. 0';
  const rounded = Math.round(amount);
  return `Rs. ${rounded.toLocaleString('en-PK')}`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=800&auto=format&fit=crop';

export function getValidImageSrc(images?: string[] | null): string | null {
  if (!images || !Array.isArray(images) || images.length === 0) return null;
  const first = images.find((img) => typeof img === 'string' && img.trim().length > 0);
  return first ? first.trim() : null;
}

export function getProductImage(
  productOrImages?: { images?: string[] | null } | string[] | string | null
): string {
  if (!productOrImages) return DEFAULT_PRODUCT_IMAGE;

  if (typeof productOrImages === 'string') {
    return productOrImages.trim() || DEFAULT_PRODUCT_IMAGE;
  }

  if (Array.isArray(productOrImages)) {
    const valid = getValidImageSrc(productOrImages);
    return valid || DEFAULT_PRODUCT_IMAGE;
  }

  if (typeof productOrImages === 'object' && productOrImages.images) {
    const valid = getValidImageSrc(productOrImages.images);
    return valid || DEFAULT_PRODUCT_IMAGE;
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
