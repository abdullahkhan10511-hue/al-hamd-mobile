'use client';

import { useEffect } from 'react';
import { initScrollRestoration } from '@/lib/scrollRestoration';

export function ScrollRestorationManager() {
  useEffect(() => {
    return initScrollRestoration();
  }, []);

  return null;
}

