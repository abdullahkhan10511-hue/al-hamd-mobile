import type { MetadataRoute } from 'next';
import { isDbConfigured } from '@/lib/db/mysql';
import { getAllProductsFromDb } from '@/lib/db/repositories/products';
import { getAllCategoriesFromDb } from '@/lib/db/repositories/categories';
import { getProducts } from '@/lib/db/products';
import { getActiveCategories } from '@/lib/db/categories';
import { getBlogPosts } from '@/lib/db/blog';
import { Category, Product } from '@/types';
import { BlogPost } from '@/types/admin';

export const revalidate = 3600;

const CANONICAL_DOMAIN = 'https://alhamdshop.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = CANONICAL_DOMAIN;

  // 1. Homepage
  const homeEntry: MetadataRoute.Sitemap[number] = {
    url: baseUrl,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1.0,
  };

  // 2. Core Public Pages
  const corePages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/shop`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/new-arrivals`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/best-sellers`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/wholesale`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/super-wholesale`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/refund-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/shipping-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];

  // 3. Fetch Categories (MySQL with graceful fallback to local data)
  let rawCategories: Category[] = [];
  if (isDbConfigured()) {
    try {
      rawCategories = await getAllCategoriesFromDb();
    } catch (err) {
      console.warn('[sitemap] Unable to load categories from MySQL, using local fallback:', err);
    }
  }

  if (!rawCategories || rawCategories.length === 0) {
    try {
      rawCategories = getActiveCategories();
    } catch {
      rawCategories = [];
    }
  }

  // Deduplicate and filter active categories
  const categoryMap = new Map<string, Category>();
  for (const cat of rawCategories) {
    if (
      cat &&
      cat.slug &&
      typeof cat.slug === 'string' &&
      cat.status !== 'inactive' &&
      cat.status !== 'archived' &&
      cat.isActive !== false
    ) {
      const cleanSlug = cat.slug.trim().toLowerCase();
      if (cleanSlug && !categoryMap.has(cleanSlug)) {
        categoryMap.set(cleanSlug, cat);
      }
    }
  }

  const categoryEntries: MetadataRoute.Sitemap = Array.from(categoryMap.values()).map((cat) => ({
    url: `${baseUrl}/category/${encodeURIComponent(cat.slug.trim())}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // 4. Fetch Products (MySQL with graceful fallback to local data)
  let rawProducts: Product[] = [];
  if (isDbConfigured()) {
    try {
      rawProducts = await getAllProductsFromDb();
    } catch (err) {
      console.warn('[sitemap] Unable to load products from MySQL, using local fallback:', err);
    }
  }

  if (!rawProducts || rawProducts.length === 0) {
    try {
      rawProducts = getProducts();
    } catch {
      rawProducts = [];
    }
  }

  // Deduplicate and filter active public products
  const productMap = new Map<string, Product>();
  for (const prod of rawProducts) {
    if (
      prod &&
      prod.slug &&
      typeof prod.slug === 'string' &&
      (prod as any).status !== 'inactive' &&
      (prod as any).status !== 'archived' &&
      (prod as any).isActive !== false
    ) {
      const cleanSlug = prod.slug.trim();
      if (cleanSlug && !productMap.has(cleanSlug)) {
        productMap.set(cleanSlug, prod);
      }
    }
  }

  const productEntries: MetadataRoute.Sitemap = Array.from(productMap.values()).map((prod) => {
    const rawDate =
      (prod as any).updated_at ||
      (prod as any).updatedAt ||
      (prod as any).created_at ||
      (prod as any).createdAt;
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const lastModified = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    return {
      url: `${baseUrl}/product/${encodeURIComponent(prod.slug.trim())}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    };
  });

  // 5. Fetch Blog Posts (if available)
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts: BlogPost[] = await getBlogPosts();
    if (Array.isArray(posts)) {
      blogEntries = posts
        .filter((post) => post && post.slug && post.status === 'published')
        .map((post) => {
          const postDate = post.publishDate ? new Date(post.publishDate) : new Date();
          return {
            url: `${baseUrl}/blog/${encodeURIComponent(post.slug.trim())}`,
            lastModified: isNaN(postDate.getTime()) ? new Date() : postDate,
            changeFrequency: 'monthly',
            priority: 0.6,
          };
        });
    }
  } catch {
    blogEntries = [];
  }

  // Combine all valid public URLs
  const allEntries: MetadataRoute.Sitemap = [
    homeEntry,
    ...corePages,
    ...categoryEntries,
    ...productEntries,
    ...blogEntries,
  ];

  // Defensive sanitization: ensure no admin, api, account, cart, or checkout URLs ever appear
  const disallowedPatterns = [
    /\/admin(\/|$)/i,
    /\/api(\/|$)/i,
    /\/account(\/|$)/i,
    /\/cart(\/|$)/i,
    /\/checkout(\/|$)/i,
    /\/login(\/|$)/i,
    /\/wishlist(\/|$)/i,
  ];

  const filteredEntries = allEntries.filter((entry) => {
    if (!entry.url || !entry.url.startsWith(baseUrl)) return false;
    const path = entry.url.replace(baseUrl, '');
    return !disallowedPatterns.some((pattern) => pattern.test(path));
  });

  return filteredEntries;
}
