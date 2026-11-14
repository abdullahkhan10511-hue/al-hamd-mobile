import { cache } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FloatingWhatsApp } from '@/components/ui/FloatingWhatsApp';
import { getWhatsAppButtonSettings } from '@/lib/db/repositories/siteUiSettings';

import { getServerStoreSettings as getStoreSettings, normalizeCanonicalUrl, resolveFaviconUrl } from '@/lib/db/settingsServer';
import { getStoreSettingsFromDb } from '@/lib/db/repositories/settings';
import { isDbConfigured } from '@/lib/db/mysql';
import { StoreSettings, NavigationItem } from '@/types/admin';
import { readPersistentNavigation } from '@/lib/db/navigationStorage';
import { readPersistentAnnouncements } from '@/lib/db/announcementsStorage';
import { getServerPages } from '@/lib/db/pagesServer';
import { readPersistentLocations } from '@/lib/db/locationStorage';

export const revalidate = 60;

const loadServerSettings = cache(async (): Promise<StoreSettings> => {
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
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadServerSettings();

  const customFavicon = resolveFaviconUrl(settings.faviconUrl, settings.seo?.faviconUrl);

  const defaultOgImage =
    '/placeholders/general.svg';

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
    `${siteName} | Mobile Accessories Pakistan`;

  // Search Engine Title Override (only used if intentionally set and not a stale default)
  const knownSeedTitles = [
    'AL-HAMD MOBILE ACCESSORIES | Premium Mobile Accessories in Pakistan',
    'AL-HAMD MOBILE ACCESSORIES | Mobile Accessories in Pakistan',
    'AL-HAMD-SHOP | Mobile Accessories in Pakistan',
    'AL-HAMD SHOP ACCESSORIES | Quality Mobile Accessories Pakistan',
    'AL-HAMD SHOP | Quality Mobile Accessories Pakistan',
    'AL-HAMD SHOP | Mobile Accessories in Pakistan',
  ];
  const rawSearchEngineTitle = settings.seo?.searchEngineTitle?.trim() || '';
  const isSearchTitleStale =
    !rawSearchEngineTitle ||
    rawSearchEngineTitle === websiteTitle ||
    knownSeedTitles.includes(rawSearchEngineTitle);

  const effectiveTitle = isSearchTitleStale ? websiteTitle : rawSearchEngineTitle;

  // Primary Meta Description from Admin SEO settings
  const primaryMetaDescription =
    (settings.seo?.metaDescription && settings.seo.metaDescription.trim()) ||
    ((settings as any).metaDescription && typeof (settings as any).metaDescription === 'string' && (settings as any).metaDescription.trim()) ||
    'Shop mobile accessories at AL-HAMD SHOP. Explore chargers, cables, cases, earbuds, power banks and more, with reliable delivery across Pakistan.';

  // Search Engine Description Override (used only when intentionally populated, never silently overriding newer metaDescription)
  const knownSeedDescriptions = [
    'Find authentic chargers, cables, cases, and earbuds with express delivery across Pakistan.',
    'Shop quality mobile accessories in Pakistan including phone cases, screen protectors, chargers, cables, power banks, earbuds and more.',
    'Shop quality smartphone cases, screen protectors, fast chargers, power banks, earbuds, and mobile accessories in Pakistan.',
    'Shop premier smartphone cases, screen protectors, fast chargers, power banks, and audio accessories nationwide in Pakistan.',
  ];
  const rawSearchEngineDesc = settings.seo?.searchEngineDescription?.trim() || '';
  const isSearchDescStale =
    !rawSearchEngineDesc ||
    rawSearchEngineDesc === primaryMetaDescription ||
    knownSeedDescriptions.includes(rawSearchEngineDesc);

  const effectiveDescription = isSearchDescStale ? primaryMetaDescription : rawSearchEngineDesc;

  const baseUrl = canonicalUrl.replace(/\/+$/, '');
  const absoluteOgImage = ogImage.startsWith('http')
    ? ogImage
    : `${baseUrl}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`;

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
          url: absoluteOgImage,
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
      images: [absoluteOgImage],
    },
    icons: {
      icon: [
        ...(customFavicon && customFavicon !== '/favicon.ico'
          ? [
              {
                url: customFavicon,
                sizes: customFavicon.endsWith('.ico') ? 'any' : '192x192',
                type: customFavicon.endsWith('.ico') ? 'image/x-icon' : 'image/png',
              },
            ]
          : []),
        { url: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      ],
      shortcut: customFavicon || '/favicon.ico',
      apple: [
        {
          url: customFavicon && customFavicon !== '/favicon.ico' ? customFavicon : '/apple-icon.png',
          sizes: '180x180',
          type: 'image/png',
        },
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
    : `${baseUrl}/icon.png`;

  // Authoritative server-side settings and navigation
  const whatsappRes = await getWhatsAppButtonSettings().catch(() => null);
  const rawNav = readPersistentNavigation();
  const allPages = await getServerPages();

  const aboutPage = allPages.find((p) => p.id === 'about' || p.slug === 'about');
  const aboutNavItem = rawNav.find((n) => n.href === '/about' || n.label.toLowerCase() === 'about');

  const isAboutNavVisible = aboutNavItem ? Boolean(aboutNavItem.visible) : true;
  const isAboutPageVisible = aboutPage
    ? aboutPage.status === 'Published' && aboutPage.showInHeader !== false
    : true;
  const isAboutEnabled = isAboutNavVisible && isAboutPageVisible;

  // Filter out any hidden navigation item BEFORE render so HTML excludes them
  const baseNav = rawNav.filter((n) => {
    if (n.visible === false) return false;
    const isAbout = n.href === '/about' || n.label.toLowerCase() === 'about';
    if (isAbout) {
      return isAboutEnabled;
    }
    return true;
  });

  const headerPages = allPages.filter((p) => p.status === 'Published' && p.showInHeader);
  const pageNavItems: NavigationItem[] = headerPages
    .filter((p) => {
      if (rawNav.some((b) => b.href === `/${p.slug}` || b.href === p.slug)) {
        return false;
      }
      if (p.slug === 'about' || p.id === 'about') {
        return false;
      }
      return true;
    })
    .map((p) => ({
      id: `page-nav-${p.id}`,
      label:
        p.title
          .replace(/AL[·\-\s]HAMD/gi, '')
          .replace(/Mobile Accessories/gi, '')
          .replace(/\bSHOP\b/gi, '')
          .trim() || p.title,
      href: `/${p.slug}`,
      displayOrder: 50 + p.order,
      visible: true,
    }));

  const initialNav = [...baseNav, ...pageNavItems].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  const initialAnnounce = readPersistentAnnouncements().filter((a) => a.active !== false);
  const initialLocation = readPersistentLocations().find((l) => l.isActive) || null;
  const publishedPages = allPages.filter((p) => p.status === 'Published');

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
    <html lang="en" className="h-full antialiased font-sans overflow-x-hidden max-w-full" data-scroll-behavior="smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-neutral-900 selection:bg-neutral-950 selection:text-white overflow-x-hidden max-w-full">
        <Providers>
          <Header
            initialSettings={settings}
            initialNavigation={initialNav}
            initialAnnouncements={initialAnnounce}
            initialPages={publishedPages}
            initialLocation={initialLocation}
          />
          <main className="flex-1">{children}</main>
          <Footer initialSettings={settings} initialLocation={initialLocation} />
          <FloatingWhatsApp initialSettings={whatsappRes?.settings} />
        </Providers>
      </body>
    </html>
  );
}
