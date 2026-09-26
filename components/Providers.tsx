'use client';

import React from 'react';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { SearchProvider } from '@/context/SearchContext';
import { CustomerAuthProvider } from '@/context/CustomerAuthContext';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { SearchModal } from '@/components/layout/SearchModal';
import { CartToast } from '@/components/ui/Toast';

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

