'use client';

import React from 'react';
import { Order, BillSettings, BillFieldToggles, ThermalPaperWidth } from '@/types/admin';
import { defaultBillFieldToggles } from '@/lib/db/billSettings';
import { formatPrice } from '@/lib/utils';
import { resolveThermalWidth } from '@/lib/utils/thermalWidth';

interface ThermalBillTemplateProps {
  order: Order;
  settings: BillSettings;
  overrideToggles?: BillFieldToggles;
  paperWidth?: ThermalPaperWidth | string;
  customWidth?: number;
  className?: string;
  id?: string;
}

export default function ThermalBillTemplate({
  order,
  settings,
  overrideToggles,
  paperWidth,
  customWidth,
  className = '',
  id,
}: ThermalBillTemplateProps) {
  // Resolve toggles: prioritize format-specific thermalConfig, then overrideToggles, then defaultBillFieldToggles
  const toggles: BillFieldToggles = {
    ...defaultBillFieldToggles,
    ...(settings.thermalConfig || {}),
    ...(overrideToggles || {}),
  };

  // Resolve responsive paper width
  const selectedPaperWidth =
    paperWidth ||
    overrideToggles?.thermalPaperWidth ||
    settings.thermalPaperWidth ||
    settings.thermalConfig?.thermalPaperWidth;
  const selectedCustomWidth =
    customWidth ??
    overrideToggles?.thermalCustomWidth ??
    settings.thermalCustomWidth ??
    settings.thermalConfig?.thermalCustomWidth;

  const resolved = resolveThermalWidth(selectedPaperWidth, selectedCustomWidth);

  const storeName = settings.storeName || 'AL-HAMD MOBILE ACCESSORIES';
  const storeLogo = settings.storeLogo;
  const storeAddress = settings.storeAddress || '';
  const storePhone = settings.phone || '';
  const website = settings.website || 'alhamdshop.com';
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
      className={`bg-white text-neutral-900 font-mono text-[11px] leading-tight mx-auto ${resolved.isNarrow ? 'p-2' : 'p-3 sm:p-4'
        } ${className}`}
      style={{
        width: resolved.widthCss,
        maxWidth: resolved.widthCss,
        margin: '0 auto',
        color: '#000000',
        background: '#ffffff',
        boxSizing: 'border-box',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
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
              className="max-h-12 max-w-[80%] object-contain mx-auto"
            />
          </div>
        ) : null}

        {toggles.showStoreName && (
          <div className="font-bold text-xs sm:text-sm tracking-wider uppercase mb-1 break-words">
            {storeName}
          </div>
        )}

        {toggles.showStoreAddress && storeAddress && (
          <div className="text-[10px] leading-tight mb-1 break-words whitespace-normal">
            {storeAddress}
          </div>
        )}

        {storePhone && (
          <div className="text-[10px] break-words">
            TEL: {storePhone}
          </div>
        )}

        {taxNumber && (
          <div className="text-[10px] font-bold mt-0.5 break-words">
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
          <div className="flex justify-between items-start gap-2">
            <span className="font-semibold shrink-0">Customer:</span>
            <span className="font-bold text-right break-words min-w-0">{customerName}</span>
          </div>
        )}

        {toggles.showCustomerPhone && customerPhone && (
          <div className="flex justify-between items-start gap-2">
            <span className="font-semibold shrink-0">Phone:</span>
            <span className="text-right break-words min-w-0">{customerPhone}</span>
          </div>
        )}

        {toggles.showCustomerAddress && customerAddress && (
          <div className="text-left pt-0.5 leading-tight break-words whitespace-normal">
            <span className="font-semibold">Address: </span>
            <span className="break-words">{customerAddress}</span>
          </div>
        )}

        <div className="pt-1 border-t border-dashed border-neutral-300"></div>

        {toggles.showInvoiceNumber && (
          <div className="flex justify-between items-start gap-2 font-bold">
            <span className="shrink-0">Bill/Invoice:</span>
            <span className="text-right break-words min-w-0">{order.invoiceNumber || `#${order.id}`}</span>
          </div>
        )}

        <div className="flex justify-between items-start gap-2">
          <span className="shrink-0">Order No:</span>
          <span className="text-right break-words min-w-0">#{order.id}</span>
        </div>

        {toggles.showDate && (
          <div className="flex justify-between items-start gap-2">
            <span className="shrink-0">Date:</span>
            <span className="text-right break-words min-w-0">{formattedDate}</span>
          </div>
        )}

        {toggles.showTime && (
          <div className="flex justify-between items-start gap-2">
            <span className="shrink-0">Time:</span>
            <span className="text-right break-words min-w-0">{formattedTime}</span>
          </div>
        )}
      </div>

      <div className="border-b border-dashed border-neutral-900 my-2"></div>

      {/* ===================================================================== */}
      {/* 3. ITEMS TABLE (Responsive: stacked for <=65mm, table for >65mm)      */}
      {/* ===================================================================== */}
      {resolved.isNarrow ? (
        /* Compact stacked layout for narrow paper widths (58mm, 57.5mm, etc.) */
        <div className="space-y-2 text-[10px]">
          <div className="border-b border-neutral-900 pb-1 flex justify-between font-bold">
            <span>ITEM</span>
            <span className="text-right">TOTAL</span>
          </div>
          <div className="divide-y divide-neutral-200">
            {order.items.map((item, idx) => {
              const isDeal = item.itemType === 'DEAL';
              const displayName = isDeal ? `[DEAL] ${item.dealName || item.productName}` : item.productName;
              const unitPrice = item.price ?? (item.quantity > 0 ? item.total / item.quantity : item.total);
              const variantText = isDeal
                ? 'Bundle Deal'
                : [item.selectedModel, item.selectedColor, item.selectedSize].filter(Boolean).join('/');

              return (
                <div key={idx} className="py-1.5 first:pt-1 last:pb-1">
                  <div className="font-bold leading-tight break-words">{displayName}</div>
                  {variantText && (
                    <div className="text-[9px] text-neutral-600 font-sans break-words">{variantText}</div>
                  )}
                  {isDeal && item.dealProducts && item.dealProducts.length > 0 && (
                    <div className="text-[8px] text-neutral-600 font-sans break-words mt-0.5">
                      Incl: {item.dealProducts.map((p) => `${p.productName} (${p.quantity || 1}x)`).join(', ')}
                    </div>
                  )}
                  {item.sku && (
                    <div className="text-[8px] text-neutral-500 font-sans break-words">SKU: {item.sku}</div>
                  )}
                  <div className="flex justify-between items-baseline mt-0.5">
                    <span className="text-neutral-700">
                      {item.quantity} × {formatPrice(unitPrice)}
                    </span>
                    <span className="font-bold text-right shrink-0 ml-2">
                      {formatPrice(item.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Proportional flexible table for wider paper widths (72mm, 76mm, 80mm, etc.) */
        <table className="w-full text-left text-[10px] border-collapse table-fixed">
          <thead>
            <tr className="border-b border-neutral-900 font-bold">
              <th className="py-1 pr-1 w-[52%]">ITEM</th>
              <th className="py-1 text-center w-[16%]">QTY</th>
              <th className="py-1 text-right w-[32%]">PRICE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {order.items.map((item, idx) => {
              const isDeal = item.itemType === 'DEAL';
              const displayName = isDeal ? `[DEAL] ${item.dealName || item.productName}` : item.productName;
              const variantText = isDeal
                ? 'Bundle Deal'
                : [item.selectedModel, item.selectedColor, item.selectedSize].filter(Boolean).join('/');

              return (
                <tr key={idx} className="align-top">
                  <td className="py-1.5 pr-1 break-words min-w-0">
                    <div className="font-bold leading-tight break-words">{displayName}</div>
                    {variantText && (
                      <div className="text-[9px] text-neutral-600 font-sans break-words">{variantText}</div>
                    )}
                    {isDeal && item.dealProducts && item.dealProducts.length > 0 && (
                      <div className="text-[8px] text-neutral-600 font-sans break-words mt-0.5">
                        Incl: {item.dealProducts.map((p) => `${p.productName} (${p.quantity || 1}x)`).join(', ')}
                      </div>
                    )}
                    {item.sku && (
                      <div className="text-[8px] text-neutral-500 font-sans break-words">SKU: {item.sku}</div>
                    )}
                  </td>
                  <td className="py-1.5 text-center font-bold">
                    {item.quantity}
                  </td>
                  <td className="py-1.5 text-right font-bold break-words min-w-0">
                    {formatPrice(item.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="border-b border-dashed border-neutral-900 my-2"></div>

      {/* ===================================================================== */}
      {/* 4. TOTALS                                                             */}
      {/* ===================================================================== */}
      <div className="space-y-1 text-[10px] font-mono">
        <div className="flex justify-between items-center">
          <span className="shrink-0">Subtotal</span>
          <span className="text-right shrink-0">{formatPrice(order.subtotal)}</span>
        </div>

        {order.discount !== undefined && order.discount > 0 && (
          <div className="flex justify-between items-center text-neutral-800">
            <span className="shrink-0">Discount</span>
            <span className="text-right shrink-0">-{formatPrice(order.discount)}</span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="shrink-0">Shipping</span>
          <span className="text-right shrink-0">{order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}</span>
        </div>

        <div className="border-b border-neutral-900 my-1"></div>

        <div className="flex justify-between items-center font-bold text-xs pt-0.5">
          <span className="shrink-0">TOTAL:</span>
          <span className="text-right shrink-0">{formatPrice(order.total)}</span>
        </div>
      </div>

      {/* Payment info - wraps properly without clipping long statuses */}
      {toggles.showPaymentMethod && order.paymentMethod && (
        <div className="mt-2 pt-2 border-t border-dashed border-neutral-300 text-[10px] flex justify-between items-start gap-2">
          <span className="shrink-0">Payment:</span>
          <span className="font-bold uppercase text-right break-words min-w-0">
            {order.paymentMethod} {order.paymentStatus ? `(${order.paymentStatus})` : ''}
          </span>
        </div>
      )}

      <div className="border-b border-dashed border-neutral-900 my-2"></div>

      {/* ===================================================================== */}
      {/* 5. FOOTER                                                             */}
      {/* ===================================================================== */}
      <div className="text-center pt-1 text-[10px] space-y-1">
        {toggles.showWebsite && (
          <div className="font-semibold break-words">
            {website && (website.includes('alhamdshop.com') || website.includes('alhamd.pk'))
              ? website
              : 'alhamdshop.com'}
          </div>
        )}

        {toggles.showThankYou && footerMessage && (
          <div className="font-bold uppercase pt-1 break-words">
            {footerMessage}
          </div>
        )}
      </div>
    </div>
  );
}
