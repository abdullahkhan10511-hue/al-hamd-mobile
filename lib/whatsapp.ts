import { getStoreSettings } from '@/lib/db/settings';
import { normalizePakistaniMobileNumber } from '@/lib/db/siteUiSettings';

export const FALLBACK_WHATSAPP_NUMBER = '923432200995';

/**
 * Returns the currently configured store WhatsApp phone number.
 * Reads from store settings and normalizes to a clean international string without '+' or spaces (e.g. 923432200995).
 */
export function getStoreWhatsAppNumber(): string {
  try {
    const settings = getStoreSettings();
    if (settings) {
      if (settings.whatsapp && typeof settings.whatsapp === 'string') {
        const cleaned = normalizePakistaniMobileNumber(settings.whatsapp) || settings.whatsapp.replace(/\D/g, '');
        if (cleaned && cleaned.length >= 10) return cleaned;
      }
      if (settings.phone && typeof settings.phone === 'string') {
        const cleaned = normalizePakistaniMobileNumber(settings.phone) || settings.phone.replace(/\D/g, '');
        if (cleaned && cleaned.length >= 10) return cleaned;
      }
    }
  } catch {}
  return FALLBACK_WHATSAPP_NUMBER;
}

/**
 * Builds a direct wa.me link for a product inquiry with prefilled name and link.
 */
export function buildProductInquiryWhatsAppUrl(product: { name: string; slug: string }): string {
  const number = getStoreWhatsAppNumber();
  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://alhamdshop.com';
  const productUrl = `${domain}/product/${product.slug}`;
  const text = `Assalam o Alaikum! I would like to inquire about the price and availability of "${product.name}".\nProduct link: ${productUrl}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
