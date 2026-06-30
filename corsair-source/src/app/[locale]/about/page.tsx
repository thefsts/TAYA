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
  const t = await getTranslations({ locale, namespace: 'about' });
  return buildPageMetadata({
    path: '/about',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('about');
  const tc = await getTranslations('common');
  const tn = await getTranslations('nav');

  const certifications = [
    { name: t('certs.nraPistol'), org: t('certs.nraPistolOrg'), icon: '🏅' },
    { name: t('certs.usccaHomeDefense'), org: t('certs.usccaHomeDefenseOrg'), icon: '🛡️' },
    { name: t('certs.usccaRangeSafety'), org: t('certs.usccaRangeSafetyOrg'), icon: '🎯' },
    { name: t('certs.texasLtc'), org: t('certs.texasLtcOrg'), icon: '🙏' },
    { name: t('certs.level2Protection'), org: t('certs.level2ProtectionOrg'), icon: '🔒' },
    { name: t('certs.level3Armed'), org: t('certs.level3ArmedOrg'), icon: '🔒' },
    { name: t('certs.level4Protection'), org: t('certs.level4ProtectionOrg'), icon: '🔒' },
    { name: t('certs.privateProtection'), org: t('certs.privateProtectionOrg'), icon: '🚨' },
    { name: t('certs.continuingEd'), org: t('certs.continuingEdOrg'), icon: '📋' },
    { name: t('certs.stopTheBleed'), org: t('certs.stopTheBleedOrg'), icon: '⚕️' },
    { name: t('certs.armedFirstResponder'), org: t('certs.armedFirstResponderOrg'), icon: '🚑' },
    { name: t('certs.northStarArms'), org: t('certs.northStarArmsOrg'), icon: '⭐' },
    { name: t('certs.privateInvestigator'), org: t('certs.privateInvestigatorOrg'), icon: '🔍' },
    { name: t('certs.allianceNetwork'), org: t('certs.allianceNetworkOrg'), icon: '🤝' },
  ];

  const licenses = [
    { label: t('licenses.securityContractor'), number: 'B29791901', desc: t('licenses.securityContractorDesc') },
    { label: t('licenses.trainingSchool'), number: 'F30797601', desc: t('licenses.trainingSchoolDesc') },
    { label: t('licenses.continuingEd'), number: 'Y30987101', desc: t('licenses.continuingEdDesc') },
    { label: t('licenses.privateInvestigation'), number: 'C31074401', desc: t('licenses.privateInvestigationDesc') },
  ];

  const philosophyPoints = [
    { title: t('philosophy.mental.title'), desc: t('philosophy.mental.desc') },
    { title: t('philosophy.situational.title'), desc: t('philosophy.situational.desc') },
    { title: t('philosophy.contingency.title'), desc: t('philosophy.contingency.desc') },
    { title: t('philosophy.firearms.title'), desc: t('philosophy.firearms.desc') },
    { title: t('philosophy.firstAid.title'), desc: t('philosophy.firstAid.desc') },
    { title: t('philosophy.conflict.title'), desc: t('philosophy.conflict.desc') },
  ];

  const testimonials = [
    {
      name: 'Shamira Simmons',
      course: t('testimonials.shamira.course'),
      quote: t('testimonials.shamira.quote'),
    },
    {
      name: 'Genetia T.',
      course: t('testimonials.genetia.course'),
      quote: t('testimonials.genetia.quote'),
    },
    {
      name: 'Sharon E.',
      course: t('testimonials.sharon.course'),
      quote: t('testimonials.sharon.quote'),
    },
  ];

  const stats = [
    { value: '500+', label: t('stats.students') },
    { value: '5.0★', label: t('stats.rating') },
    { value: '14+', label: t('stats.years') },
    { value: '14', label: t('stats.certs') },
  ];

  const experienceAreas = [
    t('experience.military'),
    t('experience.privateProtection'),
    t('experience.lawEnforcement'),
    t('experience.securityOps'),
    t('experience.firearmsInstruction'),
    t('experience.emergencyResponse'),
  ];

  return (
    <>
      <BreadcrumbJsonLd locale={locale} items={[
        { name: tn('home'), path: '/' },
        { name: tn('about'), path: '/about' },
      ]} />
      {/* ──── Hero ──── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/steve-security-closeup-01.jpg"
        imageAlt={t('hero.imageAlt')}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: tn('about') },
        ]}
        stats={[
          { value: '500+', label: t('stats.students') },
          { value: '5.0★', label: t('stats.rating') },
          { value: '14+', label: t('stats.years') },
          { value: '14', label: t('stats.certs') },
        ]}
        ctas={[
          { label: t('hero.ctaCourses', { defaultValue: 'View Courses' }), href: '/courses', variant: 'primary' },
          { label: t('hero.ctaServices', { defaultValue: 'Security Services' }), href: '/security-services', variant: 'secondary' },
        ]}
        floatingCard={{
          imageSrc: '/images/corsair-real/steve-outdoor-range-01.jpg',
          imageAlt: t('hero.cardImageAlt', { defaultValue: 'Training' }),
          label: t('hero.cardLabel', { defaultValue: 'NRA Certified' }),
          sublabel: t('hero.cardSublabel', { defaultValue: 'Professional Training' }),
        }}
      />

      {/* ──── Stats strip ──── */}
      <section className="bg-white border-b border-corsair-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-3xl font-black text-corsair-red-500">{s.value}</div>
                <div className="text-xs text-corsair-gray-500 font-medium uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── Instructor Profile ──── */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
            {/* Image + badge */}
            <div className="relative">
              <div className="relative h-96 md:h-[520px] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/images/corsair-real/meet-steve-hopwood.jpg"
                  alt={t('profile.imageAlt')}
                  fill
                  className="object-contain object-top"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest mb-1">{t('profile.badgeLabel')}</p>
                  <p className="text-2xl font-black text-white">{t('profile.name')}</p>
                  <p className="text-white/70 text-sm">{t('profile.role')}</p>
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-corsair-blue-900 text-white rounded-2xl px-5 py-4 shadow-xl border border-corsair-blue-800">
                <p className="text-xs text-corsair-gray-400 uppercase tracking-wider mb-0.5">{t('profile.backgroundLabel')}</p>
                <p className="font-black text-white text-sm">{t('profile.backgroundValue')}</p>
                <p className="text-xs text-corsair-gray-300">{t('profile.backgroundSub')}</p>
              </div>
            </div>

            {/* Bio */}
            <div>
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('profile.sectionLabel')}</span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2 mb-5">
                {t('profile.sectionTitle')}
              </h2>

              <div className="space-y-4 text-corsair-gray-600 leading-relaxed text-sm md:text-base">
                <p>
                  {t('profile.paragraph1')}
                </p>
                <p>
                  {t('profile.paragraph2')}
                </p>
                <p>
                  {t('profile.paragraph3')}
                </p>
                <p>
                  {t('profile.paragraph4')}
                </p>
              </div>

              {/* Contact callout */}
              <div className="mt-7 bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <p className="font-bold text-corsair-blue-900 text-sm">{t('profile.readyToTrain')}</p>
                  <p className="text-corsair-gray-500 text-xs">{t('profile.scheduleInfo')}</p>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <a href="tel:+12143356652" className="text-sm font-bold text-corsair-red-500 hover:underline">📞 {tc('phone')}</a>
                  <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-xs text-corsair-gray-500 hover:text-corsair-blue-900 transition-colors">{tc('email')}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──── Hilton Jackson Profile ──── */}
      <section className="py-16 md:py-24 bg-corsair-gray-50 border-t border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
            {/* Bio */}
            <div>
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Vice President of Operations</span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2 mb-5">
                Hilton Jackson
              </h2>
              <div className="space-y-4 text-corsair-gray-600 leading-relaxed text-sm md:text-base">
                <p>
                  Hilton Jackson serves as Vice President of Operations at Corsair Tactical Solutions, bringing deep expertise in firearms training, security certification, and community-focused safety education.
                </p>
                <p>
                  A co-owner of The Alliance Training Team and owner of Gideon Training Solutions, Hilton also serves as Co-Chair of the Aim For Safety initiative at Cook Children&apos;s Hospital — a role that reflects his community-first approach to firearm safety education.
                </p>
                <p>
                  A certified USCCA and NRA instructor, US Law Shield trainer, and Texas Level II, III, and IV security officer, Hilton is passionate about equipping individuals and organizations with the practical knowledge and skills to protect themselves and their communities.
                </p>
              </div>
              <div className="mt-7">
                <h4 className="text-xs font-bold text-corsair-blue-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-corsair-red-500 inline-block" />
                  Certifications &amp; Credentials
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {[
                    'Co-Chair — Aim For Safety, Cook Children’s',
                    'Owner — Gideon Training Solutions',
                    'Certified USCCA Trainer — Home Defense Fundamentals',
                    'US Law Shield Concealed Carry Instructor',
                    'US Law Shield First Aid For Gunshot Wounds',
                    'US Law Shield Personal Defensive Spray Instructor',
                    'Certified NRA Trainer — Pistol Shooting Course',
                    'Texas License to Carry Instructor',
                    'USCCA Range Safety Officer',
                    'North Star Arms — Assistant Training Director',
                    'Church Security Review & Audits',
                    'LTC Shooting Qualification Provider',
                    'Texas Security Officer Certification Level II, III, IV',
                  ].map((cred) => (
                    <li key={cred} className="flex items-start gap-2 text-sm text-corsair-gray-700">
                      <svg className="w-4 h-4 text-corsair-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {cred}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Photo */}
            <div className="relative">
              <div className="relative h-96 md:h-[520px] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/images/corsair-real/hilton-jackson-bio-01.jpg"
                  alt="Hilton Jackson — Vice President of Operations, Corsair Tactical Solutions"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest mb-1">Leadership Team</p>
                  <p className="text-2xl font-black text-white">Hilton Jackson</p>
                  <p className="text-white/70 text-sm">Vice President of Operations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──── Training Philosophy ──── */}
      <section className="py-16 bg-corsair-gray-50 border-y border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('philosophySection.label')}</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2 mb-4">
              {t('philosophySection.title')}
            </h2>
            <blockquote className="text-lg font-semibold text-corsair-blue-900 italic border-l-4 border-corsair-red-500 pl-5 text-left mb-4">
              {t('philosophySection.quote')}
            </blockquote>
            <p className="text-corsair-gray-600 leading-relaxed text-sm md:text-base">
              {t('philosophySection.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {philosophyPoints.map((point, i) => (
              <div key={i} className="bg-white rounded-2xl border border-corsair-gray-200 p-6 shadow-sm">
                <div className="w-2 h-8 bg-corsair-red-500 rounded-full mb-4" />
                <h3 className="text-base font-bold text-corsair-blue-900 mb-2">{point.title}</h3>
                <p className="text-corsair-gray-600 text-sm leading-relaxed">{point.desc}</p>
              </div>
            ))}
          </div>

          {/* Core quote */}
          <div className="mt-10 bg-corsair-blue-900 rounded-2xl p-8 text-center max-w-3xl mx-auto">
            <blockquote className="text-xl md:text-2xl font-black text-white italic leading-snug mb-3">
              {t('philosophySection.coreQuote')}
            </blockquote>
            <p className="text-corsair-gray-300 text-sm">{t('philosophySection.coreQuoteAttrib')}</p>
          </div>
        </div>
      </section>

      {/* ──── Experience & Leadership ──── */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('experienceSection.label')}</span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2 mb-5">
                {t('experienceSection.title')}
              </h2>
              <div className="space-y-4 text-corsair-gray-600 text-sm md:text-base leading-relaxed">
                <p>
                  {t('experienceSection.paragraph1')}
                </p>
                <p>
                  {t('experienceSection.paragraph2')}
                </p>
                <p>
                  {t('experienceSection.paragraph3')}
                </p>
              </div>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {experienceAreas.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-corsair-gray-700 bg-corsair-gray-50 border border-corsair-gray-200 rounded-lg px-3 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden shadow-xl bg-corsair-blue-950">
              <Image
                src="/images/corsair-real/proven-leadership-experience.jpg"
                alt={t('experienceSection.imageAlt')}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950/50 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 bg-white text-corsair-blue-900 px-4 py-3 rounded-xl shadow-xl">
                <p className="text-xs font-bold uppercase tracking-wider text-corsair-red-500">{t('experienceSection.badgeLabel')}</p>
                <p className="text-base font-black">{t('experienceSection.badgeTitle')}</p>
                <p className="text-xs text-corsair-gray-500">{t('experienceSection.badgeSub')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──── Certifications ──── */}
      <section className="py-16 md:py-24 bg-corsair-gray-50 border-t border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('certsSection.label')}</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
              {t('certsSection.title')}
            </h2>
            <p className="text-corsair-gray-500 mt-3 max-w-xl mx-auto text-sm">
              {t('certsSection.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {certifications.map((cert, i) => (
              <div key={i} className="bg-white border border-corsair-gray-200 rounded-2xl p-5 card-hover shadow-sm text-center">
                <div className="text-3xl mb-3">{cert.icon}</div>
                <h3 className="text-sm font-bold text-corsair-blue-900 mb-1 leading-snug">{cert.name}</h3>
                <p className="text-xs text-corsair-gray-500">{cert.org}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── Licensing & Credentials ──── */}
      <section className="py-14 bg-corsair-blue-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">{t('licensesSection.label')}</span>
            <h2 className="text-3xl font-black text-white mt-2">{t('licensesSection.title')}</h2>
            <p className="text-corsair-gray-300 text-sm mt-2 max-w-lg mx-auto">
              {t('licensesSection.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {licenses.map((lic, i) => (
              <div key={i} className="bg-white/10 border border-white/15 rounded-2xl p-6 text-center">
                <div className="text-corsair-red-400 font-black text-lg mb-1">{lic.number}</div>
                <div className="text-white font-bold text-sm mb-1">{lic.label}</div>
                <div className="text-corsair-gray-400 text-xs leading-relaxed">{lic.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── Vision & Mission ──── */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-8">
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('vision.label')}</span>
              <h3 className="text-2xl font-black text-corsair-blue-900 mt-2 mb-4">{t('vision.title')}</h3>
              <p className="text-corsair-gray-600 leading-relaxed text-sm">
                {t('vision.description')}
              </p>
            </div>
            <div className="bg-corsair-blue-900 rounded-2xl p-8">
              <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">{t('mission.label')}</span>
              <h3 className="text-2xl font-black text-white mt-2 mb-4">{t('mission.title')}</h3>
              <p className="text-corsair-gray-300 leading-relaxed text-sm">
                {t('mission.description')}
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ──── Safety Planning ──── */}
      <section className="py-16 md:py-24 bg-white border-t border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">

            {/* Left: text + services */}
            <div>
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Core Service</span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-6">
                Safety Planning
              </h2>
              <p className="text-corsair-gray-600 leading-relaxed mb-4">
                Protect your people, property, and operations with a customized safety plan designed
                around your unique needs.
              </p>
              <p className="text-corsair-gray-600 leading-relaxed mb-8">
                Our team conducts comprehensive risk assessments to identify vulnerabilities, evaluate
                potential threats, and develop practical response strategies. We create clear emergency
                protocols and provide staff training to ensure your team is prepared to respond
                confidently and effectively when it matters most.
              </p>

              <p className="text-sm font-bold text-corsair-blue-900 uppercase tracking-wider mb-4">Services Include</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {[
                  { icon: '🔍', label: 'Property Risk Assessments' },
                  { icon: '🚨', label: 'Emergency Response Planning' },
                  { icon: '📋', label: 'Crisis Management Protocols' },
                  { icon: '🎓', label: 'Staff Safety Training' },
                  { icon: '📝', label: 'Security Procedure Development' },
                  { icon: '🏢', label: 'Business Continuity Recommendations' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl px-4 py-3">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <span className="text-sm font-semibold text-corsair-blue-900">{item.label}</span>
                  </div>
                ))}
              </div>

              <p className="text-corsair-gray-600 leading-relaxed text-sm">
                Whether you&apos;re managing a business, church, school, community organization, or special
                event venue, Corsair delivers professional safety planning solutions that help create a
                safer, more secure environment.
              </p>
            </div>

            {/* Right: dark card with CTA */}
            <div className="bg-corsair-blue-900 rounded-2xl p-8 md:p-10 shadow-xl lg:sticky lg:top-28">
              <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">Get Started</span>
              <h3 className="text-2xl md:text-3xl font-black text-white mt-3 mb-4">
                Request a Safety Planning Consultation
              </h3>
              <p className="text-white/70 leading-relaxed mb-6 text-sm">
                Every organization has different risks. Our team will assess your specific environment,
                develop a tailored plan, and train your staff — no cookie-cutter solutions.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'On-site risk and vulnerability walkthrough',
                  'Written emergency response plan',
                  'Staff training program design',
                  'Ongoing consultation available',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-white/80 text-sm">
                    <span className="w-5 h-5 rounded-full bg-corsair-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300"
                >
                  Request a Safety Planning Consult
                </Link>
                <a
                  href="tel:+12143356652"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/10 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300"
                >
                  📞 214-335-6652
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ──── Testimonials ──── */}
      <section className="py-14 bg-corsair-gray-50 border-t border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('testimonialsSection.label')}</span>
            <h2 className="text-3xl font-black text-corsair-blue-900 mt-2">{t('testimonialsSection.title')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white border border-corsair-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, s) => (
                    <svg key={s} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-corsair-gray-600 text-sm leading-relaxed italic mb-5">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-corsair-gray-100">
                  <div className="w-9 h-9 rounded-full bg-corsair-red-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-corsair-blue-900 text-sm font-bold">{t.name}</p>
                    <p className="text-corsair-gray-400 text-xs">{t.course}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── CTA ──── */}
      <section className="py-14 bg-white border-t border-corsair-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-corsair-blue-900 mb-3">{t('cta.title')}</h2>
          <p className="text-corsair-gray-600 mb-7 text-sm">
            {t('cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/courses" className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2">
              {t('cta.viewCourses')} →
            </Link>
            <Link href="/security-services" className="border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300">
              {t('cta.securityConsultation')}
            </Link>
            <Link href="/contact" className="border-2 border-corsair-gray-300 text-corsair-gray-700 hover:border-corsair-blue-900 hover:text-corsair-blue-900 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300">
              {t('cta.contactCorsair')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
