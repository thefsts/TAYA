import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import LegalPageLayout from '@/components/LegalPageLayout';
import { buildPageMetadata } from '@/lib/seo';
import { getCmsPolicy } from '@/lib/cms';

const POLICY_META: Record<string, { titleKey: string; descKey: string; ns: string }> = {
  cookie:        { ns: 'legalPages.cookiePolicy',     titleKey: 'metaTitle', descKey: 'metaDescription' },
  privacy:       { ns: 'legalPages.privacyPolicy',    titleKey: 'metaTitle', descKey: 'metaDescription' },
  terms:         { ns: 'legalPages.termsConditions',  titleKey: 'metaTitle', descKey: 'metaDescription' },
  refund:        { ns: 'legalPages.refundPolicy',     titleKey: 'metaTitle', descKey: 'metaDescription' },
  'media-release': { ns: 'legalPages.mediaRelease',  titleKey: 'metaTitle', descKey: 'metaDescription' },
  'sms-consent': { ns: 'legalPages.smsConsent',      titleKey: 'metaTitle', descKey: 'metaDescription' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}) {
  const { locale, type } = await params;
  const meta = POLICY_META[type];
  if (!meta) return {};
  const t = await getTranslations({ locale, namespace: meta.ns });
  return buildPageMetadata({
    path: `/policies/${type}`,
    title: t(meta.titleKey),
    description: t(meta.descKey),
    locale,
  });
}

export default async function PolicyTypePage({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}) {
  const { type } = await params;

  const cmsPolicy = await getCmsPolicy(type);

  if (!cmsPolicy) notFound();

  return (
    <LegalPageLayout
      title={cmsPolicy.title}
      subtitle=""
      lastUpdated={cmsPolicy.lastUpdated ?? ''}
    >
      {cmsPolicy.content ? (
        <div dangerouslySetInnerHTML={{ __html: cmsPolicy.content }} />
      ) : (
        <p className="text-corsair-gray-500">No content available for this policy.</p>
      )}
    </LegalPageLayout>
  );
}
