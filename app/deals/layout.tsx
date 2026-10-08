import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deals',
  description: 'Explore current promotional deals and bundle offers on quality mobile accessories at AL-HAMD.',
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
