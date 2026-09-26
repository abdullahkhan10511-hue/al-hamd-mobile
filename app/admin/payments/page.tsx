'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Check,
  X,
  Printer,
  ExternalLink,
  Eye,
  AlertCircle,
  FileText,
  DollarSign,
  Smartphone,
  CreditCard,
  Banknote,
  Calendar,
} from 'lucide-react';
import { Order, PaymentStatus } from '@/types/admin';
import { getOrders, verifyPayment, rejectPayment } from '@/lib/db/orders';
import { formatPrice } from '@/lib/utils';
import { useAdminAuth } from '@/context/AdminAuthContext';
import InvoiceModal from '@/components/admin/InvoiceModal';

export default function AdminPaymentVerificationPage() {
  const { admin } = useAdminAuth();
  const adminEmail = admin?.email || 'admin@alhamd.com';

  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cod' | 'easypaisa' | 'jazzcash' | 'card'>('all');

  // Verification Dialog State
  const [verifyingOrder, setVerifyingOrder] = useState<Order | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Invoice modal
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  const loadData = () => {
    const list = getOrders();
    setOrders(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerNotice = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingOrder) return;

    setIsSubmitting(true);
    try {
      await verifyPayment(verifyingOrder.id, adminEmail, verificationNote);
      loadData();
      triggerNotice(`Payment for order #${verifyingOrder.id} successfully VERIFIED and marked as Paid.`);
      setVerifyingOrder(null);
      setVerificationNote('');
    } catch (err) {
      console.error(err);
      alert('Failed to verify payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingOrder) return;

    setIsSubmitting(true);
    try {
      await rejectPayment(rejectingOrder.id, adminEmail, rejectionReason);
      loadData();
      triggerNotice(`Payment for order #${rejectingOrder.id} marked as Failed.`);
      setRejectingOrder(null);
      setRejectionReason('');
    } catch (err) {
      console.error(err);
      alert('Failed to reject payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = o.id.toLowerCase().includes(q);
      const matchInv = o.invoiceNumber.toLowerCase().includes(q);
      const matchCustomer =
        `${o.customer.firstName} ${o.customer.lastName}`.toLowerCase().includes(q) ||
        o.customer.phone.toLowerCase().includes(q) ||
        Boolean(o.customer.email && o.customer.email.toLowerCase().includes(q)) ||
        Boolean(o.shopName && o.shopName.toLowerCase().includes(q));
      const matchRef = o.paymentReference ? o.paymentReference.toLowerCase().includes(q) : false;
      const matchMethod = o.paymentMethod.toLowerCase().includes(q);

      if (!matchId && !matchInv && !matchCustomer && !matchRef && !matchMethod) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (o.paymentStatus !== statusFilter) return false;
    }

    // Method filter
    if (methodFilter !== 'all') {
      const m = o.paymentMethod.toLowerCase();
      if (!m.includes(methodFilter)) return false;
    }

    return true;
  });

  // Aggregate Metrics
  const awaitingCount = orders.filter((o) => o.paymentStatus === 'Awaiting Verification').length;
  const awaitingTotal = orders
    .filter((o) => o.paymentStatus === 'Awaiting Verification')
    .reduce((sum, o) => sum + o.total, 0);

  const paidCount = orders.filter((o) => o.paymentStatus === 'Paid').length;
  const paidTotal = orders
    .filter((o) => o.paymentStatus === 'Paid')
    .reduce((sum, o) => sum + o.total, 0);

  const pendingCount = orders.filter((o) => o.paymentStatus === 'Pending').length;

  const renderStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Check className="w-3 h-3" /> Paid
          </span>
        );
      case 'Awaiting Verification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <Clock className="w-3 h-3" /> Awaiting Verification
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" /> Pending (COD)
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <X className="w-3 h-3" /> Failed
          </span>
        );
      case 'Refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-200 text-neutral-800 border border-neutral-300">
            Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-neutral-100 text-neutral-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 uppercase flex items-center gap-2.5">
            <span>Payment Verification</span>
            {awaitingCount > 0 && (
              <span className="text-xs bg-amber-500 text-white font-bold px-2.5 py-0.5 rounded-full font-mono">
                {awaitingCount} Awaiting
              </span>
            )}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Reconcile customer transaction reference IDs (TID) against merchant statements for manual wallet payments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/payment-methods"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            <span>Configure Payment Methods</span>
          </Link>
        </div>
      </div>

      {/* Notice Banner */}
      {feedbackNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-medium flex items-center gap-2 shadow-xs animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Awaiting Verification
            </span>
            <div className="text-2xl font-black text-amber-600 font-mono">
              {awaitingCount} orders
            </div>
            <span className="text-xs font-mono text-neutral-500">
              Total: {formatPrice(awaitingTotal)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Verified &amp; Paid
            </span>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {paidCount} orders
            </div>
            <span className="text-xs font-mono text-neutral-500">
              Collected: {formatPrice(paidTotal)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Pending Cash on Delivery
            </span>
            <div className="text-2xl font-black text-blue-600 font-mono">
              {pendingCount} orders
            </div>
            <span className="text-xs text-neutral-500">
              Receivable upon parcel handover
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Banknote className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, TID, Customer, Phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 font-sans"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('Awaiting Verification')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Awaiting Verification'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span>Awaiting</span>
              <span className="text-[10px] bg-white/30 px-1.5 py-0.2 rounded-full font-mono">
                {awaitingCount}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('Paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Paid' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Paid ({paidCount})
            </button>
            <button
              onClick={() => setStatusFilter('Pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Pending' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('Failed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Failed' ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Failed
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-800">
            <thead className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold uppercase tracking-wider text-neutral-500 font-mono">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Order ID &amp; Date</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Method</th>
                <th className="py-3.5 px-4">Payment Ref (TID)</th>
                <th className="py-3.5 px-4 text-right">Amount (PKR)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="font-semibold text-neutral-600">No payment records found</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Try adjusting search terms or status filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50/60 transition-colors">
                    {/* Order ID & Date */}
                    <td className="py-4 px-4 sm:px-6">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-bold text-neutral-950 hover:underline flex items-center gap-1.5"
                      >
                        <span>#{order.id}</span>
                        <ExternalLink className="w-3 h-3 text-neutral-400" />
                      </Link>
                      <span className="text-[11px] text-neutral-400 block mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString()} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-neutral-900">
                        {order.customer.firstName} {order.customer.lastName}
                      </div>
                      <div className="text-[11px] text-neutral-500 font-mono">
                        {order.customer.phone}
                      </div>
                    </td>

                    {/* Payment Method */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 text-xs font-semibold">
                        {order.paymentMethod}
                      </span>
                    </td>

                    {/* Payment Reference (TID) */}
                    <td className="py-4 px-4">
                      {order.paymentReference ? (
                        <div className="space-y-0.5">
                          <code className="text-xs font-mono font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 inline-block">
                            {order.paymentReference}
                          </code>
                          {order.paymentVerification?.note && (
                            <p className="text-[10px] text-neutral-500 italic truncate max-w-[200px]">
                              Note: {order.paymentVerification.note}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400 font-mono text-xs">—</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-4 px-4 text-right font-mono font-bold text-neutral-950">
                      {formatPrice(order.total)}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      {renderStatusBadge(order.paymentStatus)}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Verify / Reject buttons for manual transactions */}
                        {order.paymentStatus === 'Awaiting Verification' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setVerifyingOrder(order);
                                setVerificationNote('Verified in merchant ledger');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                              title="Verify Payment"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Verify</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRejectingOrder(order);
                                setRejectionReason('Transaction ID not found in account');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
                              title="Reject Payment"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {/* Invoice Modal Trigger */}
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceOrder(order)}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                          title="View & Print Invoice"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verify Payment Modal */}
      {verifyingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-neutral-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle className="w-5 h-5" />
                <h3 className="font-bold text-neutral-950 text-base">Verify Payment</h3>
              </div>
              <button
                onClick={() => setVerifyingOrder(null)}
                className="w-7 h-7 rounded-lg hover:bg-neutral-100 text-neutral-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 p-3.5 rounded-xl bg-neutral-50 text-xs font-mono text-neutral-800">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Order ID:</span>
                <strong>#{verifyingOrder.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Customer:</span>
                <span>
                  {verifyingOrder.customer.firstName} {verifyingOrder.customer.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Payment Method:</span>
                <strong>{verifyingOrder.paymentMethod}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Payment Reference:</span>
                <span className="font-bold text-emerald-700">
                  {verifyingOrder.paymentReference || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-1.5 font-bold text-emerald-800">
                <span className="font-sans">Payable Amount:</span>
                <span>{formatPrice(verifyingOrder.total)}</span>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Verification Audit Note (Optional)
                </label>
                <input
                  type="text"
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  placeholder="e.g. Verified in Meezan / Easypaisa statement"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingOrder(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Verifying...' : 'Confirm & Mark Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Payment Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-neutral-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <h3 className="font-bold text-neutral-950 text-base">Reject Payment</h3>
              </div>
              <button
                onClick={() => setRejectingOrder(null)}
                className="w-7 h-7 rounded-lg hover:bg-neutral-100 text-neutral-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 p-3.5 rounded-xl bg-neutral-50 text-xs font-mono text-neutral-800">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Order ID:</span>
                <strong>#{rejectingOrder.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Reference (TID):</span>
                <span className="font-bold text-red-600">
                  {rejectingOrder.paymentReference || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-sans">Amount:</span>
                <span>{formatPrice(rejectingOrder.total)}</span>
              </div>
            </div>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Reason for Rejection *
                </label>
                <input
                  type="text"
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Transaction ID not found in bank statement"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingOrder(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Rejecting...' : 'Reject Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {selectedInvoiceOrder && (
        <InvoiceModal
          isOpen={!!selectedInvoiceOrder}
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
