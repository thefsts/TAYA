import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/careers',
    title: 'Careers — Security Officer Jobs',
    description:
      'Now hiring security officers in Texas. Veteran-owned Corsair Tactical Solutions is looking for Level II, III, and IV security professionals. New guards welcome — we sponsor Level II training.',
    locale,
    keywords: [
      'security officer jobs Texas',
      'security guard hiring Texas',
      'Level II security officer job',
      'armed security officer career Texas',
      'security training sponsorship Texas',
      'Corsair Tactical Solutions careers',
    ],
  });
}

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
