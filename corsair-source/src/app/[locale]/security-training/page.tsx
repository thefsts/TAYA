import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import PageHero from '@/components/PageHero';
import { buildPageMetadata } from '@/lib/seo';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import DiscountsBanner from '@/components/DiscountsBanner';
import ScrollReveal, { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'securityTraining' });
  return buildPageMetadata({
    path: '/security-training',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function SecurityTrainingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('securityTraining');
  const tn = await getTranslations('nav');

  const certLevels = [
    {
      key: 'level2',
      courseSlug: 'level-2-security-officer',
      level: t('certLevels.level2.level'),
      title: t('certLevels.level2.title'),
      duration: t('certLevels.level2.duration'),
      price: t('certLevels.level2.price'),
      badge: t('certLevels.level2.badge'),
      description: t('certLevels.level2.description'),
      includes: (t.raw('certLevels.level2.includes') as string[]).filter(Boolean),
    },
    {
      key: 'level3',
      courseSlug: 'level-3-armed-security-officer',
      level: t('certLevels.level3.level'),
      title: t('certLevels.level3.title'),
      duration: t('certLevels.level3.duration'),
      price: t('certLevels.level3.price'),
      badge: t('certLevels.level3.badge'),
      description: t('certLevels.level3.description'),
      includes: (t.raw('certLevels.level3.includes') as string[]).filter(Boolean),
    },
    {
      key: 'level4',
      courseSlug: 'level-4-bodyguard',
      level: t('certLevels.level4.level'),
      title: t('certLevels.level4.title'),
      duration: t('certLevels.level4.duration'),
      price: t('certLevels.level4.price'),
      badge: t('certLevels.level4.badge'),
      description: t('certLevels.level4.description'),
      includes: (t.raw('certLevels.level4.includes') as string[]).filter(Boolean),
    },
    {
      key: 'level34combo',
      courseSlug: 'level-3-4-complete-package',
      level: t('certLevels.level34combo.level'),
      title: t('certLevels.level34combo.title'),
      duration: t('certLevels.level34combo.duration'),
      price: t('certLevels.level34combo.price'),
      badge: t('certLevels.level34combo.badge'),
      description: t('certLevels.level34combo.description'),
      includes: (t.raw('certLevels.level34combo.includes') as string[]).filter(Boolean),
    },
  ];

  const additionalCourses = [
    { key: 'renewal', icon: t('additionalCourses.renewal.icon'), title: t('additionalCourses.renewal.title'), desc: t('additionalCourses.renewal.desc') },
    { key: 'rangeSafety', icon: t('additionalCourses.rangeSafety.icon'), title: t('additionalCourses.rangeSafety.title'), desc: t('additionalCourses.rangeSafety.desc') },
    { key: 'legalUseOfForce', icon: t('additionalCourses.legalUseOfForce.icon'), title: t('additionalCourses.legalUseOfForce.title'), desc: t('additionalCourses.legalUseOfForce.desc') },
    { key: 'firstAid', icon: t('additionalCourses.firstAid.icon'), title: t('additionalCourses.firstAid.title'), desc: t('additionalCourses.firstAid.desc') },
  ];

  const heroTags: string[] = (t.raw('hero.tags') as string[]).filter(Boolean);
  const statsData = [
    { key: 'certifications', value: t('stats.certifications.value'), label: t('stats.certifications.label') },
    { key: 'stateCertified', value: t('stats.stateCertified.value'), label: t('stats.stateCertified.label') },
    { key: 'years', value: t('stats.years.value'), label: t('stats.years.label') },
    { key: 'rating', value: t('stats.rating.value'), label: t('stats.rating.label') },
  ];
  const instructorCerts: string[] = (t.raw('instructorSection.certs') as string[]).filter(Boolean);

  return (
    <>
      <BreadcrumbJsonLd locale={locale} items={[
        { name: tn('home'), path: '/' },
        { name: tn('securityTraining'), path: '/security-training' },
      ]} />
            {/* ── Hero ── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/steve-outdoor-range-01.jpg"
        imageAlt={t('hero.imageAlt')}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: tn('securityTraining') },
        ]}
        ctas={[
          { label: t('hero.cta'), href: '/contact', variant: 'primary' },
          { label: '📞 214-335-6652', href: '/contact', variant: 'phone', phone: '+12143356652' },
        ]}
        stats={[
          { value: t('stats.certifications.value'), label: t('stats.certifications.label') },
          { value: t('stats.stateCertified.value'), label: t('stats.stateCertified.label') },
          { value: t('stats.years.value'), label: t('stats.years.label') },
        ]}
      />

      {/* ── Stats strip ── */}
      <section className="bg-white border-b border-corsair-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center" staggerDelay={0.08}>
            {statsData.map((s) => (
              <StaggerItem key={s.key}>
                <div className="hover-lift">
                  <div className="text-2xl font-black text-corsair-red-500">{s.value}</div>
                  <div className="text-xs text-corsair-gray-500 font-medium uppercase tracking-wider mt-1">{s.label}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Next Class Alert ── */}
      <div className="bg-corsair-red-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-1.5 text-center">
            <span className="text-sm font-bold">📅  Next Training Class:</span>
            <span className="text-sm font-black tracking-wide">July 25, 2026</span>
            <Link href="/events" className="text-[11px] font-bold bg-white text-corsair-red-600 px-3.5 py-1 rounded-full hover:bg-red-50 transition-colors flex-shrink-0">
              Register Now →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Certification Levels ── */}
      <section className="py-16 md:py-24 bg-corsair-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('certsSection.label')}</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
              {t('certsSection.title')}
            </h2>
            <p className="text-corsair-gray-600 mt-3 max-w-xl mx-auto text-sm">
              {t('certsSection.description')}
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {certLevels.map((cert) => (
              <div
                key={cert.key}
                className={`bg-white rounded-2xl border p-7 shadow-sm card-hover relative ${
                  cert.badge === 'Most Popular'
                    ? 'border-corsair-red-500 ring-2 ring-corsair-red-500/20'
                    : 'border-corsair-gray-200'
                }`}
              >
                {cert.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full text-white ${cert.badge === 'Most Popular' ? 'bg-corsair-red-500' : 'bg-corsair-blue-900'}`}>
                    {cert.badge}
                  </div>
                )}
                <div className="inline-block bg-corsair-blue-900 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                  {cert.level}
                </div>
                <h3 className="text-xl font-black text-corsair-blue-900 mb-2">{cert.title}</h3>
                <p className="text-corsair-gray-600 text-sm leading-relaxed mb-4">{cert.description}</p>
                <div className="flex items-center gap-4 mb-5 text-sm">
                  <span className="flex items-center gap-1.5 text-corsair-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {cert.duration}
                  </span>
                  <span className="text-corsair-red-500 font-bold text-base">{cert.price}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {cert.includes.map((item, j) => (
                    <li key={j} className="flex items-center gap-2 text-xs text-corsair-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/courses/${cert.courseSlug}`}
                  className={`block w-full text-center py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    cert.badge === 'Most Popular'
                      ? 'bg-corsair-red-500 hover:bg-corsair-red-600 text-white'
                      : 'bg-corsair-blue-900 hover:bg-corsair-blue-800 text-white'
                  }`}
                >
                  Register for {cert.level} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Additional Courses ── */}
      <section className="py-14 bg-white border-y border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('additionalSection.label')}</span>
            <h2 className="text-3xl font-black text-corsair-blue-900 mt-2">{t('additionalSection.title')}</h2>
          </div>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" staggerDelay={0.08}>
            {additionalCourses.map((course) => (
              <StaggerItem key={course.key}>
                <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-5 card-hover hover-lift text-center">
                  <div className="text-3xl mb-3">{course.icon}</div>
                  <h3 className="text-sm font-bold text-corsair-blue-900 mb-1">{course.title}</h3>
                  <p className="text-xs text-corsair-gray-500 leading-relaxed">{course.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Instructor section ── */}
      <section className="py-16 bg-corsair-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative h-72 md:h-[440px] rounded-2xl overflow-hidden bg-corsair-blue-800">
              <Image
                src="/images/corsair-real/steve-hopwood-bio-01.png"
                alt={t('instructorSection.imageAlt')}
                fill
                className="object-contain object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 bg-corsair-red-500 text-white px-4 py-3 rounded-xl shadow-xl">
                <p className="text-xs font-bold uppercase tracking-wider">{t('instructorSection.badgeLabel')}</p>
                <p className="text-base font-black">{t('instructorSection.name')}</p>
                <p className="text-xs text-red-200">{t('instructorSection.badgeSub')}</p>
              </div>
            </div>
            <div>
              <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">{t('instructorSection.sectionLabel')}</span>
              <h2 className="text-3xl font-black text-white mt-2 mb-4">{t('instructorSection.title')}</h2>
              <p className="text-corsair-gray-300 leading-relaxed mb-4 text-sm">
                {t('instructorSection.paragraph1')}
              </p>
              <p className="text-corsair-gray-300 leading-relaxed mb-6 text-sm">
                {t('instructorSection.paragraph2')}
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {instructorCerts.map((cert, i) => (
                  <span key={i} className="bg-white/10 border border-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                    {cert}
                  </span>
                ))}
              </div>
              <Link href="/about" className="inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-6 py-3 rounded-lg text-sm font-bold transition-colors">
                {t('instructorSection.button')} →
              </Link>
            </div>
          </div>
        </div>
      </section>


      {/* ──── Now Hiring ──── */}
      <section className="py-14 bg-corsair-gray-50 border-y border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <span className="inline-block bg-corsair-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded mb-4">
                Now Hiring
              </span>
              <h2 className="text-3xl font-black text-corsair-blue-900 mb-3">
                Train With Us. Work With Us.
              </h2>
              <p className="text-corsair-gray-600 text-sm leading-relaxed max-w-lg">
                Graduates of our security training program are first in line for open positions 
                with Corsair Tactical Solutions. We actively hire Level II, III, and IV officers 
                for Texas assignments. Get licensed — then get hired.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0">
              <Link
                href="/careers"
                className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 text-center"
              >
                See Open Positions →
              </Link>
              <Link
                href="/security-training"
                className="border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 text-center"
              >
                View Training Courses
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Licensing note ── */}
      <section className="py-8 bg-corsair-gray-50 border-y border-corsair-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-corsair-gray-500">
            {t('licensingNote')}
          </p>
        </div>
      </section>

      {/* ── Discounts ── */}
      <DiscountsBanner variant="full" />

      {/* ── CTA ── */}
      <section className="py-14 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-corsair-blue-900 mb-3">{t('cta.title')}</h2>
          <p className="text-corsair-gray-600 mb-7 text-sm">
            {t('cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact" className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300">
              {t('cta.button')} →
            </Link>
            <Link href="/courses" className="border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300">
              {t('cta.viewCourses')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
