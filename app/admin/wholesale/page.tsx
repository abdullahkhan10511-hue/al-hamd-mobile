'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Customer, Order } from '@/types/admin';
import {
  getWholesaleAccounts,
  createWholesaleAccount,
  updateWholesaleAccount,
  deleteWholesaleAccount,
  updateWholesaleAccountStatus,
  getCustomerOrders,
} from '@/lib/db/customers';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { formatPrice } from '@/lib/utils';
import {
  Building2,
  Plus,
  Search,
  Phone,
  MapPin,
  Calendar,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Eye,
  Edit,
  Trash2,
  X,
  Lock,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  UserCheck,
  UserX,
} from 'lucide-react';

export default function WholesaleManagementPage() {
  const { admin, hasPermission, isSuperAdmin } = useAdminAuth();
  const operatorEmail = admin?.email || 'admin@alhamd.com';
  const canManage = isSuperAdmin || hasPermission('wholesale.manage');

  const [accounts, setAccounts] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingAccount, setViewingAccount] = useState<Customer | null>(null);
  const [editingAccount, setEditingAccount] = useState<Customer | null>(null);
  const [pendingStatusToggle, setPendingStatusToggle] = useState<{
    account: Customer;
    newStatus: 'active' | 'inactive';
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);

  // Form states - Create
  const [createShopName, setCreateShopName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Form states - Edit
  const [editShopName, setEditShopName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Orders for Viewing modal
  const [accountOrders, setAccountOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Toast / feedback message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const adminRaw = typeof window !== 'undefined' ? localStorage.getItem('alhamd_current_admin') : null;
      const authHeader = adminRaw ? `Bearer ${encodeURIComponent(adminRaw)}` : undefined;
      const res = await fetch('/api/admin/wholesale', {
        headers: { ...(authHeader ? { Authorization: authHeader } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
          return;
        }
      }
      const list = await getWholesaleAccounts();
      setAccounts(list);
    } catch (err: any) {
      console.error('Failed to load wholesale accounts:', err);
      const list = await getWholesaleAccounts();
      setAccounts(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (acc.shopName && acc.shopName.toLowerCase().includes(q)) ||
        (acc.phone && acc.phone.toLowerCase().includes(q)) ||
        (acc.address && acc.address.toLowerCase().includes(q)) ||
        (acc.city && acc.city.toLowerCase().includes(q));

      const isAccountActive = acc.status === 'active';
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isAccountActive) ||
        (statusFilter === 'inactive' && !isAccountActive);

      return matchQuery && matchStatus;
    });
  }, [accounts, searchQuery, statusFilter]);

  // If unauthorized staff attempts direct access
  if (!canManage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-neutral-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
              403 Forbidden
            </span>
            <h2 className="text-xl font-extrabold text-neutral-950 mt-3">Access Denied</h2>
            <p className="text-xs text-neutral-600 mt-2">
              Your staff account does not have authorization for{' '}
              <strong className="text-neutral-900">Wholesale Account Management</strong>.
            </p>
            <p className="text-[11px] text-neutral-400 mt-1">
              Please contact the Super Admin / Owner to request access to this module.
            </p>
          </div>
          <div className="pt-3">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Handle Create Account
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!createShopName.trim()) {
      setCreateError('Shop Name is required.');
      return;
    }

    if (!createPassword || !createPassword.trim()) {
      setCreateError('Password is required.');
      return;
    }

    if (createPassword.trim().length < 4) {
      setCreateError('Password must be at least 4 characters long.');
      return;
    }

    setIsCreating(true);
    try {
      const cleanShopName = createShopName.trim();
      const cleanPassword = createPassword.trim();
      const adminRaw = typeof window !== 'undefined' ? localStorage.getItem('alhamd_current_admin') : null;
      const authHeader = adminRaw ? `Bearer ${encodeURIComponent(adminRaw)}` : undefined;

      const res = await fetch('/api/admin/wholesale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          shopName: cleanShopName,
          password: cleanPassword,
          phone: createPhone.trim() || undefined,
          address: createAddress.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create wholesale account.');
      }

      try {
        await createWholesaleAccount(
          {
            shopName: cleanShopName,
            password: cleanPassword,
            phone: createPhone.trim() || undefined,
            address: createAddress.trim() || undefined,
          },
          operatorEmail
        );
      } catch {}

      await loadData();
      setIsCreateOpen(false);
      setCreateShopName('');
      setCreatePassword('');
      setCreatePhone('');
      setCreateAddress('');
      showToast('success', `Wholesale account for "${cleanShopName}" created successfully.`);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create wholesale account.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle View Account
  const handleOpenView = async (account: Customer) => {
    setViewingAccount(account);
    setLoadingOrders(true);
    try {
      const orders = await getCustomerOrders(account.shopName || account.email || account.id);
      setAccountOrders(orders);
    } catch (err) {
      console.error(err);
      setAccountOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Handle Open Edit Modal
  const handleOpenEdit = (account: Customer) => {
    setEditingAccount(account);
    setEditShopName(account.shopName || '');
    setEditPhone(account.phone || '');
    setEditAddress(account.address || '');
    setEditPassword('');
    setEditStatus(account.status === 'active' ? 'active' : 'inactive');
    setEditError('');
  };

  // Handle Save Edit
  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditError('');

    if (!editShopName.trim()) {
      setEditError('Shop Name is required.');
      return;
    }

    if (editPassword && editPassword.length < 4) {
      setEditError('Password must be at least 4 characters long.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const adminRaw = typeof window !== 'undefined' ? localStorage.getItem('alhamd_current_admin') : null;
      const authHeader = adminRaw ? `Bearer ${encodeURIComponent(adminRaw)}` : undefined;

      const res = await fetch(`/api/admin/wholesale/${encodeURIComponent(editingAccount.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          shopName: editShopName.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim(),
          status: editStatus,
          password: editPassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update account.');
      }

      try {
        await updateWholesaleAccount(
          editingAccount.id,
          {
            shopName: editShopName.trim(),
            phone: editPhone.trim(),
            address: editAddress.trim(),
            status: editStatus,
            password: editPassword.trim() || undefined,
          },
          operatorEmail
        );
      } catch {}

      await loadData();
      setEditingAccount(null);
      showToast('success', `Wholesale account "${editShopName.trim()}" updated successfully.`);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update account.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Status Toggle Confirmation
  const handleConfirmStatusToggle = async () => {
    if (!pendingStatusToggle) return;
    const { account, newStatus } = pendingStatusToggle;
    try {
      const adminRaw = typeof window !== 'undefined' ? localStorage.getItem('alhamd_current_admin') : null;
      const authHeader = adminRaw ? `Bearer ${encodeURIComponent(adminRaw)}` : undefined;

      const res = await fetch(`/api/admin/wholesale/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update status.');
      }

      try {
        await updateWholesaleAccountStatus(account.id, newStatus, operatorEmail);
      } catch {}

      await loadData();
      showToast(
        'success',
        `Account for "${account.shopName}" is now ${newStatus === 'active' ? 'ACTIVE' : 'DEACTIVATED'}.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update status.');
    } finally {
      setPendingStatusToggle(null);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      const adminRaw = typeof window !== 'undefined' ? localStorage.getItem('alhamd_current_admin') : null;
      const authHeader = adminRaw ? `Bearer ${encodeURIComponent(adminRaw)}` : undefined;

      const res = await fetch(`/api/admin/wholesale/${encodeURIComponent(pendingDelete.id)}`, {
        method: 'DELETE',
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete wholesale account.');
      }

      try {
        await deleteWholesaleAccount(pendingDelete.id, operatorEmail);
      } catch {}

      await loadData();
      showToast(
        'success',
        `Wholesale account "${pendingDelete.shopName}" deleted safely. Historical orders remain intact.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete account.');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
              : 'bg-rose-950 text-rose-100 border-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              Wholesale Account Management
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              B2B
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Provision verified customer business accounts, manage shop identities, credentials, and track volume orders.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateShopName('');
            setCreatePassword('');
            setCreatePhone('');
            setCreateAddress('');
            setCreateError('');
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Wholesale Account</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by shop name, phone number, address, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer font-medium"
            >
              <option value="all">All Statuses ({accounts.length})</option>
              <option value="active">
                Active Only ({accounts.filter((a) => a.status === 'active').length})
              </option>
              <option value="inactive">
                Deactivated Only ({accounts.filter((a) => a.status !== 'active').length})
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="py-3 px-4">Shop Name</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Total Orders</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading wholesale accounts...</span>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <Building2 className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="font-medium text-neutral-600">No wholesale accounts found.</p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {searchQuery
                        ? 'Try clearing your search query or filters.'
                        : 'Click "+ Create Wholesale Account" to add the first verified shop.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => {
                  const isActive = account.status === 'active';

                  return (
                    <tr key={account.id} className="hover:bg-neutral-50/70 transition-colors">
                      {/* Shop Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center shrink-0 border border-indigo-100">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-neutral-900 block">
                              {account.shopName || account.fullName || 'Untitled Shop'}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-400">
                              ID: {account.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono text-neutral-600 whitespace-nowrap">
                        {account.phone || <span className="text-neutral-400 italic">Not set</span>}
                      </td>

                      {/* Address */}
                      <td className="py-3.5 px-4 text-neutral-600 max-w-[220px] truncate" title={account.address}>
                        {account.address || <span className="text-neutral-400 italic">Not set</span>}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Deactivated
                            </>
                          )}
                        </span>
                      </td>

                      {/* Total Orders */}
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-neutral-800">
                        {account.totalOrders || 0}
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap font-mono text-[11px]">
                        {account.createdAt
                          ? new Date(account.createdAt).toLocaleDateString('en-PK', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => handleOpenView(account)}
                            title="View Account & Orders"
                            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(account)}
                            title="Edit Account Details"
                            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Deactivate */}
                          {isActive ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPendingStatusToggle({ account, newStatus: 'inactive' })
                              }
                              title="Deactivate Wholesale Account"
                              className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setPendingStatusToggle({ account, newStatus: 'active' })
                              }
                              title="Activate Wholesale Account"
                              className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setPendingDelete(account)}
                            title="Delete Account"
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CREATE ACCOUNT MODAL */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-neutral-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-950">Create Wholesale Account</h2>
                  <p className="text-[11px] text-neutral-400">Set credentials for B2B shop login</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs" autoComplete="off">
              {/* Dummy fields to absorb browser credential autofill */}
              <input type="text" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
              <input type="password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Shop Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="wholesale_shop_name_input"
                  id="wholesale-shop-name-field"
                  required
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="e.g. Khan Mobile Center"
                  value={createShopName}
                  onChange={(e) => setCreateShopName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-medium"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Used as the primary wholesale login identifier. Must be unique.
                </span>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Password <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="password"
                  name="wholesale_account_password_input"
                  id="wholesale-account-password-field"
                  required
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="Enter shop password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Must be explicitly entered by admin. No default or preset password.
                </span>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Phone Number <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0300 1234567"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Shop Address <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Shop 14, Central Mobile Market, Rawalpindi"
                  value={createAddress}
                  onChange={(e) => setCreateAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-500 flex items-center justify-between">
                <span>Initial Account Status:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Active
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isCreating ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT ACCOUNT MODAL */}
      {/* ========================================================================= */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-neutral-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-neutral-950">Edit Wholesale Account</h2>
                <p className="text-[11px] text-neutral-400 font-mono">ID: {editingAccount.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Shop Name</label>
                <input
                  type="text"
                  required
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="03XX XXXXXXX"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Address</label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Reset Password <span className="text-neutral-400 font-normal">(Leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  placeholder="New password (optional)"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer font-medium"
                >
                  <option value="active">Active (Can log in & purchase at wholesale rates)</option>
                  <option value="inactive">Deactivated (Login rejected)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSavingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VIEW ACCOUNT DETAILS & ORDERS MODAL */}
      {/* ========================================================================= */}
      {viewingAccount && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-neutral-200 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-neutral-950">{viewingAccount.shopName}</h2>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        viewingAccount.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {viewingAccount.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono">Account ID: {viewingAccount.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAccount(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
              <div>
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Contact Phone
                </span>
                <span className="font-mono font-medium text-neutral-800">
                  {viewingAccount.phone || 'Not configured'}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Registered Date
                </span>
                <span className="font-mono font-medium text-neutral-800">
                  {viewingAccount.createdAt
                    ? new Date(viewingAccount.createdAt).toLocaleString()
                    : 'N/A'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Delivery Address
                </span>
                <span className="font-medium text-neutral-800">
                  {viewingAccount.address || 'Not configured'}
                </span>
              </div>
            </div>

            {/* Order History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-600" />
                  <span>Wholesale Order History ({accountOrders.length})</span>
                </h3>
                <span className="text-xs font-mono font-semibold text-neutral-600">
                  Total Spent: {formatPrice(accountOrders.reduce((s, o) => s + (o.total || 0), 0))}
                </span>
              </div>

              {loadingOrders ? (
                <div className="p-8 text-center text-neutral-400 text-xs">
                  <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-2" />
                  <span>Loading order records...</span>
                </div>
              ) : accountOrders.length === 0 ? (
                <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 text-center text-xs text-neutral-500">
                  No orders placed by this wholesale customer yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {accountOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-xl bg-white border border-neutral-200 flex items-center justify-between text-xs hover:border-neutral-300 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-neutral-900">#{ord.id}</span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            {ord.invoiceNumber}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            WHOLESALE
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-500">
                          {new Date(ord.createdAt).toLocaleDateString()} • {ord.items.length} items
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-neutral-900 block">
                          {formatPrice(ord.total)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            ord.status === 'Delivered'
                              ? 'text-emerald-600'
                              : ord.status === 'Cancelled'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingAccount(null)}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CONFIRMATION DIALOG: ACTIVATE / DEACTIVATE */}
      {/* ========================================================================= */}
      {pendingStatusToggle && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-neutral-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                pendingStatusToggle.newStatus === 'active'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : 'bg-amber-50 text-amber-600 border border-amber-100'
              }`}
            >
              {pendingStatusToggle.newStatus === 'active' ? (
                <UserCheck className="w-6 h-6" />
              ) : (
                <UserX className="w-6 h-6" />
              )}
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-neutral-950">
                {pendingStatusToggle.newStatus === 'active'
                  ? 'Activate Wholesale Account?'
                  : 'Deactivate Wholesale Account?'}
              </h3>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                {pendingStatusToggle.newStatus === 'active' ? (
                  <>
                    Are you sure you want to activate{' '}
                    <strong className="text-neutral-900">{pendingStatusToggle.account.shopName}</strong>?
                    The customer will be able to log in and access wholesale pricing.
                  </>
                ) : (
                  <>
                    Are you sure you want to deactivate{' '}
                    <strong className="text-neutral-900">{pendingStatusToggle.account.shopName}</strong>?
                    The customer will immediately be blocked from logging in. Existing historical orders will remain completely intact.
                  </>
                )}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setPendingStatusToggle(null)}
                className="px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                className={`px-5 py-2 rounded-xl text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
                  pendingStatusToggle.newStatus === 'active'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {pendingStatusToggle.newStatus === 'active' ? 'Activate Account' : 'Deactivate Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CONFIRMATION DIALOG: DELETE ACCOUNT */}
      {/* ========================================================================= */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-neutral-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-neutral-950">Delete Wholesale Account?</h3>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                Are you sure you want to permanently remove wholesale account{' '}
                <strong className="text-neutral-900">{pendingDelete.shopName}</strong>?
              </p>
              <div className="mt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-left text-[11px] text-neutral-600">
                <span className="font-bold text-neutral-800 block mb-0.5">Historical Orders Preserved:</span>
                Past orders made by this shop will NOT be deleted. Order audit history, billing snapshots, and admin records remain intact.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
