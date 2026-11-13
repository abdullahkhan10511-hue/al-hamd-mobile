/**
 * Display-only category illustration placeholder helper.
 * Maps category slug/name keywords to lightweight SVG illustrations in /public/placeholders/.
 * Never writes placeholder paths into product or category data.
 */

export const GENERAL_PLACEHOLDER_PATH = '/placeholders/general.svg';

const KEYWORD_PLACEHOLDERS: Array<{ keywords: string[]; path: string }> = [
  {
    keywords: ['wireless-charger', 'wireless charger', 'magsafe', 'qi charger', 'induction'],
    path: '/placeholders/wireless-charger.svg',
  },
  {
    keywords: ['car-accessory', 'car accessory', 'car-charger', 'car charger', 'car mount', 'car holder', 'car '],
    path: '/placeholders/car-accessory.svg',
  },
  {
    keywords: ['power-bank', 'powerbank', 'power bank', 'battery pack'],
    path: '/placeholders/power-bank.svg',
  },
  {
    keywords: ['screen-protector', 'screen protector', 'tempered', 'glass', 'protector'],
    path: '/placeholders/screen-protector.svg',
  },
  {
    keywords: ['charger', 'adapter', 'gan', 'charging'],
    path: '/placeholders/charger.svg',
  },
  {
    keywords: ['cable', 'cord', 'type-c', 'usb-c', 'lightning', 'otg', 'aux'],
    path: '/placeholders/cable.svg',
  },
  {
    keywords: ['phone-case', 'case', 'cover', 'pouch', 'sleeve', 'bumper'],
    path: '/placeholders/phone-case.svg',
  },
  {
    keywords: ['headphone', 'headset'],
    path: '/placeholders/headphones.svg',
  },
  {
    keywords: ['earbud', 'tws', 'airpod', 'buds', 'earphone', 'handsfree', 'neckband', 'audio'],
    path: '/placeholders/earbuds.svg',
  },
  {
    keywords: ['smart-watch', 'smartwatch', 'watch', 'strap', 'band'],
    path: '/placeholders/smart-watch.svg',
  },
  {
    keywords: ['holder', 'stand', 'mount', 'tripod', 'gimbal', 'selfie'],
    path: '/placeholders/holder-stand.svg',
  },
  {
    keywords: ['speaker', 'soundbar', 'boombox'],
    path: '/placeholders/speaker.svg',
  },
  {
    keywords: ['memory', 'storage', 'sd card', 'microsd', 'flash', 'pendrive', 'usb drive', 'ssd', 'card reader'],
    path: '/placeholders/memory-storage.svg',
  },
];

export function getCategoryPlaceholder(
  categoryOrSlug?: string | null,
  fallbackName?: string | null
): string {
  const combined = `${categoryOrSlug || ''} ${fallbackName || ''}`
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .trim();

  if (!combined) return GENERAL_PLACEHOLDER_PATH;

  for (const entry of KEYWORD_PLACEHOLDERS) {
    if (entry.keywords.some((kw) => combined.includes(kw))) {
      return entry.path;
    }
  }

  return GENERAL_PLACEHOLDER_PATH;
}

export function isPlaceholderImage(src?: string | null): boolean {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim();
  return trimmed.startsWith('/placeholders/') || trimmed.startsWith('data:image/svg+xml');
}

