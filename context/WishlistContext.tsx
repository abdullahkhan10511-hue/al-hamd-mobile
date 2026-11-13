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
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
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

  // Fetch only the product ids contained in wishlist (max 50)
  useEffect(() => {
    if (!hasHydrated) return;
    if (wishlist.length === 0) {
      setWishlistProducts([]);
      return;
    }

    const idsToFetch = wishlist.slice(0, 50);
    let isMounted = true;
    fetch(`/api/products?ids=${idsToFetch.join(',')}&minimal=true`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data.products)) {
          setWishlistProducts(data.products);
        } else {
          const fallback = getProducts().filter((p) => idsToFetch.includes(p.id));
          setWishlistProducts(fallback);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const fallback = getProducts().filter((p) => idsToFetch.includes(p.id));
        setWishlistProducts(fallback);
      });

    return () => {
      isMounted = false;
    };
  }, [wishlist, hasHydrated]);

  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }, []);

  const isInWishlist = useCallback((productId: string) => wishlist.includes(productId), [wishlist]);

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
