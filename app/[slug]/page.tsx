import PolicyPageLayout from '@/components/ui/PolicyPageLayout';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DynamicCustomPage({ params }: PageProps) {
  const { slug } = await params;
  const formattedTitle = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return <PolicyPageLayout pageId={slug} fallbackTitle={formattedTitle} />;
}
