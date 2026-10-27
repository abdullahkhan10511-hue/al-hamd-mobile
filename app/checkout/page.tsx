'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Truck,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Banknote,
  Building2,
  Smartphone,
  MapPin,
  CreditCard,
  AlertTriangle,
  Copy,
  Check,
  Package,
  Tag,
  Edit,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { formatPrice, getValidImageSrc } from '@/lib/utils';
import { getProductEffectivePrice, getModelEffectivePrice } from '@/lib/wholesale';
import { createOrder } from '@/lib/db/orders';
import { Order, PaymentMethodConfig, PaymentSecuritySettings, PaymentStatus } from '@/types/admin';
import {
  getEnabledPaymentMethods,
  getPaymentSecuritySettings,
  seedPaymentSecuritySettings,
  seedPaymentMethods,
  syncPaymentMethodsFromApi,
} from '@/lib/db/paymentMethods';
import { subscribeToKey } from '@/lib/db/storage';

const PAKISTAN_PROVINCES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Gilgit-Baltistan',
  'Azad Jammu & Kashmir',
];

const POPULAR_CITIES = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
  'Bahawalpur',
  'Sargodha',
  'Abbottabad',
];

export default function CheckoutPage() {
  const {
    cart,
    subtotal,
    shipping,
    discount,
    clearCart,
    appliedPromo,
    applyPromoCode,
    removePromoCode,
    hasHydrated,
  } = useCart();
  const { customer, updateProfile } = useCustomerAuth();
  const isSuperWholesale = customer?.customerType === 'SUPER_WHOLESALE';
  const isWholesale = customer?.customerType === 'WHOLESALE';
  const isWholesaleTier = isWholesale || isSuperWholesale;
  const customerTier = isSuperWholesale ? 'SUPER_WHOLESALE' : isWholesale ? 'WHOLESALE' : 'RETAIL';

  // Promo Code State
  const [promoInput, setPromoInput] = useState('');
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  // Customer contact
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Pakistan address fields
  const [province, setProvince] = useState('Punjab');
  const [city, setCity] = useState('Lahore');
  const [area, setArea] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [postalCode, setPostalCode] = useState('54000');

  // Auto-populate customer details if logged in
  useEffect(() => {
    if (customer) {
      if (customer.email) setEmail(customer.email);
      if (customer.customerType === 'WHOLESALE' || customer.customerType === 'SUPER_WHOLESALE') {
        if (customer.shopName) {
          setFirstName(customer.shopName);
          setLastName('');
        }
        if (customer.phone) setPhone(customer.phone);
        if (customer.address) setStreetAddress(customer.address);
        if (customer.city) setCity(customer.city);
        if (customer.province) setProvince(customer.province);
        if (customer.postalCode) setPostalCode(customer.postalCode);
      } else {
        if (customer.firstName) setFirstName(customer.firstName);
        if (customer.lastName) setLastName(customer.lastName);
        if (customer.phone) setPhone(customer.phone);
        if (customer.address) setStreetAddress(customer.address);
        if (customer.city) setCity(customer.city);
        if (customer.province) setProvince(customer.province);
        if (customer.postalCode) setPostalCode(customer.postalCode);
      }
    }
  }, [customer]);


  // Wholesale details memory & editing state
  const [isEditingWholesaleDetails, setIsEditingWholesaleDetails] = useState(false);
  const hasSavedWholesaleInfo = Boolean(
    isWholesaleTier && customer?.shopName && (customer?.phone || phone) && (customer?.address || streetAddress)
  );

  // Logistics
  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard');

  // Dynamic Payment Methods from Database
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(() => {
    try {
      const enabled = getEnabledPaymentMethods();
      return enabled.length > 0 ? enabled : seedPaymentMethods.filter((m) => m.enabled);
    } catch {
      return seedPaymentMethods.filter((m) => m.enabled);
    }
  });
  const [selectedMethodId, setSelectedMethodId] = useState<string>('cod');
  const [paymentReference, setPaymentReference] = useState('');
  const [securitySettings, setSecuritySettings] = useState<PaymentSecuritySettings>(seedPaymentSecuritySettings);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Status & Confirmation
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Load & subscribe to payment configuration
  useEffect(() => {
    const syncPaymentData = () => {
      const enabled = getEnabledPaymentMethods();
      setPaymentMethods(enabled);
      if (enabled.length > 0) {
        setSelectedMethodId((prev) => {
          const match = enabled.find((m) => m.id === prev);
          return match ? prev : enabled[0].id;
        });
      }
      setSecuritySettings(getPaymentSecuritySettings());
    };

    syncPaymentData();
    syncPaymentMethodsFromApi().then(() => syncPaymentData()).catch(() => {});

    const unsubMethods = subscribeToKey('payment_methods', syncPaymentData);
    const unsubSec = subscribeToKey('payment_security_settings', syncPaymentData);

    return () => {
      unsubMethods();
      unsubSec();
    };
  }, []);

  // In PKR: standard is from CartContext (free over 5000 or 200), express is 450
  const expressFee = 450;
  const shippingCost = deliveryMethod === 'express' ? expressFee : shipping;
  const grandTotal = Math.max(0, Math.round(subtotal - discount + shippingCost));

  // Selected payment method config
  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId) || paymentMethods[0];

  // Normalize Pakistani phone number to +92 format or 03XXXXXXXXX
  const normalizePhone = (raw: string): string => {
    const cleaned = raw.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('03')) {
      return '+92' + cleaned.substring(1);
    }
    if (cleaned.startsWith('923')) {
      return '+' + cleaned;
    }
    return cleaned;
  };

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    }
  };

  const renderMethodIcon = (id: string) => {
    if (id === 'cod') {
      return <Banknote className="w-5 h-5 text-neutral-900" />;
    }
    if (id === 'card') {
      return <CreditCard className="w-5 h-5 text-neutral-900" />;
    }
    if (id === 'easypaisa') {
      return (
        <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] tracking-tight shrink-0">
          EP
        </div>
      );
    }
    if (id === 'jazzcash') {
      return (
        <div className="w-6 h-6 rounded-md bg-rose-600 text-white flex items-center justify-center font-bold text-[10px] tracking-tight shrink-0">
          JC
        </div>
      );
    }
    return <Smartphone className="w-5 h-5 text-neutral-900" />;
  };

  const handleCheckoutApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setIsCheckingPromo(true);
    setPromoFeedback(null);
    const result = await applyPromoCode(promoInput, {
      email: email.trim(),
      phone: phone.trim(),
      id: customer?.id,
    });
    setIsCheckingPromo(false);
    if (result.success) {
      setPromoFeedback({ text: result.message, isError: false });
      setPromoInput('');
    } else {
      setPromoFeedback({ text: result.message, isError: true });
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    setOrderError('');

    if (isWholesaleTier) {
      if (!phone.trim() || !streetAddress.trim()) {
        setOrderError('Please provide your shop contact phone number and delivery address.');
        return;
      }
    } else {
      if (!firstName.trim() || !lastName.trim() || !streetAddress.trim() || !city.trim() || !phone.trim()) {
        setOrderError('Please fill in all required delivery and contact fields.');
        return;
      }
    }

    if (cart.length === 0) {
      setOrderError('Your cart is empty.');
      return;
    }

    if (!selectedMethod) {
      setOrderError('Please select a payment method.');
      return;
    }

    // Security check: Card gateway unconfigured
    if (selectedMethod.id === 'card' && !selectedMethod.isConfigured) {
      setOrderError(
        selectedMethod.warningMessage ||
        'Online Credit/Debit card gateway is currently undergoing official banking PCI-DSS certification in Pakistan. Please select Cash on Delivery, Easypaisa, or JazzCash for immediate order dispatch.'
      );
      return;
    }

    // Wallet TID requirement check
    if (selectedMethod.requiresReference) {
      const ref = paymentReference.trim();
      if (!ref) {
        setOrderError(
          selectedMethod.referenceValidationMessage ||
          `Please enter your ${selectedMethod.name} Transaction ID (TID) / Payment Reference from your SMS before placing the order.`
        );
        return;
      }
      if (selectedMethod.minReferenceLength && ref.length < selectedMethod.minReferenceLength) {
        setOrderError(
          selectedMethod.referenceValidationMessage ||
          `${selectedMethod.name} Transaction ID must be at least ${selectedMethod.minReferenceLength} digits.`
        );
        return;
      }
      if (selectedMethod.maxReferenceLength && ref.length > selectedMethod.maxReferenceLength) {
        setOrderError(
          selectedMethod.referenceValidationMessage ||
          `${selectedMethod.name} Transaction ID must not exceed ${selectedMethod.maxReferenceLength} digits.`
        );
        return;
      }
    }

    setIsProcessing(true);

    try {
      const formattedPhone = normalizePhone(phone);
      const fullAddress = `${streetAddress}${area ? `, ${area}` : ''}, ${province}`;
      const customerTier = isSuperWholesale ? 'SUPER_WHOLESALE' : isWholesale ? 'WHOLESALE' : 'RETAIL';

      // Map cart items into OrderItem format using authorized effective pricing
      const orderItems = cart.map((ci) => {
        if (ci.itemType === 'DEAL') {
          const dealUnitPrice = Number(ci.dealPrice ?? ci.selectedPrice ?? ci.product?.price ?? 0);
          const lineTotal = dealUnitPrice * ci.quantity;
          const validImage = ci.selectedImage || getValidImageSrc(ci.product?.images);
          return {
            productId: ci.productId || `deal-${ci.dealId}`,
            productName: ci.dealName || ci.product?.name || 'Bundle Deal',
            slug: ci.product?.slug || `deal-${ci.dealId}`,
            sku: `DEAL-${(ci.dealId || ci.productId).replace(/^deal-/, '').slice(0, 8)}`,
            price: dealUnitPrice,
            originalPrice: ci.dealOriginalPrice ? Number(ci.dealOriginalPrice) : dealUnitPrice,
            quantity: ci.quantity,
            selectedSize: undefined,
            selectedColor: undefined,
            selectedModel: undefined,
            image: validImage || 'https://via.placeholder.com/200',
            total: lineTotal,
            itemType: 'DEAL' as const,
            dealId: ci.dealId || ci.productId.replace(/^deal-/, ''),
            dealName: ci.dealName || ci.product?.name,
            dealPrice: dealUnitPrice,
            dealProducts: ci.dealProducts || [],
          };
        }

        const modelObj =
          ci.selectedModel && ci.product?.models
            ? ci.product.models.find(
                (m) =>
                  m.name.toLowerCase() === ci.selectedModel?.toLowerCase() ||
                  m.id === ci.selectedModel
              )
            : null;

        const effectivePrice = modelObj
          ? getModelEffectivePrice(ci.product, modelObj, customerTier)
          : (ci.selectedPrice ?? getProductEffectivePrice(ci.product, customerTier));

        const lineTotal = effectivePrice * ci.quantity;
        const validImage =
          ci.selectedImage ||
          (modelObj?.images && modelObj.images.length > 0 ? getValidImageSrc(modelObj.images) : undefined) ||
          getValidImageSrc(ci.product?.images);

        return {
          productId: ci.product.id,
          productName: ci.product.name,
          slug: ci.product.slug,
          sku: modelObj?.sku || (ci.product as any).sku || `SKU-${ci.product.id}`,
          price: effectivePrice,
          originalPrice: effectivePrice,
          quantity: ci.quantity,
          selectedSize: ci.selectedSize,
          selectedColor: ci.selectedColor,
          selectedModel: ci.selectedModel,
          image: validImage || 'https://via.placeholder.com/200',
          total: lineTotal,
          itemType: 'PRODUCT' as const,
        };
      });

      // Determine initial PaymentStatus according to requirements
      let initialPaymentStatus: PaymentStatus = 'Pending';
      if (selectedMethod.type === 'wallet') {
        initialPaymentStatus = 'Awaiting Verification';
      } else if (selectedMethod.id === 'cod') {
        initialPaymentStatus = 'Pending';
      }

      // Persist real order in database with PKR currency & unique ORD-2026 ID
      const newOrder = await createOrder({
        orderType: isSuperWholesale ? 'super_wholesale' : isWholesale ? 'wholesale' : 'online',
        customerType: isSuperWholesale ? 'SUPER_WHOLESALE' : isWholesale ? 'WHOLESALE' : 'RETAIL',
        shopName: isWholesaleTier ? customer?.shopName : undefined,
        wholesaleAccountId: isWholesaleTier ? customer?.id : undefined,
        customer: {
          id: customer?.id,
          firstName: isWholesaleTier ? (customer?.shopName || 'Shop') : firstName.trim(),
          lastName: isWholesaleTier ? '' : lastName.trim(),
          email: isWholesaleTier
            ? (email.trim() || customer?.email || undefined)
            : (email.trim() || customer?.email || 'customer@alhamd-mobile.com'),
          phone: formattedPhone,
        },
        shippingAddress: {
          street: fullAddress,
          city: city.trim() || 'Islamabad',
          postalCode: postalCode.trim() || '54000',
          country: 'Pakistan',
        },
        items: orderItems,
        subtotal: Math.round(subtotal),
        discount: Math.round(discount),
        shipping: Math.round(shippingCost),
        tax: 0,
        total: grandTotal,
        currency: 'PKR',
        deliveryMethod,
        paymentMethod: selectedMethod?.name || 'Cash on Delivery',
        paymentMethodId: selectedMethod?.id || 'cod',
        paymentStatus: initialPaymentStatus,
        paymentReference: selectedMethod?.requiresReference ? paymentReference.trim() : undefined,
        status: 'Confirmed',
        notes: paymentReference ? `Payment Ref: ${paymentReference.trim()}` : undefined,
        orderSource: 'ONLINE',
        promoCode: appliedPromo ? appliedPromo.code : undefined,
        promoDiscountAmount: appliedPromo ? Math.round(discount) : undefined,
        promoDiscountType: appliedPromo ? appliedPromo.discountType : undefined,
        promoDiscountValue: appliedPromo ? appliedPromo.discountValue : undefined,
        promoDetails: appliedPromo ? appliedPromo : undefined,
      });

      // Save / update wholesale customer profile for future instant checkout
      if (isWholesaleTier && customer) {
        try {
          await updateProfile({
            phone: formattedPhone,
            address: streetAddress.trim(),
            city: city.trim(),
            province,
            postalCode,
          });
        } catch (profileErr) {
          console.warn('Could not auto-save wholesale customer profile:', profileErr);
        }
      }

      setCreatedOrder(newOrder);
      clearCart();
    } catch (err: any) {
      console.error('Order confirmation error:', err);
      setOrderError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to confirm your order. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (createdOrder) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12 sm:py-20 flex items-center justify-center">
        <div className="max-w-xl w-full mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-neutral-200/80 text-center"
          >
            {/* Subtle animated success badge */}
            <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-100/70 animate-ping opacity-25" />
              <div className="relative w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500/20 text-emerald-600 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
              </div>
            </div>

            {/* Impressive Thank You Message & Status */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold tracking-wider uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Order Placed Successfully
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight leading-snug">
              Thank You for Your Order!
            </h1>

            <p className="text-sm sm:text-base text-neutral-600 mt-4 leading-relaxed font-normal px-1 sm:px-3">
              &ldquo;Thank you for choosing AL-HAMD SHOP. We truly appreciate your trust and support. Your order has been received successfully, and we&apos;re grateful for the opportunity to serve you. We look forward to making your shopping experience wonderful!&rdquo;
            </p>

            {/* Clear Order Reference Card */}
            <div className="mt-8 mb-8 p-5 sm:p-6 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 text-left space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-200/70">
                <span className="text-neutral-500 text-xs font-medium">Order Number:</span>
                <span className="font-mono font-extrabold text-base sm:text-lg text-neutral-950 tracking-tight">
                  #{createdOrder.id}
                </span>
              </div>

              {createdOrder.invoiceNumber && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500">Invoice Number:</span>
                  <span className="font-mono font-semibold text-neutral-800">{createdOrder.invoiceNumber}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500">Order Status:</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Confirmed
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500">Payment Method:</span>
                <span className="font-semibold text-neutral-900">{createdOrder.paymentMethod}</span>
              </div>

              {createdOrder.paymentReference && (
                <div className="flex justify-between items-center text-xs pt-1 border-t border-neutral-200/60">
                  <span className="text-neutral-500">Payment Reference (TID):</span>
                  <span className="font-mono font-bold text-neutral-950">{createdOrder.paymentReference}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-neutral-200/70">
                <span className="text-neutral-600 text-xs font-semibold">Total Amount:</span>
                <span className="font-mono font-extrabold text-lg text-emerald-600">
                  {formatPrice(createdOrder.total)}
                </span>
              </div>
            </div>

            {/* Customer notification notice */}
            {createdOrder.customer?.phone && (
              <p className="text-xs text-neutral-500 mb-6">
                A confirmation has also been dispatched to{' '}
                <strong className="text-neutral-800 font-semibold">{createdOrder.customer.phone}</strong>.
              </p>
            )}

            {/* Single Primary Action: Continue Shopping */}
            <div className="max-w-sm mx-auto">
              <Link
                href="/shop"
                className="w-full py-4 px-8 rounded-full bg-neutral-950 hover:bg-neutral-800 active:scale-[0.99] text-white font-bold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!hasHydrated) {
    return (
      <div className="bg-neutral-50 min-h-screen py-24 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-neutral-900 border-t-transparent animate-spin" />
          <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">
            Loading Checkout...
          </span>
        </div>
      </div>
    );
  }

  if (hasHydrated && cart.length === 0 && !createdOrder) {
    return (
      <div className="bg-neutral-50 min-h-screen py-20 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8 sm:p-10 bg-white rounded-3xl border border-neutral-200/80 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Package className="w-8 h-8 stroke-1" />
          </div>
          <h2 className="text-xl font-extrabold text-neutral-950 mb-2">Your Shopping Bag is Empty</h2>
          <p className="text-xs text-neutral-500 mb-6">
            There are no items in your cart. Add products to your bag or click Buy It Now to proceed with checkout.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-neutral-950 text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors shadow-sm"
          >
            Explore Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 min-h-screen py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-neutral-950 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Shopping Bag</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>Encrypted Secure Checkout • Pakistan Nationwide</span>
          </div>
        </div>

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Form: Customer & Delivery Details */}
          <div className="lg:col-span-7 space-y-6">
            {isWholesaleTier ? (
              hasSavedWholesaleInfo && !isEditingWholesaleDetails ? (
                /* SAVED WHOLESALE DETAILS CARD (REPEAT ORDERS) */
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-neutral-950 text-white flex items-center justify-center shadow-xs">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-neutral-950">
                          {isSuperWholesale ? 'Super Wholesale Account Details' : 'Wholesale Account Details'}
                        </h2>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Saved Information
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="checkout-edit-wholesale-details-btn"
                      onClick={() => setIsEditingWholesaleDetails(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 text-neutral-800 text-xs font-bold hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60">
                      <span className="text-neutral-500 font-semibold">Shop:</span>
                      <span className="font-bold text-neutral-950 text-sm">{customer?.shopName || firstName}</span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60">
                      <span className="text-neutral-500 font-semibold">Phone:</span>
                      <span className="font-mono font-bold text-neutral-900">{customer?.phone || phone}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-neutral-500 font-semibold shrink-0 mr-4">Address:</span>
                      <span className="font-medium text-neutral-900 text-right">
                        {streetAddress}{area ? `, ${area}` : ''}, {city}, {province}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-400">
                    Your wholesale order will be dispatched to this destination. Click &quot;Edit Details&quot; to update your phone number or shipping destination.
                  </p>
                </div>
              ) : (
                /* FIRST WHOLESALE ORDER or EDITING SAVED DETAILS */
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-neutral-950 text-white flex items-center justify-center shadow-xs">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-neutral-950">
                          {isSuperWholesale
                            ? (isEditingWholesaleDetails ? 'Edit Super Wholesale Details' : 'Super Wholesale Customer Information')
                            : (isEditingWholesaleDetails ? 'Edit Wholesale Details' : 'Wholesale Customer Information')}
                        </h2>
                        <span className="text-[10px] font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {isSuperWholesale ? 'Super Wholesale Partner' : 'Wholesale Partner'}
                        </span>
                      </div>
                    </div>
                    {isEditingWholesaleDetails && hasSavedWholesaleInfo && (
                      <button
                        type="button"
                        onClick={() => setIsEditingWholesaleDetails(false)}
                        className="text-xs font-bold text-neutral-600 hover:text-neutral-950 transition-colors cursor-pointer underline"
                      >
                        Keep Existing Details
                      </button>
                    )}
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Shop Name (Locked to Account Identity) */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Shop Name <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        disabled
                        readOnly
                        value={customer?.shopName || firstName}
                        className="w-full px-4 py-3 bg-neutral-100 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 font-bold cursor-not-allowed select-none"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Locked to your authenticated wholesale account identity.
                      </p>
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Phone Number (WhatsApp / Calling) <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3 text-xs font-bold text-neutral-500">
                          PK (+92)
                        </span>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0300 1234567"
                          className="w-full pl-20 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 font-mono"
                        />
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                          Province / Region *
                        </label>
                        <select
                          value={province}
                          onChange={(e) => setProvince(e.target.value)}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer"
                        >
                          {PAKISTAN_PROVINCES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="e.g. Lahore, Islamabad"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                          Shop Street / Market Address *
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={streetAddress}
                          onChange={(e) => setStreetAddress(e.target.value)}
                          placeholder="Shop No., Market / Plaza name, Area, City"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70 text-[11px] text-neutral-500">
                      Your phone and address will be saved to your {isSuperWholesale ? 'super wholesale' : 'wholesale'} account automatically for faster repeat orders.
                    </div>
                  </div>
                </div>
              )
            ) : (
              /* 1. Contact Information & 2. Delivery Address for Retail Customers */
              <>
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-bold text-neutral-950">
                      1. Contact Information
                    </h2>
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Pakistan (+92)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Hamza"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Khan"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Phone Number (WhatsApp / Calling) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3 text-xs font-bold text-neutral-500">
                          PK (+92)
                        </span>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0300 1234567"
                          className="w-full pl-20 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                        />
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Courier riders will contact this phone number before delivery.
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Email Address (optional)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="customer@example.com"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-bold text-neutral-950">
                      2. Delivery Address
                    </h2>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Nationwide Pakistan Courier</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Province / Region *
                      </label>
                      <select
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer"
                      >
                        {PAKISTAN_PROVINCES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Lahore, Karachi, Islamabad"
                        list="city-suggestions"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                      <datalist id="city-suggestions">
                        {POPULAR_CITIES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Area / Locality / Sector *
                      </label>
                      <input
                        type="text"
                        required
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder="e.g. DHA Phase 5, Gulberg III, Clifton Block 2, F-8/2"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Complete House / Street Address *
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        placeholder="House / Flat No., Street No., Building name, Nearest landmark"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="e.g. 54000"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Country
                      </label>
                      <input
                        type="text"
                        disabled
                        value="Pakistan (Nationwide)"
                        className="w-full px-4 py-3 bg-neutral-100 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-500 font-semibold cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 3. Delivery Method */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-neutral-950">
                3. Shipping & Delivery
              </h2>
              <div className="space-y-3">
                <label
                  onClick={() => setDeliveryMethod('standard')}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    deliveryMethod === 'standard'
                      ? 'border-neutral-950 bg-neutral-50/50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        deliveryMethod === 'standard'
                          ? 'border-neutral-950'
                          : 'border-neutral-300'
                      }`}
                    >
                      {deliveryMethod === 'standard' && (
                        <div className="w-2 h-2 rounded-full bg-neutral-950" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-neutral-900">
                        Standard Courier Delivery
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        TCS / Leopard / Call Courier (3 to 5 business days)
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-neutral-900">
                    {shipping === 0 ? (
                      <span className="text-emerald-700">FREE</span>
                    ) : (
                      formatPrice(shipping)
                    )}
                  </span>
                </label>

                <label
                  onClick={() => setDeliveryMethod('express')}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    deliveryMethod === 'express'
                      ? 'border-neutral-950 bg-neutral-50/50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        deliveryMethod === 'express'
                          ? 'border-neutral-950'
                          : 'border-neutral-300'
                      }`}
                    >
                      {deliveryMethod === 'express' && (
                        <div className="w-2 h-2 rounded-full bg-neutral-950" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-neutral-900">
                        Express Delivery
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-neutral-900">
                    {formatPrice(expressFee)}
                  </span>
                </label>
              </div>
            </div>

            {/* 4. Pakistan Payment Methods (Dynamic & Admin Managed) */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-neutral-950">
                  {securitySettings.sectionHeading || '4. Choose Payment Method'}
                </h2>
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {securitySettings.securitySubheading || '100% Secure Checkout'}
                </span>
              </div>

              {securitySettings.generalInstructions && (
                <div className="text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-200/60 leading-relaxed whitespace-pre-line">
                  {securitySettings.generalInstructions}
                </div>
              )}

              {paymentMethods.length === 0 ? (
                <div className="p-4 rounded-xl bg-neutral-50 text-neutral-500 text-xs text-center">
                  Loading available payment methods...
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Selectable Radio Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {paymentMethods.map((m) => {
                      const isSelected = selectedMethodId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedMethodId(m.id);
                            setPaymentReference('');
                          }}
                          className={`p-4 text-left rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 relative ${
                            isSelected
                              ? 'border-neutral-950 bg-neutral-50/70 shadow-xs'
                              : 'border-neutral-200 hover:border-neutral-300 bg-white'
                          }`}
                        >
                          <div className="mt-0.5">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-neutral-950' : 'border-neutral-300'
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-neutral-950" />}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5 mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                {renderMethodIcon(m.id)}
                                <span className="text-xs font-bold text-neutral-950 truncate">{m.name}</span>
                              </div>
                              {m.badgeText && (
                                <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-neutral-200/80 text-neutral-700 shrink-0 uppercase font-mono">
                                  {m.badgeText}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 leading-snug line-clamp-2">
                              {m.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Expandable Payment Information Panel */}
                  <AnimatePresence mode="wait">
                    {selectedMethod && (
                      <motion.div
                        key={selectedMethod.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="mt-4 p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-neutral-200/70 pb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                            {selectedMethod.detailsHeading || `Payment Details: ${selectedMethod.name}`}
                          </span>
                          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest font-mono">
                            {selectedMethod.type === 'cod'
                              ? 'Cash Handover'
                              : selectedMethod.type === 'card'
                              ? 'Bank Gateway'
                              : 'Mobile Wallet'}
                          </span>
                        </div>

                        {/* Admin Configured Description & Instructions */}
                        <div className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-neutral-200/80">
                          {selectedMethod.description && (
                            <p className="font-semibold text-neutral-900 mb-1">{selectedMethod.description}</p>
                          )}
                          <p className="text-neutral-600">{selectedMethod.instructions}</p>
                        </div>

                        {/* Configured Warning or Unconfigured Card Gateway Notice */}
                        {(selectedMethod.warningMessage || (selectedMethod.id === 'card' && !selectedMethod.isConfigured)) && (
                          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">
                                {selectedMethod.warningHeading || 'Notice'}
                              </p>
                              <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed whitespace-pre-line">
                                {selectedMethod.warningMessage ||
                                  'Direct credit/debit card processing is currently undergoing banking PCI-DSS integration with State Bank of Pakistan compliant gateways. To place your order immediately, please select Cash on Delivery, Easypaisa, or JazzCash.'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Informational Message if configured */}
                        {selectedMethod.infoMessage && (
                          <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-900">
                            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] leading-relaxed whitespace-pre-line">
                              {selectedMethod.infoMessage}
                            </p>
                          </div>
                        )}

                        {/* Official Payment Account Label */}
                        {(selectedMethod.merchantName || selectedMethod.merchantIdentifier) && (
                          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                                {selectedMethod.accountSectionHeading || 'Official Payment Account'}
                              </span>
                              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                Verified Store Account
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                              {selectedMethod.merchantName && (
                                <div className="bg-white p-3 rounded-lg border border-emerald-200/60">
                                  <span className="text-[10px] font-sans uppercase font-bold text-neutral-500 block mb-0.5">
                                    {selectedMethod.accountNameLabel || 'Account / Business Name'}
                                  </span>
                                  <span className="font-bold text-neutral-900 text-xs">
                                    {selectedMethod.merchantName}
                                  </span>
                                </div>
                              )}

                              {selectedMethod.merchantIdentifier && (
                                <div className="bg-white p-3 rounded-lg border border-emerald-200/60 flex items-center justify-between">
                                  <div>
                                    <span className="text-[10px] font-sans uppercase font-bold text-neutral-500 block mb-0.5">
                                      {selectedMethod.accountNumberLabel || 'Official Payment Number / ID'}
                                    </span>
                                    <span className="font-bold text-neutral-900 text-xs">
                                      {selectedMethod.merchantIdentifier}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(selectedMethod.merchantIdentifier!, 'acc')}
                                    className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                                    title="Copy Account Number"
                                  >
                                    {copiedText === 'acc' ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>

                            {selectedMethod.accountHelpText && (
                              <p className="text-[11px] text-emerald-900/80 font-sans whitespace-pre-line">
                                {selectedMethod.accountHelpText}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Customer Transaction Reference Input */}
                        {selectedMethod.requiresReference && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-semibold text-neutral-800">
                                {selectedMethod.referenceLabel || 'Payment Reference / Transaction ID (TID) *'}
                              </label>
                              <span className="text-[10px] font-mono text-neutral-500">
                                {selectedMethod.referenceFormat || 'Required for verification'}
                              </span>
                            </div>
                            <input
                              type="text"
                              required
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                              placeholder={
                                selectedMethod.referencePlaceholder ||
                                selectedMethod.referenceFormat ||
                                'e.g. TID: 109823019'
                              }
                              className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:border-neutral-950"
                            />
                            {selectedMethod.referenceHelpText && (
                              <p className="text-[11px] text-neutral-500 whitespace-pre-line">
                                {selectedMethod.referenceHelpText}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Anti-Scam / Anti-Fraud Notice */}
                        {securitySettings.securityNotice && (
                          <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-200/80 flex items-start gap-2.5 text-[11px] text-neutral-600 leading-relaxed">
                            <Lock className="w-3.5 h-3.5 text-neutral-700 shrink-0 mt-0.5" />
                            <p className="whitespace-pre-line">{securitySettings.securityNotice}</p>
                          </div>
                        )}

                        {/* Custom Informational Blocks */}
                        {Array.isArray(securitySettings.customInfoBlocks) &&
                          securitySettings.customInfoBlocks.filter((b) => b.enabled).length > 0 && (
                            <div className="space-y-2 pt-1 border-t border-neutral-200/70">
                              {securitySettings.customInfoBlocks
                                .filter((b) => b.enabled)
                                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                                .map((block) => {
                                  const isWarn = block.type === 'warning';
                                  const isSec = block.type === 'security';
                                  return (
                                    <div
                                      key={block.id}
                                      className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                                        isWarn
                                          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                                          : isSec
                                          ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                                          : 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                                      }`}
                                    >
                                      {isWarn ? (
                                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                      ) : isSec ? (
                                        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                      ) : (
                                        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                      )}
                                      <div>
                                        <p className="font-bold text-xs">{block.title}</p>
                                        <p className="text-[11px] mt-0.5 leading-relaxed opacity-90 whitespace-pre-line">
                                          {block.content}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Right Summary Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                <h3 className="text-base font-bold text-neutral-950">Order Summary</h3>
                <span className="text-xs font-semibold text-neutral-500 font-mono">
                  {cart.length} item{cart.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Cart items preview */}
              <div className="max-h-72 overflow-y-auto space-y-3.5 pr-1 divide-y divide-neutral-100">
                {cart.map((ci) => {
                  const isDeal = ci.itemType === 'DEAL';
                  let effectivePrice: number;

                  if (isDeal) {
                    effectivePrice = Number(ci.dealPrice ?? ci.selectedPrice ?? ci.product?.price ?? 0);
                  } else {
                    const modelObj =
                      ci.selectedModel && ci.product?.models
                        ? ci.product.models.find(
                            (m) =>
                              m.name.toLowerCase() === ci.selectedModel?.toLowerCase() ||
                              m.id === ci.selectedModel
                          )
                        : null;
                    effectivePrice = modelObj
                      ? getModelEffectivePrice(ci.product, modelObj, customerTier)
                      : (ci.selectedPrice ?? getProductEffectivePrice(ci.product, customerTier));
                  }

                  const lineTotal = effectivePrice * ci.quantity;
                  const validImage = ci.selectedImage || getValidImageSrc(ci.product?.images);
                  const itemName = isDeal ? (ci.dealName || ci.product?.name) : ci.product?.name;

                  return (
                    <div key={ci.id} className="pt-3.5 first:pt-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200/60 flex items-center justify-center">
                          {validImage ? (
                            <img
                              src={validImage}
                              alt={itemName || 'Product'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 stroke-1 text-neutral-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          {isDeal && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-400 text-neutral-950 uppercase tracking-wider mb-0.5">
                              Bundle Deal
                            </span>
                          )}
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {itemName}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            Qty: {ci.quantity}
                            {ci.selectedModel ? ` • ${ci.selectedModel}` : ''}
                            {ci.selectedColor ? ` • ${ci.selectedColor}` : ''}
                            {ci.selectedSize ? ` • ${ci.selectedSize}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-neutral-950">
                          {formatPrice(lineTotal)}
                        </span>
                        <p className="text-[10px] text-neutral-400 font-mono">
                          {formatPrice(effectivePrice)} ea
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* PROMO CODE SECTION */}
              <div className="pt-4 border-t border-neutral-100 space-y-2">
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                  PROMO CODE
                </span>
                {!appliedPromo ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => {
                            setPromoInput(e.target.value.toUpperCase());
                            setPromoFeedback(null);
                          }}
                          placeholder="Enter promo code"
                          className="w-full pl-9 pr-3 py-2 text-xs uppercase font-mono font-semibold rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder:normal-case placeholder:font-sans placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCheckoutApplyPromo}
                        disabled={isCheckingPromo || !promoInput.trim()}
                        className="px-4 py-2 bg-neutral-950 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                      >
                        {isCheckingPromo ? 'Validating...' : 'APPLY'}
                      </button>
                    </div>
                    {promoFeedback && (
                      <p
                        className={`text-[11px] pl-1 font-medium ${
                          promoFeedback.isError ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {promoFeedback.text}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold uppercase font-mono text-emerald-950">
                          Promo Applied: {appliedPromo.code}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          {appliedPromo.discountType === 'percentage'
                            ? `${appliedPromo.discountValue}% OFF`
                            : 'Fixed'}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-emerald-800 mt-0.5">
                        Discount: -Rs. {discount.toLocaleString('en-PK')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removePromoCode();
                        setPromoFeedback({ text: 'Promo code removed.', isError: false });
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                    >
                      REMOVE CODE
                    </button>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-2.5 text-xs text-neutral-600 pt-4 border-t border-neutral-100">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-neutral-950 font-semibold">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount {appliedPromo ? `(${appliedPromo.code})` : ''}</span>
                    <span className="font-mono">-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery ({deliveryMethod === 'express' ? 'Express' : 'Standard'})</span>
                  <span className="font-mono text-neutral-950 font-semibold">
                    {shippingCost === 0 ? <span className="text-emerald-700 uppercase text-[11px]">Free</span> : formatPrice(shippingCost)}
                  </span>
                </div>
                <div className="pt-3 border-t border-neutral-200 flex justify-between text-base font-extrabold text-neutral-950">
                  <span>Total (PKR)</span>
                  <span className="font-mono text-lg">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Error Message if any */}
              {orderError && (
                <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}

              <button
                type="submit"
                id="checkout-confirm-place-order-btn"
                disabled={isProcessing || cart.length === 0}
                className="w-full py-4 px-6 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isProcessing
                  ? 'Confirming...'
                  : isWholesale
                  ? `Confirm & Place Order • ${formatPrice(grandTotal)}`
                  : `Confirm Order • ${formatPrice(grandTotal)}`}
              </button>

              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center gap-2.5 text-[11px] text-neutral-500">
                <Truck className="w-4 h-4 text-neutral-700 shrink-0" />
                <span>Orders placed across Pakistan are dispatched same-day or next working morning.</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
