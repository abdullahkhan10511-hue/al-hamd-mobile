import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

import { getStoreSettings, normalizeCanonicalUrl, resolveFaviconUrl } from '@/lib/db/settings';
import { getStoreSettingsFromDb } from '@/lib/db/repositories/settings';
import { isDbConfigured } from '@/lib/db/mysql';
import { StoreSettings } from '@/types/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadServerSettings(): Promise<StoreSettings> {
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
  return settings;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadServerSettings();

  const customFavicon = resolveFaviconUrl(settings.faviconUrl, settings.seo?.faviconUrl);

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

  const rawSiteName =
    (settings.storeName && typeof settings.storeName === 'string' && settings.storeName.trim()) || '';
  const siteName = rawSiteName || 'AL-HAMD SHOP';

  // Primary Website / Browser Title from Admin SEO settings
  const websiteTitle =
    (settings.websiteTitle && settings.websiteTitle.trim()) ||
    (settings.seo?.websiteTitle && settings.seo.websiteTitle.trim()) ||
    (settings.seo?.metaTitle && settings.seo.metaTitle.trim()) ||
    `${siteName} | Mobile Accessories in Pakistan`;

  // Search Engine Title Override (only used if intentionally set and not a stale default)
  const knownSeedTitles = [
    'AL-HAMD MOBILE ACCESSORIES | Premium Mobile Accessories in Pakistan',
    'AL-HAMD MOBILE ACCESSORIES | Mobile Accessories in Pakistan',
    'AL-HAMD-SHOP | Mobile Accessories in Pakistan',
  ];
  const rawSearchEngineTitle = settings.seo?.searchEngineTitle?.trim() || '';
  const isSearchTitleStale =
    !rawSearchEngineTitle ||
    rawSearchEngineTitle === websiteTitle ||
    (websiteTitle !== `${siteName} | Mobile Accessories in Pakistan` &&
      knownSeedTitles.includes(rawSearchEngineTitle));

  const effectiveTitle = isSearchTitleStale ? websiteTitle : rawSearchEngineTitle;

  // Primary Meta Description from Admin SEO settings
  const primaryMetaDescription =
    (settings.seo?.metaDescription && settings.seo.metaDescription.trim()) ||
    'Shop quality mobile accessories in Pakistan including phone cases, screen protectors, chargers, cables, power banks, earbuds and more.';

  // Search Engine Description Override (used only when intentionally populated, never silently overriding newer metaDescription)
  const knownSeedDescriptions = [
    'Find authentic chargers, cables, cases, and earbuds with express delivery across Pakistan.',
    'Shop quality mobile accessories in Pakistan including phone cases, screen protectors, chargers, cables, power banks, earbuds and more.',
  ];
  const rawSearchEngineDesc = settings.seo?.searchEngineDescription?.trim() || '';
  const isSearchDescStale =
    !rawSearchEngineDesc ||
    rawSearchEngineDesc === primaryMetaDescription ||
    (primaryMetaDescription &&
      !knownSeedDescriptions.includes(primaryMetaDescription) &&
      knownSeedDescriptions.includes(rawSearchEngineDesc));

  const effectiveDescription = isSearchDescStale ? primaryMetaDescription : rawSearchEngineDesc;

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
          'al-hamd shop',
        ];

  return {
    metadataBase: new URL(canonicalUrl),
    alternates: {
      canonical: canonicalUrl,
    },
    title: {
      default: effectiveTitle,
      template: `%s | ${siteName}`,
    },
    description: effectiveDescription,
    keywords,
    authors: [{ name: siteName }],
    openGraph: {
      title: effectiveTitle,
      description: effectiveDescription,
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
      title: effectiveTitle,
      description: effectiveDescription,
      images: [ogImage],
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        ...(customFavicon && customFavicon !== '/favicon.ico'
          ? [{ url: customFavicon, sizes: 'any' }]
          : []),
      ],
      shortcut: '/favicon.ico',
      apple: [
        { url: customFavicon && customFavicon !== '/favicon.ico' ? customFavicon : '/favicon.ico', sizes: '180x180' },
      ],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await loadServerSettings();

  const customFavicon = resolveFaviconUrl(settings.faviconUrl, settings.seo?.faviconUrl);

  const rawSiteName =
    (settings.storeName && typeof settings.storeName === 'string' && settings.storeName.trim()) || '';
  const siteName = rawSiteName || 'AL-HAMD SHOP';

  const rawLogo =
    (settings.logoUrl && typeof settings.logoUrl === 'string' && settings.logoUrl.trim()) ||
    (settings.seo?.logoUrl && typeof settings.seo.logoUrl === 'string' && settings.seo.logoUrl.trim()) ||
    '';

  const rawCanonical =
    (settings.canonicalUrl && typeof settings.canonicalUrl === 'string' && settings.canonicalUrl.trim()) ||
    (settings.seo?.canonicalUrl && typeof settings.seo.canonicalUrl === 'string' && settings.seo.canonicalUrl.trim()) ||
    'https://alhamdshop.com';
  const canonicalUrl = normalizeCanonicalUrl(rawCanonical);
  const baseUrl = canonicalUrl.replace(/\/+$/, '');

  const absoluteLogoUrl = rawLogo
    ? (rawLogo.startsWith('http') ? rawLogo : `${baseUrl}${rawLogo.startsWith('/') ? '' : '/'}${rawLogo}`)
    : (rawLogo || `${baseUrl}/favicon.ico`);

  // WebSite and Organization / OnlineStore JSON-LD Structured Data
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`,
      name: siteName,
      alternateName: 'AL-HAMD',
      url: `${baseUrl}/`,
    },
    {
      '@context': 'https://schema.org',
      '@type': ['Organization', 'OnlineStore'],
      '@id': `${baseUrl}/#organization`,
      name: siteName,
      alternateName: 'AL-HAMD',
      url: `${baseUrl}/`,
      logo: absoluteLogoUrl,
      image: absoluteLogoUrl,
    },
  ];

  return (
    <html lang="en" className="h-full antialiased font-sans" data-scroll-behavior="smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-neutral-900 selection:bg-neutral-950 selection:text-white">
        <Providers>
          <Header initialSettings={settings} />
          <main className="flex-1">{children}</main>
          <Footer initialSettings={settings} />
        </Providers>
      </body>
    </html>
  );
}
