import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/contact',
    title: 'Contact Us',
    description:
      'Get in touch with Corsair Tactical Solutions. Schedule a class, ask about security services, or request a quote. Veteran-owned, Texas-based.',
    locale,
    keywords: [
      'contact Corsair Tactical Solutions',
      'schedule firearms training Texas',
      'security services quote Texas',
      'book LTC class Texas',
    ],
  });
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
