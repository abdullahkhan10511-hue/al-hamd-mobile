'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, ArrowRight } from 'lucide-react';
import { getPageById } from '@/lib/db/pages';
import { CustomPage } from '@/types/admin';
import PageRenderer from '@/components/ui/PageRenderer';

interface PolicyPageLayoutProps {
  pageId: string;
  fallbackTitle: string;
}

export default function PolicyPageLayout({ pageId, fallbackTitle }: PolicyPageLayoutProps) {
  const [page, setPage] = useState<CustomPage | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const found = await getPageById(pageId);
      setPage(found);
    } catch (e) {
      console.error('Error loading page:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key && key !== 'pages') return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [pageId]);

  if (loading) {
    return (
      <div className="bg-white min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse space-y-4 max-w-xl w-full px-4">
          <div className="h-8 bg-neutral-100 rounded-xl w-3/4" />
          <div className="h-4 bg-neutral-100 rounded-lg w-full" />
          <div className="h-4 bg-neutral-100 rounded-lg w-5/6" />
        </div>
      </div>
    );
  }

  // If page is not found or is in Draft/Hidden status
  if (!page || page.status !== 'Published') {
    return (
      <div className="bg-white min-h-[70vh] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full text-center space-y-5 p-8 rounded-3xl border border-neutral-200 bg-neutral-50/50">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Page Unavailable</h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-2 leading-relaxed">
              This page is currently unpublished or in draft status. Please check back later or return to our homepage.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              <span>Return to Storefront</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Return to Storefront</span>
        </Link>

        {/* Page Header */}
        <div className="space-y-3 mb-10 pb-6 border-b border-neutral-100">
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
            {page.footerCategory === 'legal' ? 'Legal & Compliance' : 'Store Information'}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950">
            {page.title || fallbackTitle}
          </h1>
          {page.updatedAt && (
            <p className="text-xs text-neutral-400">
              Last updated:{' '}
              {new Date(page.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Page Content / Dynamic Blocks */}
        <PageRenderer page={page} />
      </div>
    </div>
  );
}
