'use client';

import React, { useState, useEffect } from 'react';
import { Order, BillSettings } from '@/types/admin';
import { Printer, FileText, X, CheckCircle2 } from 'lucide-react';
import { getBillSettings } from '@/lib/db/billSettings';
import { subscribeToKey } from '@/lib/db/storage';
import { printBillElement } from '@/lib/utils/printBill';
import A4BillTemplate from './billing/A4BillTemplate';
import ThermalBillTemplate from './billing/ThermalBillTemplate';

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
  storeName,
  storeEmail,
  storePhone,
  storeAddress,
  storeLogo,
}: InvoiceModalProps) {
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');
  const [billConfig, setBillConfig] = useState<BillSettings>(getBillSettings());
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    setBillConfig(getBillSettings());
    const unsub = subscribeToKey('bill_settings', (data: any) => {
      if (data) setBillConfig(data);
    });
    return () => unsub();
  }, []);

  if (!isOpen || !order) return null;

  // Merge any explicit props over billConfig
  const effectiveSettings: BillSettings = {
    ...billConfig,
    storeName: storeName || billConfig.storeName,
    storeLogo: storeLogo !== undefined ? storeLogo : billConfig.storeLogo,
    storeAddress: storeAddress || billConfig.storeAddress,
    phone: storePhone || billConfig.phone,
    email: storeEmail || billConfig.email,
  };

  const handlePrint = async (format: 'a4' | 'thermal') => {
    setPrintFormat(format);
    setIsPrinting(true);

    // Give state a frame to update the active template DOM
    setTimeout(async () => {
      try {
        await printBillElement('alhamd-modal-printable-target', {
          format,
          title: `Invoice_${order.invoiceNumber || order.id}`,
        });
      } finally {
        setIsPrinting(false);
      }
    }, 80);
  };

  return (
    <>
      {/* Strict Scoped Print Isolation CSS (for when browser Ctrl+P is pressed while modal is open) */}
      <style
        dangerouslySetInnerHTML={{
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
            /* Make only the active invoice target and children visible */
            #alhamd-modal-printable-target, #alhamd-modal-printable-target * {
              visibility: visible !important;
            }
            #alhamd-modal-printable-target {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: ${printFormat === 'thermal' ? '80mm' : '100%'} !important;
              max-width: ${printFormat === 'thermal' ? '80mm' : '100%'} !important;
              margin: 0 auto !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: #ffffff !important;
              color: #000000 !important;
              display: block !important;
              z-index: 99999999 !important;
            }
            .no-print, [data-no-print], .print-hidden {
              display: none !important;
            }
          }
        `,
        }}
      />

      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
        {/* Modal Container */}
        <div className="bg-white text-neutral-900 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:w-full print:rounded-none">
          {/* Top Action Bar (Screen Only) */}
          <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-950 text-white flex items-center justify-center shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-neutral-950 text-base leading-tight">
                  Invoice &amp; Bill
                </h3>
                <p className="text-xs font-mono text-neutral-500 mt-0.5">
                  #{order.invoiceNumber} • Order #{order.id}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Format Toggle */}
              <div className="flex items-center bg-neutral-200/80 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPrintFormat('a4')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    printFormat === 'a4'
                      ? 'bg-white text-neutral-950 shadow-xs font-bold'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  A4 Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('thermal')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    printFormat === 'thermal'
                      ? 'bg-white text-neutral-950 shadow-xs font-bold'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  Thermal (80mm)
                </button>
              </div>

              {/* Print Action Buttons */}
              <button
                type="button"
                onClick={() => handlePrint('a4')}
                disabled={isPrinting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-950 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print A4</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrint('thermal')}
                disabled={isPrinting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Thermal</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Preview Canvas */}
          <div className="overflow-y-auto p-4 sm:p-8 flex-1 bg-neutral-100/70 print:bg-white print:p-0 print:overflow-visible">
            {/* The Dedicated Printable Container */}
            <div id="alhamd-modal-printable-target">
              {printFormat === 'thermal' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 p-2 print:shadow-none print:border-none print:p-0">
                  <ThermalBillTemplate
                    order={order}
                    settings={effectiveSettings}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 print:shadow-none print:border-none print:p-0">
                  <A4BillTemplate
                    order={order}
                    settings={effectiveSettings}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
