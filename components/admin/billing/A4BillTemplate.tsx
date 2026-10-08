'use client';

import React from 'react';
import { Order, BillSettings, BillFieldToggles } from '@/types/admin';
import { defaultBillFieldToggles } from '@/lib/db/billSettings';
import { formatPrice } from '@/lib/utils';
import { Globe, Phone, Mail, MessageSquare } from 'lucide-react';

interface A4BillTemplateProps {
  order: Order;
  settings: BillSettings;
  overrideToggles?: BillFieldToggles;
  className?: string;
  id?: string;
}

export default function A4BillTemplate({
  order,
  settings,
  overrideToggles,
  className = '',
  id,
}: A4BillTemplateProps) {
  // Resolve toggles: prioritize format-specific a4Config, then overrideToggles, then defaultBillFieldToggles
  const toggles: BillFieldToggles = {
    ...defaultBillFieldToggles,
    ...(settings.a4Config || {}),
    ...(overrideToggles || {}),
  };

  const storeName = settings.storeName || 'AL-HAMD MOBILE ACCESSORIES';
  const storeLogo = settings.storeLogo;
  const storeAddress = settings.storeAddress || '';
  const storePhone = settings.phone || '';
  const storeWhatsApp = settings.whatsapp || '';
  const storeEmail = settings.email || '';
  const website = settings.website || 'alhamd.pk';
  const taxNumber = settings.taxNumber || '';
  const headerTagline = settings.invoiceHeaderText || '';
  const footerMessage =
    toggles.footerMessage || settings.a4Config?.footerMessage || settings.invoiceFooterText || 'Thank You for Shopping!';

  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'long',
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
    : [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ').trim() || 'Valued Customer';

  const customerPhone = order.customer?.phone?.trim() || '';
  const customerEmail = order.customer?.email?.trim() || '';

  // Safe address formatting
  const addressParts = [
    order.shippingAddress?.street,
    order.shippingAddress?.city,
    order.shippingAddress?.postalCode,
    order.shippingAddress?.country,
  ].filter((part) => part && typeof part === 'string' && part.trim() !== '' && !part.includes('undefined'));
  const customerAddress = addressParts.join(', ');

  return (
    <div
      id={id}
      className={`bg-white text-neutral-900 font-sans p-8 sm:p-12 max-w-4xl mx-auto ${className}`}
      style={{ minHeight: '297mm', color: '#111827', background: '#ffffff' }}
    >
      {/* ===================================================================== */}
      {/* 1. HEADER SECTION (Store Branding & Address)                         */}
      {/* ===================================================================== */}
      <div className="border-b-2 border-neutral-900 pb-6 flex flex-col sm:flex-row justify-between items-start gap-6">
        <div className="space-y-1.5 max-w-md">
          {/* Shop Logo */}
          {toggles.showLogo && storeLogo ? (
            <div className="mb-3 max-h-16 max-w-[220px] overflow-hidden flex items-center">
              <img
                src={storeLogo}
                alt={storeName}
                className="max-h-16 w-auto object-contain"
              />
            </div>
          ) : null}

          {/* Shop Name */}
          {toggles.showStoreName && (
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              {storeName}
            </h1>
          )}

          {/* Tagline */}
          {headerTagline && (
            <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
              {headerTagline}
            </p>
          )}

          {/* Shop Address & Contacts */}
          {toggles.showStoreAddress && storeAddress && (
            <p className="text-xs text-neutral-600 leading-relaxed pt-1">
              {storeAddress}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 pt-1">
            {storePhone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3 text-neutral-500" />
                <span className="font-mono">{storePhone}</span>
              </span>
            )}
            {storeWhatsApp && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-emerald-600" />
                <span className="font-mono">{storeWhatsApp}</span>
              </span>
            )}
            {storeEmail && (
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3 text-neutral-500" />
                <span>{storeEmail}</span>
              </span>
            )}
          </div>

          {taxNumber && (
            <p className="text-[11px] font-mono text-neutral-700 font-semibold pt-0.5">
              NTN / Tax ID: {taxNumber}
            </p>
          )}
        </div>

        {/* Invoice Title & Quick Badge */}
        <div className="sm:text-right space-y-1 self-start sm:self-auto shrink-0">
          <div className="inline-block px-3.5 py-1.5 bg-neutral-950 text-white rounded-lg text-xs font-black uppercase tracking-widest mb-2 shadow-xs">
            TAX INVOICE / BILL
          </div>
          {isWholesale && (
            <div>
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-900 rounded border border-purple-300 uppercase tracking-wider">
                {order.customerType === 'SUPER_WHOLESALE' ? 'SUPER WHOLESALE' : 'WHOLESALE INVOICE'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. CUSTOMER & INVOICE DETAILS METADATA                                */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-b border-neutral-200 text-xs">
        {/* Customer Column */}
        <div className="space-y-1.5">
          <h2 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
            Billed To
          </h2>

          {toggles.showCustomerName && (
            <p className="font-bold text-base text-neutral-950">
              {customerName}
            </p>
          )}

          {toggles.showCustomerPhone && customerPhone && (
            <p className="text-neutral-700 font-mono">
              <span className="text-neutral-400 font-sans mr-1">Phone:</span>
              {customerPhone}
            </p>
          )}

          {customerEmail && (
            <p className="text-neutral-600">
              <span className="text-neutral-400 mr-1">Email:</span>
              {customerEmail}
            </p>
          )}

          {toggles.showCustomerAddress && customerAddress && (
            <div className="text-neutral-700 pt-1 leading-relaxed">
              <span className="text-neutral-400 block text-[10px] uppercase font-semibold">Address:</span>
              <span>{customerAddress}</span>
            </div>
          )}
        </div>

        {/* Invoice Info Column */}
        <div className="sm:text-right space-y-1.5">
          <h2 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
            Invoice Information
          </h2>

          {toggles.showInvoiceNumber && (
            <div className="sm:justify-end flex items-center gap-2">
              <span className="text-neutral-500">Invoice No:</span>
              <span className="font-mono font-bold text-neutral-950 text-sm">
                {order.invoiceNumber}
              </span>
            </div>
          )}

          <div className="sm:justify-end flex items-center gap-2 text-neutral-600">
            <span>Order Ref:</span>
            <span className="font-mono font-semibold text-neutral-900">#{order.id}</span>
          </div>

          {toggles.showDate && (
            <div className="sm:justify-end flex items-center gap-2 text-neutral-600">
              <span>Date:</span>
              <span className="font-medium text-neutral-900">{formattedDate}</span>
            </div>
          )}

          {toggles.showTime && (
            <div className="sm:justify-end flex items-center gap-2 text-neutral-600">
              <span>Time:</span>
              <span className="font-mono text-neutral-800">{formattedTime}</span>
            </div>
          )}

          {toggles.showPaymentMethod && order.paymentMethod && (
            <div className="sm:justify-end flex items-center gap-2 pt-1">
              <span className="text-neutral-500">Payment:</span>
              <span className="font-bold text-neutral-900 uppercase">
                {order.paymentMethod}
              </span>
              {order.paymentStatus && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    order.paymentStatus.toLowerCase() === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {order.paymentStatus}
                </span>
              )}
            </div>
          )}

          {order.paymentReference && (
            <div className="sm:justify-end flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
              <span>Trx Ref:</span>
              <span className="text-neutral-900 font-bold">{order.paymentReference}</span>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. ITEMS TABLE                                                        */}
      {/* ===================================================================== */}
      <div className="py-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-900 text-[11px] uppercase tracking-wider text-neutral-600 font-bold">
              <th className="py-2.5 pr-4">Product</th>
              <th className="py-2.5 px-3">Variant / Model</th>
              <th className="py-2.5 px-3 text-center">Qty</th>
              <th className="py-2.5 px-3 text-right">Unit Price</th>
              <th className="py-2.5 pl-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-xs">
            {order.items.map((item, idx) => {
              const variantDetails = [item.selectedModel, item.selectedColor, item.selectedSize]
                .filter(Boolean)
                .join(' • ');

              return (
                <tr key={idx} className="align-top">
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.itemType === 'DEAL' && (
                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-indigo-100 text-indigo-700 tracking-wider">
                          Deal Bundle
                        </span>
                      )}
                      <p className="font-bold text-neutral-950 text-xs">
                        {item.itemType === 'DEAL' ? (item.dealName || item.productName) : item.productName}
                      </p>
                    </div>
                    {item.sku && (
                      <p className="text-[10px] font-mono text-neutral-500 mt-0.5">SKU: {item.sku}</p>
                    )}
                    {item.itemType === 'DEAL' && item.dealProducts && item.dealProducts.length > 0 && (
                      <div className="mt-1.5 pl-2 border-l-2 border-indigo-200 space-y-0.5 text-[11px] text-neutral-600">
                        <span className="font-semibold text-neutral-700 block text-[10px] uppercase">Included Products:</span>
                        {item.dealProducts.map((dp, pIdx) => (
                          <div key={pIdx} className="flex items-center gap-1">
                            <span>•</span>
                            <span>{dp.productName}</span>
                            <span className="text-neutral-400 font-mono text-[10px]">({dp.quantity || 1}x)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-neutral-700">
                    {item.itemType === 'DEAL' ? (
                      <span className="text-xs font-semibold text-indigo-600">Special Bundle Deal</span>
                    ) : variantDetails ? (
                      <span className="font-medium text-neutral-800">{variantDetails}</span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-center font-bold text-neutral-900">
                    {item.quantity}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-neutral-700">
                    {formatPrice(item.price)}
                  </td>
                  <td className="py-3.5 pl-3 text-right font-mono font-bold text-neutral-950">
                    {formatPrice(item.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===================================================================== */}
      {/* 4. FINANCIAL SUMMARY (SUBTOTAL, DISCOUNT, SHIPPING, TOTAL)           */}
      {/* ===================================================================== */}
      <div className="border-t-2 border-neutral-900 pt-4 flex justify-end">
        <div className="w-full sm:w-72 space-y-2 text-xs">
          <div className="flex justify-between text-neutral-700">
            <span>Subtotal</span>
            <span className="font-mono font-semibold">{formatPrice(order.subtotal)}</span>
          </div>

          {order.discount !== undefined && order.discount > 0 && (
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Discount</span>
              <span className="font-mono">-{formatPrice(order.discount)}</span>
            </div>
          )}

          <div className="flex justify-between text-neutral-700">
            <span>Shipping</span>
            <span className="font-mono font-semibold">
              {order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}
            </span>
          </div>

          {order.tax !== undefined && order.tax > 0 && (
            <div className="flex justify-between text-neutral-700">
              <span>Tax</span>
              <span className="font-mono">{formatPrice(order.tax)}</span>
            </div>
          )}

          <div className="border-t-2 border-neutral-900 pt-2.5 flex justify-between items-center text-sm font-black text-neutral-950">
            <span className="uppercase tracking-wider">Grand Total</span>
            <span className="font-mono text-base">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 5. FOOTER (Website URL & Gratitude Message)                          */}
      {/* ===================================================================== */}
      <div className="mt-14 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row justify-between items-center text-xs text-neutral-600 gap-3">
        {toggles.showWebsite && website && (
          <div className="flex items-center gap-1.5 font-medium text-neutral-800">
            <Globe className="w-3.5 h-3.5 text-neutral-500" />
            <span>{website}</span>
          </div>
        )}

        {toggles.showThankYou && footerMessage && (
          <p className="font-bold text-neutral-900 text-center sm:text-right tracking-tight">
            {footerMessage}
          </p>
        )}
      </div>
    </div>
  );
}
