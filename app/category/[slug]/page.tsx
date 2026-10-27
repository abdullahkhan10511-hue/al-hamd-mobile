import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getServerCategoryBySlug,
  getServerCategoryProducts,
  getServerAllBrands,
  getServerAllCategories,
} from '@/lib/db/serverCatalog';
import { CategoryPageClient } from '@/components/categories/CategoryPageClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  const category = await getServerCategoryBySlug(cleanSlug);

  if (!category) {
    return {
      title: 'Category Not Found | AL-HAMD SHOP',
      description: 'The requested product category is not available in our catalog.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alhamdshop.com';
  const canonicalUrl = `${siteUrl.replace(/\/$/, '')}/category/${category.slug}`;
  const title = `${category.name} | AL-HAMD SHOP`;
  const description =
    category.description ||
    `Explore authentic ${category.name} at AL-HAMD SHOP. High quality mobile accessories with fast cash-on-delivery across Pakistan.`;

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
      images: category.image ? [{ url: category.image }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: category.image ? [category.image] : undefined,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  // Fetch category on the server
  const category = await getServerCategoryBySlug(cleanSlug);

  // If category does not exist, return genuine HTTP 404
  if (!category) {
    notFound();
  }

  // 3. Fetch products, brands, and categories on the server
  const [products, allBrands, allCategories] = await Promise.all([
    getServerCategoryProducts(category),
    getServerAllBrands(),
    getServerAllCategories(),
  ]);

  return (
    <CategoryPageClient
      category={category}
      initialProducts={products}
      allBrands={allBrands}
      allCategories={allCategories}
    />
  );
}
