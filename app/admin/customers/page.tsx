'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Customer, Order } from '@/types/admin';
import { getCustomers, getCustomerOrders, updateCustomerStatus } from '@/lib/db/customers';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  Users,
  Search,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  DollarSign,
  ChevronRight,
  UserCheck,
  UserX,
  AlertTriangle,
  X,
  CheckCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

export default function AdminCustomersPage() {
  const { admin } = useAdminAuth();
  const userEmail = admin?.email || 'admin@alhamd.com';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Status Action Modal states
  const [pendingAction, setPendingAction] = useState<{
    customer: Customer;
    action: 'suspend' | 'deactivate';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    const list = await getCustomers();
    setCustomers(list);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const openCustomerProfile = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingOrders(true);
    const orders = await getCustomerOrders(customer.email || customer.shopName || customer.id);
    setCustomerOrders(orders);
    setLoadingOrders(false);
  };

  const handleActivate = async (customer: Customer) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const success = await updateCustomerStatus(customer.id, 'active', userEmail);
      if (success) {
        await loadData();
        if (selectedCustomer?.id === customer.id) {
          setSelectedCustomer({ ...customer, status: 'active' });
        }
        setStatusMessage(`Account for ${customer.firstName} ${customer.lastName} is now ACTIVE.`);
        setTimeout(() => setStatusMessage(''), 3500);
      } else {
        setErrorMessage('Failed to activate customer account.');
        setTimeout(() => setErrorMessage(''), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred while activating account.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeStatusAction = async () => {
    if (!pendingAction || isProcessing) return;

    const { customer, action } = pendingAction;
    setIsProcessing(true);
    try {
      const newStatus = action === 'suspend' ? 'suspended' : 'deactivated';
      const success = await updateCustomerStatus(customer.id, newStatus, userEmail);
      if (success) {
        await loadData();
        if (selectedCustomer?.id === customer.id) {
          setSelectedCustomer({ ...customer, status: newStatus });
        }
        setStatusMessage(
          `Customer ${customer.firstName} ${customer.lastName} has been ${newStatus.toUpperCase()}.`
        );
        setTimeout(() => setStatusMessage(''), 3500);
        setPendingAction(null);
      } else {
        setErrorMessage(`Failed to update customer status to ${action}.`);
        setTimeout(() => setErrorMessage(''), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred while updating customer status.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      Boolean(c.email && c.email.toLowerCase().includes(q)) ||
      Boolean(c.shopName && c.shopName.toLowerCase().includes(q)) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  const renderStatusBadge = (status: Customer['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserCheck className="w-3 h-3 text-emerald-600" />
            <span>Active</span>
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Suspended</span>
          </span>
        );
      case 'deactivated':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <UserX className="w-3 h-3 text-rose-600" />
            <span>Deactivated</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
            <span>{status || 'Inactive'}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Customers & Clients</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Registered patrons, account management (Activate, Suspend, Deactivate), and order histories
          </p>
        </div>

        <div className="bg-white px-4 py-2 rounded-xl border border-neutral-200 text-xs flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-500" />
          <span className="text-neutral-500">Total Patrons:</span>
          <span className="font-bold text-neutral-900">{customers.length}</span>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          {errorMessage}
        </div>
      )}

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by customer name, email address, or phone..."
          className="w-full bg-transparent text-xs text-neutral-900 focus:outline-none"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-right">Lifetime Spent</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    No customers found matching search.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-neutral-900">
                      <button
                        onClick={() => openCustomerProfile(c)}
                        className="hover:underline flex items-center gap-1.5 text-left cursor-pointer"
                      >
                        {c.firstName} {c.lastName}
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-neutral-600">{c.email}</td>

                    <td className="py-3.5 px-4 text-neutral-600 font-mono text-[11px]">{c.phone}</td>

                    <td className="py-3.5 px-4 text-center font-bold text-neutral-800">
                      {c.totalOrders}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-900">
                      ${c.totalSpent.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4">
                      {renderStatusBadge(c.status)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* If not active, show Activate button */}
                        {c.status !== 'active' && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleActivate(c)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            title="Activate account"
                          >
                            Activate
                          </button>
                        )}

                        {/* If active or not suspended, can Suspend */}
                        {c.status !== 'suspended' && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => setPendingAction({ customer: c, action: 'suspend' })}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            title="Suspend customer account"
                          >
                            Suspend
                          </button>
                        )}

                        {/* If not deactivated, can Deactivate */}
                        {c.status !== 'deactivated' && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => setPendingAction({ customer: c, action: 'deactivate' })}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            title="Deactivate customer account"
                          >
                            Deactivate
                          </button>
                        )}

                        <button
                          onClick={() => openCustomerProfile(c)}
                          className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Profile
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

      {/* Confirmation Modal for Suspend / Deactivate */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  pendingAction.action === 'suspend'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-neutral-900">
                  {pendingAction.action === 'suspend'
                    ? 'Suspend Customer Account?'
                    : 'Deactivate Customer Account?'}
                </h3>
                <p className="text-xs text-neutral-600 mt-1">
                  Are you sure you want to {pendingAction.action} the account of{' '}
                  <span className="font-semibold text-neutral-900">
                    {pendingAction.customer.firstName} {pendingAction.customer.lastName}
                  </span>{' '}
                  ({pendingAction.customer.email})?
                </p>
                <p className="text-[11px] text-neutral-500 mt-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                  {pendingAction.action === 'suspend'
                    ? 'The customer will be blocked from logging into their account and placing orders until reactivated. Existing orders and profile data remain completely preserved.'
                    : 'The customer account will be disabled until an administrator reactivates it. All historical order records remain intact.'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={executeStatusAction}
                className={`px-4 py-2 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 ${
                  pendingAction.action === 'suspend'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isProcessing
                  ? 'Updating Status...'
                  : pendingAction.action === 'suspend'
                  ? 'Confirm Suspension'
                  : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Profile Modal Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                  <span>{selectedCustomer.firstName} {selectedCustomer.lastName}</span>
                  {renderStatusBadge(selectedCustomer.status)}
                </h3>
                <p className="text-xs text-neutral-500">
                  Patron since {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Stats Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                  <span className="text-neutral-500">Total Orders</span>
                  <p className="text-lg font-bold font-mono text-neutral-900 mt-1">{selectedCustomer.totalOrders}</p>
                </div>
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                  <span className="text-neutral-500">Total Spent</span>
                  <p className="text-lg font-bold font-mono text-neutral-900 mt-1">${selectedCustomer.totalSpent.toFixed(2)}</p>
                </div>
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                  <span className="text-neutral-500">Account Status</span>
                  <div className="mt-1">{renderStatusBadge(selectedCustomer.status)}</div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="border border-neutral-200 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-neutral-800 text-xs">Contact Info</h4>
                <div className="flex items-center gap-2 text-neutral-600">
                  <Mail className="w-4 h-4 text-neutral-400" />
                  <span>{selectedCustomer.email}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-600">
                  <Phone className="w-4 h-4 text-neutral-400" />
                  <span>{selectedCustomer.phone}</span>
                </div>
              </div>

              {/* Order History */}
              <div className="space-y-3">
                <h4 className="font-bold text-neutral-900 text-xs flex items-center justify-between">
                  <span>Order History</span>
                  <span className="text-neutral-400 font-normal">{customerOrders.length} orders found</span>
                </h4>

                {loadingOrders ? (
                  <div className="p-6 text-center text-neutral-400">Loading order records...</div>
                ) : customerOrders.length === 0 ? (
                  <div className="p-6 text-center text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
                    No orders associated with this email yet.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                    {customerOrders.map((ord) => (
                      <div key={ord.id} className="p-3.5 hover:bg-neutral-50 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-neutral-900">#{ord.id}</span>
                            <span className="text-[10px] font-mono text-neutral-500">({ord.invoiceNumber})</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700">
                              {ord.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-1">
                            {new Date(ord.createdAt).toLocaleDateString()} • {ord.items?.length || 0} items
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <span className="font-mono font-bold text-neutral-900 text-sm">
                            ${ord.total.toFixed(2)}
                          </span>
                          <Link
                            href={`/admin/orders/${ord.id}`}
                            className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Account Status Actions inside Modal */}
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                <h4 className="font-bold text-neutral-800 text-xs">Account Status Controls</h4>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCustomer.status !== 'active' && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleActivate(selectedCustomer)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Activate Customer Account
                    </button>
                  )}

                  {selectedCustomer.status !== 'suspended' && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setPendingAction({ customer: selectedCustomer, action: 'suspend' })}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Suspend Account
                    </button>
                  )}

                  {selectedCustomer.status !== 'deactivated' && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setPendingAction({ customer: selectedCustomer, action: 'deactivate' })}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Deactivate Account
                    </button>
                  )}
                </div>
              </div>

              {/* Close Footer */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold cursor-pointer"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
