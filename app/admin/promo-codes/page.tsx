'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PromoCode, PromoCodeUsage } from '@/types/admin';
import { Product, Category } from '@/types';
import {
  getPromoCodes,
  getPromoCodeUsages,
  createPromoCode,
  updatePromoCode,
  togglePromoCodeStatus,
  deletePromoCode,
} from '@/lib/db/promotions';
import { getProducts } from '@/lib/db/products';
import { getCategories, deduplicateCategoriesById } from '@/lib/db/categories';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { subscribeToKey } from '@/lib/db/storage';
import {
  TicketPercent,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  Eye,
  Power,
  Calendar,
  Layers,
  Store,
  Globe,
  Tag,
  Users,
  ShieldCheck,
  Percent,
  Banknote,
  History,
  TrendingUp,
} from 'lucide-react';

export default function PromoCodesAdminPage() {
  const { admin, isSuperAdmin, isManager } = useAdminAuth();

  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [usages, setUsages] = useState<PromoCodeUsage[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'online' | 'pos'>('all');

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [selectedPromoForUsage, setSelectedPromoForUsage] = useState<PromoCode | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState<number>(10);
  const [formMaxDiscount, setFormMaxDiscount] = useState<string>('');
  const [formMinOrder, setFormMinOrder] = useState<number>(0);
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formExpiryDate, setFormExpiryDate] = useState<string>('');
  const [formHasUsageLimit, setFormHasUsageLimit] = useState(false);
  const [formUsageLimit, setFormUsageLimit] = useState<number>(100);
  const [formPerCustomerLimit, setFormPerCustomerLimit] = useState<string>('1');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPosAllowed, setFormPosAllowed] = useState(true);
  const [formOnlineAllowed, setFormOnlineAllowed] = useState(true);
  const [formApplicableType, setFormApplicableType] = useState<'all' | 'products' | 'categories'>('all');
  const [formApplicableProducts, setFormApplicableProducts] = useState<string[]>([]);
  const [formApplicableCategories, setFormApplicableCategories] = useState<string[]>([]);
  const [formCustomerRestrictions, setFormCustomerRestrictions] = useState<'all' | 'specific' | 'new' | 'existing'>('all');
  const [formSpecificEmails, setFormSpecificEmails] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // RBAC permissions
  const canManage = useMemo(() => {
    if (!admin) return false;
    const role = (admin.role || '').toUpperCase();
    if (isSuperAdmin || isManager || role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'PROMOTION MANAGER') return true;
    return Boolean(admin.permissions?.includes('promotions.add') || admin.permissions?.includes('promotions.edit'));
  }, [admin, isSuperAdmin, isManager]);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(() => {
    setPromos(getPromoCodes());
    setUsages(getPromoCodeUsages());
    setProducts(getProducts());
    setCategories(deduplicateCategoriesById(getCategories()));
  }, []);

  useEffect(() => {
    loadData();
    const unsubPromos = subscribeToKey('promo_codes', () => loadData());
    const unsubUsages = subscribeToKey('promo_code_usages', () => loadData());
    return () => {
      unsubPromos();
      unsubUsages();
    };
  }, [loadData]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingPromo(null);
    setFormCode('');
    setFormDescription('');
    setFormDiscountType('percentage');
    setFormDiscountValue(10);
    setFormMaxDiscount('');
    setFormMinOrder(0);
    setFormStartDate('');
    setFormExpiryDate('');
    setFormHasUsageLimit(false);
    setFormUsageLimit(100);
    setFormPerCustomerLimit('1');
    setFormIsActive(true);
    setFormPosAllowed(true);
    setFormOnlineAllowed(true);
    setFormApplicableType('all');
    setFormApplicableProducts([]);
    setFormApplicableCategories([]);
    setFormCustomerRestrictions('all');
    setFormSpecificEmails('');
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (promo: PromoCode) => {
    setEditingPromo(promo);
    setFormCode(promo.code);
    setFormDescription(promo.description || '');
    setFormDiscountType(promo.discountType);
    setFormDiscountValue(promo.discountValue);
    setFormMaxDiscount(promo.maximumDiscount ? promo.maximumDiscount.toString() : '');
    setFormMinOrder(promo.minimumOrderAmount || 0);
    setFormStartDate(promo.startDate ? promo.startDate.substring(0, 10) : '');
    setFormExpiryDate(promo.expiryDate ? promo.expiryDate.substring(0, 10) : '');
    setFormHasUsageLimit(Boolean(promo.usageLimit && promo.usageLimit > 0));
    setFormUsageLimit(promo.usageLimit || 100);
    setFormPerCustomerLimit(promo.perCustomerLimit ? promo.perCustomerLimit.toString() : 'unlimited');
    setFormIsActive(promo.isActive);
    setFormPosAllowed(promo.posAllowed);
    setFormOnlineAllowed(promo.onlineAllowed);
    setFormApplicableType(promo.applicableType);
    setFormApplicableProducts(promo.applicableProducts || []);
    setFormApplicableCategories(promo.applicableCategories || []);
    setFormCustomerRestrictions(promo.customerRestrictions);
    setFormSpecificEmails((promo.specificCustomerEmails || []).join(', '));
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Save Promo (Create / Update)
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Please provide a promo code.');
      return;
    }

    if (formDiscountValue <= 0) {
      setFormError('Discount value must be greater than 0.');
      return;
    }

    if (!formPosAllowed && !formOnlineAllowed) {
      setFormError('At least one channel (POS or Online) must be selected.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const payload = {
        code: cleanCode,
        description: formDescription.trim(),
        discountType: formDiscountType,
        discountValue: Number(formDiscountValue),
        maximumDiscount: formMaxDiscount && Number(formMaxDiscount) > 0 ? Number(formMaxDiscount) : null,
        minimumOrderAmount: Math.max(0, Number(formMinOrder) || 0),
        startDate: formStartDate ? new Date(formStartDate).toISOString() : undefined,
        expiryDate: formExpiryDate ? new Date(`${formExpiryDate}T23:59:59.999Z`).toISOString() : undefined,
        usageLimit: formHasUsageLimit ? Math.max(1, Number(formUsageLimit)) : null,
        perCustomerLimit: formPerCustomerLimit === 'unlimited' ? null : Math.max(1, Number(formPerCustomerLimit)),
        isActive: formIsActive,
        posAllowed: formPosAllowed,
        onlineAllowed: formOnlineAllowed,
        applicableType: formApplicableType,
        applicableProducts: formApplicableProducts,
        applicableCategories: formApplicableCategories,
        customerRestrictions: formCustomerRestrictions,
        specificCustomerEmails: formSpecificEmails
          ? formSpecificEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
          : [],
      };

      if (editingPromo) {
        const res = await updatePromoCode(editingPromo.id, payload, admin?.email);
        if (!res.success) {
          setFormError(res.error || 'Failed to update promo code.');
          setFormSubmitting(false);
          return;
        }
        showToast(`Promo code "${cleanCode}" updated successfully!`, 'success');
      } else {
        const res = await createPromoCode(payload, admin?.email);
        if (!res.success) {
          setFormError(res.error || 'Failed to create promo code.');
          setFormSubmitting(false);
          return;
        }
        showToast(`Promo code "${cleanCode}" created successfully!`, 'success');
      }

      setIsFormModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Unexpected error.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async (id: string, currentCode: string) => {
    try {
      const res = await togglePromoCodeStatus(id, admin?.email);
      if (res.success && res.promo) {
        showToast(`Promo "${currentCode}" is now ${res.promo.isActive ? 'Active' : 'Inactive'}.`, 'success');
        loadData();
      } else {
        showToast(res.error || 'Failed to update status.', 'error');
      }
    } catch {
      showToast('Failed to toggle promo code.', 'error');
    }
  };

  // Delete Promo
  const handleDeletePromo = async (id: string) => {
    try {
      const res = await deletePromoCode(id, admin?.email);
      if (res.success) {
        showToast('Promo code deleted.', 'success');
        setDeleteConfirmId(null);
        loadData();
      } else {
        showToast(res.error || 'Failed to delete promo code.', 'error');
      }
    } catch {
      showToast('Error deleting promo code.', 'error');
    }
  };

  // Filtered List
  const filteredPromos = useMemo(() => {
    const now = new Date();
    return promos.filter((p) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = p.code.toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        if (!codeMatch && !descMatch) return false;
      }

      // Status
      const isExpired = p.expiryDate ? new Date(p.expiryDate) < now : false;
      if (statusFilter === 'active') {
        if (!p.isActive || isExpired) return false;
      } else if (statusFilter === 'inactive') {
        if (p.isActive) return false;
      } else if (statusFilter === 'expired') {
        if (!isExpired) return false;
      }

      // Channel
      if (channelFilter === 'online' && !p.onlineAllowed) return false;
      if (channelFilter === 'pos' && !p.posAllowed) return false;

      return true;
    });
  }, [promos, searchQuery, statusFilter, channelFilter]);

  // KPIs
  const stats = useMemo(() => {
    const now = new Date();
    const activeCount = promos.filter((p) => p.isActive && (!p.expiryDate || new Date(p.expiryDate) >= now)).length;
    const totalUses = usages.length;
    const totalDiscountGiven = usages.reduce((acc, u) => acc + (u.discountAmount || 0), 0);
    const expiredCount = promos.filter((p) => p.expiryDate && new Date(p.expiryDate) < now).length;
    return { activeCount, totalUses, totalDiscountGiven, expiredCount };
  }, [promos, usages]);

  // Usages for Modal
  const displayedUsages = useMemo(() => {
    if (!selectedPromoForUsage) return usages;
    return usages.filter((u) => u.code.toUpperCase() === selectedPromoForUsage.code.toUpperCase());
  }, [usages, selectedPromoForUsage]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-bounce-in">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold ${
              toast.type === 'success'
                ? 'bg-emerald-950 border-emerald-800 text-emerald-100'
                : toast.type === 'warning'
                ? 'bg-amber-950 border-amber-800 text-amber-100'
                : 'bg-rose-950 border-rose-800 text-rose-100'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
              <TicketPercent className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight">
                Promo & Discount Codes
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                Manage promotional campaigns, coupon codes, channel access, and customer restrictions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setSelectedPromoForUsage(null);
              setIsUsageModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold text-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <History className="w-4 h-4 text-neutral-500" />
            <span>Usage History</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Promo Code</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Promos</span>
            <Tag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-neutral-950">{stats.activeCount}</div>
          <p className="text-[10px] text-neutral-400">Currently live & eligible</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Usages</span>
            <History className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-neutral-950">{stats.totalUses}</div>
          <p className="text-[10px] text-neutral-400">Times redeemed across store & POS</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Discounts Given</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            Rs. {stats.totalDiscountGiven.toLocaleString('en-PK')}
          </div>
          <p className="text-[10px] text-neutral-400">Total customer savings to date</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Expired / Inactive</span>
            <Calendar className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-neutral-950">{stats.expiredCount}</div>
          <p className="text-[10px] text-neutral-400">Expired campaigns</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code or description..."
            className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status filter pills */}
          <div className="flex items-center bg-neutral-100 p-1 rounded-xl text-xs font-bold">
            {(['all', 'active', 'inactive', 'expired'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                  statusFilter === s
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Channel filter pills */}
          <div className="flex items-center bg-neutral-100 p-1 rounded-xl text-xs font-bold">
            {(['all', 'online', 'pos'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannelFilter(c)}
                className={`px-3 py-1 rounded-lg uppercase transition-all cursor-pointer ${
                  channelFilter === c
                    ? 'bg-white text-neutral-950 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Promo Codes Table */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Discount</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Validity</th>
                <th className="py-3.5 px-4">Usage / Limit</th>
                <th className="py-3.5 px-4">Min. Order</th>
                <th className="py-3.5 px-4">Channels</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredPromos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    No promo codes match your filters.
                  </td>
                </tr>
              ) : (
                filteredPromos.map((promo) => {
                  const now = new Date();
                  const isExpired = promo.expiryDate ? new Date(promo.expiryDate) < now : false;

                  return (
                    <tr key={promo.id} className="hover:bg-neutral-50/70 transition-colors">
                      {/* Code & Description */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold font-mono text-neutral-950 text-sm tracking-wide">
                          {promo.code}
                        </div>
                        {promo.description && (
                          <div className="text-[11px] text-neutral-500 truncate max-w-[180px]">
                            {promo.description}
                          </div>
                        )}
                      </td>

                      {/* Discount Value */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-neutral-950">
                          {promo.discountType === 'percentage'
                            ? `${promo.discountValue}% OFF`
                            : `Rs. ${promo.discountValue.toLocaleString('en-PK')} OFF`}
                        </span>
                        {promo.maximumDiscount ? (
                          <div className="text-[10px] text-neutral-400">
                            Max: Rs. {promo.maximumDiscount.toLocaleString('en-PK')}
                          </div>
                        ) : null}
                      </td>

                      {/* Discount Type */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-100 text-neutral-700">
                          {promo.discountType}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isExpired ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                            Expired
                          </span>
                        ) : promo.isActive ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-neutral-100 text-neutral-600 border border-neutral-200">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Validity Dates */}
                      <td className="py-3.5 px-4 text-neutral-600 whitespace-nowrap text-[11px]">
                        {promo.expiryDate ? (
                          <div>
                            <div>Exp: {new Date(promo.expiryDate).toLocaleDateString('en-PK')}</div>
                            {promo.startDate && (
                              <div className="text-[10px] text-neutral-400">
                                Start: {new Date(promo.startDate).toLocaleDateString('en-PK')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400">Never Expires</span>
                        )}
                      </td>

                      {/* Usage / Limit */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-neutral-900 font-mono">
                          {promo.usedCount || 0} / {promo.usageLimit ? promo.usageLimit : '∞'}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {promo.perCustomerLimit ? `${promo.perCustomerLimit} per customer` : 'Unlimited per cust'}
                        </div>
                      </td>

                      {/* Min Order */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-neutral-900">
                        {promo.minimumOrderAmount > 0 ? (
                          `Rs. ${promo.minimumOrderAmount.toLocaleString('en-PK')}`
                        ) : (
                          <span className="text-neutral-400 font-sans">None</span>
                        )}
                      </td>

                      {/* Channels */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {promo.onlineAllowed && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200" title="Available in Online Store Checkout">
                              Online
                            </span>
                          )}
                          {promo.posAllowed && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Available in POS Shop Counter">
                              POS
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPromoForUsage(promo);
                            setIsUsageModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="View Usage History"
                        >
                          <History className="w-3 h-3 text-neutral-500" />
                          <span>Usage ({promo.usedCount || 0})</span>
                        </button>

                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(promo.id, promo.code)}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                promo.isActive
                                  ? 'border-amber-200 hover:bg-amber-50 text-amber-700'
                                  : 'border-emerald-200 hover:bg-emerald-50 text-emerald-700'
                              }`}
                              title={promo.isActive ? 'Deactivate promo code' : 'Activate promo code'}
                            >
                              <Power className="w-3 h-3" />
                              <span>{promo.isActive ? 'Deactivate' : 'Activate'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(promo)}
                              className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Edit promo code"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(promo.id)}
                              className="px-2 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold inline-flex items-center transition-colors cursor-pointer"
                              title="Delete promo code"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900">Delete Promo Code</h3>
            <p className="text-xs text-neutral-600">
              Are you sure you want to delete this promo code? Historical orders will retain their applied discounts.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePromo(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CREATE / EDIT PROMO CODE MODAL                                      */}
      {/* =================================================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <TicketPercent className="w-5 h-5 text-neutral-900" />
                <h3 className="font-bold text-base text-neutral-900">
                  {editingPromo ? `Edit Promo Code: ${editingPromo.code}` : 'Create New Promo Code'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromo} className="p-6 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Code & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">
                    Promo Code * <span className="text-neutral-400 font-normal">(Case-insensitive)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WELCOME10"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-mono uppercase font-bold text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. 10% Off on Mobile Gear"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Discount Type *</label>
                  <select
                    value={formDiscountType}
                    onChange={(e) => setFormDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl font-semibold text-neutral-900 focus:outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (PKR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-700 font-bold mb-1">
                    Discount Value * {formDiscountType === 'percentage' ? '(%)' : '(PKR)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formDiscountType === 'percentage' ? 100 : undefined}
                    required
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl font-mono font-bold text-neutral-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-bold mb-1">
                    Max Discount (PKR) <span className="text-neutral-400 font-normal">(Optional Cap)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={formDiscountType !== 'percentage'}
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(e.target.value)}
                    placeholder={formDiscountType === 'percentage' ? 'e.g. 1000' : 'N/A for fixed'}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl font-mono text-neutral-900 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                  />
                </div>
              </div>

              {/* Min Order & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Min. Order Amount (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={formMinOrder}
                    onChange={(e) => setFormMinOrder(parseFloat(e.target.value) || 0)}
                    placeholder="0 for no minimum"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-neutral-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-neutral-700 font-bold">Total Usage Limit</label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-neutral-500">
                      <input
                        type="checkbox"
                        checked={formHasUsageLimit}
                        onChange={(e) => setFormHasUsageLimit(e.target.checked)}
                        className="rounded accent-neutral-950"
                      />
                      <span>Limit uses</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    min="1"
                    disabled={!formHasUsageLimit}
                    value={formUsageLimit}
                    onChange={(e) => setFormUsageLimit(parseInt(e.target.value) || 1)}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl font-mono text-neutral-900 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Per Customer Limit</label>
                  <select
                    value={formPerCustomerLimit}
                    onChange={(e) => setFormPerCustomerLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl font-semibold text-neutral-900 focus:outline-none"
                  >
                    <option value="1">1 use per customer</option>
                    <option value="2">2 uses per customer</option>
                    <option value="5">5 uses per customer</option>
                    <option value="unlimited">Unlimited uses per customer</option>
                  </select>
                </div>
              </div>

              {/* Channels & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-neutral-900 block">Online Store</span>
                    <span className="text-[10px] text-neutral-500">Allowed on web checkout</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formOnlineAllowed}
                    onChange={(e) => setFormOnlineAllowed(e.target.checked)}
                    className="w-4 h-4 rounded accent-neutral-950 cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-neutral-900 block">POS Counter</span>
                    <span className="text-[10px] text-neutral-500">Allowed in Shop POS</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formPosAllowed}
                    onChange={(e) => setFormPosAllowed(e.target.checked)}
                    className="w-4 h-4 rounded accent-neutral-950 cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-neutral-900 block">Active Status</span>
                    <span className="text-[10px] text-neutral-500">Enable or pause code</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Product / Category Restrictions */}
              <div className="space-y-2 p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                <label className="block text-neutral-700 font-bold">Applicable Items</label>
                <div className="flex gap-4">
                  {[
                    { id: 'all', label: 'All Products' },
                    { id: 'categories', label: 'Selected Categories' },
                    { id: 'products', label: 'Selected Products' },
                  ].map((t) => (
                    <label key={t.id} className="flex items-center gap-1.5 cursor-pointer font-semibold">
                      <input
                        type="radio"
                        name="applicableType"
                        value={t.id}
                        checked={formApplicableType === t.id}
                        onChange={() => setFormApplicableType(t.id as any)}
                        className="accent-neutral-950"
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>

                {formApplicableType === 'categories' && (
                  <div className="pt-2">
                    <span className="text-[11px] text-neutral-500 block mb-1">
                      Choose categories eligible for this discount:
                    </span>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-white rounded-xl border border-neutral-200">
                      {categories.map((c) => {
                        const checked = formApplicableCategories.includes(c.slug || c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              const slug = c.slug || c.id;
                              setFormApplicableCategories((prev) =>
                                checked ? prev.filter((s) => s !== slug) : [...prev, slug]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              checked
                                ? 'bg-neutral-950 text-white border-neutral-950'
                                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formApplicableType === 'products' && (
                  <div className="pt-2">
                    <span className="text-[11px] text-neutral-500 block mb-1">
                      Choose specific products eligible for this discount:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white rounded-xl border border-neutral-200">
                      {products.slice(0, 40).map((p) => {
                        const checked = formApplicableProducts.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setFormApplicableProducts((prev) =>
                                checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              );
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                              checked
                                ? 'bg-neutral-950 text-white border-neutral-950'
                                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Restrictions */}
              <div className="space-y-2 p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                <label className="block text-neutral-700 font-bold">Customer Eligibility</label>
                <div className="flex flex-wrap gap-4">
                  {[
                    { id: 'all', label: 'All Customers' },
                    { id: 'new', label: 'New Customers Only' },
                    { id: 'existing', label: 'Existing Customers Only' },
                    { id: 'specific', label: 'Specific Customer Emails' },
                  ].map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 cursor-pointer font-semibold">
                      <input
                        type="radio"
                        name="customerRestrictions"
                        value={c.id}
                        checked={formCustomerRestrictions === c.id}
                        onChange={() => setFormCustomerRestrictions(c.id as any)}
                        className="accent-neutral-950"
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>

                {formCustomerRestrictions === 'specific' && (
                  <div className="pt-2">
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      Customer Emails (comma-separated):
                    </label>
                    <input
                      type="text"
                      value={formSpecificEmails}
                      onChange={(e) => setFormSpecificEmails(e.target.value)}
                      placeholder="e.g. customer1@gmail.com, customer2@outlook.com"
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-xs focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Form Bottom Actions */}
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingPromo ? 'Update Promo Code' : 'Create Promo Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PROMO CODE USAGE HISTORY MODAL                                      */}
      {/* =================================================================== */}
      {isUsageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-neutral-900" />
                <div>
                  <h3 className="font-bold text-base text-neutral-900">
                    Promo Code Usage History {selectedPromoForUsage ? `(${selectedPromoForUsage.code})` : '(All)'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {displayedUsages.length} total redemptions recorded
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUsageModalOpen(false)}
                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Promo Code</th>
                      <th className="py-2.5 px-3">Order Number</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Discount Given</th>
                      <th className="py-2.5 px-3">Order Total</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Used By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {displayedUsages.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-neutral-400">
                          No redemptions recorded for this promo code yet.
                        </td>
                      </tr>
                    ) : (
                      displayedUsages.map((usage) => (
                        <tr key={usage.id} className="hover:bg-neutral-50/70">
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-950 uppercase">
                            {usage.code}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-neutral-800">
                            #{usage.orderId}
                            {usage.invoiceNumber && (
                              <div className="text-[10px] text-neutral-400">{usage.invoiceNumber}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-neutral-900">{usage.customerName}</div>
                            {usage.customerEmail && (
                              <div className="text-[10px] text-neutral-500">{usage.customerEmail}</div>
                            )}
                            {usage.customerPhone && (
                              <div className="text-[10px] text-neutral-400">{usage.customerPhone}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold font-mono text-emerald-700">
                            Rs. {usage.discountAmount.toLocaleString('en-PK')}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-neutral-900">
                            Rs. {usage.orderTotal.toLocaleString('en-PK')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                usage.channel === 'POS'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {usage.channel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600 whitespace-nowrap text-[11px]">
                            {new Date(usage.createdAt).toLocaleDateString('en-PK')}{' '}
                            <span className="text-neutral-400 text-[10px]">
                              {new Date(usage.createdAt).toLocaleTimeString('en-PK', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-700 text-[11px]">
                            {usage.usedBy || 'Customer'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
