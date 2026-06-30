import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/courses',
    title: 'Courses & Training Programs',
    description:
      'Browse all Corsair Tactical Solutions courses — Texas License to Carry certification, defensive handgun, Level II–IV security officer training, church safety, and more. Starting at $100.',
    locale,
    keywords: [
      'Texas LTC courses',
      'handgun training classes Texas',
      'security officer training courses',
      'Level II III IV security training',
      'church safety training course',
      'private firearms classes Texas',
    ],
  });
}

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
