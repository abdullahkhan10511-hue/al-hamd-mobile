import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

import { getStoreSettings } from '@/lib/db/settings';
import { getStoreSettingsFromDb } from '@/lib/db/repositories/settings';
import { isDbConfigured } from '@/lib/db/mysql';

export async function generateMetadata(): Promise<Metadata> {
  let settings = getStoreSettings();
  if (isDbConfigured()) {
    try {
      const dbSettings = await getStoreSettingsFromDb();
      if (dbSettings) {
        settings = dbSettings;
      }
    } catch (e) {
      // Fallback to local settings
    }
  }

  const customFavicon =
    (settings.seo?.faviconUrl && typeof settings.seo.faviconUrl === 'string' && settings.seo.faviconUrl.trim()) ||
    (settings.faviconUrl && typeof settings.faviconUrl === 'string' && settings.faviconUrl.trim()) ||
    (settings.logoUrl && typeof settings.logoUrl === 'string' && settings.logoUrl.trim()) ||
    '/favicon.ico';

  const defaultOgImage =
    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop';

  const ogImage = customFavicon !== '/favicon.ico' ? customFavicon : defaultOgImage;

  const title =
    (settings.seo?.metaTitle && settings.seo.metaTitle.trim()) ||
    'AL-HAMD MOBILE ACCESSORIES | Premium Mobile Accessories & Smartphone Essentials';

  const description =
    (settings.seo?.metaDescription && settings.seo.metaDescription.trim()) ||
    'Discover premium mobile accessories, high-speed GaN chargers, military-grade drop cases, Kevlar braided cables, and wireless audio across Pakistan.';

  const keywords =
    Array.isArray(settings.seo?.keywords) && settings.seo.keywords.length > 0
      ? settings.seo.keywords
      : [
          'mobile accessories',
          'phone cases',
          'screen protectors',
          'fast chargers',
          'charging cables',
          'power banks',
          'wireless chargers',
          'TWS earbuds',
          'al-hamd mobile accessories',
        ];

  return {
    metadataBase: new URL('https://alhamdshop.com'),
    alternates: {
      canonical: 'https://alhamdshop.com',
    },
    title,
    description,
    keywords,
    authors: [{ name: settings.storeName || 'AL-HAMD MOBILE ACCESSORIES' }],
    openGraph: {
      title,
      description,
      url: 'https://alhamdshop.com',
      siteName: settings.storeName || 'AL-HAMD MOBILE ACCESSORIES',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: settings.storeName || 'AL-HAMD-MOBILE Premium Mobile Accessories',
        },
      ],
      locale: 'en_PK',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    icons: {
      icon: customFavicon,
      shortcut: customFavicon,
      apple: customFavicon,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased font-sans" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col bg-white text-neutral-900 selection:bg-neutral-950 selection:text-white">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
