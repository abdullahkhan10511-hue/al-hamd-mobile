'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Product, CartItem } from '@/types';
import { getProducts } from '@/lib/db/products';
import { getStoreSettings } from '@/lib/db/settings';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getProductEffectivePrice, getModelEffectivePrice } from '@/lib/wholesale';

export interface AppliedPromoInfo {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  description?: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (
    product: Product,
    quantity?: number,
    selectedSize?: string,
    selectedColor?: string,
    selectedModel?: string,
    selectedPrice?: number,
    selectedImage?: string
  ) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, newQuantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  isWholesale: boolean;
  isSuperWholesale: boolean;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  promoCode: string;
  appliedPromo: AppliedPromoInfo | null;
  applyPromoCode: (
    code: string,
    customerInfo?: { email?: string; phone?: string; id?: string }
  ) => Promise<{ success: boolean; message: string; discount?: number }>;
  removePromoCode: () => void;
  appliedDiscountPercentage: number;
  lastAddedProduct: Product | null;
  showAddedToast: boolean;
  dismissToast: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const DEFAULT_FREE_SHIPPING_THRESHOLD = 5000;
const DEFAULT_STANDARD_SHIPPING_FEE = 200;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { customer, isWholesale, isSuperWholesale } = useCustomerAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoInfo | null>(null);
  const [appliedDiscountPercentage, setAppliedDiscountPercentage] = useState(0);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(DEFAULT_FREE_SHIPPING_THRESHOLD);
  const [shippingFee, setShippingFee] = useState(DEFAULT_STANDARD_SHIPPING_FEE);

  // Load store settings and sync
  const loadSettings = () => {
    try {
      const s = getStoreSettings();
      if (s) {
        setFreeShippingThreshold(s.freeShippingThreshold || DEFAULT_FREE_SHIPPING_THRESHOLD);
        setShippingFee(s.standardShippingFee ?? DEFAULT_STANDARD_SHIPPING_FEE);
      }
    } catch {
      // Fallback to defaults
    }
  };

  useEffect(() => {
    loadSettings();
    const handleUpdate = () => {
      loadSettings();
      // Validate existing cart items against live catalog
      try {
        const liveProds = getProducts();
        setCart((prev) => prev.filter((item) => {
          const live = liveProds.find((p) => p.id === item.product.id);
          return live && live.status !== 'inactive' && live.status !== 'archived';
        }));
      } catch {}
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Hydrate from localStorage once mounted
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('al_hamd_cart');
      if (savedCart) {
        const parsed: CartItem[] = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          const liveProds = getProducts();
          const valid = parsed.filter((item) => {
            if (!item || !item.product) return false;
            const live = liveProds.find((p) => p.id === item.product.id);
            return live && live.status !== 'inactive' && live.status !== 'archived';
          });
          setCart(valid);
        }
      }
      const savedPromo = localStorage.getItem('al_hamd_promo');
      if (savedPromo) {
        const parsedPromo: AppliedPromoInfo = JSON.parse(savedPromo);
        setAppliedPromo(parsedPromo);
        setPromoCode(parsedPromo.code);
        if (parsedPromo.discountType === 'percentage') {
          setAppliedDiscountPercentage(parsedPromo.discountValue / 100);
        }
      }
    } catch (e) {
      console.error('Failed to load cart from storage', e);
    }
    setHasHydrated(true);
  }, []);

  // Save to localStorage whenever cart changes after initial hydration
  useEffect(() => {
    if (hasHydrated) {
      try {
        localStorage.setItem('al_hamd_cart', JSON.stringify(cart));
      } catch (e) {
        console.error('Failed to save cart to storage', e);
      }
    }
  }, [cart, hasHydrated]);

  // Save promo to localStorage
  useEffect(() => {
    if (hasHydrated) {
      try {
        if (appliedPromo) {
          localStorage.setItem('al_hamd_promo', JSON.stringify(appliedPromo));
        } else {
          localStorage.removeItem('al_hamd_promo');
        }
      } catch (e) {
        console.error('Failed to save promo to storage', e);
      }
    }
  }, [appliedPromo, hasHydrated]);

  const addToCart = (
    product: Product,
    quantity = 1,
    selectedSize?: string,
    selectedColor?: string,
    selectedModel?: string,
    selectedPrice?: number,
    selectedImage?: string
  ) => {
    // Prevent adding out-of-stock items to cart
    if (!product) return;

    const size = selectedSize || (product.variants?.sizes ? product.variants.sizes[0] : undefined);
    const color =
      selectedColor ||
      (product.enableColorSelection && product.colors?.length
        ? product.colors.find((c) => c.isActive !== false)?.name
        : product.variants?.colors
        ? product.variants.colors[0].name
        : undefined);
    const model = selectedModel;

    // RULE: Online customer availability is strictly driven by SHOP STOCK and must be active in Shop Inventory
    if (product.isShopActive === false) {
      return;
    }

    let maxStock = product.shopStock !== undefined ? Math.max(0, product.shopStock) : 0;
    if (model && product.models && Array.isArray(product.models)) {
      const foundModel = product.models.find(
        (m) => m.name.toLowerCase() === model.toLowerCase() || m.id === model
      );
      if (foundModel) {
        maxStock = Math.max(0, (foundModel as any).shopStock !== undefined ? (foundModel as any).shopStock : 0);
      }
    }

    if (maxStock <= 0) {
      return;
    }

    const itemKey = `${product.id}-${size || 'default'}-${color || 'default'}-${model || 'default'}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === itemKey);
      if (existingIndex > -1) {
        const updated = [...prev];
        const currentQty = updated[existingIndex].quantity;
        const newQty = Math.min(maxStock, currentQty + quantity);
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          selectedPrice: selectedPrice !== undefined ? selectedPrice : updated[existingIndex].selectedPrice,
          selectedImage: selectedImage || updated[existingIndex].selectedImage,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: itemKey,
            productId: product.id,
            product,
            quantity: Math.min(maxStock, quantity),
            selectedSize: size,
            selectedColor: color,
            selectedModel: model,
            selectedPrice,
            selectedImage,
          },
        ];
      }
    });

    setLastAddedProduct(product);
    setShowAddedToast(true);
    setIsCartOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          let maxStock = item.product.shopStock !== undefined ? Math.max(0, item.product.shopStock) : 0;
          if (item.product.isShopActive === false) {
            maxStock = 0;
          }
          if (item.selectedModel && item.product.models && Array.isArray(item.product.models)) {
            const foundModel = item.product.models.find(
              (m) => m.name.toLowerCase() === item.selectedModel!.toLowerCase() || m.id === item.selectedModel
            );
            if (foundModel) {
              maxStock = Math.max(0, (foundModel as any).shopStock !== undefined ? (foundModel as any).shopStock : 0);
            }
          }
          return { ...item, quantity: Math.min(maxStock, newQuantity) };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    setAppliedPromo(null);
    setPromoCode('');
    setAppliedDiscountPercentage(0);
  };

  const totalItems = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const subtotal = useMemo(
    () =>
      cart.reduce((acc, item) => {
        let itemPrice: number;
        if (item.selectedModel && item.product.models && Array.isArray(item.product.models)) {
          const modelObj = item.product.models.find(
            (m) => m.name.toLowerCase() === item.selectedModel!.toLowerCase() || m.id === item.selectedModel
          );
          if (modelObj) {
            itemPrice = getModelEffectivePrice(item.product, modelObj, customer?.customerType);
          } else {
            itemPrice = item.selectedPrice ?? getProductEffectivePrice(item.product, customer?.customerType);
          }
        } else {
          itemPrice = item.selectedPrice ?? getProductEffectivePrice(item.product, customer?.customerType);
        }
        return acc + itemPrice * item.quantity;
      }, 0),
    [cart, customer?.customerType]
  );

  const applyPromoCode = async (
    code: string,
    customerInfo?: { email?: string; phone?: string; id?: string }
  ): Promise<{ success: boolean; message: string; discount?: number }> => {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      return { success: false, message: 'Please enter a promo code.' };
    }

    if (cart.length === 0) {
      return { success: false, message: 'Your shopping bag is empty.' };
    }

    try {
      const response = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: clean,
          subtotal,
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            price: getProductEffectivePrice(i.product, customer?.customerType),
            categorySlug: i.product.categorySlug,
          })),
          channel: 'ONLINE',
          customer: customerInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        return {
          success: false,
          message: data.error || 'Invalid promo code.',
        };
      }

      const info: AppliedPromoInfo = {
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        discountAmount: data.discountAmount,
        description: data.description,
      };

      setAppliedPromo(info);
      setPromoCode(data.code);
      if (data.discountType === 'percentage') {
        setAppliedDiscountPercentage(data.discountValue / 100);
      } else {
        setAppliedDiscountPercentage(subtotal > 0 ? data.discountAmount / subtotal : 0);
      }

      return {
        success: true,
        message: `Promo code "${data.code}" applied! Discount: Rs. ${data.discountAmount.toLocaleString('en-PK')}`,
        discount: data.discountAmount,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Failed to validate promo code.',
      };
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setAppliedDiscountPercentage(0);
  };

  const discount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.discountType === 'percentage') {
      const calculated = Math.round(subtotal * (appliedPromo.discountValue / 100));
      return Math.min(subtotal, appliedPromo.discountAmount || calculated);
    }
    return Math.min(subtotal, appliedPromo.discountAmount);
  }, [subtotal, appliedPromo]);

  const shipping = useMemo(() => {
    if (cart.length === 0) return 0;
    return subtotal - discount >= freeShippingThreshold ? 0 : shippingFee;
  }, [subtotal, discount, cart.length, freeShippingThreshold, shippingFee]);

  const total = useMemo(
    () => Math.max(0, Math.round(subtotal - discount + shipping)),
    [subtotal, discount, shipping]
  );

  const dismissToast = () => {
    setShowAddedToast(false);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        shipping,
        discount,
        total,
        isWholesale,
        isSuperWholesale,
        isCartOpen,
        setIsCartOpen,
        promoCode,
        appliedPromo,
        applyPromoCode,
        removePromoCode,
        appliedDiscountPercentage,
        lastAddedProduct,
        showAddedToast,
        dismissToast,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
