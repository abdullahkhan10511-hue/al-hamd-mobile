'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  ChevronDown,
  MessageSquare,
  ExternalLink,
  Loader2,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { getStoreSettings, getActiveSocialAccounts } from '@/lib/db/settings';
import { getActiveShopLocation } from '@/lib/db/locations';
import { StoreSettings, ShopLocation, InquiryType } from '@/types/admin';
import { ShopLocationCard } from '@/components/ui/ShopLocationCard';

const INQUIRY_TYPES: InquiryType[] = [
  'General Question',
  'Product Inquiry',
  'Order Issue',
  'Delivery Issue',
  'Return / Replacement',
  'Warranty',
  'Complaint',
  'Payment Issue',
  'Other',
];

const faqs = [
  {
    q: 'What is your standard delivery timeframe across Pakistan?',
    a: 'We dispatch all verified orders within 24 hours. Orders in Lahore, Karachi, and Islamabad arrive within 2 to 3 business days. All other cities and regions across Pakistan arrive within 3 to 5 business days via reliable express courier networks with Cash on Delivery (COD) supported.',
  },
  {
    q: 'How does your 7-day replacement warranty work?',
    a: 'If your mobile accessory arrives damaged or does not function as described, contact our support team within 7 days of delivery. We arrange swift replacement or hassle-free refunds across Pakistan.',
  },
  {
    q: 'Are your mobile accessories covered by warranty?',
    a: 'Yes. All GaN fast chargers, wireless charging docks, high-capacity power banks, and TWS earbuds carry official replacement check warranties against electronic defects.',
  },
  {
    q: 'How do I verify compatibility with my smartphone?',
    a: 'Every accessory clearly lists exact supported smartphone models (Apple iPhone, Samsung Galaxy, Xiaomi, Realme, Oppo, Vivo, etc.), connection port types (USB-C, Lightning), and recommended fast charging wattages.',
  },
];

export default function ContactPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [activeLocation, setActiveLocation] = useState<ShopLocation | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inquiryType, setInquiryType] = useState<InquiryType>('General Question');
  const [orderNumber, setOrderNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const activeSocialAccounts = getActiveSocialAccounts(settings);

  const loadData = () => {
    setSettings(getStoreSettings());
    setActiveLocation(getActiveShopLocation());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const CONTACT_KEYS = ['store_settings', 'shop_locations'];
      if (key && !CONTACT_KEYS.includes(key)) return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setInquiryType('General Question');
    setOrderNumber('');
    setSubject('');
    setMessage('');
    setSubmittedReference(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Please enter your phone number.');
      return;
    }
    if (phone.trim().length < 7) {
      setErrorMessage('Please enter a valid phone number (minimum 7 digits).');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please enter an inquiry subject.');
      return;
    }
    if (!message.trim()) {
      setErrorMessage('Please provide your message or inquiry details.');
      return;
    }
    if (message.trim().length < 10) {
      setErrorMessage('Your message must be at least 10 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim(),
          inquiryType,
          orderNumber: orderNumber.trim() || undefined,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(
          data.error ||
            'Unable to submit inquiry at this moment. Please check your details or call our support line.'
        );
        setIsSubmitting(false);
        return;
      }

      setSubmittedReference(data.referenceNumber || 'INQ-ACKNOWLEDGED');
      setIsSubmitting(false);
    } catch {
      setErrorMessage(
        'A network connection error occurred. Please check your internet connection and try again.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white min-h-screen py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Technical Support & Customer Care
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 mt-1">
            We&apos;re Here to Assist
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-2">
            Have questions about orders, warranty replacements, device compatibility, or product specifications? Contact our team anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Customer Inquiry Form (Left) */}
          <div className="lg:col-span-7 bg-neutral-50/70 p-8 sm:p-10 rounded-3xl border border-neutral-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-neutral-950">Send Us an Inquiry</h2>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                Average reply &lt; 2 hrs
              </span>
            </div>
            <p className="text-xs text-neutral-500 mb-6">
              Fill out the form below. Our support department is on standby during business hours to assist you.
            </p>

            {submittedReference ? (
              <div className="p-6 sm:p-8 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-900">
                      Inquiry Submitted Successfully
                    </h3>
                    <p className="text-xs text-emerald-700">
                      Your inquiry has been safely recorded in our support desk.
                    </p>
                  </div>
                </div>

                <div className="bg-white/90 p-4 rounded-xl border border-emerald-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-emerald-600" />
                      Reference Number:
                    </span>
                    <span className="text-sm font-extrabold text-neutral-950 font-mono tracking-wider bg-neutral-100 px-2.5 py-0.5 rounded-lg border border-neutral-200">
                      #{submittedReference}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed pt-1">
                    Your inquiry has been submitted successfully. Our support team will review your message and get back to you as soon as possible.
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/60 px-3 py-1.5 rounded-lg">
                    Please keep this reference number for future support.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full py-3 px-6 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer shadow-xs"
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2.5 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span className="text-xs font-medium">{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Abdullah Khan"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950 transition-colors disabled:bg-neutral-100"
                    />
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0300 1234567 or +92 300 1234567"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950 transition-colors disabled:bg-neutral-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email Address */}
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Email Address <span className="text-neutral-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950 transition-colors disabled:bg-neutral-100"
                    />
                  </div>

                  {/* Inquiry Type */}
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Inquiry Type <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={inquiryType}
                        onChange={(e) => setInquiryType(e.target.value as InquiryType)}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950 transition-colors appearance-none pr-10 cursor-pointer disabled:bg-neutral-100"
                      >
                        {INQUIRY_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Order Number */}
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Order Number <span className="text-neutral-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="e.g. ORD-2026-000123"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950 transition-colors disabled:bg-neutral-100"
                    />
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief topic of your inquiry"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950 transition-colors disabled:bg-neutral-100"
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide details of your inquiry, complaint, product questions, or warranty issue..."
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950 transition-colors disabled:bg-neutral-100"
                  />
                  <div className="flex justify-between text-[11px] text-neutral-400 mt-1">
                    <span>Minimum 10 characters</span>
                    <span>{message.length} / 3000</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-full bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-semibold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Submitting Inquiry...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Inquiry</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Contact Details & Info (Right - Preserved Exactly) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Admin Controlled Shop Location Card */}
            <ShopLocationCard />

            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-5">
              <h3 className="text-base font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-100 pb-3">
                Direct Channels
              </h3>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-800">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Email Support</p>
                    <a
                      href={`mailto:${settings?.email || 'support@alhamd-mobile.com'}`}
                      className="text-neutral-500 hover:text-neutral-900"
                    >
                      {settings?.email || 'support@alhamd-mobile.com'}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-800">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Direct Telephone</p>
                    <a
                      href={`tel:${settings?.phone || '+923001234567'}`}
                      className="text-neutral-500 hover:text-neutral-900"
                    >
                      {settings?.phone || '+92 300 1234567'}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-800">
                    <MapPin className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">
                      {activeLocation?.shopName || 'Design Studio & Flagship'}
                    </p>
                    <p className="text-neutral-500 leading-relaxed mt-0.5">
                      {settings?.address || 'Shop # 12, Commercial Plaza, MM Alam Road, Gulberg III, Lahore, Pakistan'}
                    </p>
                    {activeLocation?.googleMapsUrl && (
                      <a
                        href={activeLocation.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-900 hover:text-amber-600 mt-1.5 underline underline-offset-2 transition-colors"
                      >
                        <span>View on Google Maps</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-800">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Operating Hours</p>
                    <p className="text-neutral-500 leading-relaxed mt-0.5 whitespace-pre-line">
                      {settings?.businessHours || 'Mon – Sat: 10:00 AM – 10:00 PM PKT\nSun: 1:00 PM – 9:00 PM PKT'}
                    </p>
                  </div>
                </div>

                {activeSocialAccounts.length > 0 && (
                  <div className="pt-3 border-t border-neutral-100">
                    <p className="font-bold text-neutral-900 mb-2">Social Channels</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeSocialAccounts.map((account) => {
                        const p = account.platform.toLowerCase();
                        const href =
                          p === 'whatsapp' && !account.url.startsWith('http')
                            ? `https://wa.me/${account.url.replace(/\D/g, '')}`
                            : account.url;

                        const badgeText =
                          p === 'instagram' ? 'IG' :
                          p === 'facebook' ? 'FB' :
                          p === 'tiktok' ? 'TK' :
                          p === 'youtube' ? 'YT' :
                          p === 'whatsapp' ? 'WA' :
                          account.name.slice(0, 2).toUpperCase();

                        return (
                          <a
                            key={account.platform}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            id={`contact-social-${account.platform}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-950 hover:text-white text-neutral-800 font-medium text-xs transition-colors"
                          >
                            <span className="font-bold">{badgeText}</span>
                            <span>{account.name}</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick FAQ Accordion */}
            <div className="bg-neutral-50/70 p-6 sm:p-8 rounded-3xl border border-neutral-200/80 space-y-4">
              <h3 className="text-sm font-bold text-neutral-950 uppercase tracking-tight flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-neutral-500" />
                <span>Frequently Asked Questions</span>
              </h3>

              <div className="space-y-2">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="border border-neutral-200/80 rounded-2xl bg-white overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="w-full px-4 py-3 text-left font-semibold text-xs text-neutral-900 flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
                          openFaq === idx ? 'rotate-180 text-neutral-950' : ''
                        }`}
                      />
                    </button>
                    {openFaq === idx && (
                      <div className="px-4 pb-3.5 text-xs text-neutral-600 leading-relaxed border-t border-neutral-100 pt-2">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
