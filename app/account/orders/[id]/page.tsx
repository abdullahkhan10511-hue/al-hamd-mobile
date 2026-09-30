'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Calendar,
  CreditCard,
  Truck,
  MapPin,
  AlertCircle,
  Star,
} from 'lucide-react';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getCustomerOrderById } from '@/lib/db/customers';
import { Order } from '@/types/admin';
import { formatPrice } from '@/lib/utils';

export default function CustomerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params?.id as string) || '';

  const { customer, isAuthenticated, isLoading } = useCustomerAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !customer) {
      router.replace(`/login?redirect=/account/orders/${orderId}`);
      return;
    }

    const fetchOrder = async () => {
      setIsOrderLoading(true);
      try {
        const found = await getCustomerOrderById(customer.id, orderId);
        if (found) {
          setOrder(found);
          setAccessDenied(false);
        } else {
          setAccessDenied(true);
        }
      } catch (err) {
        console.error('Failed to load order', err);
        setAccessDenied(true);
      } finally {
        setIsOrderLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [customer, isAuthenticated, isLoading, orderId, router]);

  if (isLoading || isOrderLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-500 font-medium">Retrieving order details...</span>
        </div>
      </div>
    );
  }

  if (accessDenied || !order) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-950">Order Not Found or Access Denied</h2>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              We could not find order #{orderId} associated with your customer account. You can only view orders placed under your authenticated account.
            </p>
          </div>
          <Link
            href="/account"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-colors w-full"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Account</span>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'processing':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'confirmed':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50/60 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600 hover:text-neutral-950 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Orders</span>
          </Link>

          <span className="text-xs text-neutral-400">
            Invoice: <strong className="text-neutral-800 font-semibold">{order.invoiceNumber || order.id}</strong>
          </span>
        </div>

        {/* Order Header Card */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-neutral-950 tracking-tight">
                  Order #{order.id}
                </h1>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getStatusBadge(
                    order.status
                  )}`}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>
                  Placed on{' '}
                  {new Date(order.createdAt).toLocaleDateString('en-PK', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </p>
            </div>

            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block">
                Total Amount
              </span>
              <span className="text-2xl font-black text-neutral-950">
                {formatPrice(order.total)}
              </span>
            </div>
          </div>

          {/* Delivery & Payment Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Payment Method</span>
              </span>
              <p className="text-xs font-bold text-neutral-900 uppercase">
                {order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : order.paymentMethod}
              </p>
              <span className="text-[11px] font-medium text-neutral-500 block">
                Status:{' '}
                <strong
                  className={order.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}
                >
                  {order.paymentStatus}
                </strong>
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                <span>Shipping Method</span>
              </span>
              <p className="text-xs font-bold text-neutral-900 uppercase">
                {order.deliveryMethod === 'express' ? 'Express Courier (24-48h)' : 'Standard Delivery'}
              </p>
              <span className="text-[11px] font-medium text-neutral-500 block">
                Tracked shipping nationwide
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>Delivery Destination</span>
              </span>
              <p className="text-xs font-bold text-neutral-900 truncate">
                {order.shippingAddress?.street || 'N/A'}
              </p>
              <span className="text-[11px] font-medium text-neutral-500 block">
                {order.shippingAddress?.city}, {order.shippingAddress?.country || 'Pakistan'}
              </span>
            </div>
          </div>
        </div>

        {/* Order Items List */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-neutral-950 flex items-center gap-2">
            <Package className="w-4 h-4 text-neutral-700" />
            <span>Purchased Items ({order.items.length})</span>
          </h2>

          <div className="divide-y divide-neutral-100">
            {order.items.map((item, idx) => (
              <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200/80 overflow-hidden relative shrink-0">
                  {item.image && typeof item.image === 'string' && item.image.trim() ? (
                    <Image
                      src={item.image.trim()}
                      alt={item.productName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
                      No Img
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-neutral-900 truncate">
                    {item.productName}
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-0.5">
                    <span>SKU: {item.sku || 'N/A'}</span>
                    {item.selectedModel && <span>Model: {item.selectedModel}</span>}
                    {item.selectedColor && <span>Color: {item.selectedColor}</span>}
                    {item.selectedSize && <span>Size: {item.selectedSize}</span>}
                  </div>
                  <div className="text-xs text-neutral-700 font-semibold mt-1">
                    {formatPrice(item.price)} × {item.quantity}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-neutral-950 block">
                    {formatPrice(item.total || item.price * item.quantity)}
                  </span>
                  <Link
                    href={`/account?tab=reviews&reviewProductId=${item.productId}`}
                    className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-semibold mt-1 underline cursor-pointer"
                  >
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>Review Item</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Summary */}
          <div className="pt-6 border-t border-neutral-100 space-y-2 text-xs">
            <div className="flex justify-between text-neutral-500">
              <span>Subtotal</span>
              <span className="font-semibold text-neutral-800">{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span className="font-semibold">-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-neutral-500">
              <span>Shipping Fee</span>
              <span className="font-semibold text-neutral-800">
                {order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t border-neutral-200 text-sm font-black text-neutral-950">
              <span>Grand Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
