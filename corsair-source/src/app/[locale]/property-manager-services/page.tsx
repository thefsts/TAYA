import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import PageHero from '@/components/PageHero';
import { buildPageMetadata } from '@/lib/seo';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import ScrollReveal, { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'propertyManagerServices' });
  return buildPageMetadata({
    path: '/property-manager-services',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function PropertyManagerServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('propertyManagerServices');
  const tc = await getTranslations('common');
  const tn = await getTranslations('nav');

  const services = [
    { key: 'propertySecurity', icon: t('services.propertySecurity.icon'), title: t('services.propertySecurity.title'), description: t('services.propertySecurity.description') },
    { key: 'patrol', icon: t('services.patrol.icon'), title: t('services.patrol.title'), description: t('services.patrol.description') },
    { key: 'tenantSafety', icon: t('services.tenantSafety.icon'), title: t('services.tenantSafety.title'), description: t('services.tenantSafety.description') },
    { key: 'incidentResponse', icon: t('services.incidentResponse.icon'), title: t('services.incidentResponse.title'), description: t('services.incidentResponse.description') },
    { key: 'accessControl', icon: t('services.accessControl.icon'), title: t('services.accessControl.title'), description: t('services.accessControl.description') },
    { key: 'safetyPlanning', icon: t('services.safetyPlanning.icon'), title: t('services.safetyPlanning.title'), description: t('services.safetyPlanning.description') },
    { key: 'consultation', icon: t('services.consultation.icon'), title: t('services.consultation.title'), description: t('services.consultation.description') },
  ];

  const realtorSafety = [
    { key: 'stat1', stat: t('realtorSection.stats.stat1.value'), label: t('realtorSection.stats.stat1.label') },
    { key: 'stat2', stat: t('realtorSection.stats.stat2.value'), label: t('realtorSection.stats.stat2.label') },
    { key: 'stat3', stat: t('realtorSection.stats.stat3.value'), label: t('realtorSection.stats.stat3.label') },
  ];

  const whyChooseItems = [
    { key: 'licensed', text: t('whyChoose.licensed') },
    { key: 'certified', text: t('whyChoose.certified') },
    { key: 'veteran', text: t('whyChoose.veteran') },
    { key: 'trained', text: t('whyChoose.trained') },
    { key: 'gpsTracked', text: t('whyChoose.gpsTracked') },
    { key: 'flexible', text: t('whyChoose.flexible') },
  ];

  return (
    <>
      <BreadcrumbJsonLd locale={locale} items={[
        { name: tn('home'), path: '/' },
        { name: tn('propertyManagerServices'), path: '/property-manager-services' },
      ]} />
            {/* ── Hero ── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/protecting-properties-hero-01.png"
        imageAlt={t('hero.imageAlt')}
        splitLayout={true}
        cardImageSrc="/images/corsair-real/protecting-properties.jpg"
        floatingCard={{
          imageSrc: '/images/corsair-real/realtor-safety-program-01.png',
          imageAlt: 'Protected residential neighborhood',
          label: 'Neighborhood Protection',
          sublabel: 'Residential & Property Security',
        }}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: tn('services'), href: '/security-services' },
          { label: tn('propertyManagerServices') },
        ]}
        ctas={[
          { label: t('hero.cta'), href: '/contact', variant: 'primary' },
          { label: '📞 214-335-6652', href: '/contact', variant: 'phone', phone: '+12143356652' },
        ]}
      />

      {/* ── Service Cards ── */}
      <section className="bg-corsair-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mb-4">
              {t('servicesSection.title')}
            </h2>
            <p className="text-corsair-gray-600 max-w-2xl mx-auto leading-relaxed">
              {t('servicesSection.description')}
            </p>
          </div>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.1}>
            {services.map((service) => (
              <StaggerItem key={service.key}>
                <div className="bg-white rounded-xl p-6 border border-corsair-gray-200 shadow-sm card-hover hover-lift">
                  <span className="text-3xl mb-4 block">{service.icon}</span>
                  <h3 className="text-lg font-bold text-corsair-blue-900 mb-2">{service.title}</h3>
                  <p className="text-sm text-corsair-gray-600 leading-relaxed">{service.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Realtor Safety Program ── */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block bg-corsair-red-500/10 text-corsair-red-500 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded mb-4">
                {t('realtorSection.badge')}
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mb-6 leading-tight">
                {t('realtorSection.title')}
              </h2>
              <p className="text-corsair-gray-600 leading-relaxed mb-6">
                {t('realtorSection.paragraph1')}
              </p>
              <p className="text-corsair-gray-600 leading-relaxed mb-6">
                {t('realtorSection.paragraph2')}
              </p>

              <p className="text-corsair-gray-600 leading-relaxed mb-6">
                Whether you&apos;re hosting a busy open house, meeting a new client, or showcasing a high-value
                property, our team is there to provide a visible security presence and immediate response
                capability when needed.
              </p>

              <div className="mb-8">
                <p className="text-sm font-bold text-corsair-blue-900 uppercase tracking-wider mb-4">Our Services Include</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Open House Security',
                    'Private Showing Escorts',
                    'Luxury & High-Value Property Protection',
                    'Realtor Safety Assessments',
                    'Client Meeting Security',
                    'Event & Property Security Presence',
                  ].map((svc) => (
                    <div key={svc} className="flex items-center gap-3">
                      <span className="w-4 h-4 rounded-full bg-corsair-red-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="text-sm text-corsair-gray-700 font-medium">{svc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4 mb-8">
                {realtorSafety.map((item) => (
                  <div key={item.key} className="flex items-start gap-4">
                    <span className="flex-shrink-0 text-2xl font-black text-corsair-red-500 min-w-[90px]">{item.stat}</span>
                    <span className="text-sm text-corsair-gray-600 leading-relaxed">{item.label}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/contact"
                className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-6 py-3 rounded-lg text-sm font-bold transition-all duration-300 inline-block"
              >
                {t('realtorSection.cta')} →
              </Link>

              <div className="mt-8 pt-6 border-t border-corsair-gray-200">
                <p className="text-corsair-blue-900 font-bold text-base mb-1">
                  You focus on closing the deal. We&apos;ll focus on your safety.
                </p>
                <p className="text-corsair-red-500 font-bold text-sm tracking-wide uppercase mb-3">
                  Professional. Discreet. Reliable.
                </p>
                <p className="text-sm text-corsair-gray-600 leading-relaxed">
                  Trust Corsair Tactical Solutions to help protect you, your clients, and your
                  business every step of the way.
                </p>
              </div>
            </div>

            <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden shadow-xl">
              <Image
                src="/images/corsair-real/realtor-safety-program-01.png"
                alt={t('realtorSection.imageAlt')}
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950/60 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Choose Corsair ── */}
      <section className="bg-corsair-blue-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-white mb-4">{t('whyChooseSection.title')}</h2>
            <p className="text-white/75 max-w-2xl mx-auto">
              {t('whyChooseSection.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {whyChooseItems.map((item) => (
              <div key={item.key} className="flex items-center gap-3 bg-corsair-blue-800/50 rounded-lg p-4 border border-corsair-blue-700">
                <span className="text-lg">✅</span>
                <span className="text-sm font-medium text-white">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-corsair-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mb-4">
            {t('cta.title')}
          </h2>
          <p className="text-corsair-gray-600 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            {t('cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-4 rounded-lg text-base font-bold transition-all duration-300"
            >
              {t('cta.button')} →
            </Link>
            <a
              href="tel:+12143356652"
              className="border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white px-8 py-4 rounded-lg text-base font-bold transition-all duration-300"
            >
              📞 214-335-6652
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
