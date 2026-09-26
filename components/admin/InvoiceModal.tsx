'use client';

import React, { useState, useEffect } from 'react';
import { Order } from '@/types/admin';
import { Printer, FileText, X, CheckCircle2, ShieldCheck } from 'lucide-react';

import { formatPrice } from '@/lib/utils';
import { getBillSettings } from '@/lib/db/billSettings';
import { subscribeToKey } from '@/lib/db/storage';

interface InvoiceModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  storeEmail?: string;
  storePhone?: string;
  storeAddress?: string;
  storeLogo?: string;
}

export default function InvoiceModal({
  order,
  isOpen,
  onClose,
  storeName = 'AL-HAMD-MOBILE',
  storeEmail = 'support@alhamd-mobile.com',
  storePhone = '+92 300 1234567',
  storeAddress = 'Shop # 12, Commercial Plaza, MM Alam Road, Gulberg III, Lahore, Pakistan',
  storeLogo,
}: InvoiceModalProps) {
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');
  const [billConfig, setBillConfig] = useState(getBillSettings());

  useEffect(() => {
    setBillConfig(getBillSettings());
    const unsub = subscribeToKey('bill_settings', (data: any) => {
      if (data) setBillConfig(data);
    });
    return () => unsub();
  }, []);

  const activeStoreName =
    storeName !== 'AL-HAMD-MOBILE' ? storeName : billConfig.storeName || 'AL-HAMD-MOBILE';
  const activeLogo = storeLogo || billConfig.storeLogo || '';
  const activeAddress =
    storeAddress !==
    'Shop # 12, Commercial Plaza, MM Alam Road, Gulberg III, Lahore, Pakistan'
      ? storeAddress
      : billConfig.storeAddress || storeAddress;
  const activePhone =
    storePhone !== '+92 300 1234567' ? storePhone : billConfig.phone || storePhone;
  const activeWhatsApp = billConfig.whatsapp || '';
  const activeEmail =
    storeEmail !== 'support@alhamd-mobile.com'
      ? storeEmail
      : billConfig.email || storeEmail;
  const activeWebsite = billConfig.website || 'alhamd.pk';
  const activeHeaderText =
    billConfig.invoiceHeaderText || 'Premium Mobile Accessories & Charging Essentials';
  const activeFooterText =
    billConfig.invoiceFooterText || 'Thank you for your business.';
  const activeTaxNumber = billConfig.taxNumber || '';
  const activeThermalFooter =
    billConfig.thermalFooterNote || 'THANK YOU FOR YOUR PATRONAGE!';

  if (!isOpen) return null;

  const handlePrint = (format: 'a4' | 'thermal') => {
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Card */}
      <div className="bg-white text-neutral-900 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:w-full print:rounded-none">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">Invoice & Bill</h3>
              <p className="text-xs text-neutral-500">
                Invoice #{order.invoiceNumber} • Order #{order.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint('a4')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print A4 Invoice
            </button>
            <button
              onClick={() => handlePrint('thermal')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Thermal Bill
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="overflow-y-auto p-6 sm:p-10 flex-1 print:p-0 print:overflow-visible bg-neutral-100/50 print:bg-white">
          {/* A4 Format Container */}
          <div
            className={`${
              printFormat === 'thermal'
                ? 'max-w-[80mm] mx-auto bg-white p-4 shadow-md font-mono text-[11px] print:shadow-none print:p-2 print:m-0 print:w-[80mm]'
                : 'max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-xl shadow-md border border-neutral-200/80 print:shadow-none print:border-none print:p-0'
            }`}
          >
            {/* ===================== THERMAL RECEIPT LAYOUT ===================== */}
            {printFormat === 'thermal' ? (
              <div className="leading-tight text-neutral-900 text-center">
                {activeLogo ? (
                  <div className="mb-2 flex justify-center">
                    <img
                      src={activeLogo}
                      alt={activeStoreName}
                      className="max-h-12 max-w-[120px] object-contain"
                    />
                  </div>
                ) : null}
                <div className="font-bold text-sm tracking-wider uppercase mb-1">{activeStoreName}</div>
                {activeHeaderText && (
                  <div className="text-[9px] text-neutral-500 mb-1">{activeHeaderText}</div>
                )}
                <div className="text-[10px] text-neutral-600 mb-0.5">{activeAddress}</div>
                <div className="text-[10px] text-neutral-600 mb-0.5">TEL: {activePhone}</div>
                {activeWhatsApp && (
                  <div className="text-[10px] text-neutral-600 mb-0.5">WA: {activeWhatsApp}</div>
                )}
                {activeTaxNumber && (
                  <div className="text-[10px] font-mono text-neutral-800 font-bold mb-1">
                    NTN: {activeTaxNumber}
                  </div>
                )}
                <div className="border-b border-dashed border-neutral-400 my-2"></div>

                <div className="text-left text-[10px] space-y-0.5 mb-2">
                  <div>INV: <span className="font-bold">{order.invoiceNumber}</span></div>
                  <div>ORD: {order.id}</div>
                  <div>DATE: {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div>CUST: {order.customerType === 'WHOLESALE' ? (order.shopName || order.customer.firstName) : `${order.customer.firstName} ${order.customer.lastName}`}</div>
                  {order.customerType === 'WHOLESALE' && <div>TYPE: WHOLESALE ACCOUNT</div>}
                  <div>TEL: {order.customer.phone}</div>
                </div>

                <div className="border-b border-dashed border-neutral-400 my-2"></div>

                {/* Items */}
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-neutral-300">
                      <th className="py-1">ITEM</th>
                      <th className="py-1 text-center">QTY</th>
                      <th className="py-1 text-right">PRICE</th>
                      <th className="py-1 text-right">TOT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-neutral-100">
                        <td className="py-1 pr-1">
                          <div className="font-bold truncate max-w-[35mm]">{item.productName}</div>
                          <div className="text-[8px] text-neutral-500 font-sans">SKU: {item.sku}</div>
                          {item.discountPercentage && item.discountPercentage > 0 ? (
                            <div className="text-[7px] text-neutral-600 font-sans">Bulk: {item.discountPercentage}% OFF</div>
                          ) : null}
                        </td>
                        <td className="py-1 text-center font-bold">{item.quantity}</td>
                        <td className="py-1 text-right font-mono">{formatPrice(item.price)}</td>
                        <td className="py-1 text-right font-bold font-mono">{formatPrice(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-b border-dashed border-neutral-400 my-2"></div>

                {/* Financials */}
                <div className="text-right text-[10px] space-y-0.5 font-mono">
                  <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>DISCOUNT:</span>
                      <span>-{formatPrice(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>SHIPPING:</span>
                    <span>{order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}</span>
                  </div>
                  {order.tax > 0 && (
                    <div className="flex justify-between">
                      <span>TAX:</span>
                      <span>{formatPrice(order.tax)}</span>
                    </div>
                  )}
                  <div className="border-b border-neutral-300 my-1"></div>
                  <div className="flex justify-between font-bold text-xs">
                    <span>TOTAL:</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>

                <div className="border-b border-dashed border-neutral-400 my-2"></div>

                <div className="text-[9px] text-neutral-600 text-center space-y-0.5">
                  <div>PAYMENT: {order.paymentMethod.toUpperCase()} ({order.paymentStatus.toUpperCase()})</div>
                  {order.paymentReference && (
                    <div>PAYMENT REF: {order.paymentReference}</div>
                  )}
                  <div>STATUS: {order.status.toUpperCase()}</div>
                  <div className="pt-2 font-bold uppercase">{activeThermalFooter}</div>
                  <div>{activeWebsite}</div>
                </div>
              </div>
            ) : (
              /* ===================== STANDARD A4 INVOICE LAYOUT ===================== */
              <div className="text-neutral-900 font-sans">
                {/* Header / Brand */}
                <div className="flex flex-col sm:flex-row justify-between items-start pb-8 border-b-2 border-neutral-900 gap-6">
                  <div>
                    {activeLogo ? (
                      <div className="mb-3 max-h-16 max-w-[200px] overflow-hidden">
                        <img
                          src={activeLogo}
                          alt={activeStoreName}
                          className="max-h-16 w-auto object-contain"
                        />
                      </div>
                    ) : null}
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase">{activeStoreName}</h1>
                    {activeHeaderText && (
                      <p className="text-xs text-neutral-500 font-medium tracking-wider uppercase mt-1">
                        {activeHeaderText}
                      </p>
                    )}
                    <div className="text-xs text-neutral-600 mt-3 space-y-0.5">
                      <p>{activeAddress}</p>
                      <p>
                        Phone: {activePhone}
                        {activeWhatsApp ? ` • WhatsApp: ${activeWhatsApp}` : ''}
                      </p>
                      <p>
                        Email: {activeEmail}
                        {activeWebsite ? ` • Web: ${activeWebsite}` : ''}
                      </p>
                      {activeTaxNumber && (
                        <p className="font-mono text-[11px] text-neutral-800 font-bold">
                          Tax / NTN: {activeTaxNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <div className="inline-block px-3 py-1 bg-neutral-900 text-white rounded text-xs font-bold uppercase tracking-widest mb-2">
                      INVOICE / BILL
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-neutral-900">
                        Invoice No: <span className="font-mono text-neutral-900">{order.invoiceNumber}</span>
                      </p>
                      <p className="text-xs text-neutral-600">
                        Order Ref: <span className="font-mono font-medium">{order.id}</span>
                      </p>
                      <p className="text-xs text-neutral-600">Issue Date: {formattedDate}</p>
                      <p className="text-xs">
                        Payment Method:{' '}
                        <span className="font-semibold text-neutral-900">{order.paymentMethod}</span>
                      </p>
                      <p className="text-xs">
                        Payment Status:{' '}
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {order.paymentStatus}
                        </span>
                      </p>
                      {order.paymentReference && (
                        <p className="text-xs">
                          Payment Reference:{' '}
                          <span className="font-mono font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                            {order.paymentReference}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Customer & Shipping Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-b border-neutral-200 text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-neutral-400 uppercase tracking-wider">Billed To</h4>
                      {order.customerType === 'WHOLESALE' && (
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200">
                          WHOLESALE ACCOUNT
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-sm text-neutral-900">
                      {order.customerType === 'WHOLESALE' ? (order.shopName || order.customer.firstName) : `${order.customer.firstName} ${order.customer.lastName}`}
                    </p>
                    {order.customer.email ? (
                      <p className="text-neutral-600 mt-1">{order.customer.email}</p>
                    ) : null}
                    <p className="text-neutral-600">{order.customer.phone}</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-neutral-400 uppercase tracking-wider mb-2">Shipping Destination</h4>
                    <p className="text-neutral-800 font-medium">{order.shippingAddress.street}</p>
                    <p className="text-neutral-800">
                      {order.shippingAddress.city}, {order.shippingAddress.postalCode}
                    </p>
                    <p className="text-neutral-800">{order.shippingAddress.country}</p>
                    <p className="text-neutral-500 mt-1">Delivery: {order.deliveryMethod === 'express' ? 'Express Courier' : 'Standard Delivery'}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="py-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-300 text-[11px] uppercase tracking-wider text-neutral-500">
                        <th className="pb-3 font-semibold">Item & Description</th>
                        <th className="pb-3 font-semibold">SKU</th>
                        <th className="pb-3 font-semibold text-center">Qty</th>
                        <th className="pb-3 font-semibold text-right">Unit Price</th>
                        <th className="pb-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-xs">
                      {order.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/50">
                          <td className="py-3.5 pr-4">
                            <p className="font-semibold text-neutral-900">{item.productName}</p>
                            {(item.selectedSize || item.selectedColor) && (
                              <p className="text-[10px] text-neutral-500 mt-0.5">
                                {[item.selectedSize, item.selectedColor].filter(Boolean).join(' • ')}
                              </p>
                            )}
                            {item.discountPercentage && item.discountPercentage > 0 ? (
                              <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                                Bulk Offer: {item.discountPercentage}% OFF (Was {formatPrice(item.originalPrice || item.price)} ea)
                              </p>
                            ) : null}
                          </td>
                          <td className="py-3.5 font-mono text-[11px] text-neutral-600">{item.sku}</td>
                          <td className="py-3.5 text-center font-medium">{item.quantity}</td>
                          <td className="py-3.5 text-right font-mono text-neutral-600">{formatPrice(item.price)}</td>
                          <td className="py-3.5 text-right font-bold font-mono text-neutral-900">
                            {formatPrice(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="border-t-2 border-neutral-900 pt-4 flex justify-end">
                  <div className="w-full sm:w-64 space-y-2 text-xs">
                    <div className="flex justify-between text-neutral-600">
                      <span>Subtotal</span>
                      <span className="font-mono font-medium">{formatPrice(order.subtotal)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span>
                        <span className="font-mono font-medium">-{formatPrice(order.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-neutral-600">
                      <span>Shipping</span>
                      <span className="font-mono font-medium">
                        {order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}
                      </span>
                    </div>
                    {order.tax > 0 && (
                      <div className="flex justify-between text-neutral-600">
                        <span>Estimated Tax</span>
                        <span className="font-mono font-medium">{formatPrice(order.tax)}</span>
                      </div>
                    )}
                    <div className="border-t border-neutral-300 pt-2 flex justify-between font-bold text-sm text-neutral-900">
                      <span>Grand Total</span>
                      <span className="font-mono text-base font-bold">{formatPrice(order.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Notes & Guarantee */}
                <div className="mt-12 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row justify-between items-center text-xs text-neutral-500 gap-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Official verified receipt generated by {activeStoreName} Commerce Engine</span>
                  </div>
                  <p className="font-medium text-neutral-700">{activeFooterText}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
