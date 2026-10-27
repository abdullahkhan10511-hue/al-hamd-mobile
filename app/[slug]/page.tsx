import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import PolicyPageLayout from '@/components/ui/PolicyPageLayout';
import { getPageById } from '@/lib/db/pages';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageById(slug);

  if (!page || page.status !== 'Published') {
    return {
      title: 'Page Not Found | AL-HAMD Mobile Accessories',
      robots: { index: false, follow: false },
    };
  }

  const title = page.seoTitle || page.title;
  const description = page.seoDescription || `Information about ${page.title} at AL-HAMD Mobile Accessories.`;
  const canonical = `https://alhamdshop.com/${page.slug.replace(/^\//, '')}`;

  return {
    title: `${title} | AL-HAMD Mobile Accessories`,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'AL-HAMD Mobile Accessories',
      type: 'website',
    },
  };
}

export default async function DynamicCustomPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPageById(slug);

  if (!page || page.status !== 'Published') {
    notFound();
  }

  const formattedTitle = page.title || slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return <PolicyPageLayout pageId={slug} fallbackTitle={formattedTitle} initialPage={page} />;
}
