import Link from 'next/link';
import { PackageX, Home, ShoppingBag, Layers, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found | AL-HAMD SHOP',
  description: 'The requested page, product, or category is no longer available.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-[70vh] bg-white flex items-center justify-center px-4 py-16 sm:py-24">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-6 shadow-inner">
          <PackageX className="w-10 h-10 stroke-[1.75]" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-neutral-100 text-neutral-600 mb-3">
          Error 404 · Not Found
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
          Page or Product Not Found
        </h1>

        {/* Description */}
        <p className="mt-2.5 text-xs sm:text-sm text-neutral-500 leading-relaxed max-w-sm mx-auto">
          The product, category, or page you were looking for doesn&apos;t exist, has been permanently removed, or may have changed URL.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-neutral-950 text-white font-semibold text-xs hover:bg-neutral-800 transition-colors shadow-md"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>

          <Link
            href="/shop"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-neutral-100 text-neutral-800 font-semibold text-xs hover:bg-neutral-200 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Browse Products</span>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-8 pt-6 border-t border-neutral-100 flex items-center justify-center gap-6 text-xs text-neutral-500">
          <Link href="/categories" className="hover:text-neutral-950 flex items-center gap-1.5 font-medium transition-colors">
            <Layers className="w-3.5 h-3.5" />
            <span>All Categories</span>
          </Link>
          <span className="text-neutral-300">·</span>
          <Link href="/deals" className="hover:text-neutral-950 font-medium transition-colors">
            Featured Deals
          </Link>
          <span className="text-neutral-300">·</span>
          <Link href="/contact" className="hover:text-neutral-950 font-medium transition-colors">
            Need Help?
          </Link>
        </div>
      </div>
    </div>
  );
}
