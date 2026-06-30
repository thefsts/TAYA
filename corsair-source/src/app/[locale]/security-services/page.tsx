import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import PageHero from '@/components/PageHero';
import ScrollReveal, { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { RadarPulse } from '@/components/animations/PulseEffect';
import { buildPageMetadata } from '@/lib/seo';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'securityServices' });
  return buildPageMetadata({
    path: '/security-services',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function SecurityServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('securityServices');
  const tc = await getTranslations('common');
  const tn = await getTranslations('nav');

  const services = [
    { icon: '🏢', title: t('services.business.title'), description: t('services.business.description') },
    { icon: '⛪', title: t('services.church.title'), description: t('services.church.description') },
    { icon: '🎪', title: t('services.event.title'), description: t('services.event.description') },
    { icon: '🛡️', title: t('services.ppo.title'), description: t('services.ppo.description') },
    { icon: '🏡', title: t('services.residential.title'), description: t('services.residential.description') },
    { icon: '🚗', title: t('services.patrol.title'), description: t('services.patrol.description') },
  ];

  const whyChoose = [
    { icon: '✅', text: t('whyChoose.licensed') },
    { icon: '✅', text: t('whyChoose.armedUnarmed') },
    { icon: '✅', text: t('whyChoose.dpsCertified') },
    { icon: '✅', text: t('whyChoose.veteranOwned') },
    { icon: '✅', text: t('whyChoose.specialists') },
    { icon: '✅', text: t('whyChoose.flexible') },
  ];

  const differentiators = [
    { title: t('differentiators.trainingSchool.title'), desc: t('differentiators.trainingSchool.desc') },
    { title: t('differentiators.vettedPersonnel.title'), desc: t('differentiators.vettedPersonnel.desc') },
    { title: t('differentiators.accountability.title'), desc: t('differentiators.accountability.desc') },
    { title: t('differentiators.customPlans.title'), desc: t('differentiators.customPlans.desc') },
  ];

  const churchSafetyItems = [
    t('churchSpotlight.teamTraining'),
    t('churchSpotlight.protocolDev'),
    t('churchSpotlight.officerPlacement'),
    t('churchSpotlight.eventSecurity'),
    t('churchSpotlight.threatResponse'),
  ];

  return (
    <>
      <BreadcrumbJsonLd locale={locale} items={[
        { name: tn('home'), path: '/' },
        { name: tn('securityServices'), path: '/security-services' },
      ]} />
      {/* ──── Hero ──── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/steve-security-uniform-01.jpg"
        imageAlt={t('hero.imageAlt')}
        breadcrumbs={[
          { label: tn('corsair'), href: '/' },
          { label: tn('securityServices') },
        ]}
        ctas={[
          { label: t('hero.cta'), href: '/contact', variant: 'primary' },
          { label: `📞 ${tc('phone')}`, href: '/contact', variant: 'phone', phone: '+12143356652' },
        ]}
      />

      {/* ──— 4D Protection Model™ —— */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Proprietary Security Framework</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
              The 4D Protection Model&#x2122;
            </h2>
            <p className="text-corsair-gray-600 mt-3 max-w-2xl mx-auto text-sm leading-relaxed">
              The <strong>4D Protection Model&#x2122;</strong> is CTS&apos;s proprietary security framework built around four sequential phases designed to proactively protect people, property, and organizations while reducing risk through progressive response strategies.
            </p>
          </ScrollReveal>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10" staggerDelay={0.15}>
            {[
              {
                phase: 'Deter',
                subtitle: 'The First Line of Defense',
                description: 'Visible security presence, signage, lighting, and access control measures discourage threats before they materialize.',
              },
              {
                phase: 'Detect',
                subtitle: 'Identify Threats Early',
                description: 'Surveillance systems, trained officer observation, and situational awareness protocols identify potential threats early, creating valuable time and space to respond appropriately.',
              },
              {
                phase: 'Deflect',
                subtitle: 'The CTS Difference',
                description: 'Officers are trained in verbal de-escalation, conflict management, and trauma-informed response techniques that redirect threats without unnecessary force — a critical middle layer that protects clients while reducing unnecessary escalation.',
              },
              {
                phase: 'Defend',
                subtitle: 'Professional Response When Necessary',
                description: 'The final escalation tier activates only when other phases are exhausted. Includes physical intervention, emergency response, life safety protection, and coordination with law enforcement.',
              },
            ].map((d, i) => (
              <StaggerItem key={d.phase}>
                <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-7 relative hover-lift group cursor-default">
                  <div className="text-5xl font-black text-corsair-blue-900/10 absolute top-4 right-5 leading-none select-none">{i + 1}</div>
                  <div className="w-8 h-1 bg-corsair-red-500 rounded-full mb-4 group-hover:w-12 transition-all duration-300" />
                  <h3 className="text-lg font-black text-corsair-blue-900 mb-1">{d.phase}</h3>
                  <p className="text-xs font-bold text-corsair-red-500 uppercase tracking-wider mb-3">{d.subtitle}</p>
                  <p className="text-sm text-corsair-gray-600 leading-relaxed">{d.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <div className="bg-corsair-blue-900 rounded-2xl p-8 text-center">
            <h3 className="text-lg font-black text-white mb-3">Progressive Escalation</h3>
            <p className="text-corsair-gray-300 text-sm leading-relaxed max-w-2xl mx-auto mb-4">
              The model is structured as a progressive escalation ladder — each phase only activates when the previous one is insufficient. The objective is to resolve situations as early as possible, minimizing risk to personnel, clients, visitors, and bystanders.
            </p>
            <p className="text-corsair-red-400 text-sm font-bold italic">
              &ldquo;A well-trained officer is a communicator first and a physical responder only when necessary.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* ──── Why Choose Us ──── */}
      <section className="bg-white border-b border-corsair-gray-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" staggerDelay={0.06}>
            {whyChoose.map((item, i) => (
              <StaggerItem key={i}>
                <div className="flex items-center gap-2 text-sm font-semibold text-corsair-gray-700 hover:text-corsair-blue-900 transition-colors">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ──── Services Grid ──── */}
      <section className="py-16 md:py-24 bg-corsair-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('servicesSection.label')}</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
              {t('servicesSection.title')}
            </h2>
            <p className="text-corsair-gray-600 mt-3 max-w-xl mx-auto text-sm">
              {t('servicesSection.description')}
            </p>
          </ScrollReveal>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.1}>
            {services.map((service, i) => (
              <StaggerItem key={i}>
                <div className="bg-white border border-corsair-gray-200 rounded-2xl p-7 card-hover shadow-sm hover-lift group">
                  <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">{service.icon}</div>
                  <h3 className="text-lg font-bold text-corsair-blue-900 mb-2">{service.title}</h3>
                  <p className="text-corsair-gray-600 text-sm leading-relaxed">{service.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ──── Why Corsair Differentiators ──── */}
      <section className="py-14 bg-white border-y border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('differentiators.label')}</span>
            <h2 className="text-3xl font-black text-corsair-blue-900 mt-2">{t('differentiators.title')}</h2>
          </ScrollReveal>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" staggerDelay={0.1}>
            {differentiators.map((d, i) => (
              <StaggerItem key={i}>
                <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-6 hover-lift group">
                  <div className="w-8 h-1 bg-corsair-red-500 rounded-full mb-4 group-hover:w-12 transition-all duration-300" />
                  <h3 className="text-sm font-bold text-corsair-blue-900 mb-2">{d.title}</h3>
                  <p className="text-xs text-corsair-gray-600 leading-relaxed">{d.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ──── Church Safety Spotlight ──── */}
      <section className="py-16 bg-corsair-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal direction="left">
              <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden shadow-xl hover-zoom">
                <Image
                  src="/images/corsair-real/church-safety-specialty-01.png"
                  alt={t('churchSpotlight.imageAlt')}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950/60 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 bg-corsair-red-500 text-white px-4 py-3 rounded-xl shadow-xl">
                  <p className="text-xs font-bold uppercase tracking-wider">{t('churchSpotlight.badgeLabel')}</p>
                  <p className="text-base font-black">{t('churchSpotlight.badgeTitle')}</p>
                  <p className="text-xs text-red-200">{t('churchSpotlight.badgeSub')}</p>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right">
              <div>
                <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('churchSpotlight.label')}</span>
                <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2 mb-4">
                  {t('churchSpotlight.title')}
                </h2>
                <p className="text-corsair-gray-600 leading-relaxed mb-4 text-sm">
                  {t('churchSpotlight.paragraph1')}
                </p>
                <p className="text-corsair-gray-600 leading-relaxed mb-6 text-sm">
                  {t('churchSpotlight.paragraph2')}
                </p>
                <ul className="space-y-2 mb-6">
                  {churchSafetyItems.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-corsair-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-6 py-3 rounded-lg text-sm font-bold transition-colors"
                >
                  {t('churchSpotlight.cta')} →
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>


      {/* ──── Now Hiring ──── */}
      <section className="py-14 bg-corsair-blue-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
              <div className="flex-1 text-center lg:text-left">
                <span className="inline-block bg-corsair-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded mb-4">
                  Now Hiring
                </span>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
                  Join Our Security Team
                </h2>
                <p className="text-corsair-gray-300 text-sm leading-relaxed max-w-lg">
                  We are actively recruiting Level II, III, and IV security officers for church safety,
                  corporate, and event assignments across Texas. New guards welcome —
                  we sponsor Level II training for the right candidates.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0">
                <Link
                  href="/careers"
                  className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 text-center"
                >
                  View Open Positions →
                </Link>
                <a
                  href="mailto:corsairtacticalsolutions@gmail.com"
                  className="border-2 border-white/50 hover:border-white text-white hover:bg-white/10 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 text-center"
                >
                  Email Us
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ──── CTA ──── */}
      <section className="py-14 bg-corsair-blue-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">{t('cta.label')}</span>
            <h2 className="text-3xl font-black text-white mt-2 mb-3">{t('cta.title')}</h2>
            <p className="text-corsair-gray-300 mb-7 text-sm max-w-xl mx-auto">
              {t('cta.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact" className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300">
                {t('cta.button')} →
              </Link>
              <a href="tel:+12143356652" className="border-2 border-white/50 hover:border-white text-white hover:bg-white/10 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300">
                📞 {tc('phone')}
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}

