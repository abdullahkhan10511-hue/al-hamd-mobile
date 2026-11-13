'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import {
  getSavedListingState,
  restoreScrollPosition,
  clearListingReturnFlag,
} from '@/lib/scrollRestoration';
import { syncHomepageSettingsFromApi } from '@/lib/db/homepage';

export function HomePageClientSync() {
  const savedState = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getSavedListingState('/');
  }, []);

  const hasRestoredScroll = useRef(false);
  useEffect(() => {
    if (!hasRestoredScroll.current && savedState && savedState.scrollY > 0) {
      hasRestoredScroll.current = true;
      restoreScrollPosition(savedState.scrollY, () => {
        clearListingReturnFlag();
      });
    }
  }, [savedState]);

  useEffect(() => {
    syncHomepageSettingsFromApi().catch(() => {});
  }, []);

  return null;
}

