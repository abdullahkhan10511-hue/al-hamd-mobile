'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Order } from '@/types/admin';
import { getOrders, syncOrdersFromApi } from '@/lib/db/orders';
import { useAdminAuth } from '@/context/AdminAuthContext';
import InvoiceModal from '@/components/admin/InvoiceModal';
import {
  FileText,
  Search,
  Printer,
  Calendar,
  DollarSign,
  ChevronRight,
  Receipt,
  Download,
  CheckCircle,
} from 'lucide-react';

export default function AdminInvoicesPage() {
  const { admin } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadData = () => {
    const list = getOrders();
    setOrders(list);
  };

  useEffect(() => {
    loadData();
    syncOrdersFromApi(admin?.email).then((synced) => {
      if (synced && synced.length > 0) {
        setOrders(synced);
      }
    }).catch(() => {});

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [admin?.email]);

  const filtered = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      o.invoiceNumber?.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.customer.firstName.toLowerCase().includes(q) ||
      o.customer.lastName.toLowerCase().includes(q) ||
      Boolean(o.customer.email && o.customer.email.toLowerCase().includes(q)) ||
      Boolean(o.shopName && o.shopName.toLowerCase().includes(q))
    );
  });

  const totalInvoiced = orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Invoices & Bills</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Compliant printable tax invoices and thermal receipts for retail and audit
          </p>
        </div>

        <div className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-xs flex items-center gap-3">
          <span className="text-neutral-400">Total Billed:</span>
          <span className="font-bold font-mono text-sm">${totalInvoiced.toFixed(2)}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Invoice Number (INV-2026-...), Order #, Customer..."
          className="w-full bg-transparent text-xs text-neutral-900 focus:outline-none"
        />
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Print Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    No invoices match your search query.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-neutral-900">
                      {order.invoiceNumber}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-neutral-600">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="hover:underline flex items-center gap-1"
                      >
                        #{order.id}
                        <ChevronRight className="w-3 h-3 text-neutral-400" />
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-neutral-900">
                        {order.customer.firstName} {order.customer.lastName}
                      </div>
                      <div className="text-[10px] text-neutral-500">{order.customer.email}</div>
                    </td>

                    <td className="py-3.5 px-4 text-neutral-600 whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-neutral-900">
                      ${order.total.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3" />
                        {order.paymentStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print A4 / Thermal
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal for Printing */}
      {selectedOrder && (
        <InvoiceModal
          isOpen={!!selectedOrder}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
