'use client';

import React, { useState } from 'react';
import { ShopBill } from '@/types/admin';
import {
  Printer,
  X,
  Warehouse,
  Store,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
} from 'lucide-react';
import { getBillSettings } from '@/lib/db/billSettings';
import { printBillElement } from '@/lib/utils/printBill';
import { resolveThermalWidth } from '@/lib/utils/thermalWidth';

interface ShopBillModalProps {
  bill: ShopBill;
  isOpen: boolean;
  onClose: () => void;
  onFinalize?: (bill: ShopBill) => void;
  isFinalizing?: boolean;
}

export function ShopBillModal({
  bill,
  isOpen,
  onClose,
  onFinalize,
  isFinalizing = false,
}: ShopBillModalProps) {
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');
  const billSettings = getBillSettings();
  const thermalResolved = resolveThermalWidth(
    billSettings.thermalPaperWidth,
    billSettings.thermalCustomWidth
  );

  if (!isOpen || !bill) return null;

  const handlePrint = (format: 'a4' | 'thermal') => {
    setPrintFormat(format);
    setTimeout(() => {
      printBillElement('printable-shop-bill', {
        format,
        paperWidth: format === 'thermal' ? thermalResolved.widthCss : undefined,
        customWidth: format === 'thermal' ? thermalResolved.customWidth : undefined,
        title: `ShopTransfer_${bill.billNumber}`,
      });
    }, 80);
  };

  const totalTransferUnits = bill.items.reduce((sum, item) => sum + item.transferQuantity, 0);

  const formattedDate = new Date(bill.createdAt).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = new Date(bill.createdAt).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      {/* Print Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-shop-bill, #printable-shop-bill * {
              visibility: visible;
            }
            #printable-shop-bill {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: ${printFormat === 'thermal' ? '10px' : '25px'};
              font-size: ${printFormat === 'thermal' ? '11px' : '13px'};
              color: black !important;
              background: white !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `,
        }}
      />

      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-neutral-200 overflow-hidden my-6">
          {/* Action Header (No Print) */}
          <div className="no-print px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                Shop Bill Preview
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                  bill.status === 'finalized'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : bill.status === 'voided'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {bill.status}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrint('a4')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print A4
              </button>
              <button
                type="button"
                onClick={() => handlePrint('thermal')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 text-neutral-700 hover:bg-neutral-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Thermal
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-neutral-200/60 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Printable Shop Bill Document */}
          <div id="printable-shop-bill" className="p-6 sm:p-8 space-y-6">
            {/* Bill Title Banner */}
            <div className="text-center pb-5 border-b-2 border-neutral-900">
              <p className="text-xs font-black tracking-widest text-neutral-400 uppercase">
                {billSettings.storeName || 'AL-HAMD MOBILE'}
              </p>
              <h1 className="text-3xl font-black text-neutral-950 tracking-tight mt-1">
                SHOP BILL
              </h1>
              <p className="text-xs font-semibold text-violet-700 tracking-wider uppercase mt-1">
                Warehouse → Shop Stock Transfer
              </p>
            </div>

            {/* Bill Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">
                  Bill Number
                </span>
                <span className="font-extrabold text-neutral-900 text-sm">{bill.billNumber}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Date &amp; Time</span>
                <span className="font-semibold text-neutral-800">
                  {formattedDate} {formattedTime}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Source Location</span>
                <span className="font-bold text-neutral-800 flex items-center gap-1">
                  <Warehouse className="w-3 h-3 text-neutral-500" /> Warehouse
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Destination</span>
                <span className="font-bold text-violet-700 flex items-center gap-1">
                  <Store className="w-3 h-3 text-violet-600" /> Shop Stock
                </span>
              </div>
            </div>

            {/* Additional info */}
            <div className="flex flex-wrap items-center justify-between text-xs text-neutral-500 gap-2 px-1">
              <span>
                Created by: <strong className="text-neutral-800">{bill.createdBy}</strong>
              </span>
              {bill.finalizedBy && (
                <span>
                  Finalized by: <strong className="text-emerald-700">{bill.finalizedBy}</strong>
                </span>
              )}
              {bill.voidedBy && (
                <span className="text-rose-600 font-semibold">
                  Voided by {bill.voidedBy}: {bill.voidReason}
                </span>
              )}
            </div>

            {/* Line Items Table */}
            <div className="border border-neutral-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100/70 border-b border-neutral-200 text-neutral-700 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Product Name &amp; SKU</th>
                    <th className="py-2.5 px-3 text-center">Transfer Qty</th>
                    {bill.status === 'finalized' && (
                      <>
                        <th className="py-2.5 px-3 text-center">Warehouse</th>
                        <th className="py-2.5 px-3 text-center">Shop Stock</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {bill.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-3 text-neutral-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-neutral-900">{item.productName}</p>
                        {item.modelName && (
                          <p className="text-[11px] text-violet-600 font-medium">{item.modelName}</p>
                        )}
                        {item.sku && <p className="text-[11px] text-neutral-400">SKU: {item.sku}</p>}
                      </td>
                      <td className="py-3 px-3 text-center font-black text-sm text-neutral-950">
                        {item.transferQuantity}
                      </td>
                      {bill.status === 'finalized' && (
                        <>
                          <td className="py-3 px-3 text-center text-xs">
                            <span className="text-rose-600 font-semibold">{item.warehouseStockBefore}</span>
                            <span className="text-neutral-400 mx-1">→</span>
                            <span className="font-bold text-neutral-900">{item.warehouseStockAfter}</span>
                          </td>
                          <td className="py-3 px-3 text-center text-xs">
                            <span className="text-neutral-400">{item.shopStockBefore}</span>
                            <span className="text-neutral-400 mx-1">→</span>
                            <span className="font-bold text-emerald-700">{item.shopStockAfter}</span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bill Summary Footer */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
              <div className="text-xs text-neutral-600">
                <p>
                  <strong>Total Products:</strong> {bill.items.length} item(s)
                </p>
                {bill.notes && (
                  <p className="mt-1">
                    <strong>Notes:</strong> {bill.notes}
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Total Units Transferred
                </span>
                <span className="text-2xl font-black text-neutral-950">{totalTransferUnits} Units</span>
              </div>
            </div>

            {/* Verification Signatures (for official paper record) */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
              <div>
                <p className="font-semibold text-neutral-700">Dispatched from Warehouse:</p>
                <div className="mt-8 pt-2 border-t border-neutral-300 text-[11px]">
                  Signature &amp; Date
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-neutral-700">Received at Shop Counter:</p>
                <div className="mt-8 pt-2 border-t border-neutral-300 text-[11px]">
                  Signature &amp; Date
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer (No Print) */}
          {bill.status === 'draft' && onFinalize && (
            <div className="no-print px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
              <p className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                This is a draft bill. Finalizing will move warehouse stock to shop stock.
              </p>
              <button
                type="button"
                onClick={() => onFinalize(bill)}
                disabled={isFinalizing}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-md shadow-emerald-200 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isFinalizing ? 'Finalizing...' : 'Finalize Transfer Now'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
