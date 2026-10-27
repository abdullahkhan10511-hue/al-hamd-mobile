'use client';

import React from 'react';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { SearchProvider } from '@/context/SearchContext';
import { CustomerAuthProvider } from '@/context/CustomerAuthContext';
import dynamic from 'next/dynamic';
import { CartToast } from '@/components/ui/Toast';

const CartDrawer = dynamic(
  () => import('@/components/cart/CartDrawer').then((mod) => mod.CartDrawer),
  { ssr: false }
);

const SearchModal = dynamic(
  () => import('@/components/layout/SearchModal').then((mod) => mod.SearchModal),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAuthProvider>
      <CartProvider>
        <WishlistProvider>
          <SearchProvider>
            {children}
            <CartDrawer />
            <SearchModal />
            <CartToast />
          </SearchProvider>
        </WishlistProvider>
      </CartProvider>
    </CustomerAuthProvider>
  );
}

