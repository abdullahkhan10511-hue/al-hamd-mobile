'use client';

import React from 'react';
import { Order, BillSettings, BillFieldToggles } from '@/types/admin';
import { defaultBillFieldToggles } from '@/lib/db/billSettings';
import { formatPrice } from '@/lib/utils';

interface ThermalBillTemplateProps {
  order: Order;
  settings: BillSettings;
  overrideToggles?: BillFieldToggles;
  className?: string;
  id?: string;
}

export default function ThermalBillTemplate({
  order,
  settings,
  overrideToggles,
  className = '',
  id,
}: ThermalBillTemplateProps) {
  // Resolve toggles: prioritize format-specific thermalConfig, then overrideToggles, then defaultBillFieldToggles
  const toggles: BillFieldToggles = {
    ...defaultBillFieldToggles,
    ...(settings.thermalConfig || {}),
    ...(overrideToggles || {}),
  };

  const storeName = settings.storeName || 'AL-HAMD MOBILE ACCESSORIES';
  const storeLogo = settings.storeLogo;
  const storeAddress = settings.storeAddress || '';
  const storePhone = settings.phone || '';
  const website = settings.website || 'alhamd.pk';
  const taxNumber = settings.taxNumber || '';
  const footerMessage =
    toggles.footerMessage || settings.thermalConfig?.footerMessage || settings.thermalFooterNote || 'Thank You for Shopping!';

  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = orderDate.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Safe customer info resolution (no undefined or null)
  const isWholesale = order.customerType === 'WHOLESALE' || order.customerType === 'SUPER_WHOLESALE';
  const customerName = isWholesale
    ? (order.shopName || order.customer?.firstName || 'Valued Business Customer')
    : [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ').trim() || 'Walk-in Customer';

  const customerPhone = order.customer?.phone?.trim() || '';

  // Safe address resolution
  const addressParts = [
    order.shippingAddress?.street,
    order.shippingAddress?.city,
  ].filter((part) => part && typeof part === 'string' && part.trim() !== '' && !part.includes('undefined'));
  const customerAddress = addressParts.join(', ');

  return (
    <div
      id={id}
      className={`bg-white text-neutral-900 font-mono text-[11px] leading-tight mx-auto p-4 w-[80mm] max-w-[80mm] ${className}`}
      style={{
        width: '80mm',
        maxWidth: '80mm',
        margin: '0 auto',
        color: '#000000',
        background: '#ffffff',
        boxSizing: 'border-box',
      }}
    >
      {/* ===================================================================== */}
      {/* 1. HEADER                                                             */}
      {/* ===================================================================== */}
      <div className="text-center pb-2">
        {toggles.showLogo && storeLogo ? (
          <div className="mb-2 flex justify-center">
            <img
              src={storeLogo}
              alt={storeName}
              className="max-h-12 max-w-[140px] object-contain"
            />
          </div>
        ) : null}

        {toggles.showStoreName && (
          <div className="font-bold text-sm tracking-wider uppercase mb-1">
            {storeName}
          </div>
        )}

        {toggles.showStoreAddress && storeAddress && (
          <div className="text-[10px] leading-tight mb-1">
            {storeAddress}
          </div>
        )}

        {storePhone && (
          <div className="text-[10px]">
            TEL: {storePhone}
          </div>
        )}

        {taxNumber && (
          <div className="text-[10px] font-bold mt-0.5">
            NTN: {taxNumber}
          </div>
        )}
      </div>

      <div className="border-b border-dashed border-neutral-900 my-2"></div>

      {/* ===================================================================== */}
      {/* 2. CUSTOMER & ORDER INFORMATION                                       */}
      {/* ===================================================================== */}
      <div className="text-[10px] space-y-1">
        {toggles.showCustomerName && customerName && (
          <div className="flex justify-between">
            <span className="font-semibold">Customer:</span>
            <span className="font-bold text-right truncate max-w-[45mm]">{customerName}</span>
          </div>
        )}

        {toggles.showCustomerPhone && customerPhone && (
          <div className="flex justify-between">
            <span className="font-semibold">Phone:</span>
            <span>{customerPhone}</span>
          </div>
        )}

        {toggles.showCustomerAddress && customerAddress && (
          <div className="text-left pt-0.5 leading-tight">
            <span className="font-semibold">Address: </span>
            <span>{customerAddress}</span>
          </div>
        )}

        <div className="pt-1 border-t border-dashed border-neutral-300"></div>

        {toggles.showInvoiceNumber && (
          <div className="flex justify-between font-bold">
            <span>Bill/Invoice:</span>
            <span>{order.invoiceNumber || `#${order.id}`}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>Order No:</span>
          <span>#{order.id}</span>
        </div>

        {toggles.showDate && (
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{formattedDate}</span>
          </div>
        )}

        {toggles.showTime && (
          <div className="flex justify-between">
            <span>Time:</span>
            <span>{formattedTime}</span>
          </div>
        )}
      </div>

      <div className="border-b border-dashed border-neutral-900 my-2"></div>

      {/* ===================================================================== */}
      {/* 3. ITEMS TABLE (Proper text wrapping & aligned prices)                */}
      {/* ===================================================================== */}
      <table className="w-full text-left text-[10px] border-collapse">
        <thead>
          <tr className="border-b border-neutral-900 font-bold">
            <th className="py-1 pr-1 w-[44mm]">ITEM</th>
            <th className="py-1 text-center w-[10mm]">QTY</th>
            <th className="py-1 text-right w-[18mm]">PRICE</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {order.items.map((item, idx) => {
            const variantText = [item.selectedModel, item.selectedColor, item.selectedSize]
              .filter(Boolean)
              .join('/');

            return (
              <tr key={idx} className="align-top">
                <td className="py-1.5 pr-1 break-words">
                  <div className="font-bold leading-tight">{item.productName}</div>
                  {variantText && (
                    <div className="text-[9px] text-neutral-600 font-sans">{variantText}</div>
                  )}
                  {item.sku && (
                    <div className="text-[8px] text-neutral-500 font-sans">SKU: {item.sku}</div>
                  )}
                </td>
                <td className="py-1.5 text-center font-bold">
                  {item.quantity}
                </td>
                <td className="py-1.5 text-right font-bold whitespace-nowrap">
                  {formatPrice(item.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="border-b border-dashed border-neutral-900 my-2"></div>

      {/* ===================================================================== */}
      {/* 4. TOTALS                                                             */}
      {/* ===================================================================== */}
      <div className="space-y-1 text-[10px] font-mono">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>

        {order.discount !== undefined && order.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatPrice(order.discount)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>Shipping</span>
          <span>{order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}</span>
        </div>

        <div className="border-b border-neutral-900 my-1"></div>

        <div className="flex justify-between font-bold text-xs pt-0.5">
          <span>TOTAL:</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>

      {/* Payment info */}
      {toggles.showPaymentMethod && order.paymentMethod && (
        <div className="mt-2 pt-2 border-t border-dashed border-neutral-300 text-[10px] flex justify-between">
          <span>Payment:</span>
          <span className="font-bold uppercase">
            {order.paymentMethod} {order.paymentStatus ? `(${order.paymentStatus})` : ''}
          </span>
        </div>
      )}

      <div className="border-b border-dashed border-neutral-900 my-2"></div>

      {/* ===================================================================== */}
      {/* 5. FOOTER                                                             */}
      {/* ===================================================================== */}
      <div className="text-center pt-1 text-[10px] space-y-1">
        {toggles.showWebsite && website && (
          <div className="font-semibold">{website}</div>
        )}

        {toggles.showThankYou && footerMessage && (
          <div className="font-bold uppercase pt-1">
            {footerMessage}
          </div>
        )}
      </div>
    </div>
  );
}
