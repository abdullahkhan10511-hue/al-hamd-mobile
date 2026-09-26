import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'AL-HAMD MOBILE ACCESSORIES | Premium Mobile Accessories & Smartphone Essentials',
  description:
    'Discover premium mobile accessories, high-speed GaN chargers, military-grade drop cases, Kevlar braided cables, and wireless audio across Pakistan.',
  keywords: [
    'mobile accessories',
    'phone cases',
    'screen protectors',
    'fast chargers',
    'charging cables',
    'power banks',
    'wireless chargers',
    'TWS earbuds',
    'al-hamd mobile accessories',
  ],
  authors: [{ name: 'AL-HAMD MOBILE ACCESSORIES' }],
  openGraph: {
    title: 'AL-HAMD MOBILE ACCESSORIES | Premium Mobile Accessories & Smartphone Essentials',
    description:
      'Shop genuine premium mobile accessories, ultra-durable phone cases, and high-speed chargers with fast nationwide delivery across Pakistan.',
    url: 'https://alhamd.pk',
    siteName: 'AL-HAMD MOBILE ACCESSORIES',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop',
        width: 1200,
        height: 630,
        alt: 'AL-HAMD-MOBILE Premium Mobile Accessories',
      },
    ],
    locale: 'en_PK',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AL-HAMD-MOBILE | Premium Mobile Accessories & Charging Essentials',
    description:
      'Shop genuine premium mobile accessories, ultra-durable phone cases, and high-speed chargers with fast nationwide delivery across Pakistan.',
    images: ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop'],
  },
  icons: {
    icon: '/favicon.ico',
  },
};

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
