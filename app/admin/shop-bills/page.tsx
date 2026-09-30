'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ReceiptText, ArrowRight } from 'lucide-react';

export default function ShopBillsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/shop-inventory?tab=bills');
  }, [router]);

  return (
    <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
        <ReceiptText className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-base font-bold text-neutral-900">Redirecting to Shop Inventory...</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Shop Bills are now integrated directly inside Shop Inventory.
        </p>
      </div>
      <Link
        href="/admin/shop-inventory?tab=bills"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors"
      >
        <span>Open Shop Inventory</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
