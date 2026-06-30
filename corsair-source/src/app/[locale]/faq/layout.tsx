import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/faq',
    title: 'Frequently Asked Questions',
    description:
      'Answers to common questions about Texas License to Carry requirements, class costs, what to bring, security training levels, and Corsair Tactical Solutions policies.',
    locale,
    keywords: [
      'Texas LTC FAQ',
      'firearms training questions',
      'License to Carry requirements Texas',
      'security training FAQ',
      'LTC class what to bring',
    ],
  });
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
