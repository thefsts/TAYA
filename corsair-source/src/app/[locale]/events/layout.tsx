import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/events',
    title: 'Upcoming Training Events',
    description:
      'View upcoming firearms training events, License to Carry classes, and security certification courses hosted by Corsair Tactical Solutions across Texas.',
    locale,
    keywords: [
      'firearms training events Texas',
      'LTC class schedule Texas',
      'upcoming security training events',
      'gun safety class schedule',
    ],
  });
}

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
