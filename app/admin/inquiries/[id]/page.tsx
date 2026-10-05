'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShoppingBag,
  ExternalLink,
  MessageSquare,
  Lock,
  Save,
  Check,
  Send,
  Loader2,
  Hash,
} from 'lucide-react';
import { CustomerInquiry, InquiryStatus, InquiryPriority } from '@/types/admin';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function AdminInquiryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { admin } = useAdminAuth();

  const [inquiry, setInquiry] = useState<CustomerInquiry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [status, setStatus] = useState<InquiryStatus>('NEW');
  const [priority, setPriority] = useState<InquiryPriority>('NORMAL');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadInquiry() {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/inquiries/${id}`);
        if (!res.ok) {
          setError('Inquiry not found or access denied.');
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        if (data.success && data.inquiry) {
          setInquiry(data.inquiry);
          setStatus(data.inquiry.status);
          setPriority(data.inquiry.priority);
          setAdminNotes(data.inquiry.adminNotes || '');
        } else {
          setError(data.error || 'Failed to fetch inquiry details.');
        }
      } catch (err) {
        console.error(err);
        setError('Network error while loading inquiry.');
      } finally {
        setIsLoading(false);
      }
    }

    loadInquiry();
  }, [id]);

  const handleUpdate = async (newStatus?: InquiryStatus, newPriority?: InquiryPriority) => {
    if (!inquiry) return;
    setIsSaving(true);
    setSaveSuccess(false);

    const payload = {
      status: newStatus !== undefined ? newStatus : status,
      priority: newPriority !== undefined ? newPriority : priority,
      adminNotes: adminNotes,
    };

    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setInquiry(data.inquiry);
        setStatus(data.inquiry.status);
        setPriority(data.inquiry.priority);
        setAdminNotes(data.inquiry.adminNotes || '');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(data.error || 'Failed to update inquiry.');
      }
    } catch {
      alert('Network error while saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const getCleanPhone = (phone: string) => phone.replace(/\D/g, '');

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-neutral-500 font-medium">Loading inquiry details...</p>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900">Inquiry Not Found</h2>
        <p className="text-xs text-neutral-500">{error || 'The requested inquiry could not be retrieved.'}</p>
        <Link
          href="/admin/inquiries"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inquiries</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Navigation & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/inquiries"
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 flex items-center justify-center transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-extrabold text-neutral-950 font-mono">
                #{inquiry.referenceNo}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                {inquiry.inquiryType}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Submitted on {new Date(inquiry.createdAt).toLocaleDateString('en-PK', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Quick Transition Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {inquiry.status !== 'IN_PROGRESS' && inquiry.status !== 'RESOLVED' && inquiry.status !== 'CLOSED' && (
            <button
              onClick={() => handleUpdate('IN_PROGRESS')}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Mark In Progress
            </button>
          )}

          {inquiry.status !== 'RESOLVED' && (
            <button
              onClick={() => handleUpdate('RESOLVED')}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Mark as Resolved
            </button>
          )}

          {inquiry.status !== 'CLOSED' && (
            <button
              onClick={() => handleUpdate('CLOSED')}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Close Inquiry
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Customer & Inquiry Details */}
        <div className="lg:col-span-8 space-y-6">
          {/* Inquiry Subject & Message Box */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Inquiry Subject
              </span>
              <h2 className="text-xl font-extrabold text-neutral-950 mt-1">
                {inquiry.subject}
              </h2>
            </div>

            <div className="border-t border-neutral-100 pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                Customer Message
              </span>
              {/* Preserved permanently, safely rendered with proper whitespace */}
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 border border-neutral-200/60 text-neutral-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {inquiry.message}
              </div>
            </div>

            {/* Related Order lookup if provided */}
            {inquiry.orderNumber && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-950">Referenced Order Number</p>
                    <p className="text-xs font-mono font-bold text-amber-800 mt-0.5">
                      {inquiry.orderNumber}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/admin/orders?search=${encodeURIComponent(inquiry.orderNumber)}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-semibold text-xs transition-colors shadow-2xs"
                >
                  <span>Lookup Order</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Internal Admin Notes (Strictly Confidential) */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-neutral-950 uppercase tracking-tight">
                  Internal Admin Notes
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Staff Confidential (Never Customer-Facing)
              </span>
            </div>

            <p className="text-xs text-neutral-500">
              Record customer communication logs, warranty decisions, return courier tracking, or internal follow-ups.
            </p>

            <textarea
              rows={5}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Spoke with customer on WhatsApp. Agreed on replacement of GaN charger. Return courier AWB #123456 dispatched via Trax..."
              className="w-full p-4 text-xs rounded-2xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-neutral-950 transition-colors leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs">
                {saveSuccess && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold animate-in fade-in duration-200">
                    <Check className="w-3.5 h-3.5" />
                    <span>Admin notes saved successfully!</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleUpdate()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Admin Notes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Profile & Admin Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Customer Profile Card */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              <span>Customer Information</span>
            </h3>

            <div>
              <p className="text-base font-extrabold text-neutral-950">{inquiry.name}</p>
              <span className="text-[11px] font-semibold text-neutral-500">
                Direct Contact Profile
              </span>
            </div>

            <div className="space-y-3 pt-2 text-xs border-t border-neutral-100">
              {/* Phone */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-neutral-600">
                  <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="font-mono font-semibold text-neutral-900">
                    {inquiry.phone}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`tel:${inquiry.phone}`}
                    className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-[10px] transition-colors"
                  >
                    Call
                  </a>
                  <a
                    href={`https://wa.me/${getCleanPhone(inquiry.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold text-[10px] transition-colors"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>

              {/* Email */}
              {inquiry.email ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-neutral-600 truncate">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate text-neutral-900">{inquiry.email}</span>
                  </div>
                  <a
                    href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Regarding Inquiry #${inquiry.referenceNo}: ${inquiry.subject}`)}`}
                    className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-[10px] shrink-0 transition-colors"
                  >
                    Email
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-neutral-400 text-xs">
                  <Mail className="w-3.5 h-3.5" />
                  <span>No email provided</span>
                </div>
              )}
            </div>
          </div>

          {/* Inquiry Controls & Status */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Management Controls
            </h3>

            {/* Status Dropdown */}
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value as InquiryStatus;
                  setStatus(s);
                  handleUpdate(s, priority);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-neutral-950 font-bold transition-colors cursor-pointer"
              >
                <option value="NEW">NEW</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            {/* Priority Dropdown */}
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => {
                  const p = e.target.value as InquiryPriority;
                  setPriority(p);
                  handleUpdate(status, p);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:border-neutral-950 font-bold transition-colors cursor-pointer"
              >
                <option value="LOW">LOW</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            {/* Metadata Timestamps */}
            <div className="border-t border-neutral-100 pt-3 space-y-2 text-[11px] text-neutral-500">
              <div className="flex justify-between">
                <span>Created:</span>
                <span className="font-medium text-neutral-700">
                  {new Date(inquiry.createdAt).toLocaleString('en-PK')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated:</span>
                <span className="font-medium text-neutral-700">
                  {new Date(inquiry.updatedAt).toLocaleString('en-PK')}
                </span>
              </div>
              {inquiry.resolvedAt && (
                <div className="flex justify-between text-emerald-700">
                  <span>Resolved Date:</span>
                  <span className="font-medium">
                    {new Date(inquiry.resolvedAt).toLocaleString('en-PK')}
                  </span>
                </div>
              )}
              {inquiry.resolvedBy && (
                <div className="flex justify-between text-emerald-700">
                  <span>Resolved By:</span>
                  <span className="font-medium">{inquiry.resolvedBy}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
