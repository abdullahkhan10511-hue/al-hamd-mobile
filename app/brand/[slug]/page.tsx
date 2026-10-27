import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getServerBrandBySlug,
  getServerBrandProducts,
  getServerAllBrands,
  getServerAllCategories,
} from '@/lib/db/serverCatalog';
import { BrandPageClient } from '@/components/brands/BrandPageClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  const brand = await getServerBrandBySlug(cleanSlug);

  if (!brand) {
    return {
      title: 'Brand Not Found | AL-HAMD SHOP',
      description: 'The requested brand collection is not available in our catalog.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alhamdshop.com';
  const canonicalUrl = `${siteUrl.replace(/\/$/, '')}/brand/${brand.slug}`;
  const title = `${brand.name} Mobile Accessories | AL-HAMD SHOP`;
  const description =
    brand.description ||
    `Browse authentic ${brand.name} mobile accessories at AL-HAMD SHOP. High quality, best rates, and fast delivery across Pakistan.`;

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
      images: brand.logo ? [{ url: brand.logo }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: brand.logo ? [brand.logo] : undefined,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function BrandPage({ params }: PageProps) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  const brand = await getServerBrandBySlug(cleanSlug);

  // If brand does not exist, return genuine HTTP 404
  if (!brand) {
    notFound();
  }

  // Fetch products, brands, and categories on the server
  const [products, allBrands, allCategories] = await Promise.all([
    getServerBrandProducts(brand),
    getServerAllBrands(),
    getServerAllCategories(),
  ]);

  return (
    <BrandPageClient
      brand={brand}
      initialProducts={products}
      allBrands={allBrands}
      allCategories={allCategories}
    />
  );
}
