'use client';

import { useState, useEffect } from 'react';

/**
 * Returns the current CSS grid column count for standard listing grid:
 *   grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5
 *   - <768px: 2 columns
 *   - 768px - 1023px (md): 3 columns
 *   - 1024px - 1535px (lg): 4 columns
 *   - >=1536px (2xl): 5 columns
 *
 * Each batch requests 4 complete rows = columns * 4:
 *   2 cols -> 8 items
 *   3 cols -> 12 items
 *   4 cols -> 16 items
 *   5 cols -> 20 items
 */
export function useGridBatchLimit(initialColumns = 4): {
  columns: number;
  batchLimit: number;
} {
  const [columns, setColumns] = useState<number>(initialColumns);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq2xl = window.matchMedia('(min-width: 1536px)');
    const mqLg = window.matchMedia('(min-width: 1024px)');
    const mqMd = window.matchMedia('(min-width: 768px)');

    const computeColumns = () => {
      if (mq2xl.matches) return 5;
      if (mqLg.matches) return 4;
      if (mqMd.matches) return 3;
      return 2;
    };

    setColumns(computeColumns());

    const update = () => setColumns(computeColumns());

    mq2xl.addEventListener?.('change', update);
    mqLg.addEventListener?.('change', update);
    mqMd.addEventListener?.('change', update);

    return () => {
      mq2xl.removeEventListener?.('change', update);
      mqLg.removeEventListener?.('change', update);
      mqMd.removeEventListener?.('change', update);
    };
  }, []);

  const batchLimit = Math.max(8, columns * 4);

  return { columns, batchLimit };
}

