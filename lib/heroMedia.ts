export type HeroMediaCategory = 'video' | 'image' | 'animated';

export const HERO_MEDIA_LIMITS: Record<
  HeroMediaCategory,
  { maxBytes: number; recommendedBytes: number; maxLabel: string; recommendedLabel: string; title: string }
> = {
  image: {
    maxBytes: 3 * 1024 * 1024,
    recommendedBytes: 400 * 1024,
    maxLabel: '3 MB',
    recommendedLabel: '400 KB',
    title: 'Picture (WebP / JPG / PNG / AVIF)',
  },
  animated: {
    maxBytes: 6 * 1024 * 1024,
    recommendedBytes: 2 * 1024 * 1024,
    maxLabel: '6 MB',
    recommendedLabel: '2 MB',
    title: 'Animated GIF / WebP',
  },
  video: {
    maxBytes: 15 * 1024 * 1024,
    recommendedBytes: 6 * 1024 * 1024,
    maxLabel: '15 MB',
    recommendedLabel: '6 MB',
    title: 'Video (MP4 / WebM)',
  },
};

export type HeroSizeHealth = 'green' | 'amber' | 'red';

export function getHeroSizeHealth(sizeBytes: number | undefined | null, type: HeroMediaCategory): HeroSizeHealth {
  if (!sizeBytes || sizeBytes <= 0) return 'green';
  const limits = HERO_MEDIA_LIMITS[type] || HERO_MEDIA_LIMITS.video;
  if (sizeBytes > limits.maxBytes) return 'red';
  if (sizeBytes > limits.recommendedBytes) return 'amber';
  return 'green';
}

export function formatHeroBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return 'External URL';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Tiny 24px-wide dark-brand-toned base64 blur placeholder for instant first-frame paint.
 */
export const DEFAULT_HERO_BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDE0Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMGYxNzJhIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiMxMjFjMmQiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxODE4MWIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMTQiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=';

/**
 * Detects animated WebP by scanning RIFF/WEBP chunks for VP8X animation flag or ANIM chunk.
 */
export function isAnimatedWebpBuffer(buf: Uint8Array): boolean {
  if (buf.length < 16) return false;
  // Verify RIFF....WEBP
  if (
    buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46 ||
    buf[8] !== 0x57 || buf[9] !== 0x45 || buf[10] !== 0x42 || buf[11] !== 0x50
  ) {
    return false;
  }
  const limit = Math.min(buf.length - 4, 4096);
  for (let i = 12; i <= limit; i++) {
    // 'ANIM' chunk
    if (buf[i] === 0x41 && buf[i + 1] === 0x4e && buf[i + 2] === 0x49 && buf[i + 3] === 0x4d) {
      return true;
    }
  }
  return false;
}

