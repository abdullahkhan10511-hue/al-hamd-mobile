'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Phone,
  Mail,
  Hash,
  X,
  FileQuestion,
  User,
  ShoppingBag,
} from 'lucide-react';
import { CustomerInquiry, InquiryStatus, InquiryPriority, InquiryType } from '@/types/admin';
import { useAdminAuth } from '@/context/AdminAuthContext';

const STATUS_OPTIONS: { label: string; value: InquiryStatus | 'ALL' }[] = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'New', value: 'NEW' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Closed', value: 'CLOSED' },
];

const PRIORITY_OPTIONS: { label: string; value: InquiryPriority | 'ALL' }[] = [
  { label: 'All Priorities', value: 'ALL' },
  { label: 'Urgent', value: 'URGENT' },
  { label: 'High', value: 'HIGH' },
  { label: 'Normal', value: 'NORMAL' },
  { label: 'Low', value: 'LOW' },
];

const TYPE_OPTIONS: { label: string; value: InquiryType | 'ALL' }[] = [
  { label: 'All Inquiry Types', value: 'ALL' },
  { label: 'General Question', value: 'General Question' },
  { label: 'Product Inquiry', value: 'Product Inquiry' },
  { label: 'Order Issue', value: 'Order Issue' },
  { label: 'Delivery Issue', value: 'Delivery Issue' },
  { label: 'Return / Replacement', value: 'Return / Replacement' },
  { label: 'Warranty', value: 'Warranty' },
  { label: 'Complaint', value: 'Complaint' },
  { label: 'Payment Issue', value: 'Payment Issue' },
  { label: 'Other', value: 'Other' },
];

export default function AdminInquiriesPage() {
  const { admin } = useAdminAuth();
  const [inquiries, setInquiries] = useState<CustomerInquiry[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    newCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
    closedCount: 0,
    highOrUrgentCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<InquiryStatus | 'ALL'>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<InquiryPriority | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<InquiryType | 'ALL'>('ALL');

  const fetchInquiries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus);
      if (selectedPriority !== 'ALL') params.set('priority', selectedPriority);
      if (selectedType !== 'ALL') params.set('type', selectedType);

      const res = await fetch(`/api/admin/inquiries?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setInquiries(data.inquiries || []);
          if (data.stats) {
            setStats(data.stats);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load inquiries:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedStatus, selectedPriority, selectedType]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleClearFilters = () => {
    setSearch('');
    setSelectedStatus('ALL');
    setSelectedPriority('ALL');
    setSelectedType('ALL');
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedStatus !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedType !== 'ALL';

  const getStatusBadge = (status: InquiryStatus) => {
    switch (status) {
      case 'NEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            NEW
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Clock className="w-3 h-3 text-sky-600" />
            IN PROGRESS
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            RESOLVED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
            CLOSED
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: InquiryPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-red-100 text-red-800 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" />
            Urgent
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-orange-100 text-orange-800 border border-orange-200">
            <AlertTriangle className="w-3 h-3 text-orange-600" />
            High
          </span>
        );
      case 'NORMAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-neutral-100 text-neutral-700 border border-neutral-200">
            Normal
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase bg-neutral-50 text-neutral-500 border border-neutral-200">
            Low
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-neutral-900 text-white">
              Customer Support Desk
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              AL-HAMD MOBILE ACCESSORIES
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight flex items-center gap-2">
            <span>Customer Inquiries & Complaints</span>
            <span className="text-sm font-semibold text-neutral-500 bg-neutral-100 px-2.5 py-0.5 rounded-full border border-neutral-200">
              {stats.total}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Track, prioritize, and resolve customer contact inquiries, order issues, and complaints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchInquiries()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-semibold text-xs hover:bg-neutral-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setSelectedStatus('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'ALL'
              ? 'bg-neutral-950 text-white border-neutral-950 shadow-sm'
              : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-900'
          }`}
        >
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${selectedStatus === 'ALL' ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Total Inquiries
          </p>
          <p className="text-2xl font-extrabold mt-1">{stats.total}</p>
        </div>

        <div
          onClick={() => setSelectedStatus('NEW')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'NEW'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-white border-neutral-200 hover:border-amber-300 text-neutral-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${selectedStatus === 'NEW' ? 'text-amber-100' : 'text-amber-700'}`}>
              New / Unhandled
            </p>
            {stats.newCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <p className="text-2xl font-extrabold mt-1">{stats.newCount}</p>
        </div>

        <div
          onClick={() => setSelectedStatus('IN_PROGRESS')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'IN_PROGRESS'
              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
              : 'bg-white border-neutral-200 hover:border-sky-300 text-neutral-900'
          }`}
        >
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${selectedStatus === 'IN_PROGRESS' ? 'text-sky-100' : 'text-sky-700'}`}>
            In Progress
          </p>
          <p className="text-2xl font-extrabold mt-1">{stats.inProgressCount}</p>
        </div>

        <div
          onClick={() => setSelectedPriority('URGENT')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedPriority === 'URGENT' || selectedPriority === 'HIGH'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-white border-neutral-200 hover:border-rose-300 text-neutral-900'
          }`}
        >
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${selectedPriority === 'URGENT' ? 'text-rose-100' : 'text-rose-700'}`}>
            High / Urgent
          </p>
          <p className="text-2xl font-extrabold mt-1 text-rose-600 dark:text-rose-400">
            {stats.highOrUrgentCount}
          </p>
        </div>

        <div
          onClick={() => setSelectedStatus('RESOLVED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'RESOLVED'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white border-neutral-200 hover:border-emerald-300 text-neutral-900'
          }`}
        >
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${selectedStatus === 'RESOLVED' ? 'text-emerald-100' : 'text-emerald-700'}`}>
            Resolved
          </p>
          <p className="text-2xl font-extrabold mt-1 text-emerald-600">{stats.resolvedCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, subject, order #..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-neutral-950 transition-colors"
            />
          </div>

          {/* Status Dropdown */}
          <div className="sm:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as InquiryStatus | 'ALL')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-neutral-950 transition-colors cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Dropdown */}
          <div className="sm:col-span-2">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as InquiryPriority | 'ALL')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-neutral-950 transition-colors cursor-pointer"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Inquiry Type Dropdown */}
          <div className="sm:col-span-3">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as InquiryType | 'ALL')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-neutral-950 transition-colors cursor-pointer"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs text-neutral-500">
            <span>Filtered results: {inquiries.length} matching inquiries</span>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-800 hover:text-red-600 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Inquiry List Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-neutral-500">Loading inquiries from database...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="py-20 text-center space-y-3 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
              <FileQuestion className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900">No Inquiries Found</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              {hasActiveFilters
                ? 'No customer inquiries match your active search or filter criteria. Try clearing filters.'
                : 'There are currently no customer inquiries or complaints recorded in the system.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-neutral-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Inquiry Details</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {inquiries.map((inq) => (
                  <tr
                    key={inq.id}
                    className="hover:bg-neutral-50/80 transition-colors group"
                  >
                    {/* Reference # */}
                    <td className="py-3.5 px-4 font-mono font-bold text-neutral-900 whitespace-nowrap">
                      <Link
                        href={`/admin/inquiries/${inq.id}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        <Hash className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{inq.referenceNo}</span>
                      </Link>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                        <User className="w-3 h-3 text-neutral-400" />
                        <span>{inq.name}</span>
                      </div>
                      <div className="flex flex-col text-[11px] text-neutral-500 mt-0.5">
                        <span className="font-mono">{inq.phone}</span>
                        {inq.email && (
                          <span className="truncate max-w-[180px] text-neutral-400">
                            {inq.email}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Inquiry Details */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="inline-block px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-semibold mb-1">
                        {inq.inquiryType}
                      </div>
                      <p className="font-semibold text-neutral-900 truncate">
                        {inq.subject}
                      </p>
                      <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                        {inq.message}
                      </p>
                    </td>

                    {/* Order # */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {inq.orderNumber ? (
                        <Link
                          href={`/admin/orders?search=${encodeURIComponent(inq.orderNumber)}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-mono font-medium transition-colors"
                          title="Open order in admin panel"
                        >
                          <ShoppingBag className="w-3 h-3 text-neutral-500" />
                          <span>{inq.orderNumber}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </Link>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getPriorityBadge(inq.priority)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(inq.status)}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-neutral-500 text-[11px]">
                      {new Date(inq.createdAt).toLocaleDateString('en-PK', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      <div className="text-[10px] text-neutral-400">
                        {new Date(inq.createdAt).toLocaleTimeString('en-PK', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/inquiries/${inq.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-[11px] transition-colors shadow-2xs"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
