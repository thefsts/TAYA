import LegalPageLayout from '@/components/LegalPageLayout';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { getCmsPolicy } from '@/lib/cms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPages.refundCancellationPolicy' });
  return buildPageMetadata({
    path: '/refund-cancellation-policy',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function RefundCancellationPage() {
  const t = await getTranslations('legalPages.refundCancellationPolicy');
  const cmsPolicy = await getCmsPolicy('refund');

  return (
    <LegalPageLayout
      title={cmsPolicy?.title ?? t('title')}
      subtitle={t('subtitle')}
      lastUpdated={cmsPolicy?.lastUpdated ?? t('lastUpdated')}
    >
      {cmsPolicy?.content && (
        <div dangerouslySetInnerHTML={{ __html: cmsPolicy.content }} />
      )}
    </LegalPageLayout>
  );
}
