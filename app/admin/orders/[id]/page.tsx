'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Order, OrderStatus, PaymentStatus, getOrderType } from '@/types/admin';
import { getOrderById, updateOrderStatus, verifyPayment, rejectPayment } from '@/lib/db/orders';
import { formatPrice } from '@/lib/utils';
import { useAdminAuth } from '@/context/AdminAuthContext';
import InvoiceModal from '@/components/admin/InvoiceModal';
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  Truck,
  Package,
  Clock,
  XCircle,
  CreditCard,
  MapPin,
  User,
  Mail,
  Phone,
  FileText,
  Calendar,
  AlertCircle,
  Check,
  X,
  ShieldCheck,
  Building2,
  Store,
  Globe,
} from 'lucide-react';

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { admin } = useAdminAuth();
  const adminEmail = admin?.email || 'admin@alhamd.com';

  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<OrderStatus>('Pending');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pending');
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Verification dialog states
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const reloadOrder = () => {
    if (orderId) {
      const found = getOrderById(orderId);
      if (found) {
        setOrder(found);
        setStatus(found.status);
        setPaymentStatus(found.paymentStatus);
      }
    }
  };

  useEffect(() => {
    reloadOrder();
  }, [orderId]);

  if (!order) {
    return (
      <div className="p-12 text-center">
        <AlertCircle className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-neutral-900">Order Not Found</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-4">The order ID #{orderId} does not exist in the database.</p>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </Link>
      </div>
    );
  }

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleUpdateStatus = async () => {
    setIsSaving(true);
    await updateOrderStatus(order.id, status, paymentStatus, adminEmail);
    reloadOrder();
    setIsSaving(false);
    showFeedback('Order and payment status updated successfully.');
  };

  const handleConfirmVerification = async () => {
    setIsSaving(true);
    await verifyPayment(order.id, adminEmail, verifyNote || 'Verified in merchant ledger');
    reloadOrder();
    setIsVerifying(false);
    setIsSaving(false);
    showFeedback('Payment marked as Verified & Paid.');
  };

  const handleConfirmRejection = async () => {
    setIsSaving(true);
    await rejectPayment(order.id, adminEmail, rejectReason || 'Transaction ID not verified');
    reloadOrder();
    setIsRejecting(false);
    setIsSaving(false);
    showFeedback('Payment marked as Rejected / Failed.');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Back button and page title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="w-9 h-9 flex items-center justify-center bg-white border border-neutral-200 rounded-xl text-neutral-600 hover:text-neutral-950 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Order #{order.id}</h1>
              <span className="text-xs font-mono bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded border border-neutral-200">
                {order.invoiceNumber}
              </span>
              {(() => {
                const orderType = getOrderType(order);
                if (orderType === 'wholesale') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      <Building2 className="w-3.5 h-3.5" />
                      WHOLESALE ORDER
                    </span>
                  );
                }
                if (orderType === 'walk_in') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Store className="w-3.5 h-3.5" />
                      WALK-IN CUSTOMER
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    <Globe className="w-3.5 h-3.5" />
                    ONLINE ORDER
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Placed on {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* PRINT BILL Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsInvoiceOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            PRINT BILL / INVOICE
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-medium flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Items and Fulfillment status */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Card */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6">
            <h2 className="text-sm font-bold text-neutral-900 mb-4 flex items-center justify-between">
              <span>Order Items</span>
              <span className="text-xs font-normal text-neutral-500">
                {order.items.reduce((s, i) => s + i.quantity, 0)} units total
              </span>
            </h2>

            <div className="divide-y divide-neutral-100">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden relative flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.productName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-neutral-900 truncate">{item.productName}</h3>
                    <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
                      SKU: <span className="font-semibold text-neutral-700">{item.sku}</span>
                    </p>
                    {(item.selectedSize || item.selectedColor) && (
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {[item.selectedSize, item.selectedColor].filter(Boolean).join(' / ')}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-neutral-900">{formatPrice(item.total)}</div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      {formatPrice(item.price)} × {item.quantity}
                    </div>
                    {order.customerType === 'WHOLESALE' && (
                      <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 mt-1">
                        Wholesale Rate
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Totals */}
            <div className="mt-6 pt-4 border-t border-neutral-100 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span className="font-mono">{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-mono">-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-neutral-600">
                <span>Shipping ({order.deliveryMethod})</span>
                <span className="font-mono">{order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}</span>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Tax</span>
                  <span className="font-mono">{formatPrice(order.tax)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-neutral-200 flex justify-between text-sm font-bold text-neutral-900">
                <span>Grand Total</span>
                <span className="font-mono text-base">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Fulfillment & Payment Status Changer */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 space-y-4">
            <h2 className="text-sm font-bold text-neutral-900">Update Fulfillment &amp; Payment</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Order Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
                >
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Processing">Processing</option>
                  <option value="Packed">Packed</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
                >
                  <option value="Pending">Pending (COD / Initial)</option>
                  <option value="Awaiting Verification">Awaiting Verification (Wallet)</option>
                  <option value="Paid">Paid</option>
                  <option value="Failed">Failed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleUpdateStatus}
              disabled={isSaving}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSaving ? 'Updating...' : 'Save Status Changes'}
            </button>
          </div>
        </div>

        {/* Right Col: Customer details & Payment Info */}
        <div className="space-y-6">
          {/* Customer Card */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <User className="w-4 h-4 text-neutral-500" />
                Customer Details
              </h2>
              {(() => {
                const orderType = getOrderType(order);
                if (orderType === 'wholesale') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      <Building2 className="w-3 h-3" />
                      WHOLESALE
                    </span>
                  );
                }
                if (orderType === 'walk_in') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Store className="w-3 h-3" />
                      WALK-IN
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    <Globe className="w-3 h-3" />
                    ONLINE
                  </span>
                );
              })()}
            </div>

            <div className="space-y-2 text-xs">
              {getOrderType(order) === 'wholesale' ? (
                <>
                  <div>
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">Shop Name</span>
                    <span className="font-bold text-neutral-900 text-sm flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      {order.shopName || order.customer.firstName}
                    </span>
                  </div>
                  {order.customer.email ? (
                    <div className="flex items-center gap-2 text-neutral-600 pt-1">
                      <Mail className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{order.customer.email}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-neutral-400 pt-1 text-[11px] italic">
                      <Mail className="w-3.5 h-3.5 text-neutral-300" />
                      <span>No email required (Wholesale Account)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="font-mono">{order.customer.phone || 'No phone'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-neutral-900 text-sm">
                    {order.customer.firstName} {order.customer.lastName}
                  </div>
                  {order.customer.email && (
                    <div className="flex items-center gap-2 text-neutral-600">
                      <Mail className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{order.customer.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="font-mono">{order.customer.phone}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Shipping Address Card */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 space-y-4">
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-neutral-500" />
              Shipping Destination
            </h2>

            <div className="text-xs text-neutral-700 space-y-1">
              <p className="font-medium text-neutral-900">{order.shippingAddress.street}</p>
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.postalCode}
              </p>
              <p>{order.shippingAddress.country}</p>
            </div>
          </div>

          {/* Detailed Payment Information Card (Requirement 22) */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-neutral-500" />
                PAYMENT INFORMATION
              </h2>
              <span className="text-[10px] font-mono text-neutral-400 uppercase">PKR</span>
            </div>

            <div className="text-xs space-y-2.5 pt-1">
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Method:</span>
                <span className="font-bold text-neutral-900">{order.paymentMethod}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Amount:</span>
                <span className="font-mono font-bold text-neutral-950 text-sm">
                  {formatPrice(order.total)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    order.paymentStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : order.paymentStatus === 'Awaiting Verification'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : order.paymentStatus === 'Failed'
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  {order.paymentStatus}
                </span>
              </div>

              {order.paymentReference && (
                <div className="flex justify-between items-center border-t border-neutral-100 pt-2">
                  <span className="text-neutral-500">Reference (TID):</span>
                  <code className="bg-neutral-100 px-2 py-0.5 rounded text-xs font-mono font-bold text-neutral-900 border border-neutral-200">
                    {order.paymentReference}
                  </code>
                </div>
              )}

              {/* Verification Metadata */}
              {order.paymentVerification && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 text-[11px] space-y-1">
                  <div className="flex justify-between text-neutral-600">
                    <span>Verified By:</span>
                    <span className="font-mono font-semibold text-neutral-900">{order.paymentVerification.verifiedBy}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Date:</span>
                    <span>{new Date(order.paymentVerification.verifiedAt).toLocaleString()}</span>
                  </div>
                  {order.paymentVerification.note && (
                    <div className="text-neutral-700 italic pt-0.5">
                      &quot;{order.paymentVerification.note}&quot;
                    </div>
                  )}
                </div>
              )}

              {/* Actions for manual verification */}
              {order.paymentStatus === 'Awaiting Verification' && (
                <div className="pt-2 border-t border-neutral-100 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    Verification Actions
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsVerifying(true)}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify Payment</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRejecting(true)}
                      className="w-full py-2 px-3 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Verify Dialog */}
      {isVerifying && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-neutral-200 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-neutral-900">Confirm Payment Verification</h3>
            <p className="text-xs text-neutral-600">
              Confirm that reference <strong>{order.paymentReference || 'N/A'}</strong> has been received in the store account for {formatPrice(order.total)}.
            </p>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Verification Note (Optional)
              </label>
              <input
                type="text"
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                placeholder="e.g. Matched in official Easypaisa statement"
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsVerifying(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerification}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Verify & Mark Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {isRejecting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-neutral-200 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-red-600">Reject Payment</h3>
            <p className="text-xs text-neutral-600">
              Mark this payment as failed. The customer will be informed that the reference could not be validated.
            </p>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Reason for Rejection *
              </label>
              <input
                type="text"
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Transaction ID not found in bank ledger"
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {isInvoiceOpen && (
        <InvoiceModal
          isOpen={isInvoiceOpen}
          order={order}
          onClose={() => setIsInvoiceOpen(false)}
        />
      )}
    </div>
  );
}
