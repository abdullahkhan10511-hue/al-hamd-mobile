'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Product } from '@/types';
import { Order, Customer } from '@/types/admin';
import { getProducts } from '@/lib/db/products';
import { getOrders } from '@/lib/db/orders';
import { createPosSale } from '@/lib/db/pos';
import { getCustomers } from '@/lib/db/customers';
import { getEnabledPaymentMethods } from '@/lib/db/paymentMethods';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { formatPrice } from '@/lib/utils';
import PosReceiptModal from '@/components/admin/PosReceiptModal';
import {
  Store,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Tag,
  Receipt,
  RotateCcw,
  Percent,
  Calculator,
  Printer,
  History,
  TrendingUp,
  Package,
  Layers,
  Sparkles,
  X,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface CartItemState {
  product: Product;
  quantity: number;
  selectedModel?: string;
  selectedColor?: string;
  selectedPrice?: number;
}

const getPosCartItemKey = (item: { product: { id: string }; selectedModel?: string; selectedColor?: string }) =>
  `${item.product.id}__${item.selectedModel || 'default'}__${item.selectedColor || 'default'}`;

export default function ShopCounterPosPage() {
  const { admin, isSuperAdmin, isManager } = useAdminAuth();

  // Active Tab: 'terminal' (counter) | 'summary' (today KPIs) | 'history' (sales & voids)
  const [activeTab, setActiveTab] = useState<'terminal' | 'summary' | 'history'>('terminal');

  // Real Database Collections
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Cart State
  const [cart, setCart] = useState<CartItemState[]>([]);

  // Variant Picker Modal State for POS
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [selectedVariantModel, setSelectedVariantModel] = useState<string>('');
  const [selectedVariantColor, setSelectedVariantColor] = useState<string>('');

  // Catalog Filter & Search State
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'stock-desc' | 'newest'>('name');

  // Customer Mode & Info
  const [customerMode, setCustomerMode] = useState<'walkin' | 'existing'>('walkin');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');

  // Discount State
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState('');
  const [showDiscountForm, setShowDiscountForm] = useState(false);

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    discountAmount: number;
    description?: string;
  } | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Easypaisa' | 'JazzCash'>('Cash');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');

  // Sale Processing & Modals
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Void Modal State
  const [voidModalOrder, setVoidModalOrder] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // History Search
  const [historySearch, setHistorySearch] = useState('');

  // Permissions
  const canApplyDiscount = useMemo(() => {
    if (!admin) return false;
    if (isSuperAdmin || isManager || admin.role === 'ADMIN' || admin.role === 'SUPER_ADMIN') return true;
    return Boolean(admin.permissions?.includes('pos.apply_discount'));
  }, [admin, isSuperAdmin, isManager]);

  const canVoidSale = useMemo(() => {
    if (!admin) return false;
    if (isSuperAdmin || isManager || admin.role === 'ADMIN' || admin.role === 'SUPER_ADMIN') return true;
    return Boolean(admin.permissions?.includes('pos.void_sale'));
  }, [admin, isSuperAdmin, isManager]);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Safe cart validator & cleaner: removes deleted/inactive items, adjusts stock changes
  const validateAndCleanCart = useCallback((freshProducts: Product[]) => {
    setCart((prevCart) => {
      let removedAny = false;
      let modifiedAny = false;

      const newCart: CartItemState[] = [];

      for (const item of prevCart) {
        const liveProduct = freshProducts.find((p) => p.id === item.product.id);
        if (!liveProduct || liveProduct.status === 'inactive' || liveProduct.status === 'archived') {
          removedAny = true;
          continue; // Safely removed from cart!
        }

        const modelObj =
          item.selectedModel && Array.isArray(liveProduct.models)
            ? liveProduct.models.find(
                (m: any) =>
                  m.name.toLowerCase() === item.selectedModel?.toLowerCase() ||
                  m.id === item.selectedModel
              )
            : null;

        const availableStock = modelObj
          ? (modelObj.stock !== undefined ? modelObj.stock : liveProduct.stock)
          : liveProduct.stock;

        // Check Available Stock
        if (availableStock <= 0) {
          removedAny = true;
          continue;
        }

        let qty = item.quantity;
        if (qty > availableStock) {
          qty = availableStock;
          modifiedAny = true;
        }

        newCart.push({
          product: liveProduct,
          quantity: Math.max(1, qty),
          selectedModel: item.selectedModel,
          selectedColor: item.selectedColor,
          selectedPrice: modelObj
            ? Number(modelObj.price)
            : (item.selectedPrice ?? Number(liveProduct.price)),
        });
      }

      if (removedAny) {
        showToast(
          'This product is no longer available and was removed from your cart.',
          'warning'
        );
      } else if (modifiedAny) {
        showToast(
          'Cart quantities were adjusted to match current available inventory.',
          'warning'
        );
      }

      return newCart;
    });
  }, [showToast]);

  // Load fresh data from authoritative store and validate cart
  const loadData = useCallback(() => {
    const freshProducts = getProducts();
    setProducts(freshProducts);
    validateAndCleanCart(freshProducts);
    setOrders(getOrders());
    getCustomers().then((c) => setCustomers(c)).catch(() => {});
  }, [validateAndCleanCart]);

  // Hydrate cart from storage once mounted and validate against live catalog
  useEffect(() => {
    try {
      const saved = localStorage.getItem('alhamd_pos_counter_cart');
      const freshProducts = getProducts();
      if (saved) {
        const parsed: CartItemState[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let removedAny = false;
          let modifiedAny = false;
          const validCart: CartItemState[] = [];

          for (const item of parsed) {
            if (!item || !item.product || !item.product.id) continue;
            const live = freshProducts.find((p) => p.id === item.product.id);
            if (!live || live.status === 'inactive' || live.status === 'archived') {
              removedAny = true;
              continue;
            }
            const modelObj =
              item.selectedModel && Array.isArray(live.models)
                ? live.models.find(
                    (m: any) =>
                      m.name.toLowerCase() === item.selectedModel?.toLowerCase() ||
                      m.id === item.selectedModel
                  )
                : null;
            const availableStock = modelObj
              ? (modelObj.stock !== undefined ? modelObj.stock : live.stock)
              : live.stock;
            if (availableStock <= 0) {
              removedAny = true;
              continue;
            }
            const qty = Math.min(item.quantity || 1, availableStock);
            if (qty !== item.quantity) modifiedAny = true;
            validCart.push({
              product: live,
              quantity: Math.max(1, qty),
              selectedModel: item.selectedModel,
              selectedColor: item.selectedColor,
              selectedPrice: modelObj
                ? Number(modelObj.price)
                : (item.selectedPrice ?? Number(live.price)),
            });
          }

          setCart(validCart);
          if (removedAny) {
            showToast('This product is no longer available and was removed from your cart.', 'warning');
          } else if (modifiedAny) {
            showToast('Cart quantities were adjusted to match current available inventory.', 'warning');
          }
        }
      }
    } catch {}
  }, [showToast]);

  // Persist POS cart to localStorage whenever cart state changes
  useEffect(() => {
    try {
      if (cart.length === 0) {
        localStorage.removeItem('alhamd_pos_counter_cart');
      } else {
        localStorage.setItem('alhamd_pos_counter_cart', JSON.stringify(cart));
      }
    } catch {}
  }, [cart]);

  useEffect(() => {
    loadData();

    const handleDataUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleDataUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleDataUpdate);
  }, [loadData]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.status !== 'inactive' && p.status !== 'archived') {
        set.add(p.category);
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  // Filter & Sort Products for Catalog
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => p.status !== 'inactive' && p.status !== 'archived');

    // Search query
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Sorting
    switch (sortBy) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'stock-desc':
        list.sort((a, b) => b.stock - a.stock);
        break;
      case 'newest':
        list.sort((a, b) => (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0));
        break;
      case 'name':
      default:
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return list;
  }, [products, catalogSearch, selectedCategory, sortBy]);

  // Cart Calculations with standard retail pricing
  const cartCalculations = useMemo(() => {
    let subtotal = 0;
    const items = cart.map((item) => {
      const modelObj =
        item.selectedModel && Array.isArray(item.product.models)
          ? item.product.models.find(
              (m) =>
                m.name.toLowerCase() === item.selectedModel?.toLowerCase() ||
                m.id === item.selectedModel
            )
          : null;
      const basePrice = modelObj
        ? (Number(modelObj.price) || Number(item.product.price) || 0)
        : (item.selectedPrice ?? Number(item.product.price) ?? 0);
      const unitPrice = basePrice;
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      return {
        ...item,
        key: getPosCartItemKey(item),
        unitPrice,
        originalUnitPrice: basePrice,
        discountPercentage: 0,
        lineTotal,
      };
    });

    let manualDiscountAmount = 0;
    if (discountValue > 0) {
      if (discountType === 'percentage') {
        const pct = Math.min(100, Math.max(0, discountValue));
        manualDiscountAmount = Math.round((subtotal * pct) / 100);
      } else {
        manualDiscountAmount = Math.min(subtotal, Math.round(discountValue));
      }
    }

    const promoDiscountAmount = appliedPromo ? appliedPromo.discountAmount : 0;
    const totalDiscount = Math.min(subtotal, manualDiscountAmount + promoDiscountAmount);
    const grandTotal = Math.max(0, subtotal - totalDiscount);

    return {
      items,
      subtotal,
      manualDiscountAmount,
      promoDiscountAmount,
      discountAmount: totalDiscount,
      grandTotal,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [cart, discountType, discountValue, appliedPromo]);

  const addSpecificVariantToCart = (live: Product, modelName?: string, colorName?: string) => {
    const modelObj =
      modelName && Array.isArray(live.models)
        ? live.models.find(
            (m) =>
              m.name.toLowerCase() === modelName.toLowerCase() ||
              m.id === modelName
          )
        : null;

    const availableStock = modelObj
      ? (modelObj.stock !== undefined ? modelObj.stock : live.stock)
      : live.stock;

    if (availableStock <= 0) {
      showToast(
        `"${live.name}${modelName ? ` (${modelName})` : ''}" is currently out of stock.`,
        'warning'
      );
      return;
    }

    const itemPrice = modelObj
      ? (Number(modelObj.price) || Number(live.price))
      : Number(live.price);

    setCart((prev) => {
      const matchIdx = prev.findIndex(
        (item) =>
          item.product.id === live.id &&
          (item.selectedModel || '') === (modelName || '') &&
          (item.selectedColor || '') === (colorName || '')
      );

      if (matchIdx !== -1) {
        if (prev[matchIdx].quantity >= availableStock) {
          showToast(`Only ${availableStock} units available for this selection.`, 'warning');
          return prev;
        }
        return prev.map((item, idx) =>
          idx === matchIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prev,
          {
            product: live,
            quantity: 1,
            selectedModel: modelName,
            selectedColor: colorName,
            selectedPrice: itemPrice,
          },
        ];
      }
    });

    setVariantModalProduct(null);
  };

  // Handle Add to Cart
  const handleAddToCart = (product: Product) => {
    // Re-verify against latest catalog
    const freshProducts = getProducts();
    const live = freshProducts.find((p) => p.id === product.id);
    if (!live || live.status === 'inactive' || live.status === 'archived') {
      showToast('This product is no longer available.', 'error');
      validateAndCleanCart(freshProducts);
      return;
    }

    if (live.stock <= 0) {
      showToast(`"${live.name}" is currently out of stock.`, 'warning');
      return;
    }

    const hasModels = Boolean(
      live.enableModelSelection &&
      Array.isArray(live.models) &&
      live.models.filter((m) => m.isActive !== false).length > 0
    );
    const hasColors = Boolean(
      (live.enableColorSelection && Array.isArray(live.colors) && live.colors.filter((c) => c.isActive !== false).length > 0) ||
      (Array.isArray(live.variants?.colors) && live.variants.colors.length > 0)
    );

    if (hasModels || hasColors) {
      setVariantModalProduct(live);
      const activeM = live.models?.filter((m) => m.isActive !== false) || [];
      setSelectedVariantModel(activeM[0]?.name || '');
      const activeC =
        (live.colors && live.colors.filter((c) => c.isActive !== false)) ||
        live.variants?.colors ||
        [];
      setSelectedVariantColor(activeC[0]?.name || '');
      return;
    }

    addSpecificVariantToCart(live, undefined, undefined);
  };

  // Change Quantity
  const handleUpdateQuantity = (itemKey: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemKey);
      return;
    }

    setCart((prev) => {
      const target = prev.find((item) => getPosCartItemKey(item) === itemKey);
      if (!target) return prev;

      const modelObj =
        target.selectedModel && Array.isArray(target.product.models)
          ? target.product.models.find(
              (m) =>
                m.name.toLowerCase() === target.selectedModel?.toLowerCase() ||
                m.id === target.selectedModel
            )
          : null;

      const availableStock = modelObj
        ? (modelObj.stock !== undefined ? modelObj.stock : target.product.stock)
        : target.product.stock;

      if (newQty > availableStock) {
        showToast(`Only ${availableStock} units available for this selection.`, 'warning');
        return prev;
      }

      return prev.map((item) =>
        getPosCartItemKey(item) === itemKey ? { ...item, quantity: newQty } : item
      );
    });
  };

  const handleRemoveItem = (itemKey: string) => {
    setCart((prev) => prev.filter((item) => getPosCartItemKey(item) !== itemKey));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiscountValue(0);
    setAmountPaidInput('');
    setSelectedCustomer(null);
    setWalkinName('');
    setWalkinPhone('');
    setAppliedPromo(null);
    setPromoCodeInput('');
    setPromoError('');
  };

  // Promo Code Validation Handler for POS
  const handleApplyPromoCode = async () => {
    const codeToTest = promoCodeInput.trim().toUpperCase();
    if (!codeToTest) {
      setPromoError('Please enter a promo code.');
      return;
    }
    if (cart.length === 0) {
      setPromoError('Please add products to cart before applying promo code.');
      return;
    }

    setIsApplyingPromo(true);
    setPromoError('');

    try {
      const response = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeToTest,
          subtotal: cartCalculations.subtotal,
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            price: i.product.price,
            categorySlug: i.product.categorySlug,
          })),
          channel: 'POS',
          customer:
            customerMode === 'existing' && selectedCustomer
              ? {
                  id: selectedCustomer.id,
                  email: selectedCustomer.email,
                  phone: selectedCustomer.phone,
                  firstName: selectedCustomer.firstName,
                  lastName: selectedCustomer.lastName,
                }
              : {
                  firstName: walkinName.trim() || 'Walk-in',
                  lastName: 'Customer',
                  phone: walkinPhone.trim(),
                },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.valid) {
        setPromoError(data.error || 'Invalid promo code.');
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo({
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        discountAmount: data.discountAmount,
        description: data.description,
      });
      setPromoError('');
      showToast(`Promo ${data.code} applied! Discount: Rs. ${data.discountAmount.toLocaleString('en-PK')}`, 'success');
    } catch (err: any) {
      setPromoError(err?.message || 'Network error while checking promo code.');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromoCode = () => {
    setAppliedPromo(null);
    setPromoCodeInput('');
    setPromoError('');
    showToast('Promo code removed.', 'success');
  };

  // Quick Tender helpers
  const handleQuickTender = (amount: number) => {
    setAmountPaidInput(amount.toString());
  };

  const cashChange = useMemo(() => {
    if (paymentMethod !== 'Cash') return 0;
    const paid = parseFloat(amountPaidInput) || 0;
    return Math.max(0, paid - cartCalculations.grandTotal);
  }, [paymentMethod, amountPaidInput, cartCalculations.grandTotal]);

  // Complete Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Please add products to complete a sale.', 'warning');
      return;
    }

    // Proactive inventory and product validity verification against current authoritative catalog
    const freshProducts = getProducts();
    let hasInvalid = false;
    for (const item of cart) {
      const live = freshProducts.find((p) => p.id === item.product.id);
      if (!live || live.status === 'inactive' || live.status === 'archived') {
        hasInvalid = true;
        break;
      }
      const modelObj =
        item.selectedModel && Array.isArray(live.models)
          ? live.models.find(
              (m: any) =>
                m.name.toLowerCase() === item.selectedModel?.toLowerCase() ||
                m.id === item.selectedModel
            )
          : null;
      const availableStock = modelObj
        ? (modelObj.stock !== undefined ? modelObj.stock : live.stock)
        : live.stock;
      if (availableStock < item.quantity) {
        hasInvalid = true;
        break;
      }
    }

    if (hasInvalid) {
      validateAndCleanCart(freshProducts);
      showToast('This product is no longer available and was removed from your cart.', 'error');
      return;
    }

    const grandTotal = cartCalculations.grandTotal;

    // Validate payment amount
    let finalAmountPaid = grandTotal;
    if (paymentMethod === 'Cash') {
      const enteredCash = parseFloat(amountPaidInput);
      if (isNaN(enteredCash) || enteredCash < grandTotal) {
        showToast(
          `Cash received (Rs. ${isNaN(enteredCash) ? 0 : enteredCash.toLocaleString('en-PK')}) cannot be less than total (Rs. ${grandTotal.toLocaleString('en-PK')}).`,
          'error'
        );
        return;
      }
      finalAmountPaid = enteredCash;
    }

    // Validate discount permissions
    if (discountValue > 0 && !canApplyDiscount) {
      showToast('You do not have authorization to grant manual discounts.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const customer =
        customerMode === 'existing' && selectedCustomer
          ? {
              id: selectedCustomer.id,
              firstName: selectedCustomer.firstName,
              lastName: selectedCustomer.lastName,
              email: selectedCustomer.email,
              phone: selectedCustomer.phone,
            }
          : {
              firstName: walkinName.trim() || 'Walk-in',
              lastName: 'Customer',
              email: 'counter@alhamd-mobile.com',
              phone: walkinPhone.trim(),
            };

      const result = await createPosSale({
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          selectedModel: item.selectedModel,
          selectedColor: item.selectedColor,
        })),
        catalogSnapshot: freshProducts,
        customer,
        discountType: discountValue > 0 ? discountType : undefined,
        discountValue: discountValue > 0 ? discountValue : undefined,
        discountReason: discountReason.trim() || undefined,
        promoCode: appliedPromo ? appliedPromo.code : undefined,
        paymentMethod,
        amountPaid: finalAmountPaid,
        paymentReference: paymentReference.trim() || undefined,
        cashierId: admin?.id,
        cashierName: admin?.name || admin?.email?.split('@')[0] || 'Counter Staff',
        cashierEmail: admin?.email || 'counter@alhamd-mobile.com',
      });

      if (!result.success || !result.order) {
        if (result.error && (result.error.includes('was not found') || result.error.includes('no longer available'))) {
          validateAndCleanCart(getProducts());
          showToast('This product is no longer available and was removed from your cart.', 'error');
        } else {
          showToast(result.error || 'Failed to complete sale.', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      // Success! Set completed order, trigger Sale Completed screen, clear cart, refresh data
      setCompletedOrder(result.order);
      setIsReceiptModalOpen(true);
      handleClearCart();
      loadData();
      showToast('Sale completed successfully!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error processing sale.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Void Sale
  const handleVoidSale = async () => {
    if (!voidModalOrder) return;
    if (!voidReason.trim()) {
      showToast('Please provide a reason for voiding this sale.', 'warning');
      return;
    }

    setIsVoiding(true);
    try {
      const response = await fetch('/api/admin/pos/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: voidModalOrder.id,
          reason: voidReason.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        showToast(data.error || 'Failed to void sale.', 'error');
        setIsVoiding(false);
        return;
      }

      showToast(`Sale #${voidModalOrder.invoiceNumber} has been voided and stock restored.`, 'success');
      setVoidModalOrder(null);
      setVoidReason('');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Error voiding sale.', 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  // Today's summary stats
  const todaySummary = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const posOrders = orders.filter(
      (o) => o.orderSource === 'POS' && new Date(o.createdAt) >= todayStart
    );

    const activePosOrders = posOrders.filter((o) => o.status !== 'Cancelled');
    const voidedPosOrders = posOrders.filter((o) => o.status === 'Cancelled');

    const totalRevenue = activePosOrders.reduce((sum, o) => sum + o.total, 0);
    const totalDiscounts = activePosOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
    const totalItems = activePosOrders.reduce(
      (sum, o) => sum + o.items.reduce((iSum, i) => iSum + i.quantity, 0),
      0
    );

    let cashTotal = 0;
    let cardTotal = 0;
    let easypaisaTotal = 0;
    let jazzcashTotal = 0;

    activePosOrders.forEach((o) => {
      const m = (o.paymentMethod || '').toLowerCase();
      if (m.includes('cash') || m === 'cod') cashTotal += o.total;
      else if (m.includes('card')) cardTotal += o.total;
      else if (m.includes('easypaisa')) easypaisaTotal += o.total;
      else if (m.includes('jazzcash')) jazzcashTotal += o.total;
    });

    // Cashier breakdown
    const cashierMap: Record<string, { count: number; total: number }> = {};
    activePosOrders.forEach((o) => {
      const name = o.cashierName || 'Staff';
      if (!cashierMap[name]) cashierMap[name] = { count: 0, total: 0 };
      cashierMap[name].count += 1;
      cashierMap[name].total += o.total;
    });

    return {
      totalRevenue,
      totalDiscounts,
      totalItems,
      ordersCount: activePosOrders.length,
      voidedCount: voidedPosOrders.length,
      cashTotal,
      cardTotal,
      easypaisaTotal,
      jazzcashTotal,
      cashierMap,
    };
  }, [orders]);

  // Filtered POS orders for History tab
  const posSalesHistory = useMemo(() => {
    let list = orders.filter((o) => o.orderSource === 'POS');
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.invoiceNumber.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          o.customer.firstName.toLowerCase().includes(q) ||
          o.customer.lastName.toLowerCase().includes(q) ||
          o.customer.phone.toLowerCase().includes(q) ||
          (o.cashierName && o.cashierName.toLowerCase().includes(q)) ||
          o.items.some(
            (item) =>
              item.productName.toLowerCase().includes(q) ||
              (item.sku && item.sku.toLowerCase().includes(q))
          )
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, historySearch]);

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
      {/* =================================================================== */}
      {/* TOP HEADER & NAVIGATION BAR                                         */}
      {/* =================================================================== */}
      <div className="bg-white px-5 py-4 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-neutral-950 text-white flex items-center justify-center shadow-sm">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-neutral-950 tracking-tight">
                Shop Counter / POS
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                LIVE TERMINAL
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Cashier: <strong className="text-neutral-800">{admin?.name || admin?.email}</strong> • Store: AL-HAMD MOBILE ACCESSORIES
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'terminal'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Counter Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'summary'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Today's Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Sales History & Voids</span>
          </button>
        </div>
      </div>

      {/* Toast feedback banner */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toastMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {toastMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{toastMessage.text}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: SHOP COUNTER ACTIVE TERMINAL                                 */}
      {/* =================================================================== */}
      {activeTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* --------------------------------------------------------------- */}
          {/* LEFT AREA: PRODUCT CATALOG (lg:col-span-7 or 8)                 */}
          {/* --------------------------------------------------------------- */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-3">
            {/* Catalog Filter Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                {/* Search Bar */}
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search product name, SKU, brand, category..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 transition-all"
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <span className="text-[11px] text-neutral-400 font-medium whitespace-nowrap hidden sm:inline">
                    Sort by:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full sm:w-auto px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 font-medium focus:outline-none focus:border-neutral-950 cursor-pointer"
                  >
                    <option value="name">Name (A-Z)</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="stock-desc">Highest Stock</option>
                    <option value="newest">New Arrivals</option>
                  </select>
                </div>
              </div>

              {/* Category Pills Slider */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-neutral-950 text-white shadow-xs'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-neutral-200">
                  <Package className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-neutral-600">No products match your search or filter.</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Try clearing filters or checking SKU.</p>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const inCartItem = cart.find((i) => i.product.id === product.id);
                  const isOutOfStock = product.stock <= 0;
                  const isLowStock = product.stock > 0 && product.stock <= (product.lowStockThreshold || 5);
                  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && handleAddToCart(product)}
                      className={`group relative bg-white rounded-2xl border p-2.5 flex flex-col justify-between transition-all select-none ${
                        isOutOfStock
                          ? 'border-neutral-200 opacity-60 cursor-not-allowed bg-neutral-50/70'
                          : 'border-neutral-200 hover:border-neutral-900 hover:shadow-md cursor-pointer active:scale-[0.99]'
                      } ${inCartItem ? 'ring-2 ring-neutral-950 border-transparent' : ''}`}
                    >
                      <div>
                        {/* Image & Badges */}
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-100 mb-2">
                          <img
                            src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder.png'}
                            alt={product.name}
                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* In-cart badge count */}
                          {inCartItem && (
                            <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-neutral-950 text-white font-black text-[11px] flex items-center justify-center shadow-md">
                              {inCartItem.quantity}
                            </span>
                          )}

                          {/* Stock Status Badge */}
                          <div className="absolute bottom-1.5 left-1.5">
                            {isOutOfStock ? (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-rose-600 text-white shadow-xs">
                                Out of Stock
                              </span>
                            ) : isLowStock ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-amber-500 text-neutral-950 shadow-xs">
                                Low: {product.stock} left
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-neutral-900/80 backdrop-blur-xs text-white">
                                Stock: {product.stock}
                              </span>
                            )}
                          </div>

                          {/* Sale Badge */}
                          {hasDiscount && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-rose-600 text-white">
                              SALE
                            </span>
                          )}
                        </div>

                        {/* Title & SKU */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] text-neutral-500">
                            <span className="truncate">{product.brand || product.category}</span>
                            <span className="font-mono text-[9px]">{product.sku || '—'}</span>
                          </div>
                          <h4 className="font-bold text-neutral-900 text-xs line-clamp-2 leading-snug">
                            {product.name}
                          </h4>
                        </div>
                      </div>

                      {/* Pricing Row */}
                      <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between">
                        <div>
                          <div className="font-black text-xs text-neutral-950">
                            Rs. {product.price.toLocaleString('en-PK')}
                          </div>
                          {hasDiscount && (
                            <div className="text-[10px] line-through text-neutral-400">
                              Rs. {product.compareAtPrice?.toLocaleString('en-PK')}
                            </div>
                          )}
                        </div>

                        {!isOutOfStock && (
                          <div className="w-7 h-7 rounded-xl bg-neutral-900 text-white flex items-center justify-center group-hover:bg-neutral-800 transition-colors shadow-xs">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* RIGHT AREA: CURRENT CART & BILLING CHECKOUT (lg:col-span-5/4)   */}
          {/* --------------------------------------------------------------- */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-3xl border border-neutral-200 shadow-lg p-4 sm:p-5 flex flex-col space-y-4">
            {/* Cart Top Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-neutral-900" />
                <h3 className="font-black text-neutral-900 text-sm">
                  Current Sale ({cartCalculations.itemCount})
                </h3>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Customer Selector Section */}
            <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Customer
                </span>

                <div className="flex items-center bg-white p-0.5 rounded-lg border border-neutral-200 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('walkin');
                      setSelectedCustomer(null);
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      customerMode === 'walkin'
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Walk-in
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode('existing')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      customerMode === 'existing'
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Registered
                  </button>
                </div>
              </div>

              {/* Walk-in Customer Inputs */}
              {customerMode === 'walkin' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    placeholder="Customer Name (optional)"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-neutral-200 text-xs focus:outline-none focus:border-neutral-900"
                  />
                  <input
                    type="tel"
                    value={walkinPhone}
                    onChange={(e) => setWalkinPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-neutral-200 text-xs focus:outline-none focus:border-neutral-900"
                  />
                </div>
              )}

              {/* Existing Customer Search & Selection */}
              {customerMode === 'existing' && (
                <div className="space-y-2">
                  {!selectedCustomer ? (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search customer by name, phone, or email..."
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-white border border-neutral-200 text-xs focus:outline-none focus:border-neutral-900"
                      />

                      {customerSearch.trim() && (
                        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-neutral-200 shadow-xl max-h-48 overflow-y-auto divide-y divide-neutral-100 text-xs">
                          {customers
                            .filter(
                              (c) =>
                                c.firstName.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                c.lastName.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                c.phone.includes(customerSearch) ||
                                Boolean(c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase())) ||
                                Boolean(c.shopName && c.shopName.toLowerCase().includes(customerSearch.toLowerCase()))
                            )
                            .slice(0, 5)
                            .map((c) => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  setCustomerSearch('');
                                }}
                                className="p-2 hover:bg-neutral-50 cursor-pointer flex justify-between items-center"
                              >
                                <div>
                                  <span className="font-bold text-neutral-900">
                                    {c.firstName} {c.lastName}
                                  </span>
                                  <div className="text-[10px] text-neutral-500">{c.phone || c.email}</div>
                                </div>
                                <span className="text-[10px] text-emerald-600 font-semibold">
                                  {c.totalOrders || 0} orders
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-white border border-neutral-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-neutral-900">
                          {selectedCustomer.firstName} {selectedCustomer.lastName}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {selectedCustomer.phone || selectedCustomer.email} • {selectedCustomer.totalOrders || 0} orders
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(null)}
                        className="text-neutral-400 hover:text-neutral-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 max-h-[320px] overflow-y-auto space-y-2 divide-y divide-neutral-100 pr-1">
              {cartCalculations.items.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 space-y-1">
                  <ShoppingCart className="w-8 h-8 mx-auto stroke-1 text-neutral-300" />
                  <p className="text-xs font-semibold">Cart is currently empty.</p>
                  <p className="text-[10px]">Click any product on the left catalog to add.</p>
                </div>
              ) : (
                cartCalculations.items.map((item) => {
                  const modelObj =
                    item.selectedModel && Array.isArray(item.product.models)
                      ? item.product.models.find(
                          (m) =>
                            m.name.toLowerCase() === item.selectedModel?.toLowerCase() ||
                            m.id === item.selectedModel
                        )
                      : null;
                  const itemImg =
                    (modelObj?.images && modelObj.images.length > 0 ? modelObj.images[0] : null) ||
                    item.product.images?.[0] ||
                    '/placeholder.png';

                  return (
                    <div key={item.key} className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs">
                      {/* Item details */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <img
                          src={itemImg}
                          alt={item.product.name}
                          className="w-10 h-10 rounded-lg object-cover bg-neutral-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-neutral-900 truncate leading-tight">
                            {item.product.name}
                          </h5>
                          {(item.selectedModel || item.selectedColor) && (
                            <div className="text-[10px] text-neutral-600 font-medium">
                              {[
                                item.selectedModel ? `Model: ${item.selectedModel}` : null,
                                item.selectedColor ? `Color: ${item.selectedColor}` : null,
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </div>
                          )}
                          <div className="text-[10px] text-neutral-500 font-mono">
                            Rs. {item.unitPrice.toLocaleString('en-PK')} each
                          </div>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center bg-neutral-100 rounded-xl p-0.5 border border-neutral-200">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.key, item.quantity - 1)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-neutral-50 text-neutral-800 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center font-bold font-mono text-xs text-neutral-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.key, item.quantity + 1)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-neutral-50 text-neutral-800 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="w-16 text-right font-black font-mono text-neutral-900">
                          Rs. {item.lineTotal.toLocaleString('en-PK')}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.key)}
                          className="w-6 h-6 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Calculations & Discounts */}
            <div className="pt-3 border-t border-neutral-200 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal:</span>
                <span className="font-bold font-mono">
                  Rs. {cartCalculations.subtotal.toLocaleString('en-PK')}
                </span>
              </div>

              {/* Manual Discount Toggle / Input */}
              {canApplyDiscount ? (
                <div>
                  {!showDiscountForm ? (
                    <button
                      type="button"
                      onClick={() => setShowDiscountForm(true)}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Tag className="w-3 h-3" />
                      {cartCalculations.discountAmount > 0
                        ? `Discount Applied: -Rs. ${cartCalculations.discountAmount.toLocaleString('en-PK')}`
                        : '+ Apply Counter Discount'}
                    </button>
                  ) : (
                    <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                        <span>Manual Counter Discount</span>
                        <button
                          type="button"
                          onClick={() => setShowDiscountForm(false)}
                          className="text-amber-700 hover:text-amber-900"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as any)}
                          className="px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-neutral-800 focus:outline-none"
                        >
                          <option value="fixed">Fixed Rs.</option>
                          <option value="percentage">% Percent</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          value={discountValue || ''}
                          onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                          placeholder="Amount"
                          className="col-span-2 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Promo Code Input Section */}
              <div className="pt-2 border-t border-dashed border-neutral-200">
                {!appliedPromo ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <Tag className="w-3 h-3 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={promoCodeInput}
                          onChange={(e) => {
                            setPromoCodeInput(e.target.value.toUpperCase());
                            setPromoError('');
                          }}
                          placeholder="Enter promo code"
                          className="w-full pl-7 pr-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs uppercase font-mono font-semibold text-neutral-900 placeholder:normal-case placeholder:font-sans placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyPromoCode}
                        disabled={isApplyingPromo || !promoCodeInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                      >
                        {isApplyingPromo ? '...' : 'APPLY'}
                      </button>
                    </div>
                    {promoError && (
                      <p className="text-[11px] text-rose-600 font-medium pl-1">{promoError}</p>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black font-mono text-emerald-950 uppercase">
                          {appliedPromo.code}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                          {appliedPromo.discountType === 'percentage'
                            ? `-${appliedPromo.discountValue}%`
                            : 'Fixed OFF'}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-emerald-800 mt-0.5">
                        Discount: -Rs. {appliedPromo.discountAmount.toLocaleString('en-PK')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromoCode}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                    >
                      REMOVE
                    </button>
                  </div>
                )}
              </div>

              {/* Discounts Line Item */}
              {cartCalculations.discountAmount > 0 && (
                <div className="space-y-1">
                  {cartCalculations.manualDiscountAmount > 0 && (
                    <div className="flex justify-between text-amber-800 font-semibold text-[11px]">
                      <span>Manual Discount:</span>
                      <span className="font-mono">
                        -Rs. {cartCalculations.manualDiscountAmount.toLocaleString('en-PK')}
                      </span>
                    </div>
                  )}
                  {cartCalculations.promoDiscountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                      <span>Promo Discount ({appliedPromo?.code}):</span>
                      <span className="font-mono">
                        -Rs. {cartCalculations.promoDiscountAmount.toLocaleString('en-PK')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Total Discount:</span>
                    <span className="font-mono">
                      -Rs. {cartCalculations.discountAmount.toLocaleString('en-PK')}
                    </span>
                  </div>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-center pt-2 border-t border-neutral-900 text-sm">
                <span className="font-black text-neutral-950 uppercase tracking-tight">
                  Grand Total:
                </span>
                <span className="font-black text-lg font-mono text-neutral-950">
                  Rs. {cartCalculations.grandTotal.toLocaleString('en-PK')}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 pt-1 border-t border-neutral-100">
              <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block">
                Payment Method
              </span>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                {[
                  { id: 'Cash', label: 'Cash', icon: Banknote },
                  { id: 'Card', label: 'Card', icon: CreditCard },
                  { id: 'Easypaisa', label: 'Easypaisa', icon: Smartphone },
                  { id: 'JazzCash', label: 'JazzCash', icon: Wallet },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id as any);
                        if (m.id === 'Cash') {
                          setAmountPaidInput(cartCalculations.grandTotal.toString());
                        }
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-neutral-950 border-neutral-950 text-white shadow-xs'
                          : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px]">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Cash Tender Calculation */}
              {paymentMethod === 'Cash' && (
                <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-neutral-700">Cash Received:</span>
                    <input
                      type="number"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      placeholder={cartCalculations.grandTotal.toString()}
                      className="w-28 px-2 py-1 bg-white border border-neutral-300 rounded-lg text-right font-black font-mono text-xs focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  {/* Quick cash buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleQuickTender(cartCalculations.grandTotal)}
                      className="flex-1 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-[10px] font-bold text-neutral-700 transition-colors"
                    >
                      Exact
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickTender(Math.ceil(cartCalculations.grandTotal / 500) * 500)
                      }
                      className="flex-1 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-[10px] font-bold text-neutral-700 transition-colors"
                    >
                      Round 500
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickTender(Math.ceil(cartCalculations.grandTotal / 1000) * 1000)
                      }
                      className="flex-1 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-[10px] font-bold text-neutral-700 transition-colors"
                    >
                      Round 1000
                    </button>
                  </div>

                  {/* Change display */}
                  <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-neutral-200">
                    <span className="text-neutral-600">Change to Return:</span>
                    <span
                      className={`font-mono text-sm font-black ${
                        cashChange >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      Rs. {cashChange.toLocaleString('en-PK')}
                    </span>
                  </div>
                </div>
              )}

              {/* Transaction reference for wallet / card */}
              {paymentMethod !== 'Cash' && (
                <div>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder={`${paymentMethod} Transaction ID / Ref # (optional)`}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
              )}
            </div>

            {/* Complete Sale Button */}
            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={isSubmitting || cart.length === 0}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-sm tracking-wide transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Processing Sale...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>COMPLETE SALE (Rs. {cartCalculations.grandTotal.toLocaleString('en-PK')})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: TODAY'S SALES SUMMARY                                        */}
      {/* =================================================================== */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Today's POS Sales
              </span>
              <div className="text-2xl font-black font-mono text-neutral-950">
                Rs. {todaySummary.totalRevenue.toLocaleString('en-PK')}
              </div>
              <p className="text-[10px] text-emerald-600 font-semibold">Active completed revenue</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Completed POS Orders
              </span>
              <div className="text-2xl font-black font-mono text-neutral-950">
                {todaySummary.ordersCount}
              </div>
              <p className="text-[10px] text-neutral-500 font-medium">
                {todaySummary.voidedCount > 0 && `${todaySummary.voidedCount} voided`}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Items Sold
              </span>
              <div className="text-2xl font-black font-mono text-neutral-950">
                {todaySummary.totalItems} pcs
              </div>
              <p className="text-[10px] text-neutral-500 font-medium">Accessories dispensed</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Total Discounts
              </span>
              <div className="text-2xl font-black font-mono text-amber-700">
                Rs. {todaySummary.totalDiscounts.toLocaleString('en-PK')}
              </div>
              <p className="text-[10px] text-amber-600 font-medium">Manual price reductions</p>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                Payment Channels Breakdown
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-neutral-700" />
                    <span className="font-bold text-neutral-800">Cash Sales</span>
                  </div>
                  <span className="font-black font-mono text-neutral-950">
                    Rs. {todaySummary.cashTotal.toLocaleString('en-PK')}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-neutral-700" />
                    <span className="font-bold text-neutral-800">Card Payments</span>
                  </div>
                  <span className="font-black font-mono text-neutral-950">
                    Rs. {todaySummary.cardTotal.toLocaleString('en-PK')}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-neutral-800">Easypaisa</span>
                  </div>
                  <span className="font-black font-mono text-neutral-950">
                    Rs. {todaySummary.easypaisaTotal.toLocaleString('en-PK')}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-neutral-800">JazzCash</span>
                  </div>
                  <span className="font-black font-mono text-neutral-950">
                    Rs. {todaySummary.jazzcashTotal.toLocaleString('en-PK')}
                  </span>
                </div>
              </div>
            </div>

            {/* Cashier Performance */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <User className="w-4 h-4 text-neutral-700" />
                Cashier Performance (Today)
              </h4>

              <div className="space-y-2 text-xs">
                {Object.keys(todaySummary.cashierMap).length === 0 ? (
                  <p className="text-neutral-400 py-8 text-center text-xs">
                    No counter sales completed yet today.
                  </p>
                ) : (
                  Object.entries(todaySummary.cashierMap).map(([name, stat]) => (
                    <div
                      key={name}
                      className="flex justify-between items-center p-3 rounded-xl bg-neutral-50 border border-neutral-100"
                    >
                      <div>
                        <div className="font-bold text-neutral-900">{name}</div>
                        <div className="text-[10px] text-neutral-500">{stat.count} orders completed</div>
                      </div>
                      <div className="font-black font-mono text-sm text-neutral-950">
                        Rs. {stat.total.toLocaleString('en-PK')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: POS SALES HISTORY & VOIDS                                    */}
      {/* =================================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-3">
            <Search className="w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search POS sales by Invoice Number, Customer, Phone, SKU, Cashier..."
              className="w-full bg-transparent text-xs text-neutral-900 focus:outline-none"
            />
          </div>

          {/* Sales Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {posSalesHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-neutral-400">
                        No POS sales match your query.
                      </td>
                    </tr>
                  ) : (
                    posSalesHistory.map((order) => {
                      const isCancelled = order.status === 'Cancelled';

                      return (
                        <tr key={order.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold font-mono text-neutral-900">
                              {order.invoiceNumber}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono">#{order.id}</div>
                          </td>

                          <td className="py-3 px-4 text-neutral-600 whitespace-nowrap">
                            <div>{new Date(order.createdAt).toLocaleDateString('en-PK')}</div>
                            <div className="text-[10px] text-neutral-400">
                              {new Date(order.createdAt).toLocaleTimeString('en-PK', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-neutral-900">
                              {order.customer.firstName} {order.customer.lastName}
                            </div>
                            {order.customer.phone && (
                              <div className="text-[10px] text-neutral-500">{order.customer.phone}</div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-neutral-700">
                            <span className="font-medium">{order.cashierName || 'Staff'}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-neutral-800">
                              {order.items.reduce((sum, item) => sum + item.quantity, 0)} pcs
                            </span>
                            <div className="text-[10px] text-neutral-400 truncate max-w-[130px]">
                              {order.items[0]?.productName}
                              {order.items.length > 1 && ` +${order.items.length - 1} more`}
                            </div>
                          </td>

                          <td className="py-3 px-4 font-black font-mono text-neutral-900">
                            Rs. {order.total.toLocaleString('en-PK')}
                            {order.discount > 0 && (
                              <div className="text-[10px] text-emerald-600 font-normal">
                                Disc: -Rs. {order.discount}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-neutral-100 text-neutral-800">
                              {order.paymentMethod}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {isCancelled ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                                Voided
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Completed
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setCompletedOrder(order);
                                setIsReceiptModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-neutral-900 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                              title="Reprint original bill without recalculating"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>REPRINT BILL</span>
                            </button>

                            {!isCancelled && canVoidSale && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoidModalOrder(order);
                                  setVoidReason('');
                                }}
                                className="px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Void</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* RECEIPT / BILL MODAL                                                */}
      {/* =================================================================== */}
      {completedOrder && (
        <PosReceiptModal
          order={completedOrder}
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          onNewSale={() => {
            setIsReceiptModalOpen(false);
            setCompletedOrder(null);
            handleClearCart();
            setActiveTab('terminal');
          }}
        />
      )}

      {/* =================================================================== */}
      {/* VARIANT PICKER MODAL FOR PRODUCTS WITH MODELS / COLORS              */}
      {/* =================================================================== */}
      {variantModalProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-neutral-200 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden relative shrink-0">
                  <img
                    src={variantModalProduct.images?.[0] || '/placeholder.png'}
                    alt={variantModalProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-extrabold text-neutral-900 text-sm line-clamp-1">
                    {variantModalProduct.name}
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">
                    {(() => {
                      const selM = variantModalProduct.models?.find(
                        (m) => m.name === selectedVariantModel || m.id === selectedVariantModel
                      );
                      const price = selM ? Number(selM.price) : Number(variantModalProduct.price);
                      const stock = selM ? (selM.stock ?? variantModalProduct.stock) : variantModalProduct.stock;
                      return (
                        <>
                          <span className="font-bold text-neutral-900">Rs. {price.toLocaleString('en-PK')}</span>
                          {' • '}
                          <span className={stock > 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                            {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                          </span>
                        </>
                      );
                    })()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVariantModalProduct(null)}
                className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Model Selector */}
            {variantModalProduct.enableModelSelection &&
              Array.isArray(variantModalProduct.models) &&
              variantModalProduct.models.filter((m) => m.isActive !== false).length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                    <span>Select Model Variant *</span>
                    <span className="text-[11px] text-neutral-400 font-normal">{selectedVariantModel}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {variantModalProduct.models
                      .filter((m) => m.isActive !== false)
                      .map((m) => {
                        const isSel = selectedVariantModel === m.name;
                        const isOut = m.stock !== undefined && m.stock <= 0;
                        return (
                          <button
                            key={m.id || m.name}
                            type="button"
                            onClick={() => setSelectedVariantModel(m.name)}
                            className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                              isSel
                                ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs'
                                : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
                            } ${isOut ? 'opacity-50' : ''}`}
                          >
                            <div className="font-bold truncate">{m.name}</div>
                            <div className={`text-[10px] font-mono mt-0.5 ${isSel ? 'text-neutral-300' : 'text-neutral-500'}`}>
                              Rs. {Number(m.price).toLocaleString('en-PK')}
                              {isOut ? ' (Out)' : ''}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

            {/* Color Selector */}
            {(() => {
              const activeCols =
                (variantModalProduct.enableColorSelection &&
                  Array.isArray(variantModalProduct.colors) &&
                  variantModalProduct.colors.filter((c) => c.isActive !== false)) ||
                (Array.isArray(variantModalProduct.variants?.colors) && variantModalProduct.variants.colors) ||
                [];
              if (activeCols.length === 0) return null;
              return (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                    <span>Select Color</span>
                    <span className="text-[11px] text-neutral-400 font-normal">{selectedVariantColor}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeCols.map((c) => {
                      const isSel = selectedVariantColor === c.name;
                      const hasHex = c.hex && c.hex.startsWith('#');
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setSelectedVariantColor(c.name)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSel
                              ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs'
                              : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
                          }`}
                        >
                          {hasHex && (
                            <span
                              className="w-3 h-3 rounded-full border border-neutral-300 shrink-0"
                              style={{ backgroundColor: c.hex }}
                            />
                          )}
                          <span>{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setVariantModalProduct(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (variantModalProduct) {
                    addSpecificVariantToCart(
                      variantModalProduct,
                      selectedVariantModel || undefined,
                      selectedVariantColor || undefined
                    );
                  }
                }}
                className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Add to POS Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VOID SALE CONFIRMATION MODAL                                        */}
      {/* =================================================================== */}
      {voidModalOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-neutral-900 text-base">Void POS Sale</h3>
                <p className="text-xs text-neutral-500">
                  Invoice #{voidModalOrder.invoiceNumber} • Rs. {voidModalOrder.total.toLocaleString('en-PK')}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <p className="font-bold">Inventory Restoration Notice:</p>
              <p>
                Voiding this completed sale will automatically return{' '}
                <strong>
                  {voidModalOrder.items.reduce((s, i) => s + i.quantity, 0)} item(s)
                </strong>{' '}
                back to active store inventory and log an audit movement.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-neutral-800 block">Reason for Void *</label>
              <input
                type="text"
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Customer returned items, wrong barcode selected..."
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 text-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setVoidModalOrder(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVoiding || !voidReason.trim()}
                onClick={handleVoidSale}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isVoiding ? 'Voiding...' : 'Confirm & Restore Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
