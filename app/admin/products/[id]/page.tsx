'use client';

import React, { use } from 'react';
import { ProductForm } from '@/components/admin/ProductForm';
import { getProductById } from '@/lib/db/products';
import Link from 'next/link';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const product = getProductById(resolvedParams.id);

  if (!product) {
    return (
      <div className="py-20 text-center space-y-3">
        <h2 className="text-xl font-bold text-neutral-900">Product Not Found</h2>
        <p className="text-xs text-neutral-500">The requested product ID does not exist or was deleted.</p>
        <Link
          href="/admin/products"
          className="inline-block px-5 py-2 rounded-full bg-neutral-950 text-white text-xs font-semibold"
        >
          Return to Products
        </Link>
      </div>
    );
  }

  return <ProductForm initialProduct={product} isNew={false} />;
}
