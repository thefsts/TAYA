import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/training-waiver',
    title: 'Training Waiver & Registration',
    description: 'Complete your Corsair Tactical Solutions training waiver and student registration before your class.',
    locale,
    noIndex: true,
  });
}

export default function TrainingWaiverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
