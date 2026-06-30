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
  const t = await getTranslations({ locale, namespace: 'privateInvestigations' });
  return buildPageMetadata({
    path: '/private-investigations',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function PrivateInvestigationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('privateInvestigations');
  const tn = await getTranslations('nav');

  const services = [
    { key: 'surveillance', icon: t('services.surveillance.icon'), title: t('services.surveillance.title'), description: t('services.surveillance.description') },
    { key: 'background', icon: t('services.background.icon'), title: t('services.background.title'), description: t('services.background.description') },
    { key: 'assetSearch', icon: t('services.assetSearch.icon'), title: t('services.assetSearch.title'), description: t('services.assetSearch.description') },
    { key: 'dueDiligence', icon: t('services.dueDiligence.icon'), title: t('services.dueDiligence.title'), description: t('services.dueDiligence.description') },
    { key: 'legalSupport', icon: t('services.legalSupport.icon'), title: t('services.legalSupport.title'), description: t('services.legalSupport.description') },
    { key: 'missingPersons', icon: t('services.missingPersons.icon'), title: t('services.missingPersons.title'), description: t('services.missingPersons.description') },
  ];

  const processSteps = [
    { key: 'step1', step: '01', title: t('process.step1.title'), desc: t('process.step1.desc') },
    { key: 'step2', step: '02', title: t('process.step2.title'), desc: t('process.step2.desc') },
    { key: 'step3', step: '03', title: t('process.step3.title'), desc: t('process.step3.desc') },
    { key: 'step4', step: '04', title: t('process.step4.title'), desc: t('process.step4.desc') },
  ];

  const stats = [
    { key: 'licensed', value: t('stats.licensed.value'), label: t('stats.licensed.label') },
    { key: 'discreet', value: t('stats.discreet.value'), label: t('stats.discreet.label') },
    { key: 'military', value: t('stats.military.value'), label: t('stats.military.label') },
    { key: 'texas', value: t('stats.texas.value'), label: t('stats.texas.label') },
  ];

  return (
    <>
      <BreadcrumbJsonLd locale={locale} items={[
        { name: tn('home'), path: '/' },
        { name: tn('privateInvestigations'), path: '/private-investigations' },
      ]} />
            {/* ── Hero ── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/private-investigations-hero-01.png"
        imageAlt={t('hero.imageAlt')}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: tn('privateInvestigations') },
        ]}
        ctas={[
          { label: t('hero.cta'), href: '/contact', variant: 'primary' },
          { label: '📞 214-335-6652', href: '/contact', variant: 'phone', phone: '+12143356652' },
        ]}
        stats={[
          { value: t('stats.licensed.value'), label: t('stats.licensed.label') },
          { value: t('stats.discreet.value'), label: t('stats.discreet.label') },
          { value: t('stats.military.value'), label: t('stats.military.label') },
        ]}
      />

      {/* ── Trust strip ── */}
      <section className="bg-white border-b border-corsair-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center" staggerDelay={0.08}>
            {stats.map((s) => (
              <StaggerItem key={s.key}>
                <div className="hover-lift">
                  <div className="text-xl font-black text-corsair-red-500">{s.value}</div>
                  <div className="text-xs text-corsair-gray-500 font-medium uppercase tracking-wider mt-1">{s.label}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Services Grid ── */}
      <section className="py-16 md:py-24 bg-corsair-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('servicesSection.label')}</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
              {t('servicesSection.title')}
            </h2>
            <p className="text-corsair-gray-600 mt-3 max-w-xl mx-auto text-sm">
              {t('servicesSection.description')}
            </p>
          </div>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.1}>
            {services.map((service) => (
              <StaggerItem key={service.key}>
                <div className="bg-white border border-corsair-gray-200 rounded-2xl p-7 card-hover shadow-sm hover-lift">
                  <div className="text-3xl mb-4">{service.icon}</div>
                  <h3 className="text-lg font-bold text-corsair-blue-900 mb-2">{service.title}</h3>
                  <p className="text-corsair-gray-600 text-sm leading-relaxed">{service.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Our Process ── */}
      <section className="py-14 bg-white border-y border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('processSection.label')}</span>
            <h2 className="text-3xl font-black text-corsair-blue-900 mt-2">{t('processSection.title')}</h2>
          </div>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" staggerDelay={0.1}>
            {processSteps.map((step, i) => (
              <StaggerItem key={step.key}>
                <div className="relative">
                  <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-6 card-hover h-full hover-lift">
                    <div className="text-4xl font-black text-corsair-red-500/20 mb-2">{step.step}</div>
                    <h3 className="text-base font-bold text-corsair-blue-900 mb-2">{step.title}</h3>
                    <p className="text-xs text-corsair-gray-600 leading-relaxed">{step.desc}</p>
                  </div>
                  {i < processSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-corsair-gray-300" />
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Confidentiality Notice ── */}
      <section className="py-12 bg-corsair-blue-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-3">🔐</div>
            <h3 className="text-xl font-black text-white mb-2">{t('confidentiality.title')}</h3>
            <p className="text-corsair-gray-300 text-sm leading-relaxed max-w-xl mx-auto">
              {t('confidentiality.description')}
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-14 bg-corsair-gray-50 border-t border-corsair-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('cta.label')}</span>
          <h2 className="text-3xl font-black text-corsair-blue-900 mt-2 mb-3">{t('cta.title')}</h2>
          <p className="text-corsair-gray-600 mb-7 text-sm">
            {t('cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact" className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300">
              {t('cta.button')} →
            </Link>
            <a href="tel:+12143356652" className="border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300">
              📞 214-335-6652
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
