import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getServerProductBySlug,
  getServerRelatedProducts,
} from '@/lib/db/serverCatalog';
import { ProductDetailClient } from '@/components/products/ProductDetailClient';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/utils';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getServerProductBySlug(slug);

  if (!product) {
    return {
      title: 'Product Not Found | AL-HAMD SHOP',
      description: 'The requested product is not available in our catalog.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alhamdshop.com';
  const canonicalUrl = `${siteUrl.replace(/\/$/, '')}/product/${product.slug}`;
  const title = `${product.name} | AL-HAMD SHOP`;
  const description =
    product.description ||
    product.tagline ||
    `Buy authentic ${product.name} at AL-HAMD SHOP. Fast cash-on-delivery across Pakistan with guaranteed quality.`;
  const imageUrl = product.images?.[0] || (product as any).image || DEFAULT_PRODUCT_IMAGE;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'AL-HAMD SHOP',
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getServerProductBySlug(slug);

  // If product does not exist, return genuine HTTP 404
  if (!product) {
    notFound();
  }

  // Fetch related products for the same category on the server
  const relatedProducts = await getServerRelatedProducts(
    product.categorySlug,
    product.id,
    4
  );

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alhamdshop.com';
  const productUrl = `${siteUrl.replace(/\/$/, '')}/product/${product.slug}`;
  const stockCount = product.shopStock ?? product.stock ?? 0;

  // Schema.org Product structured data for Googlebot
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images?.[0] || (product as any).image || DEFAULT_PRODUCT_IMAGE,
    description: product.description || product.tagline || product.name,
    sku: product.sku || `ALH-${product.id}`,
    brand: {
      '@type': 'Brand',
      name: product.brand || 'AL-HAMD',
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'PKR',
      price: product.price,
      availability:
        stockCount > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'AL-HAMD SHOP',
      },
    },
    ...(product.rating && product.reviewCount
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <>
      {/* JSON-LD Structured Data for Search Engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Interactive Product Details with Server Hydrated Initial Data */}
      <ProductDetailClient
        initialProduct={product}
        initialRelatedProducts={relatedProducts}
      />
    </>
  );
}
