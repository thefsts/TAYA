import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import ScrollReveal, { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import StatsCounter from '@/components/StatsCounter';
import { homepageEventsPreview } from '@/data/events';
import { buildPageMetadata, SITE_NAME, SITE_TAGLINE } from '@/lib/seo';
import { getHomepageCourses } from '@/lib/courses';
import { getLocalizedCourse } from '@/lib/courseTranslations';
import HeroCarousel from '@/components/HeroCarousel';
import DiscountsBanner from '@/components/DiscountsBanner';
import { getCmsHomepage } from '@/lib/cms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  // Homepage title per spec: "Corsair Tactical Solutions | Firearms Training, Security Services & Certification"
  const homepageTitle = `${SITE_NAME} | ${SITE_TAGLINE}`;
  return buildPageMetadata({
    path: '/',
    title: homepageTitle,
    description: t('metaDescription'),
    locale,
    appendSiteName: false,
    keywords: [
      'Texas firearms training',
      'Texas License to Carry Certification',
      'LTC training Texas',
      'security guard training Texas',
      'private investigations Texas',
    ],
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  // Fetch CMS hero content from Convex — falls back gracefully if unavailable
  const cmsHero = await getCmsHomepage();

  const levelColorMap: Record<string, string> = {
    Beginner: 'bg-green-100 text-green-700',
    Intermediate: 'bg-yellow-100 text-yellow-700',
    Advanced: 'bg-red-100 text-red-700',
    'All Levels': 'bg-blue-100 text-blue-700',
  };

  const featuredCourses = getHomepageCourses().map((course) => {
    const localized = getLocalizedCourse(course, locale);
    return {
      slug: localized.slug,
      title: localized.title,
      description: localized.description,
      duration: localized.duration,
      level: localized.level,
      price: localized.price,
      levelColor: levelColorMap[course.level] ?? 'bg-gray-100 text-gray-700',
      image: localized.image,
    };
  });

  const allOfferings = [
    t('offerings.ltc'),
    t('offerings.onlineAssessment'),
    t('offerings.shootingProficiency'),
    t('offerings.wichitaCert'),
    t('offerings.ltcCombo'),
    t('offerings.beginnerTraining'),
    t('offerings.introFirearms'),
    t('offerings.basicHandgun1on1'),
    t('offerings.defensiveSkills'),
    t('offerings.privateInstruction'),
    t('offerings.womensOnly'),
    t('offerings.level2Security'),
    t('offerings.level3Security'),
    t('offerings.level4Bodyguard'),
    t('offerings.churchSecurity'),
    t('offerings.activeShooter'),
    t('offerings.homeDefense'),
    t('offerings.scenarioTraining'),
    t('offerings.nraCourses'),
    t('offerings.usccaCourses'),
    t('offerings.rifleTraining'),
    t('offerings.shotgunTraining'),
    t('offerings.stopTheBleed'),
    t('offerings.cprFirstAid'),
    t('offerings.legalUseOfForce'),
    t('offerings.permitlessCarry'),
  ];

  const testimonials = [
    {
      name: 'Shamira Simmons',
      course: t('testimonials.shamira.course'),
      quote: t('testimonials.shamira.quote'),
      stars: 5,
    },
    {
      name: 'Ronique Simmons',
      course: t('testimonials.ronique.course'),
      quote: t('testimonials.ronique.quote'),
      stars: 5,
    },
    {
      name: 'Juanita Briggs',
      course: t('testimonials.juanita.course'),
      quote: t('testimonials.juanita.quote'),
      stars: 5,
    },
    {
      name: 'Janet C.',
      course: t('testimonials.janet.course'),
      quote: t('testimonials.janet.quote'),
      stars: 5,
    },
    {
      name: 'Sherri P.',
      course: t('testimonials.sherri.course'),
      quote: t('testimonials.sherri.quote'),
      stars: 5,
    },
    {
      name: 'Allan',
      course: t('testimonials.allan.course'),
      quote: t('testimonials.allan.quote'),
      stars: 5,
    },
  ];

  const whyCorsairItems = [
    { icon: '🏆', text: t('whyCorsair.experienced') },
    { icon: '🏢', text: t('whyCorsair.safeEnvironment') },
    { icon: '🙏', text: t('whyCorsair.ltcExperts') },
    { icon: '🎯', text: t('whyCorsair.allLevels') },
    { icon: '⚡', text: t('whyCorsair.practicalTraining') },
    { icon: '⭐', text: t('whyCorsair.rating') },
  ];

  const instructorCerts = [
    t('instructor.nraCertified'),
    t('instructor.usccaCertified'),
    t('instructor.texasLtcInstructor'),
    t('instructor.securityLevel'),
    t('instructor.stopTheBleed'),
    t('instructor.navyVeteran'),
  ];

  return (
    <>
      {/* ═══════════ APPROVED HOMEPAGE STYLE ═══════════ */}

      {/* ── HERO CAROUSEL ── */}
      {/* cmsSlide0Headline/Subheadline: when set in Convex dashboard, overrides the first slide */}
      <HeroCarousel
        cmsSlide0Headline={cmsHero?.heroHeadline}
        cmsSlide0Subheadline={cmsHero?.heroSubheadline}
      />

      {/* ── STATS COUNTER ── */}
      <StatsCounter />

      {/* ── NEXT CLASS ALERT ── */}
      <div className="bg-corsair-red-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-1.5 text-center">
            <span className="text-sm font-bold">📅  Next Training Class:</span>
            <span className="text-sm font-black tracking-wide">July 25, 2026</span>
            <Link href="/events" className="text-[11px] font-bold bg-white text-corsair-red-600 px-3.5 py-1 rounded-full hover:bg-red-50 transition-colors flex-shrink-0">
              View Details →
            </Link>
          </div>
        </div>
      </div>

      {/* ── CORE SERVICES OVERVIEW ── */}
      <section className="py-12 bg-white border-b border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Security Services — PRIMARY */}
            <Link
              href="/security-services"
              className="group relative bg-corsair-blue-900 hover:bg-corsair-blue-950 text-white rounded-2xl p-7 flex flex-col gap-3 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-10 h-10 bg-corsair-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest">{t('servicesOverview.primary.label')}</span>
                <h3 className="text-lg font-black text-white mt-1">{t('servicesOverview.primary.title')}</h3>
                <p className="text-sm text-corsair-gray-300 mt-1 leading-relaxed">{t('servicesOverview.primary.description')}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-corsair-red-400 font-bold text-xs uppercase tracking-wider">
                {t('servicesOverview.learnMore')} <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </span>
            </Link>

            {/* Security Training — SECONDARY */}
            <Link
              href="/security-training"
              className="group bg-corsair-gray-50 hover:bg-corsair-blue-900 border border-corsair-gray-200 hover:border-corsair-blue-900 rounded-2xl p-7 flex flex-col gap-3 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-10 h-10 bg-corsair-blue-100 group-hover:bg-corsair-red-500 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                <svg className="w-5 h-5 text-corsair-blue-900 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m0-6l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold text-corsair-red-500 group-hover:text-corsair-red-400 uppercase tracking-widest transition-colors">{t('servicesOverview.secondary.label')}</span>
                <h3 className="text-lg font-black text-corsair-blue-900 group-hover:text-white mt-1 transition-colors">{t('servicesOverview.secondary.title')}</h3>
                <p className="text-sm text-corsair-gray-500 group-hover:text-corsair-gray-300 mt-1 leading-relaxed transition-colors">{t('servicesOverview.secondary.description')}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-corsair-red-500 group-hover:text-corsair-red-400 font-bold text-xs uppercase tracking-wider transition-colors">
                {t('servicesOverview.learnMore')} <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </span>
            </Link>

            {/* Texas LTC / Private Instruction — TERTIARY */}
            <Link
              href="/courses"
              className="group bg-corsair-gray-50 hover:bg-corsair-blue-900 border border-corsair-gray-200 hover:border-corsair-blue-900 rounded-2xl p-7 flex flex-col gap-3 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-10 h-10 bg-corsair-blue-100 group-hover:bg-corsair-red-500 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                <svg className="w-5 h-5 text-corsair-blue-900 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold text-corsair-red-500 group-hover:text-corsair-red-400 uppercase tracking-widest transition-colors">{t('servicesOverview.tertiary.label')}</span>
                <h3 className="text-lg font-black text-corsair-blue-900 group-hover:text-white mt-1 transition-colors">{t('servicesOverview.tertiary.title')}</h3>
                <p className="text-sm text-corsair-gray-500 group-hover:text-corsair-gray-300 mt-1 leading-relaxed transition-colors">{t('servicesOverview.tertiary.description')}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-corsair-red-500 group-hover:text-corsair-red-400 font-bold text-xs uppercase tracking-wider transition-colors">
                {t('servicesOverview.learnMore')} <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4D PROTECTION MODEL ── */}
      <section className="py-14 bg-corsair-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">Our Proven Framework</span>
            <h2 className="text-2xl md:text-3xl font-black text-white mt-2 mb-3">The 4D Protection Model™</h2>
            <p className="text-corsair-gray-300 max-w-2xl mx-auto text-sm">Every Corsair security engagement is delivered through our proven methodology — a proactive, layered approach to protecting people, property, and operations.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { d: 'Detect', icon: '🔍', desc: 'Identify threats before they escalate through trained observation, intelligence, and surveillance protocols.' },
              { d: 'Deter',  icon: '🛡️', desc: 'Prevent incidents through visible, professional presence that discourages criminal activity and unauthorized access.' },
              { d: 'Deflect', icon: '↩️', desc: 'Redirect, de-escalate, and contain situations using proven conflict management and communication techniques.' },
              { d: 'Defend', icon: '⚔️', desc: 'Respond decisively and proportionally to active threats with trained, licensed security professionals.' },
            ].map((item) => (
              <div key={item.d} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-colors">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-xl font-black text-corsair-red-400 mb-2">{item.d}</h3>
                <p className="text-xs text-corsair-gray-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/security-services" className="inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-6 py-3 rounded-lg text-sm font-bold transition-colors">
              Explore Our Security Services →
            </Link>
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES WE PROTECT ── */}
      <section className="py-14 bg-white border-b border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Who We Serve</span>
            <h2 className="text-2xl md:text-3xl font-black text-corsair-blue-900 mt-2 mb-3">Industries We Protect</h2>
            <p className="text-corsair-gray-500 max-w-xl mx-auto text-sm">From houses of worship to commercial facilities — we deliver customized protection strategies for every sector.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {[
              { icon: '⛪', title: 'Churches & Faith-Based Organizations', desc: 'Trained church security teams and active-shooter response planning tailored to your congregation.', href: '/church-safety' },
              { icon: '🏘️', title: 'Property Management & HOA Communities', desc: 'Uniformed security officers protecting residential communities and commercial properties.', href: '/property-manager-services' },
              { icon: '🏢', title: 'Corporate & Commercial Facilities', desc: 'Professional access control, mobile patrols, and risk assessment for business environments.', href: '/security-services' },
              { icon: '🤵', title: 'Executive Protection', desc: 'Close protection specialists and secure transportation for executives and VIP clients.', href: '/security-services' },
              { icon: '🎤', title: 'Special Events', desc: 'Licensed security personnel for concerts, conventions, and private events of all sizes.', href: '/event-security' },
              { icon: '🔎', title: 'Private Investigations', desc: 'Licensed investigators providing surveillance, background checks, and investigative support.', href: '/private-investigations' },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group bg-corsair-gray-50 hover:bg-corsair-blue-900 border border-corsair-gray-200 hover:border-corsair-blue-900 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-sm font-black text-corsair-blue-900 group-hover:text-white mb-2 transition-colors">{item.title}</h3>
                <p className="text-xs text-corsair-gray-500 group-hover:text-corsair-gray-300 leading-relaxed transition-colors">{item.desc}</p>
                <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-bold text-corsair-red-500 group-hover:text-corsair-red-400 uppercase tracking-wider transition-colors">
                  Learn More <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAIN: Featured Courses + Why Card ── */}
      <main className="home-main-approved concrete-bg">
        <div className="home-grid-approved">
          {/* Left: Featured Courses */}
          <section>
            <h2 className="section-title-approved">{t('coursesSection.title')}</h2>
            <p className="section-subtitle-approved">{t('coursesSection.description')}</p>

            <div className="course-grid-approved">
              {featuredCourses.map((course) => (
                <Link
                  key={course.slug}
                  href={`/courses/${course.slug}`}
                  className="course-card-approved"
                >
                  <div className="course-card-image-approved">
                    <Image
                      src={course.image}
                      alt={course.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1180px) 50vw, 25vw"
                    />
                  </div>
                  <div className="course-card-body-approved">
                    <h3 className="course-card-title-approved">{course.title}</h3>
                    <p className="course-card-text-approved">{course.description}</p>
                    <div className="course-card-meta-approved">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {course.duration}
                      </span>
                      <span className="course-card-price-approved">{course.price}</span>
                    </div>
                    <span className="course-card-link-approved">
                      {tc('learnMore')}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-7">
              <Link href="/courses" className="btn-navy-approved">
                {t('coursesSection.viewAllCourses')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </section>

          {/* Right: Why Train With Corsair (navy card) */}
          <aside className="why-card-approved">
            <h3>{t('whyCorsair.title')}</h3>
            <p className="why-card-subtitle">{t('whyCorsair.subtitle')}</p>

            <div className="why-item-approved">
              <div className="why-icon-approved">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <p className="why-item-title-approved">{t('whyCorsair.experienced')}</p>
                <p className="why-item-text-approved">NRA & USCCA certified · 14+ years instructing</p>
              </div>
            </div>

            <div className="why-item-approved">
              <div className="why-icon-approved">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <div>
                <p className="why-item-title-approved">{t('whyCorsair.safeEnvironment')}</p>
                <p className="why-item-text-approved">Safety-first, professional range training</p>
              </div>
            </div>

            <div className="why-item-approved">
              <div className="why-icon-approved">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
              </div>
              <div>
                <p className="why-item-title-approved">{t('whyCorsair.ltcExperts')}</p>
                <p className="why-item-text-approved">State-approved Texas LTC certification</p>
              </div>
            </div>

            <div className="why-item-approved">
              <div className="why-icon-approved">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <p className="why-item-title-approved">{t('whyCorsair.practicalTraining')}</p>
                <p className="why-item-text-approved">Real-world scenarios, not just paper drills</p>
              </div>
            </div>

            <div className="why-item-approved">
              <div className="why-icon-approved">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              </div>
              <div>
                <p className="why-item-title-approved">{t('whyCorsair.rating')}</p>
                <p className="why-item-text-approved">Trusted by 500+ Texas gun owners</p>
              </div>
            </div>
          </aside>
        </div>

        {/* ── Trust Strip + CTA Panel ── */}
        <div className="lower-grid-approved">
          <section className="trust-strip-approved">
            <div className="trust-strip-item-approved">
              <div className="trust-strip-icon-approved">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <p className="trust-strip-title-approved">500+</p>
              <p className="trust-strip-text-approved">Students Trained</p>
            </div>
            <div className="trust-strip-item-approved">
              <div className="trust-strip-icon-approved">
                <svg fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              </div>
              <p className="trust-strip-title-approved">5.0★</p>
              <p className="trust-strip-text-approved">Average Rating</p>
            </div>
            <div className="trust-strip-item-approved">
              <div className="trust-strip-icon-approved">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="trust-strip-title-approved">14+</p>
              <p className="trust-strip-text-approved">Years Instructing</p>
            </div>
            <div className="trust-strip-item-approved">
              <div className="trust-strip-icon-approved">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <p className="trust-strip-title-approved">14</p>
              <p className="trust-strip-text-approved">Certifications Held</p>
            </div>
          </section>

          <section className="cta-panel-approved">
            <h3>{t('ctaCard.title')}</h3>
            <p>{t('ctaCard.description')}</p>
            <Link href="/contact" className="btn-red-approved">
              {t('ctaCard.button')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </section>
        </div>
      </main>

      {/* ──────── DISCOUNTS ──────── */}
      <DiscountsBanner variant="full" />

      {/* ───── UPCOMING EVENTS (preview) ───── */}
      <ScrollReveal delay={0.05}>
        <section className="py-20 bg-corsair-gray-50 border-t border-corsair-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Centered header */}
            <div className="text-center mb-12">
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">
                {t('eventsPreview.label')}
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2 mb-3">
                {t('eventsPreview.title')}
              </h2>
              <p className="text-corsair-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
                {t('eventsPreview.description')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {homepageEventsPreview.map((event) => (
                <Link
                  key={event.id}
                  href={event.registrationUrl ?? '/events'}
                  className="group bg-white rounded-2xl overflow-hidden border border-corsair-gray-200 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col"
                >
                  {/* Flyer image — taller for more visual impact */}
                  <div className="relative w-full aspect-[4/3] overflow-hidden bg-corsair-blue-900">
                    <Image
                      src={event.heroImage}
                      alt={event.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    {/* Category badge */}
                    <span className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-white/95 text-corsair-blue-900 shadow-sm">
                      {event.category}
                    </span>
                    {/* Date pill over image */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-white drop-shadow-md leading-tight">
                        {event.dateDisplay}
                      </span>
                      <span className="text-[10px] font-bold text-white/80 bg-black/40 backdrop-blur rounded-full px-2.5 py-1 whitespace-nowrap">
                        {event.time}
                      </span>
                    </div>
                  </div>
                  {/* Card body */}
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-base font-black text-corsair-blue-900 leading-snug mb-2 group-hover:text-corsair-red-500 transition-colors">
                      {event.title}
                    </h3>
                    <p className="text-xs text-corsair-gray-500 mb-3 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-corsair-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {event.location}
                    </p>
                    <p className="text-sm text-corsair-gray-600 leading-relaxed line-clamp-2 flex-1">
                      {event.shortDescription}
                    </p>
                    <div className="mt-5 pt-4 border-t border-corsair-gray-100 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-corsair-red-500 font-bold text-xs uppercase tracking-wider group-hover:text-corsair-red-600 transition-colors">
                        {t('eventsPreview.cardCta')}
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                      <span className="text-[10px] font-bold text-corsair-blue-900 bg-corsair-blue-50 border border-corsair-blue-100 px-2.5 py-1 rounded-full">
                        Register Now
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Centered view-all CTA */}
            <div className="text-center mt-10">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 bg-corsair-blue-900 hover:bg-corsair-blue-950 text-white px-8 py-3.5 rounded-lg text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {t('eventsPreview.viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ───── ALL COURSES WE OFFER ───── */}
      <ScrollReveal delay={0.1}>
        <section className="py-14 bg-corsair-gray-50 border-y border-corsair-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('offeringsSection.label')}</span>
              <h2 className="text-3xl font-black text-corsair-blue-900 mt-2">{t('offeringsSection.title')}</h2>
              <p className="text-corsair-gray-600 mt-2 max-w-xl mx-auto text-sm">
                {t('offeringsSection.description')}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
              {allOfferings.map((item, i) => (
                <div
                  key={i}
                  className="bg-white border border-corsair-gray-200 rounded-lg px-3 py-2.5 flex items-center gap-2 shadow-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-corsair-gray-700">{item}</span>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link
                href="/courses"
                className="btn-red-glow inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-3 rounded-lg text-sm font-bold transition-all duration-300"
              >
                {t('offeringsSection.button')} →
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ───── TESTIMONIALS ───── */}
      <ScrollReveal delay={0.15}>
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('testimonialsSection.label')}</span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
                {t('testimonialsSection.title')}
              </h2>
              <div className="flex items-center justify-center gap-1 mt-3">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                <span className="ml-2 text-sm font-bold text-corsair-gray-700">{t('testimonialsSection.rating')}</span>
              </div>
            </div>

            <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.08}>
              {testimonials.map((t, i) => (
                <StaggerItem key={i}>
                  <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-6 card-hover hover-lift">
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(t.stars)].map((_, s) => (
                      <svg key={s} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  {/* Quote */}
                  <p className="text-corsair-gray-700 text-sm leading-relaxed mb-5 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  {/* Reviewer */}
                  <div className="flex items-center gap-3 pt-4 border-t border-corsair-gray-200">
                    <div className="w-9 h-9 rounded-full bg-corsair-blue-900 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-corsair-gray-900">{t.name}</p>
                      <p className="text-xs text-corsair-gray-500">{t.course}</p>
                    </div>
                  </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>
      </ScrollReveal>

      {/* ──────── FOLLOW US ──────── */}
      <ScrollReveal delay={0.1}>
        <section className="py-10 bg-white border-y border-corsair-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('followUs.label')}</span>
                <h2 className="text-xl font-black text-corsair-blue-900 mt-1">{t('followUs.title')}</h2>
                <p className="text-corsair-gray-500 text-sm mt-1">{t('followUs.subtitle')}</p>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href="https://www.instagram.com/corsairtacticalsolutions?igsh=MTd1MmhkZzZtaWh2MQ=="
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Corsair Tactical Solutions on Instagram"
                  className="group flex items-center gap-3 bg-corsair-gray-50 hover:bg-corsair-blue-900 border border-corsair-gray-200 hover:border-corsair-blue-900 rounded-xl px-5 py-3 transition-all duration-200"
                >
                  <svg className="w-5 h-5 text-corsair-blue-900 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-corsair-blue-900 group-hover:text-white transition-colors">Instagram</span>
                </a>
                <a
                  href="https://www.facebook.com/share/17iPFcVg7j/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Corsair Tactical Solutions on Facebook"
                  className="group flex items-center gap-3 bg-corsair-gray-50 hover:bg-corsair-blue-900 border border-corsair-gray-200 hover:border-corsair-blue-900 rounded-xl px-5 py-3 transition-all duration-200"
                >
                  <svg className="w-5 h-5 text-corsair-blue-900 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-corsair-blue-900 group-hover:text-white transition-colors">Facebook</span>
                </a>
                <a
                  href="https://www.tiktok.com/@stevehopwood0?_r=1&_t=ZT-96ERuVVLCKU"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Corsair Tactical Solutions on TikTok"
                  className="group flex items-center gap-3 bg-corsair-gray-50 hover:bg-corsair-blue-900 border border-corsair-gray-200 hover:border-corsair-blue-900 rounded-xl px-5 py-3 transition-all duration-200"
                >
                  <svg className="w-5 h-5 text-corsair-blue-900 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43V13.2a8.19 8.19 0 005.58 2.18v-3.45a4.85 4.85 0 01-3.59-1.39V6.69h3.59z" />
                  </svg>
                  <span className="text-sm font-bold text-corsair-blue-900 group-hover:text-white transition-colors">TikTok</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ──────── ABOUT PREVIEW ──────── */}
      <ScrollReveal direction="none">
        <section className="py-16 bg-corsair-blue-900 text-white relative overflow-hidden">
          {/* Floating elements for about section */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-10 right-10 w-40 h-40 bg-corsair-red-500/8 rounded-full blur-3xl animate-float-slow" />
            <div className="absolute bottom-10 left-10 w-32 h-32 bg-corsair-blue-400/8 rounded-full blur-3xl animate-float-medium" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-corsair-red-500/4 rounded-full blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Image */}
              <div className="relative h-72 md:h-[440px] rounded-2xl overflow-hidden bg-corsair-gray-100">
                <Image
                  src="/images/corsair-real/steve-hopwood-bio-01.png"
                  alt={t('instructor.imageAlt')}
                  fill
                  className="object-contain object-center"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                {/* Floating badge */}
                <div className="absolute bottom-5 left-5 bg-corsair-red-500 text-white px-4 py-3 rounded-xl shadow-xl">
                  <p className="text-xs font-bold uppercase tracking-wider">{t('instructor.badgeLabel')}</p>
                  <p className="text-base font-black">{t('instructor.name')}</p>
                  <p className="text-xs text-red-200">{t('instructor.badgeSubtitle')}</p>
                </div>
              </div>

              {/* Text */}
              <div>
                <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">{t('instructorSection.label')}</span>
                <h2 className="text-3xl md:text-4xl font-black text-white mt-2 mb-4">
                  {t('instructorSection.title')}
                </h2>
                <p className="text-corsair-gray-300 leading-relaxed mb-4">
                  {t('instructorSection.paragraph1')}
                </p>
                <p className="text-corsair-gray-300 leading-relaxed mb-6">
                  {t('instructorSection.paragraph2')}
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {instructorCerts.map((cert, i) => (
                    <span key={i} className="bg-white/10 border border-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                      {cert}
                    </span>
                  ))}
                </div>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-6 py-3 rounded-lg text-sm font-bold transition-colors"
                >
                  {t('instructorSection.button')} →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>


      {/* ──────── MEET THE TEAM ──────── */}
      <ScrollReveal direction="none">
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Our Training Team</span>
              <h2 className="text-2xl md:text-3xl font-black text-corsair-blue-900 mt-2 mb-2">
                Meet the Instructors Behind the Mission
              </h2>
              <p className="text-corsair-gray-500 max-w-xl mx-auto text-sm">
                CTS is more than one person — it is a team of certified professionals united by a commitment to safety and excellence.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { name: 'Steve Hopwood',        role: 'Founder & Lead Instructor',   tag: 'Navy Veteran · 14 Yrs',        img: '/images/corsair-real/meet-steve-hopwood.jpg',       link: undefined, imgClass: 'object-contain object-center' },
                { name: 'Hilton Jackson',        role: 'Vice President of Operations',  tag: 'DPS Licensed · Armed Officer', img: '/images/corsair-real/hilton-jackson-bio-01.jpg', link: 'https://www.gideontrainingsolutions.com/', imgClass: 'object-cover object-[center_20%]' },
                { name: 'Dr. Casilda Maxwell',   role: 'Lead Firearms Instructor',     tag: 'USCCA · NRA Certified',        img: '/images/corsair-real/dr-casilda-maxwell.jpg',       link: 'https://lowkeydefense.com/#home', imgClass: 'object-cover object-[center_25%]' },
                { name: 'Shannon Gulley',        role: 'Certified LTC Instructor',     tag: 'LTC · NRA Certified',          img: '/images/instructors/shannon-gulley.jpg',            link: undefined, imgClass: 'object-cover object-[center_20%]' },
              ].map((inst) => (
                <div key={inst.name} className="text-center group">
                  <div className="relative h-48 rounded-2xl overflow-hidden mb-3 shadow-sm border border-corsair-gray-100">
                    <Image
                      src={inst.img}
                      alt={inst.name}
                      fill
                      className={`${inst.imgClass} group-hover:scale-105 transition-transform duration-500`}
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  {inst.link ? (
                    <a href={inst.link} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-corsair-blue-900 hover:text-corsair-red-500 transition-colors">
                      {inst.name} <span className="text-[9px] font-normal opacity-60">↗</span>
                    </a>
                  ) : (
                    <p className="text-sm font-black text-corsair-blue-900">{inst.name}</p>
                  )}
                  <p className="text-xs text-corsair-gray-500 mt-0.5">{inst.role}</p>
                  <span className="inline-block mt-1.5 text-[10px] font-bold bg-corsair-red-50 text-corsair-red-600 border border-corsair-red-100 px-2 py-0.5 rounded-full">
                    {inst.tag}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/instructors" className="inline-flex items-center gap-2 text-corsair-red-500 font-bold text-sm hover:text-corsair-red-600 transition-colors">
                Meet the Full Team &amp; View Credentials →
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ───── FINAL CTA ───── */}
      <ScrollReveal delay={0.1}>
        <section className="py-16 bg-corsair-gray-50 border-y border-corsair-gray-200 relative overflow-hidden">
          {/* Floating glow orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-5 left-1/4 w-24 h-24 bg-corsair-red-500/6 rounded-full blur-3xl animate-float-slow" />
            <div className="absolute bottom-5 right-1/4 w-20 h-20 bg-corsair-blue-400/6 rounded-full blur-3xl animate-float-medium" />
          </div>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('finalCta.label')}</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-4">
              {t('finalCta.title')}
            </h2>
            <p className="text-corsair-gray-600 mb-8 max-w-xl mx-auto">
              {t('finalCta.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="btn-red-glow animate-glow-pulse bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2"
              >
                Schedule a Security Consultation
              </Link>
              <Link
                href="/contact"
                className="border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white px-8 py-4 rounded-lg text-sm font-bold transition-all duration-300"
              >
                {t('finalCta.contactUs')}
              </Link>
            </div>
            <div className="mt-4">
              <Link href="/courses" className="text-sm text-corsair-gray-500 hover:text-corsair-red-500 transition-colors font-semibold">
                {t('finalCta.browseCourses')} →
              </Link>
            </div>
            <p className="mt-5 text-xs text-corsair-gray-500">
              {t('finalCta.callUs')} <a href="tel:+12143356652" className="text-corsair-red-500 font-bold hover:underline">{tc('phone')}</a>
            </p>
          </div>
        </section>
      </ScrollReveal>
    </>
  );
}