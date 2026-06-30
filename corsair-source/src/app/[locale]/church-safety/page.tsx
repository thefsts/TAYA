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
  const t = await getTranslations({ locale, namespace: 'churchSafety' });
  return buildPageMetadata({
    path: '/church-safety',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function ChurchSafetyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('churchSafety');
  const tn = await getTranslations('nav');

  const services = [
    { key: 'safetyPlanning', icon: t('services.safetyPlanning.icon'), title: t('services.safetyPlanning.title'), description: t('services.safetyPlanning.description') },
    { key: 'assessments', icon: t('services.assessments.icon'), title: t('services.assessments.title'), description: t('services.assessments.description') },
    { key: 'volunteerTraining', icon: t('services.volunteerTraining.icon'), title: t('services.volunteerTraining.title'), description: t('services.volunteerTraining.description') },
    { key: 'walkthroughs', icon: t('services.walkthroughs.icon'), title: t('services.walkthroughs.title'), description: t('services.walkthroughs.description') },
    { key: 'deEscalation', icon: t('services.deEscalation.icon'), title: t('services.deEscalation.title'), description: t('services.deEscalation.description') },
    { key: 'medical', icon: t('services.medical.icon'), title: t('services.medical.title'), description: t('services.medical.description') },
    { key: 'emergencyPlanning', icon: t('services.emergencyPlanning.icon'), title: t('services.emergencyPlanning.title'), description: t('services.emergencyPlanning.description') },
    { key: 'onsiteSecurity', icon: t('services.onsiteSecurity.icon'), title: t('services.onsiteSecurity.title'), description: t('services.onsiteSecurity.description') },
  ];

  const processSteps = [
    { key: 'step1', step: '01', title: t('process.step1.title'), desc: t('process.step1.desc') },
    { key: 'step2', step: '02', title: t('process.step2.title'), desc: t('process.step2.desc') },
    { key: 'step3', step: '03', title: t('process.step3.title'), desc: t('process.step3.desc') },
    { key: 'step4', step: '04', title: t('process.step4.title'), desc: t('process.step4.desc') },
  ];

  return (
    <>
      <BreadcrumbJsonLd locale={locale} items={[
        { name: tn('home'), path: '/' },
        { name: tn('churchSafety'), path: '/church-safety' },
      ]} />
            {/* ── Hero ── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/church-safety-hero-01.jpg"
        imageAlt={t('hero.imageAlt')}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: tn('services'), href: '/security-services' },
          { label: tn('churchSafety') },
        ]}
        ctas={[
          { label: t('hero.cta'), href: '/contact', variant: 'primary' },
          { label: '📞 214-335-6652', href: '/contact', variant: 'phone', phone: '+12143356652' },
        ]}
      />

      {/* ── Intro Statement ── */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="text-lg md:text-xl text-corsair-gray-700 leading-relaxed">
              {t('introStatement')}
            </p>
          </ScrollReveal>
        </div>
      </section>

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

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6" staggerDelay={0.1}>
            {services.map((service) => (
              <StaggerItem key={service.key}>
                <div className="bg-white rounded-xl p-6 border border-corsair-gray-200 shadow-sm card-hover hover-lift">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl flex-shrink-0">{service.icon}</span>
                    <div>
                      <h3 className="text-lg font-bold text-corsair-blue-900 mb-2">{service.title}</h3>
                      <p className="text-sm text-corsair-gray-600 leading-relaxed">{service.description}</p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Our Process ── */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mb-4">
              {t('processSection.title')}
            </h2>
            <p className="text-corsair-gray-600 max-w-2xl mx-auto leading-relaxed">
              {t('processSection.description')}
            </p>
          </div>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" staggerDelay={0.1}>
            {processSteps.map((step, i) => (
              <StaggerItem key={step.key}>
                <div className="relative">
                  <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-6 h-full card-hover hover-lift">
                    <div className="text-4xl font-black text-corsair-red-500/20 mb-2">{step.step}</div>
                    <h3 className="text-base font-bold text-corsair-blue-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-corsair-gray-600 leading-relaxed">{step.desc}</p>
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

      {/* ── Onsite Security Section ── */}
      <section className="bg-corsair-blue-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block bg-corsair-red-500/20 text-corsair-red-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded mb-4">
                {t('onsiteSection.badge')}
              </span>
              <h2 className="text-3xl font-black text-white mb-6 leading-tight">
                {t('onsiteSection.title')}
              </h2>
              <p className="text-white/75 leading-relaxed mb-6">
                {t('onsiteSection.paragraph1')}
              </p>
              <p className="text-white/75 leading-relaxed mb-8">
                {t('onsiteSection.paragraph2')}
              </p>
              <Link
                href="/contact"
                className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-6 py-3 rounded-lg text-sm font-bold transition-all duration-300 inline-block"
              >
                {t('onsiteSection.cta')} →
              </Link>
            </div>
            <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden shadow-xl">
              <Image
                src="/images/corsair-real/classroom-training-group-01.jpg"
                alt={t('onsiteSection.imageAlt')}
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950/60 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Call to Pastors ── */}
      <section className="bg-corsair-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mb-4">
            {t('pastorsCta.title')}
          </h2>
          <p className="text-corsair-gray-600 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            {t('pastorsCta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-4 rounded-lg text-base font-bold transition-all duration-300"
            >
              {t('pastorsCta.button')} →
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
