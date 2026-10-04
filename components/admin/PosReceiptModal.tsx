'use client';

import React, { useState, useEffect } from 'react';
import { Order, BillSettings } from '@/types/admin';
import {
  CheckCircle2,
  Printer,
  FileText,
  X,
  RotateCcw,
} from 'lucide-react';
import { getBillSettings } from '@/lib/db/billSettings';
import { subscribeToKey } from '@/lib/db/storage';
import { printBillElement } from '@/lib/utils/printBill';
import ThermalBillTemplate from './billing/ThermalBillTemplate';
import A4BillTemplate from './billing/A4BillTemplate';
import { resolveThermalWidth } from '@/lib/utils/thermalWidth';

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
  const [billSettings, setBillSettings] = useState<BillSettings>(getBillSettings());
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    setBillSettings(getBillSettings());
    const unsub = subscribeToKey('bill_settings', (data: any) => {
      if (data) setBillSettings(data);
    });
    return () => unsub();
  }, []);

  const thermalResolved = resolveThermalWidth(
    billSettings.thermalPaperWidth,
    billSettings.thermalCustomWidth
  );

  if (!isOpen || !order) return null;

  const handlePrint = async (format: 'thermal' | 'a4') => {
    setPrintFormat(format);
    setIsPrinting(true);

    setTimeout(async () => {
      try {
        await printBillElement('pos-receipt-print-area', {
          format,
          paperWidth: format === 'thermal' ? thermalResolved.widthCss : undefined,
          customWidth: format === 'thermal' ? thermalResolved.customWidth : undefined,
          title: `Receipt_${order.invoiceNumber || order.id}`,
        });
      } finally {
        setIsPrinting(false);
      }
    }, 80);
  };

  return (
    <>
      {/* Dedicated Print Isolation Styles for fallback window.print / Ctrl+P */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              margin: ${printFormat === 'thermal' ? '0mm' : '10mm'};
              size: ${printFormat === 'thermal' ? `${thermalResolved.widthCss} auto` : 'A4 portrait'};
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
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: ${printFormat === 'thermal' ? thermalResolved.widthCss : '100%'} !important;
              max-width: ${printFormat === 'thermal' ? thermalResolved.widthCss : '100%'} !important;
              margin: 0 auto !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: #ffffff !important;
              color: #000000 !important;
              display: block !important;
              z-index: 99999999 !important;
            }
            .screen-only, .no-print, [aria-hidden="true"], [data-no-print] {
              display: none !important;
            }
          }
        `,
        }}
      />

      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
        {/* Modal Dialog */}
        <div className="bg-white text-neutral-900 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:w-full print:rounded-none">
          {/* Top Header (Screen Only) */}
          <div className="px-6 py-4 border-b border-neutral-100 bg-emerald-50/80 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
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
                  Thermal ({thermalResolved.widthCss})
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
              <span className="font-semibold text-neutral-900">{order.cashierName || 'Counter Staff'}</span>
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
          <div className="p-4 sm:p-8 overflow-y-auto bg-neutral-100/60 flex-1 print:p-0 print:overflow-visible print:bg-white">
            {/* The Dedicated Printable Container */}
            <div id="pos-receipt-print-area">
              {printFormat === 'thermal' ? (
                <div
                  className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 p-2 mx-auto print:shadow-none print:border-none print:p-0 transition-all"
                  style={{
                    width: thermalResolved.widthCss,
                    maxWidth: '100%',
                  }}
                >
                  <ThermalBillTemplate
                    order={order}
                    settings={billSettings}
                    paperWidth={thermalResolved.paperWidth}
                    customWidth={thermalResolved.customWidth}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 print:shadow-none print:border-none print:p-0">
                  <A4BillTemplate
                    order={order}
                    settings={billSettings}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Modal Bottom Bar with Print Actions (Screen Only) */}
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
                disabled={isPrinting}
                className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>PRINT THERMAL BILL</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint('a4')}
                disabled={isPrinting}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
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
