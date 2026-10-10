import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://alhamdshop.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/favicon', '/uploads/'],
        disallow: [
          '/admin',
          '/admin/',
          '/api',
          '/api/',
          '/account',
          '/account/',
          '/cart',
          '/checkout',
          '/login',
          '/wishlist',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
