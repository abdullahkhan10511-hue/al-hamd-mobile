'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Product, CartItem } from '@/types';
import { Deal } from '@/types/admin';
import { getProducts } from '@/lib/db/products';
import { getStoreSettings } from '@/lib/db/settings';
import { isDealCurrentlyActive } from '@/lib/db/deals';
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
    selectedImage?: string,
    options?: { openDrawer?: boolean; showToast?: boolean }
  ) => void;
  buyNow: (
    product: Product,
    quantity?: number,
    selectedSize?: string,
    selectedColor?: string,
    selectedModel?: string,
    selectedPrice?: number,
    selectedImage?: string
  ) => void;
  addDealToCart: (
    deal: Deal,
    quantity?: number,
    options?: { openDrawer?: boolean; showToast?: boolean }
  ) => { success: boolean; error?: string };
  hasHydrated: boolean;
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
    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'store_settings' && key !== 'products') return;
      loadSettings();
      // Validate existing cart items against live catalog only if cart has items
      try {
        const liveProds = getProducts();
        setCart((prev) => {
          if (!prev || prev.length === 0) return prev;
          let changed = false;
          const filtered = prev.filter((item) => {
            if (item.itemType === 'DEAL') return true;
            const live = liveProds.find((p) => p.id === item.product?.id);
            const isValid = Boolean(live && live.status !== 'inactive' && live.status !== 'archived');
            if (!isValid) changed = true;
            return isValid;
          });
          return changed ? filtered : prev;
        });
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
            if (!item) return false;
            if (item.itemType === 'DEAL') return true;
            if (!item.product) return false;
            const live = liveProds.find((p) => p.id === item.product?.id);
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

  const addToCart = useCallback((
    product: Product,
    quantity = 1,
    selectedSize?: string,
    selectedColor?: string,
    selectedModel?: string,
    selectedPrice?: number,
    selectedImage?: string,
    options?: { openDrawer?: boolean; showToast?: boolean }
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

    const itemKey = `${product.id}-${size || 'default'}-${color || 'default'}-${model || 'default'}`;

    let updatedCart: CartItem[] = [];
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === itemKey);
      if (existingIndex > -1) {
        const next = [...prev];
        const currentQty = next[existingIndex].quantity;
        const newQty = currentQty + quantity;
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: newQty,
          selectedPrice: selectedPrice !== undefined ? selectedPrice : next[existingIndex].selectedPrice,
          selectedImage: selectedImage || next[existingIndex].selectedImage,
        };
        updatedCart = next;
        return next;
      } else {
        const next = [
          ...prev,
          {
            id: itemKey,
            productId: product.id,
            product,
            quantity: Math.max(1, quantity),
            selectedSize: size,
            selectedColor: color,
            selectedModel: model,
            selectedPrice,
            selectedImage,
          },
        ];
        updatedCart = next;
        return next;
      }
    });

    // Synchronously write to localStorage to guarantee instant persistence before immediate router transitions
    try {
      if (typeof window !== 'undefined' && updatedCart.length > 0) {
        localStorage.setItem('al_hamd_cart', JSON.stringify(updatedCart));
      }
    } catch (e) {
      console.warn('Failed synchronous cart save to localStorage', e);
    }

    const shouldOpenDrawer = options?.openDrawer ?? true;
    const shouldShowToast = options?.showToast ?? true;

    setLastAddedProduct(product);
    if (shouldShowToast) {
      setShowAddedToast(true);
    }
    if (shouldOpenDrawer) {
      setIsCartOpen(true);
    } else {
      setIsCartOpen(false);
    }
  }, []);

  const buyNow = useCallback((
    product: Product,
    quantity = 1,
    selectedSize?: string,
    selectedColor?: string,
    selectedModel?: string,
    selectedPrice?: number,
    selectedImage?: string
  ) => {
    addToCart(
      product,
      quantity,
      selectedSize,
      selectedColor,
      selectedModel,
      selectedPrice,
      selectedImage,
      { openDrawer: false, showToast: false }
    );
  }, [addToCart]);

  const addDealToCart = useCallback((
    deal: Deal,
    quantity = 1,
    options?: { openDrawer?: boolean; showToast?: boolean }
  ): { success: boolean; error?: string } => {
    if (!deal) return { success: false, error: 'Deal not found.' };

    if (!isDealCurrentlyActive(deal)) {
      return { success: false, error: 'This deal is currently not active.' };
    }

    if (!Array.isArray(deal.products) || deal.products.length === 0) {
      return { success: false, error: 'This deal contains no products.' };
    }

    // Read live shop stock for bundle reference
    const liveProds = getProducts();
    let minShopStock = 9999;

    for (const item of deal.products) {
      const liveProduct = liveProds.find((p) => p.id === item.productId);
      let availableShop = item.shopStock ?? 0;

      if (liveProduct) {
        if (item.modelId && liveProduct.models && Array.isArray(liveProduct.models)) {
          const modelObj = liveProduct.models.find(
            (m) => m.id === item.modelId || m.name.toLowerCase() === item.modelName?.toLowerCase()
          );
          if (modelObj && modelObj.shopStock !== undefined) {
            availableShop = modelObj.shopStock;
          }
        } else if (liveProduct.shopStock !== undefined) {
          availableShop = liveProduct.shopStock;
        }
      }

      minShopStock = Math.min(minShopStock, availableShop);
    }

    const itemKey = `deal-${deal.id}`;
    const syntheticProduct: Product = {
      id: `deal-${deal.id}`,
      name: deal.name,
      slug: `deal-${deal.slug || deal.id}`,
      sku: `DEAL-${deal.id.slice(0, 8)}`,
      description: deal.description || deal.name,
      brand: 'Al-Hamd',
      price: Number(deal.dealPrice || 0),
      compareAtPrice: deal.originalPrice ? Number(deal.originalPrice) : undefined,
      stock: Math.max(0, minShopStock),
      shopStock: Math.max(0, minShopStock),
      images: deal.image ? [deal.image] : [],
      category: 'Deals',
      categorySlug: 'deals',
      status: 'active',
      rating: 5,
      reviewCount: 1,
    };

    const requestedQty = Math.max(1, quantity);

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === itemKey);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + requestedQty;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          selectedPrice: Number(deal.dealPrice || 0),
          dealPrice: Number(deal.dealPrice || 0),
        };
        return updated;
      } else {
        const newCartItem: CartItem = {
          id: itemKey,
          productId: `deal-${deal.id}`,
          product: syntheticProduct,
          quantity: requestedQty,
          selectedPrice: Number(deal.dealPrice || 0),
          selectedImage: deal.image,
          itemType: 'DEAL',
          dealId: deal.id,
          dealName: deal.name,
          dealPrice: Number(deal.dealPrice || 0),
          dealOriginalPrice: deal.originalPrice ? Number(deal.originalPrice) : undefined,
          dealProducts: deal.products.map((p) => ({
            productId: p.productId,
            modelId: p.modelId,
            productName: p.productName,
            modelName: p.modelName,
            quantity: 1,
            shopStock: p.shopStock || 0,
            price: p.price || 0,
            image: p.image,
            sku: p.sku,
          })),
        };
        return [...prev, newCartItem];
      }
    });

    try {
      if (typeof window !== 'undefined') {
        const existingRaw = localStorage.getItem('al_hamd_cart');
        const prevItems: CartItem[] = existingRaw ? JSON.parse(existingRaw) : [];
        const existingIdx = prevItems.findIndex((item) => item.id === itemKey);
        let syncCart: CartItem[];
        if (existingIdx > -1) {
          syncCart = [...prevItems];
          syncCart[existingIdx] = {
            ...syncCart[existingIdx],
            quantity: syncCart[existingIdx].quantity + requestedQty,
            selectedPrice: Number(deal.dealPrice || 0),
            dealPrice: Number(deal.dealPrice || 0),
          };
        } else {
          syncCart = [
            ...prevItems,
            {
              id: itemKey,
              productId: `deal-${deal.id}`,
              product: syntheticProduct,
              quantity: requestedQty,
              selectedPrice: Number(deal.dealPrice || 0),
              selectedImage: deal.image,
              itemType: 'DEAL',
              dealId: deal.id,
              dealName: deal.name,
              dealPrice: Number(deal.dealPrice || 0),
              dealOriginalPrice: deal.originalPrice ? Number(deal.originalPrice) : undefined,
              dealProducts: deal.products.map((p) => ({
                productId: p.productId,
                modelId: p.modelId,
                productName: p.productName,
                modelName: p.modelName,
                quantity: 1,
                shopStock: p.shopStock || 0,
                price: p.price || 0,
                image: p.image,
                sku: p.sku,
              })),
            },
          ];
        }
        localStorage.setItem('al_hamd_cart', JSON.stringify(syncCart));
      }
    } catch {}

    const shouldOpenDrawer = options?.openDrawer ?? true;
    const shouldShowToast = options?.showToast ?? true;

    setLastAddedProduct(syntheticProduct);
    if (shouldShowToast) {
      setShowAddedToast(true);
    }
    if (shouldOpenDrawer) {
      setIsCartOpen(true);
    } else {
      setIsCartOpen(false);
    }

    return { success: true };
  }, []);

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
          return { ...item, quantity: Math.max(1, newQuantity) };
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
        if (item.itemType === 'DEAL') {
          const dealUnitPrice = item.dealPrice ?? item.selectedPrice ?? item.product?.price ?? 0;
          return acc + dealUnitPrice * item.quantity;
        }
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

  const contextValue = useMemo<CartContextType>(
    () => ({
      cart,
      addToCart,
      buyNow,
      addDealToCart,
      hasHydrated,
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
    }),
    [
      cart,
      addToCart,
      buyNow,
      addDealToCart,
      hasHydrated,
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
    ]
  );

  return (
    <CartContext.Provider value={contextValue}>
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
