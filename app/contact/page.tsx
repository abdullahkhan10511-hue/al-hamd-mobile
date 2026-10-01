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
} from 'lucide-react';
import { getStoreSettings, getActiveSocialAccounts } from '@/lib/db/settings';
import { getActiveShopLocation } from '@/lib/db/locations';
import { StoreSettings, ShopLocation } from '@/types/admin';
import { ShopLocationCard } from '@/components/ui/ShopLocationCard';

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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setSubmitted(true);
  };

  return (
    <div className="bg-white min-h-screen py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            Technical Support
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 mt-1">
            We&apos;re Here to Assist
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-2">
            Have questions about device compatibility, fast charging standards, or accessory specs? Reach our mobile tech team anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Contact Form (Left) */}
          <div className="lg:col-span-7 bg-neutral-50/70 p-8 sm:p-10 rounded-3xl border border-neutral-200/80 shadow-xs">
            <h2 className="text-xl font-bold text-neutral-950 mb-2">Send Us an Inquiry</h2>
            <p className="text-xs text-neutral-500 mb-6">
              Typical response time is within 2 hours during business operations.
            </p>

            {submitted ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold">Inquiry Received</h3>
                </div>
                <p className="text-xs">
                  Thank you, {name}. A member of our client advisory team has been notified and will reply to {email} shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Julian Vance"
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="julian@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 300 1234567 or 03001234567"
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Your Message *</label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us how we can help you today..."
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-950"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Transmit Inquiry</span>
                </button>
              </form>
            )}
          </div>

          {/* Contact Details & Info (Right) */}
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
