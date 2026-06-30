import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/instructors',
    title: 'Our Instructors',
    description:
      'Meet the veteran and licensed instructors behind Corsair Tactical Solutions — certified Texas DPS instructors with real-world law enforcement and military backgrounds.',
    locale,
    keywords: [
      'Texas DPS certified firearms instructors',
      'LTC instructor Texas',
      'security training instructors Texas',
      'veteran firearms instructor',
    ],
  });
}

export default function InstructorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
