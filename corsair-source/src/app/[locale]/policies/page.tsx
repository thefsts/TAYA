import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'policies' });
  return buildPageMetadata({
    path: '/policies',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function PoliciesPage() {
  const t = await getTranslations('policies');
  const tc = await getTranslations('common');

  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-corsair-blue-900 py-20 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
            backgroundSize: '20px 20px'
          }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/" className="text-corsair-gray-400 hover:text-white text-sm transition-colors">{tc('home')}</Link>
            <span className="text-corsair-gray-600">/</span>
            <span className="text-corsair-red-400 text-sm font-medium">{t('breadcrumb')}</span>
          </div>
          <div className="max-w-3xl">
            <span className="inline-block bg-corsair-red-500/20 text-corsair-red-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded mb-4">
              {t('heroBadge')}
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              {t('heroTitle')}
            </h1>
            <p className="text-corsair-gray-300 text-lg leading-relaxed">
              {t('heroDescription')}
            </p>
          </div>
        </div>
      </section>

      {/* ── Policies Content ── */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">

            {/* Cancellation Policy */}
            <div id="cancellation" className="scroll-mt-24">
              <div className="flex items-start gap-5 mb-5">
                <div className="flex-shrink-0 w-12 h-12 bg-corsair-blue-900 rounded-xl flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('cancellation.sectionLabel')}</span>
                  <h2 className="text-2xl font-black text-corsair-blue-900">{t('cancellation.title')}</h2>
                </div>
              </div>
              <div className="ml-0 md:ml-17 bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-6">
                <p className="text-corsair-gray-700 text-sm leading-relaxed">
                  {t('cancellation.content')}
                </p>
              </div>
            </div>

            <div className="border-t border-corsair-gray-100" />

            {/* Reschedule Policy */}
            <div id="reschedule" className="scroll-mt-24">
              <div className="flex items-start gap-5 mb-5">
                <div className="flex-shrink-0 w-12 h-12 bg-corsair-blue-900 rounded-xl flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('reschedule.sectionLabel')}</span>
                  <h2 className="text-2xl font-black text-corsair-blue-900">{t('reschedule.title')}</h2>
                </div>
              </div>
              <div className="ml-0 md:ml-17 bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-6">
                <p className="text-corsair-gray-700 text-sm leading-relaxed">
                  {t('reschedule.content')}
                </p>
              </div>
            </div>

            <div className="border-t border-corsair-gray-100" />

            {/* Refund Policy */}
            <div id="refunds" className="scroll-mt-24">
              <div className="flex items-start gap-5 mb-5">
                <div className="flex-shrink-0 w-12 h-12 bg-corsair-blue-900 rounded-xl flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('refund.sectionLabel')}</span>
                  <h2 className="text-2xl font-black text-corsair-blue-900">{t('refund.title')}</h2>
                </div>
              </div>
              <div className="ml-0 md:ml-17 bg-corsair-red-50 border border-corsair-red-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-corsair-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-black text-corsair-red-600 text-sm mb-1">{t('refund.heading')}</p>
                    <p className="text-corsair-gray-700 text-sm leading-relaxed">
                      {t('refund.content')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-corsair-gray-100" />

            {/* Media / Marketing Policy */}
            <div id="media" className="scroll-mt-24">
              <div className="flex items-start gap-5 mb-5">
                <div className="flex-shrink-0 w-12 h-12 bg-corsair-blue-900 rounded-xl flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('media.sectionLabel')}</span>
                  <h2 className="text-2xl font-black text-corsair-blue-900">{t('media.title')}</h2>
                </div>
              </div>
              <div className="ml-0 md:ml-17 bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-6">
                <p className="text-corsair-gray-700 text-sm leading-relaxed">
                  {t('media.content')}
                </p>
              </div>
            </div>
          </div>

          {/* Last Updated + Contact */}
          <div className="mt-14 bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-7 text-center">
            <p className="text-corsair-gray-500 text-sm mb-1">
              <strong className="text-corsair-gray-800">{t('lastUpdatedLabel')}:</strong> {t('lastUpdatedDate')}
            </p>
            <p className="text-corsair-gray-500 text-sm">
              {t('questionsAboutPolicies')}{' '}
              <Link href="/contact" className="text-corsair-red-500 hover:underline font-semibold">
                {t('contactUsAnytime')}
              </Link>{' '}
              {t('orCall')} <a href="tel:+12143356652" className="text-corsair-red-500 font-semibold hover:underline">214-335-6652</a>.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-12 bg-corsair-blue-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-white mb-3">{t('cta.title')}</h2>
          <p className="text-corsair-gray-300 text-sm mb-6">
            {t('cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/courses" className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-7 py-3 rounded-xl text-sm font-bold transition-all duration-300">
              {t('cta.viewCourses')} →
            </Link>
            <Link href="/contact" className="border-2 border-white/40 hover:border-white text-white px-7 py-3 rounded-xl text-sm font-bold transition-colors">
              {t('cta.contactUs')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}