'use client';

import React, { use, useState, useEffect } from 'react';
import { ProductForm } from '@/components/admin/ProductForm';
import { getProductById } from '@/lib/db/products';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;
  const [product, setProduct] = useState<any>(() => getProductById(productId));
  const [loading, setLoading] = useState(!product);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadFreshProduct() {
      try {
        const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.product && isMounted) {
            setProduct(data.product);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not fetch fresh product from API, falling back to local cache', err);
      }

      if (isMounted) {
        const fallback = getProductById(productId);
        if (fallback) {
          setProduct(fallback);
          setLoading(false);
        } else {
          setNotFound(true);
          setLoading(false);
        }
      }
    }

    loadFreshProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <div className="py-24 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        <p className="text-xs font-semibold text-neutral-500">Loading product details...</p>
      </div>
    );
  }

  if (notFound || !product) {
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

  return <ProductForm key={product.id + (product.updatedAt || '')} initialProduct={product} isNew={false} />;
}
