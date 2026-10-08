'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Order, OrderStatus, PaymentStatus, getOrderType } from '@/types/admin';
import { getOrders, filterAndSortOrders } from '@/lib/db/orders';
import { persistCollection } from '@/lib/db/storage';
import { getAdminAuthHeaders } from '@/lib/db/staff';
import InvoiceModal from '@/components/admin/InvoiceModal';
import PosReceiptModal from '@/components/admin/PosReceiptModal';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { formatPrice } from '@/lib/utils';
import {
  Search,
  Filter,
  Eye,
  Printer,
  Calendar,
  CheckCircle,
  Clock,
  Truck,
  Package,
  XCircle,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Receipt,
  Store,
  Globe,
  Building2,
  Crown,
} from 'lucide-react';

export default function AdminOrdersPage() {
  const { admin, isManager } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>(() => getOrders());
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'online' | 'pos' | 'wholesale' | 'super_wholesale'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [selectedPosOrder, setSelectedPosOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/orders', {
        headers: getAdminAuthHeaders(admin?.email),
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
        await persistCollection('orders', data.orders, true);
      } else {
        setOrders(getOrders());
        if (data.error) {
          console.warn('Orders fetch warning:', data.error);
        }
      }
    } catch (err) {
      console.warn('Network error fetching orders:', err);
      setOrders(getOrders());
    } finally {
      setIsLoading(false);
    }
  }, [admin?.email]);

  useEffect(() => {
    // 1. Initial render from cache to eliminate layout shift
    setOrders(getOrders());
    // 2. Authoritative server sync from production database
    fetchOrders();

    const handleUpdate = () => {
      setOrders(getOrders());
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [fetchOrders]);

  useEffect(() => {
    const filtered = filterAndSortOrders(orders, {
      query: searchQuery,
      status: statusFilter,
      paymentStatus: paymentFilter,
      source: sourceFilter,
      sortBy,
    });
    setFilteredOrders(filtered);
  }, [orders, searchQuery, statusFilter, paymentFilter, sourceFilter, sortBy]);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3000);
  };

  const showError = (msg: string) => {
    setStatusError(msg);
    setTimeout(() => setStatusError(null), 5000);
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    // Find the previous status for rollback
    const prevStatus = orders.find((o) => o.id === orderId)?.status;
    if (!prevStatus || prevStatus === newStatus) return;

    // Optimistic update: update local state immediately for snappy UI
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    setIsUpdating(orderId);

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAdminAuthHeaders(admin?.email),
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Rollback optimistic update on failure
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: prevStatus } : o))
        );
        showError(`Failed to update order status: ${data.error || res.statusText || 'Server error'}`);
      } else {
        showToast('Order status updated successfully.');
        // Re-sync from server response to ensure consistency
        if (data.order) {
          setOrders((prev) => {
            const next = prev.map((o) => (o.id === orderId ? { ...o, ...data.order, id: o.id } : o));
            persistCollection('orders', next, true).catch(() => {});
            return next;
          });
        }
      }
    } catch (err: any) {
      // Network error — rollback
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: prevStatus } : o))
      );
      showError('Failed to update order status. Please check your connection and try again.');
    } finally {
      setIsUpdating(null);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" />
            Delivered
          </span>
        );
      case 'Shipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <Truck className="w-3.5 h-3.5" />
            Shipped
          </span>
        );
      case 'Out for Delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">
            <Truck className="w-3.5 h-3.5" />
            Out for Delivery
          </span>
        );
      case 'Packed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
            <Package className="w-3.5 h-3.5" />
            Packed
          </span>
        );
      case 'Processing':
      case 'Confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Package className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'Cancelled':
      case 'Refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-500/10 text-neutral-600 border border-neutral-500/20">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  return (
    <>
      <div className="space-y-6 print:hidden">
      {/* Toast Notifications */}
      {statusToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-neutral-950 text-white text-xs font-semibold rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-300">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          {statusToast}
        </div>
      )}
      {statusError && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-rose-600 text-white text-xs font-semibold rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-300 max-w-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          {statusError}
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Orders Management</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Track customer shipments, update fulfillment states, and generate invoices
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchOrders}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
            title="Fetch latest orders from production database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Syncing...' : 'Refresh Orders'}</span>
          </button>

          {!isManager && (
            <Link
              href="/admin/invoices"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-colors border border-neutral-200"
            >
              <Receipt className="w-4 h-4" />
              Invoices Archive
            </Link>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, Customer, Phone, SKU, Cashier..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
            />
          </div>

          {/* Source / Channel Filter */}
          <div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer font-medium"
            >
              <option value="all">All Channels (All)</option>
              <option value="wholesale">Wholesale Orders</option>
              <option value="super_wholesale">Super Wholesale Orders</option>
              <option value="online">Online Orders</option>
              <option value="pos">Walk-In / POS Orders</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
            >
              <option value="all">All Order Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="out for delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="highest">Sort: Highest Amount</option>
              <option value="lowest">Sort: Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="py-3 px-4">Order ID & Source</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    No orders match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-bold text-neutral-900 hover:text-neutral-600 transition-colors flex items-center gap-1 font-mono"
                      >
                        #{order.id}
                        <ChevronRight className="w-3 h-3 text-neutral-400" />
                      </Link>
                      <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                        {order.invoiceNumber}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {(() => {
                          const orderType = getOrderType(order);
                          if (orderType === 'super_wholesale') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                <Crown className="w-3 h-3 text-purple-700" />
                                SUPER WHOLESALE
                              </span>
                            );
                          }
                          if (orderType === 'wholesale') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Building2 className="w-3 h-3 text-indigo-600" />
                                WHOLESALE
                              </span>
                            );
                          }
                          if (orderType === 'walk_in') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Store className="w-3 h-3 text-emerald-600" />
                                WALK-IN CUSTOMER
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Globe className="w-3 h-3 text-blue-600" />
                              ONLINE ORDER
                            </span>
                          );
                        })()}
                        {order.cashierName && (
                          <span className="text-[10px] text-neutral-500 font-medium">
                            • {order.cashierName}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {getOrderType(order) === 'wholesale' || getOrderType(order) === 'super_wholesale' ? (
                        <>
                          <div className="font-bold text-neutral-950 flex items-center gap-1">
                            <span>{order.shopName || order.customer.firstName}</span>
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono">
                            {order.customer.phone}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-neutral-900">
                            {order.customer.firstName} {order.customer.lastName}
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate max-w-[160px]">
                            {order.customer.email || '—'}
                          </div>
                        </>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-neutral-600 whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-neutral-700">
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)} pcs
                        </span>
                        {(order.hasBackorder || order.stockStatus === 'PARTIAL_STOCK' || order.stockStatus === 'BACKORDER') && (
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            Backorder
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 truncate max-w-[140px]">
                        {order.items[0]?.itemType === 'DEAL'
                          ? `[Deal] ${order.items[0]?.dealName || order.items[0]?.productName}`
                          : order.items[0]?.productName}
                        {order.items.length > 1 && ` +${order.items.length - 1} more`}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold font-mono text-neutral-900">
                      {formatPrice(order.total)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          order.paymentStatus === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        disabled={isUpdating === order.id}
                        className="text-xs font-semibold bg-transparent border-0 cursor-pointer focus:ring-0 text-neutral-800 hover:text-neutral-950"
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
                      <div>{getStatusBadge(order.status)}</div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {order.orderSource === 'POS' ? (
                          <button
                            onClick={() => setSelectedPosOrder(order)}
                            title="Reprint POS Bill"
                            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>REPRINT BILL</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedOrderForInvoice(order)}
                            title="Print Bill / Invoice"
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          href={`/admin/orders/${order.id}`}
                          title="View Order Details"
                          className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
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
      </div>

      {/* Standard Invoice Modal */}
      {selectedOrderForInvoice && (
        <InvoiceModal
          isOpen={!!selectedOrderForInvoice}
          order={selectedOrderForInvoice}
          onClose={() => setSelectedOrderForInvoice(null)}
        />
      )}

      {/* POS Thermal & A4 Receipt Modal for POS Orders */}
      {selectedPosOrder && (
        <PosReceiptModal
          isOpen={!!selectedPosOrder}
          order={selectedPosOrder}
          onClose={() => setSelectedPosOrder(null)}
          onNewSale={() => setSelectedPosOrder(null)}
        />
      )}
    </>
  );
}
