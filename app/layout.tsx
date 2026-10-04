import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

import { getStoreSettings, normalizeCanonicalUrl } from '@/lib/db/settings';
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
    } catch {
      // Fallback to local settings
    }
  }

  // Favicon: do not automatically use website logo
  const customFavicon =
    (settings.faviconUrl && typeof settings.faviconUrl === 'string' && settings.faviconUrl.trim()) ||
    (settings.seo?.faviconUrl && typeof settings.seo.faviconUrl === 'string' && settings.seo.faviconUrl.trim()) ||
    '/favicon.ico';

  const defaultOgImage =
    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop';

  const customOgImage =
    (settings.ogImageUrl && typeof settings.ogImageUrl === 'string' && settings.ogImageUrl.trim()) ||
    (settings.seo?.ogImageUrl && typeof settings.seo.ogImageUrl === 'string' && settings.seo.ogImageUrl.trim()) ||
    '';

  const ogImage = customOgImage || defaultOgImage;

  const rawCanonical =
    (settings.canonicalUrl && typeof settings.canonicalUrl === 'string' && settings.canonicalUrl.trim()) ||
    (settings.seo?.canonicalUrl && typeof settings.seo.canonicalUrl === 'string' && settings.seo.canonicalUrl.trim()) ||
    'https://alhamdshop.com';
  const canonicalUrl = normalizeCanonicalUrl(rawCanonical);

  const siteName = (settings.storeName && settings.storeName.trim()) || 'AL-HAMD MOBILE ACCESSORIES';

  // Website / Browser Title
  const websiteTitle =
    (settings.websiteTitle && settings.websiteTitle.trim()) ||
    (settings.seo?.websiteTitle && settings.seo.websiteTitle.trim()) ||
    (settings.seo?.metaTitle && settings.seo.metaTitle.trim()) ||
    `${siteName} | Mobile Accessories in Pakistan`;

  // Search Engine Title (falls back to Website / Browser Title)
  const searchEngineTitle =
    (settings.seo?.searchEngineTitle && settings.seo.searchEngineTitle.trim()) ||
    websiteTitle;

  // Meta Description
  const metaDescription =
    (settings.seo?.metaDescription && settings.seo.metaDescription.trim()) ||
    'Shop quality mobile accessories in Pakistan including phone cases, screen protectors, chargers, cables, power banks, earbuds and more.';

  // Search Engine Description (falls back to Meta Description)
  const searchEngineDescription =
    (settings.seo?.searchEngineDescription && settings.seo.searchEngineDescription.trim()) ||
    metaDescription;

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
    metadataBase: new URL(canonicalUrl),
    alternates: {
      canonical: canonicalUrl,
    },
    title: {
      default: searchEngineTitle,
      template: `%s | ${siteName}`,
    },
    description: searchEngineDescription,
    keywords,
    authors: [{ name: siteName }],
    openGraph: {
      title: searchEngineTitle,
      description: searchEngineDescription,
      url: canonicalUrl,
      siteName,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
      locale: 'en_PK',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: searchEngineTitle,
      description: searchEngineDescription,
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
