'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Product } from '@/types';
import { getProducts } from '@/lib/db/products';

interface WishlistContextType {
  wishlist: string[];
  wishlistProducts: Product[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  wishlistCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('al_hamd_wishlist');
      if (saved) {
        setWishlist(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load wishlist from storage', e);
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      try {
        localStorage.setItem('al_hamd_wishlist', JSON.stringify(wishlist));
      } catch (e) {
        console.error('Failed to save wishlist to storage', e);
      }
    }
  }, [wishlist, hasHydrated]);

  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }, []);

  const isInWishlist = useCallback((productId: string) => wishlist.includes(productId), [wishlist]);

  const wishlistProducts = useMemo(() => {
    if (wishlist.length === 0) return [];
    return getProducts().filter(
      (p) =>
        wishlist.includes(p.id) &&
        (p as any).status !== 'archived' &&
        (p as any).status !== 'inactive' &&
        (p as any).isActive !== false
    );
  }, [wishlist]);

  const contextValue = useMemo<WishlistContextType>(
    () => ({
      wishlist,
      wishlistProducts,
      toggleWishlist,
      isInWishlist,
      wishlistCount: wishlist.length,
    }),
    [wishlist, wishlistProducts, toggleWishlist, isInWishlist]
  );

  return (
    <WishlistContext.Provider value={contextValue}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
