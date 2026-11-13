'use client';

import React, { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/utils';

export interface SafeImageProps extends Omit<ImageProps, 'src'> {
  src?: string | null | any;
  fallbackSrc?: string;
}

/**
 * SafeImage Component (Task S11)
 *
 * Wraps Next.js Image with:
 * 1. Automatic fallback when `src` is missing, invalid, or fails to load.
 * 2. Automatic `unoptimized={true}` for SVG and data URIs (enforces `dangerouslyAllowSVG: false`).
 * 3. Infinite error loop prevention on broken fallbacks.
 */
export function SafeImage({
  src,
  fallbackSrc = DEFAULT_PRODUCT_IMAGE,
  alt = 'Image',
  unoptimized,
  onError,
  ...rest
}: SafeImageProps) {
  const initialSrc = (typeof src === 'string' && src.trim()) ? src.trim() : fallbackSrc;
  const [currentSrc, setCurrentSrc] = useState<string>(initialSrc);
  const [hasFailed, setHasFailed] = useState<boolean>(false);

  // Sync if parent updates src
  useEffect(() => {
    const nextSrc = (typeof src === 'string' && src.trim()) ? src.trim() : fallbackSrc;
    setCurrentSrc(nextSrc);
    setHasFailed(false);
  }, [src, fallbackSrc]);

  const isExternalOrSvgOrDataUri =
    typeof currentSrc === 'string' &&
    (currentSrc.startsWith('http://') ||
     currentSrc.startsWith('https://') ||
     currentSrc.startsWith('data:image/') ||
     currentSrc.toLowerCase().endsWith('.svg') ||
     currentSrc.toLowerCase().includes('.svg?'));

  const shouldBeUnoptimized = unoptimized ?? isExternalOrSvgOrDataUri;

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasFailed && currentSrc !== fallbackSrc) {
      setHasFailed(true);
      setCurrentSrc(fallbackSrc);
    }
    if (onError) {
      onError(e);
    }
  };

  return (
    <Image
      {...rest}
      src={currentSrc}
      alt={alt}
      unoptimized={shouldBeUnoptimized}
      onError={handleError}
    />
  );
}

export default SafeImage;

