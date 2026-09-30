'use client';

import React, { useState } from 'react';
import { Order } from '@/types/admin';
import {
  CheckCircle2,
  Printer,
  FileText,
  X,
  RotateCcw,
} from 'lucide-react';
import { getBillSettings } from '@/lib/db/billSettings';

interface PosReceiptModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onNewSale: () => void;
}

export default function PosReceiptModal({
  order,
  isOpen,
  onClose,
  onNewSale,
}: PosReceiptModalProps) {
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const billSettings = getBillSettings();

  if (!isOpen || !order) return null;

  const handlePrint = (format: 'thermal' | 'a4') => {
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = new Date(order.createdAt).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const manualDiscount = Math.max(
    0,
    (order.discount || 0) - (order.promoDiscountAmount || 0)
  );

  return (
    <>
      {/* Dedicated Print Isolation Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            margin: ${printFormat === 'thermal' ? '0mm' : '10mm'};
            size: ${printFormat === 'thermal' ? '80mm auto' : 'A4 portrait'};
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          /* Hide EVERYTHING in the DOM by default */
          body * {
            visibility: hidden !important;
          }
          /* Make only the receipt print container and children visible */
          #pos-receipt-print-area, #pos-receipt-print-area * {
            visibility: visible !important;
          }
          #pos-receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${printFormat === 'thermal' ? '76mm' : '100%'} !important;
            max-width: ${printFormat === 'thermal' ? '76mm' : '100%'} !important;
            margin: 0 auto !important;
            padding: ${printFormat === 'thermal' ? '4mm' : '12mm'} !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: block !important;
            z-index: 999999 !important;
          }
          .screen-only, .no-print, [aria-hidden="true"] {
            display: none !important;
          }
        }
      `}} />

      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
        {/* Modal Dialog */}
        <div className="bg-white text-neutral-900 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:w-full print:rounded-none">
          {/* Top Header (Screen Only) */}
          <div className="px-6 py-4 border-b border-neutral-100 bg-emerald-50/80 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                  SALE COMPLETED SUCCESSFULLY
                </span>
                <h3 className="font-extrabold text-neutral-900 text-base mt-0.5">
                  Invoice #{order.invoiceNumber}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Print Format Switcher */}
              <div className="flex items-center bg-white border border-neutral-200 rounded-xl p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setPrintFormat('thermal')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    printFormat === 'thermal'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Thermal (80mm)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('a4')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    printFormat === 'a4'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  A4 Invoice
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-500 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Sale Summary Bar (Screen Only) */}
          <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs print:hidden">
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-semibold">Order ID</span>
              <span className="font-bold text-neutral-900 font-mono">#{order.id}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-semibold">Cashier</span>
              <span className="font-semibold text-neutral-900">{order.cashierName || 'Cashier'}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-semibold">Grand Total</span>
              <span className="font-black text-emerald-700">Rs. {order.total.toLocaleString('en-PK')}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-semibold">Payment</span>
              <span className="font-bold uppercase text-neutral-900">{order.paymentMethod}</span>
            </div>
          </div>

          {/* Scrollable Receipt Area */}
          <div className="p-6 sm:p-8 overflow-y-auto print:p-0 print:overflow-visible">
            {/* The Print Area Element Target */}
            <div id="pos-receipt-print-area">
              {/* ================================================================= */}
              {/* THERMAL RECEIPT FORMAT (80mm standard pos roll)                   */}
              {/* ================================================================= */}
              {printFormat === 'thermal' && (
                <div className="max-w-[340px] mx-auto bg-neutral-50 p-5 rounded-2xl border border-dashed border-neutral-300 font-mono text-[11px] leading-tight text-neutral-900 print:border-0 print:p-0 print:max-w-none print:bg-white">
                  {/* Store Header */}
                  <div className="text-center space-y-1 pb-3 border-b border-dashed border-neutral-400">
                    <div className="font-black text-sm tracking-wider uppercase">
                      {billSettings.storeName || 'AL-HAMD MOBILE ACCESSORIES'}
                    </div>
                    <div className="text-[10px] text-neutral-700">
                      {billSettings.storeAddress ||
                        'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan'}
                    </div>
                    <div className="text-[10px] text-neutral-700">
                      Phone: {billSettings.phone || '+92 343 2200995'}
                    </div>
                    <div className="text-[10px] text-neutral-700">
                      Email: {billSettings.email || 'support@alhamd-mobile.com'}
                    </div>
                    <div className="text-[10px] font-bold text-neutral-900 pt-1">
                      *** SHOP COUNTER CASH RECEIPT ***
                    </div>
                  </div>

                  {/* Order Meta */}
                  <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>INVOICE NUMBER:</span>
                      <span className="font-bold">{order.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ORDER NUMBER:</span>
                      <span className="font-bold">#{order.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DATE & TIME:</span>
                      <span>
                        {formattedDate} {formattedTime}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>CASHIER:</span>
                      <span className="font-semibold">{order.cashierName || 'Counter Staff'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CUSTOMER:</span>
                      <span>
                        {order.customer?.firstName && order.customer.firstName !== 'Walk-in'
                          ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim()
                          : 'Walk-in Customer'}
                      </span>
                    </div>
                    {order.customer?.phone && (
                      <div className="flex justify-between">
                        <span>PHONE:</span>
                        <span>{order.customer.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-2">
                    <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-neutral-200">
                      <span className="w-1/2">PRODUCT / SKU</span>
                      <span className="w-1/4 text-center">QTY x PRICE</span>
                      <span className="w-1/4 text-right">TOTAL</span>
                    </div>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="font-bold">{item.productName}</div>
                        {(item.selectedModel || item.selectedColor) && (
                          <div className="text-[9px] text-neutral-600 font-medium">
                            {[item.selectedModel ? `Model: ${item.selectedModel}` : null, item.selectedColor ? `Color: ${item.selectedColor}` : null].filter(Boolean).join(' • ')}
                          </div>
                        )}
                        {item.sku && (
                          <div className="text-[9px] text-neutral-500">SKU: {item.sku}</div>
                        )}
                        <div className="flex justify-between text-neutral-600 text-[10px]">
                          <span>
                            {item.quantity} x Rs. {item.price.toLocaleString('en-PK')}
                            {item.originalPrice && item.originalPrice > item.price && (
                              <span className="line-through ml-1 text-neutral-400">
                                Rs. {item.originalPrice}
                              </span>
                            )}
                          </span>
                          <span className="font-bold text-neutral-900">
                            Rs. {item.total.toLocaleString('en-PK')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals Breakdown */}
                  <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>Rs. {order.subtotal.toLocaleString('en-PK')}</span>
                    </div>

                    {/* Manual Discount if applied */}
                    {manualDiscount > 0 && (
                      <div className="flex justify-between text-neutral-800">
                        <span>
                          Manual Discount{' '}
                          {order.posDiscountType === 'percentage' && order.posDiscountValue
                            ? `(${order.posDiscountValue}%)`
                            : ''}
                          :
                        </span>
                        <span>-Rs. {manualDiscount.toLocaleString('en-PK')}</span>
                      </div>
                    )}

                    {/* Promo Code Discount */}
                    {order.promoCode && (
                      <div className="py-1 border-y border-dashed border-neutral-300 my-1 space-y-0.5 font-bold text-neutral-900">
                        <div className="flex justify-between">
                          <span>PROMO CODE:</span>
                          <span className="tracking-wider uppercase">{order.promoCode}</span>
                        </div>
                        {order.promoDiscountType === 'percentage' && order.promoDiscountValue ? (
                          <div className="flex justify-between text-[10px] font-normal text-neutral-700">
                            <span>PROMO DISCOUNT:</span>
                            <span>{order.promoDiscountValue}%</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between text-emerald-800">
                          <span>PROMO DISCOUNT:</span>
                          <span>-Rs. {(order.promoDiscountAmount || order.discount).toLocaleString('en-PK')}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between font-black text-sm pt-1 border-t border-neutral-300">
                      <span>GRAND TOTAL:</span>
                      <span>Rs. {order.total.toLocaleString('en-PK')}</span>
                    </div>

                    <div className="flex justify-between text-[10px] pt-1 text-neutral-700">
                      <span>PAYMENT METHOD:</span>
                      <span className="font-bold uppercase">{order.paymentMethod}</span>
                    </div>

                    <div className="flex justify-between text-[10px] text-neutral-700">
                      <span>AMOUNT PAID:</span>
                      <span>Rs. {(order.amountPaid !== undefined && order.amountPaid > 0 ? order.amountPaid : order.total).toLocaleString('en-PK')}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-neutral-900">
                      <span>CHANGE:</span>
                      <span>Rs. {(order.changeGiven || 0).toLocaleString('en-PK')}</span>
                    </div>
                  </div>

                  {/* Footer Note */}
                  <div className="text-center pt-3 space-y-1 text-[10px] text-neutral-600">
                    <div className="font-bold uppercase tracking-wider text-neutral-800">
                      THANK YOU FOR SHOPPING WITH US!
                    </div>
                    <div>Exchanges accepted within 3 days with this bill.</div>
                    <div>AL-HAMD Retail Management • Mandi Bahauddin</div>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* A4 INVOICE FORMAT                                                 */}
              {/* ================================================================= */}
              {printFormat === 'a4' && (
                <div className="max-w-3xl mx-auto space-y-6 text-xs text-neutral-800 bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200 print:border-0 print:p-0">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-neutral-200 pb-5">
                    <div>
                      <h2 className="text-xl font-black text-neutral-950 tracking-tight">
                        {billSettings.storeName || 'AL-HAMD MOBILE ACCESSORIES'}
                      </h2>
                      <p className="text-neutral-500 mt-0.5 text-[11px]">
                        {billSettings.invoiceHeaderText ||
                          'Quality Mobile Accessories & Smartphone Essentials'}
                      </p>
                      <div className="mt-2 space-y-0.5 text-neutral-600 text-[11px]">
                        <div>
                          {billSettings.storeAddress ||
                            'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan'}
                        </div>
                        <div>Phone: {billSettings.phone || '+92 343 2200995'}</div>
                        <div>Email: {billSettings.email || 'support@alhamd-mobile.com'}</div>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="inline-block px-3 py-1 rounded-md bg-neutral-950 text-white font-extrabold text-[10px] uppercase tracking-wider">
                        TAX INVOICE
                      </span>
                      <div className="font-mono font-bold text-sm text-neutral-900 mt-1">
                        Invoice #{order.invoiceNumber}
                      </div>
                      <div className="text-neutral-500 text-[11px]">Order #{order.id}</div>
                      <div className="text-neutral-600 text-[11px]">
                        Date & Time: {formattedDate} {formattedTime}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Cashier Info Grid */}
                  <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-200 text-[11px]">
                    <div>
                      <span className="font-bold text-neutral-500 uppercase tracking-wider block text-[10px]">
                        Customer Details
                      </span>
                      <div className="font-bold text-neutral-900 text-xs mt-1">
                        {order.customer?.firstName && order.customer.firstName !== 'Walk-in'
                          ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim()
                          : 'Walk-in Customer'}
                      </div>
                      {order.customer.phone && <div>Phone: {order.customer.phone}</div>}
                      {order.customer.email && (
                        <div className="text-neutral-500">{order.customer.email}</div>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-neutral-500 uppercase tracking-wider block text-[10px]">
                        Cashier / Sales Representative
                      </span>
                      <div className="font-bold text-neutral-900 text-xs mt-1">
                        {order.cashierName || 'Shop Cashier'}
                      </div>
                      <div className="text-neutral-500">{order.cashierEmail || 'Counter Staff'}</div>
                      <div className="font-semibold text-emerald-700 mt-1">
                        Channel: POS / Shop Counter
                      </div>
                    </div>
                  </div>

                  {/* Products Table */}
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-neutral-200 text-[11px] font-bold text-neutral-700 uppercase tracking-wider">
                        <th className="py-2.5 px-2">#</th>
                        <th className="py-2.5 px-2">Product Description</th>
                        <th className="py-2.5 px-2">SKU</th>
                        <th className="py-2.5 px-2 text-right">Unit Price</th>
                        <th className="py-2.5 px-2 text-center">Quantity</th>
                        <th className="py-2.5 px-2 text-right">Line Total (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {order.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-2 text-neutral-400">{idx + 1}</td>
                          <td className="py-2.5 px-2">
                            <span className="font-semibold text-neutral-900 block">{item.productName}</span>
                            {(item.selectedModel || item.selectedColor) && (
                              <span className="text-[10px] text-neutral-500 block">
                                {[item.selectedModel ? `Model: ${item.selectedModel}` : null, item.selectedColor ? `Color: ${item.selectedColor}` : null].filter(Boolean).join(' • ')}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[11px] text-neutral-500">
                            {item.sku || '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            Rs. {item.price.toLocaleString('en-PK')}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold">{item.quantity}</td>
                          <td className="py-2.5 px-2 text-right font-bold text-neutral-900">
                            Rs. {item.total.toLocaleString('en-PK')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Summary Totals */}
                  <div className="flex justify-end pt-2">
                    <div className="w-72 space-y-2 border-t-2 border-neutral-900 pt-3 text-[11px]">
                      <div className="flex justify-between text-neutral-600">
                        <span>Subtotal:</span>
                        <span>Rs. {order.subtotal.toLocaleString('en-PK')}</span>
                      </div>

                      {manualDiscount > 0 && (
                        <div className="flex justify-between text-neutral-800">
                          <span>
                            Manual Discount{' '}
                            {order.posDiscountType === 'percentage' && order.posDiscountValue
                              ? `(${order.posDiscountValue}%)`
                              : ''}:
                          </span>
                          <span>-Rs. {manualDiscount.toLocaleString('en-PK')}</span>
                        </div>
                      )}

                      {/* Promo Code Line if used */}
                      {order.promoCode && (
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-0.5">
                          <div className="flex justify-between font-bold">
                            <span>Promo Code:</span>
                            <span className="tracking-wider uppercase">{order.promoCode}</span>
                          </div>
                          {order.promoDiscountType === 'percentage' && order.promoDiscountValue ? (
                            <div className="flex justify-between text-[10px]">
                              <span>Discount Rate:</span>
                              <span>{order.promoDiscountValue}% OFF</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between font-extrabold text-emerald-700">
                            <span>Promo Discount:</span>
                            <span>-Rs. {(order.promoDiscountAmount || order.discount).toLocaleString('en-PK')}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between font-black text-base text-neutral-950 pt-1 border-t border-neutral-200">
                        <span>Grand Total:</span>
                        <span>Rs. {order.total.toLocaleString('en-PK')}</span>
                      </div>

                      <div className="flex justify-between text-[11px] text-neutral-600 pt-1">
                        <span>Payment Method:</span>
                        <span className="font-bold uppercase">{order.paymentMethod}</span>
                      </div>

                      <div className="flex justify-between text-[11px] text-neutral-600">
                        <span>Amount Paid:</span>
                        <span>Rs. {(order.amountPaid !== undefined && order.amountPaid > 0 ? order.amountPaid : order.total).toLocaleString('en-PK')}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-neutral-900">
                        <span>Change:</span>
                        <span>Rs. {(order.changeGiven || 0).toLocaleString('en-PK')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Clean Professional Footer */}
                  <div className="border-t border-neutral-200 pt-4 text-center text-neutral-500 text-[11px]">
                    {billSettings.invoiceFooterText || 'Thank you for your business.'}
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      AL-HAMD MOBILE ACCESSORIES • Mandi Bahauddin • support@alhamd-mobile.com • +92 343 2200995
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Bottom Bar with Specified 3 Primary Buttons (Screen Only) */}
          <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <button
              type="button"
              onClick={onNewSale}
              className="px-5 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-bold text-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>NEW SALE</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrint('thermal')}
                className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>PRINT BILL</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint('a4')}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>PRINT A4 INVOICE</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
