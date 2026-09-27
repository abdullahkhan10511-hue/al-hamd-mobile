'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Customer, Order } from '@/types/admin';
import {
  getSuperWholesaleAccounts,
  createSuperWholesaleAccount,
  updateSuperWholesaleAccount,
  deleteSuperWholesaleAccount,
  updateSuperWholesaleAccountStatus,
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
  Crown,
} from 'lucide-react';

export default function SuperWholesaleManagementPage() {
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
  const [createStatus, setCreateStatus] = useState<'active' | 'inactive'>('active');
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
      const res = await fetch('/api/admin/super-wholesale', {
        headers: { ...(authHeader ? { Authorization: authHeader } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
          return;
        }
      }
      const list = await getSuperWholesaleAccounts();
      setAccounts(list);
    } catch (err: any) {
      console.error('Failed to load super wholesale accounts:', err);
      const list = await getSuperWholesaleAccounts();
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
              <strong className="text-neutral-900">Super Wholesale Account Management</strong>.
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

      const res = await fetch('/api/admin/super-wholesale', {
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
          status: createStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create super wholesale account.');
      }

      try {
        await createSuperWholesaleAccount(
          {
            shopName: cleanShopName,
            password: cleanPassword,
            phone: createPhone.trim() || undefined,
            address: createAddress.trim() || undefined,
            status: createStatus,
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
      setCreateStatus('active');
      showToast('success', `Super Wholesale account for "${cleanShopName}" created successfully.`);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create super wholesale account.');
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

      const res = await fetch(`/api/admin/super-wholesale/${encodeURIComponent(editingAccount.id)}`, {
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
        await updateSuperWholesaleAccount(
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
      showToast('success', `Super Wholesale account "${editShopName.trim()}" updated successfully.`);
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

      const res = await fetch(`/api/admin/super-wholesale/${encodeURIComponent(account.id)}`, {
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
        await updateSuperWholesaleAccountStatus(account.id, newStatus, operatorEmail);
      } catch {}

      await loadData();
      showToast(
        'success',
        `Super Wholesale account "${account.shopName}" is now ${newStatus === 'active' ? 'ACTIVE' : 'DEACTIVATED'}.`
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

      const res = await fetch(`/api/admin/super-wholesale/${encodeURIComponent(pendingDelete.id)}`, {
        method: 'DELETE',
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete super wholesale account.');
      }

      try {
        await deleteSuperWholesaleAccount(pendingDelete.id, operatorEmail);
      } catch {}

      await loadData();
      showToast(
        'success',
        `Super Wholesale account "${pendingDelete.shopName}" deleted safely. Historical orders remain intact.`
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
              Super Wholesale Accounts
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Crown className="w-3 h-3" />
              <span>Tier 1 Elite B2B</span>
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Manage top-tier Super Wholesale partners entitled to preferential bulk discounts, custom pricing, and direct dispatch.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateShopName('');
            setCreatePassword('');
            setCreatePhone('');
            setCreateAddress('');
            setCreateStatus('active');
            setCreateError('');
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Super Wholesale Account</span>
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
                    <span>Loading super wholesale accounts...</span>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <Crown className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="font-medium text-neutral-600">No super wholesale accounts found.</p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {searchQuery
                        ? 'Try clearing your search query or filters.'
                        : 'Click "+ Create Super Wholesale Account" to add the first partner.'}
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
                          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0 border border-purple-100">
                            <Crown className="w-4 h-4" />
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
                              title="Deactivate Super Wholesale Account"
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
                              title="Activate Super Wholesale Account"
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
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-950">Create Super Wholesale Account</h2>
                  <p className="text-[11px] text-neutral-400">Set credentials for top-tier Super Wholesale partner</p>
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
              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Shop Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Madina Telecom"
                  value={createShopName}
                  onChange={(e) => setCreateShopName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-medium"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Used as the primary super wholesale login identifier. Must be unique.
                </span>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Password <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Enter shop password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Encrypted securely before saving. Passwords are never stored in plain text.
                </span>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Initial Status <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer font-medium"
                >
                  <option value="active">Active (Can log in & buy immediately)</option>
                  <option value="inactive">Inactive / Deactivated</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Contact Phone <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="tel"
                  placeholder="0300 1234567"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Shop Delivery Address <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Shop No., Market name, City"
                  value={createAddress}
                  onChange={(e) => setCreateAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
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
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-950">Edit Super Wholesale Account</h2>
                  <p className="text-[11px] text-neutral-400">Update shop details, credentials, or status</p>
                </div>
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

            <form onSubmit={handleSaveEditSubmit} className="space-y-4 text-xs" autoComplete="off">
              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Shop Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">
                  Reset Password <span className="text-neutral-400 font-normal">(Leave blank to keep existing password)</span>
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter new password if changing"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Passwords are encrypted. Only enter a value here if resetting credentials.
                </span>
              </div>

              <div>
                <label className="font-semibold text-neutral-800 block mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer font-medium"
                >
                  <option value="active">Active (Can log in & buy at Super Wholesale price)</option>
                  <option value="inactive">Deactivated (Access blocked)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="0300 1234567"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Shop Address</label>
                <textarea
                  rows={2}
                  placeholder="Shop No., Market name, City"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 font-medium transition-colors cursor-pointer"
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
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-950">
                    {viewingAccount.shopName || viewingAccount.fullName || 'Untitled Shop'}
                  </h2>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Super Wholesale Partner ID: {viewingAccount.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAccount(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Profile Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Status
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold ${
                    viewingAccount.status === 'active' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {viewingAccount.status === 'active' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Active & Verified
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Deactivated
                    </>
                  )}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Phone Number
                </span>
                <span className="text-xs font-mono font-bold text-neutral-900">
                  {viewingAccount.phone || 'Not set'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Total Orders
                </span>
                <span className="text-xs font-mono font-bold text-neutral-900">
                  {viewingAccount.totalOrders || accountOrders.length}
                </span>
              </div>
            </div>

            {/* Address */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Dispatch & Delivery Address
              </span>
              <p className="text-neutral-900 font-medium">
                {viewingAccount.address || 'No physical address configured.'}
                {viewingAccount.city && `, ${viewingAccount.city}`}
                {viewingAccount.province && `, ${viewingAccount.province}`}
              </p>
            </div>

            {/* Recent Orders List */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                Order History ({accountOrders.length})
              </h3>
              {loadingOrders ? (
                <div className="py-8 text-center text-neutral-400 text-xs">
                  <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-2" />
                  <span>Loading customer order records...</span>
                </div>
              ) : accountOrders.length === 0 ? (
                <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-center text-xs text-neutral-500">
                  No orders placed by this account yet.
                </div>
              ) : (
                <div className="border border-neutral-200 rounded-2xl overflow-hidden divide-y divide-neutral-100 text-xs">
                  {accountOrders.map((ord) => (
                    <div key={ord.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900">#{ord.id}</span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            Super Wholesale
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {new Date(ord.createdAt).toLocaleDateString('en-PK', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-neutral-900 block">
                          {formatPrice(ord.total)}
                        </span>
                        <span className="text-[10px] font-semibold text-neutral-500 uppercase">
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setViewingAccount(null)}
                className="px-5 py-2 rounded-xl bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CONFIRM STATUS TOGGLE MODAL */}
      {/* ========================================================================= */}
      {pendingStatusToggle && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-neutral-200 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
                pendingStatusToggle.newStatus === 'active'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : 'bg-amber-50 text-amber-600 border border-amber-100'
              }`}
            >
              {pendingStatusToggle.newStatus === 'active' ? (
                <UserCheck className="w-7 h-7" />
              ) : (
                <UserX className="w-7 h-7" />
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-neutral-950">
                {pendingStatusToggle.newStatus === 'active'
                  ? 'Activate Super Wholesale Account?'
                  : 'Deactivate Super Wholesale Account?'}
              </h2>
              <p className="text-xs text-neutral-600 mt-1">
                {pendingStatusToggle.newStatus === 'active'
                  ? `"${pendingStatusToggle.account.shopName}" will regain access to Super Wholesale pricing and login immediately.`
                  : `"${pendingStatusToggle.account.shopName}" will be prevented from logging in until reactivated.`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingStatusToggle(null)}
                className="py-2.5 px-4 rounded-xl border border-neutral-200 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                className={`py-2.5 px-4 rounded-xl text-white text-xs font-semibold transition-colors cursor-pointer ${
                  pendingStatusToggle.newStatus === 'active'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CONFIRM DELETE MODAL */}
      {/* ========================================================================= */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-neutral-200 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-base font-bold text-neutral-950">
                Delete Super Wholesale Account?
              </h2>
              <p className="text-xs text-neutral-600 mt-1">
                Are you sure you want to delete{' '}
                <strong className="text-neutral-900">&ldquo;{pendingDelete.shopName}&rdquo;</strong>?
              </p>
              <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-xl text-[11px] text-neutral-500 mt-3 text-left">
                <span className="font-semibold text-neutral-800 block mb-0.5">
                  Safe Deletion Guarantee:
                </span>
                Existing order history, customer billing records, and audit logs will remain preserved intact.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-neutral-200 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
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
