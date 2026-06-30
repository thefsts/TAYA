import Link from 'next/link';
import Image from 'next/image';
import QuickConsultForm from '@/components/QuickConsultForm';
import { getTranslations } from 'next-intl/server';
import { type Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import ScrollReveal, { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/church-security',
    title: 'Church Security Division | Faith-Based Security Services | Corsair Tactical Solutions',
    description:
      'Texas DPS-licensed armed and unarmed security for churches, mosques, synagogues, and houses of worship. Veteran-owned. Discreet. Available 24/7. Serving all of North Texas.',
    locale,
  });
}

const SERVICES = [
  { icon: '🛡️', title: 'Armed Security Officers', desc: 'Level III & IV DPS-licensed armed officers — uniformed or plainclothes. Discreet protection that respects your congregation and mission.' },
  { icon: '👮', title: 'Unarmed Security Officers', desc: 'Visible deterrence, access control, and crowd management for Sunday services, special events, and weekday activities.' },
  { icon: '🎓', title: 'Volunteer Safety Team Training', desc: 'Empower your congregation. We train your existing volunteers in threat recognition, de-escalation, and emergency response protocols.' },
  { icon: '🔍', title: 'Security Risk Assessment', desc: 'Comprehensive vulnerability analysis of your facility. Written report with prioritized action items delivered at no cost.' },
  { icon: '📋', title: 'Emergency Response Planning', desc: 'Custom emergency plans for active shooter, medical emergency, fire, and evacuation scenarios tailored to your campus.' },
  { icon: '🚗', title: 'Mobile Patrol', desc: 'Regular drive-through patrols of your campus throughout the week — visible deterrence at a fraction of staffed cost.' },
  { icon: '🎉', title: 'Special Event Security', desc: 'Easter, Christmas, revivals, funerals, concerts — high-attendance events require extra coordination. We have it covered.' },
  { icon: '🅿️', title: 'Parking & Campus Security', desc: 'Escort services, vehicle monitoring, and pedestrian safety from the parking lot to the front door of your facility.' },
];

const TRUST_ITEMS = [
  { stat: '10+', label: 'Years Serving TX Churches' },
  { stat: '500+', label: 'Safety Officers Trained' },
  { stat: '4',   label: 'Texas DPS Licenses' },
  { stat: '24/7',label: 'On-Call Response' },
];

const WHY_ITEMS = [
  { icon: '✝️', title: 'Faith-Sensitive Approach',    desc: "We understand the culture of worship environments. Our officers blend in, respect the congregation, and operate with complete discretion." },
  { icon: '📜', title: 'Texas DPS Licensed',           desc: 'All officers hold active Texas DPS security licenses. We carry $1M liability coverage on every assignment — no exceptions.' },
  { icon: '🎖️', title: 'Veteran-Owned & Operated',   desc: 'Founded by a Navy veteran and DPS-certified instructor. The same discipline that serves the country now serves your congregation.' },
  { icon: '⚡', title: 'Rapid Deployment',             desc: 'We can have licensed officers at your facility within 48 hours of engagement. No long-term contracts required for your first service.' },
];

export default async function ChurchSecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tn = await getTranslations('nav');

  return (
    <>
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: tn('home'), path: '/' },
          { name: 'Church Security Division', path: '/church-security' },
        ]}
      />

      <PageHero
        badge="Faith-Based Security Specialists"
        title1="Church Security"
        title2="Division"
        subtitle="Protecting houses of worship across North Texas — armed, unarmed, and volunteer-training solutions that keep your congregation safe while honoring the openness of your ministry."
        imageSrc="/images/corsair-real/security-team-church-01.jpg"
        imageAlt="Corsair Tactical church security officers on duty"
        splitLayout={true}
        floatingCard={{
          imageSrc: '/images/corsair-real/church-safety-specialty-01.png',
          imageAlt: 'Church safety and security program',
          label: 'Faith-Based Experts',
          sublabel: '10+ Years Serving TX Churches',
        }}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: 'Services', href: '/security-services' },
          { label: 'Church Security Division' },
        ]}
        ctas={[
          { label: 'Free Security Assessment', href: '/contact', variant: 'primary' },
          { label: '📞 214-335-6652', href: '/contact', variant: 'phone', phone: '+12143356652' },
        ]}
      />

      {/* Trust Bar */}
      <section className="bg-corsair-blue-900 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center" staggerDelay={0.08}>
            {TRUST_ITEMS.map((item) => (
              <StaggerItem key={item.label}>
                <div className="hover-lift">
                  <p className="text-3xl md:text-4xl font-black text-corsair-red-400">{item.stat}</p>
                  <p className="text-sm text-white/70 font-medium mt-1">{item.label}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Intro */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Why Churches Trust CTS</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-6">
              Security That Understands the Culture of Worship
            </h2>
            <p className="text-lg text-corsair-gray-700 leading-relaxed">
              Churches face a unique security challenge. You welcome everyone — but not everyone who enters has good intentions.
              Our Church Security Division provides professional, discreet, faith-sensitive protection that keeps your congregation
              safe while honoring the openness at the heart of your ministry.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Services Grid */}
      <section className="bg-corsair-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Division Services</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-4">
              Complete Church Security Solutions
            </h2>
            <p className="text-corsair-gray-600 max-w-2xl mx-auto">
              From Sunday morning security to full campus safety planning — we cover every aspect of faith-based protection.
            </p>
          </div>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" staggerDelay={0.08}>
            {SERVICES.map((s) => (
              <StaggerItem key={s.title}>
                <div className="bg-white rounded-xl p-6 border border-corsair-gray-200 shadow-sm card-hover hover-lift">
                  <span className="text-3xl mb-4 block">{s.icon}</span>
                  <h3 className="text-base font-bold text-corsair-blue-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-corsair-gray-600 leading-relaxed">{s.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Why CTS */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Our Advantage</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3">
              Why Houses of Worship Choose Corsair
            </h2>
          </div>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8" staggerDelay={0.1}>
            {WHY_ITEMS.map((item) => (
              <StaggerItem key={item.title}>
                <div className="flex gap-5 hover-lift p-3 rounded-xl">
                  <span className="text-3xl flex-shrink-0 mt-1">{item.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-corsair-blue-900 mb-2">{item.title}</h3>
                    <p className="text-corsair-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Photo + CTA Split */}
      <section className="bg-corsair-blue-950 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
              <Image
                src="/images/corsair-real/church-pews-01.jpg"
                alt="Wooden church pews with stained glass — protecting houses of worship"
                fill
                className="object-cover object-center"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">Get Started</span>
              <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-6">
                Request a Free Church Security Assessment
              </h2>
              <p className="text-white/70 leading-relaxed mb-8">
                Every faith community has different needs. Our team will walk your facility, review your current protocols, and
                deliver a written security assessment — at no charge, with no obligation.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Physical vulnerability walkthrough',
                  'Threat environment analysis',
                  'Staffing recommendations',
                  'Volunteer training program options',
                  'Written action-item report',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/80">
                    <span className="w-5 h-5 rounded-full bg-corsair-red-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-4 rounded-xl font-bold transition-all duration-300"
                >
                  Request Free Assessment
                </Link>
                <Link
                  href="/church-safety"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/10 px-8 py-4 rounded-xl font-bold transition-all duration-300"
                >
                  View Safety Planning &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick Consult Form ── */}
      <section className="bg-corsair-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Book in Minutes</span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-4">
                Start with a Free Assessment
              </h2>
              <p className="text-corsair-gray-600 leading-relaxed mb-6">
                Fill out the form and a CTS specialist will contact you within one business day to schedule your no-cost church security assessment.
              </p>
              <div className="space-y-3">
                {['Free security walkthrough of your facility', 'Written vulnerability report delivered to you', 'Staffing and training recommendations', 'No long-term commitment required'].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-corsair-gray-700">
                    <span className="w-5 h-5 rounded-full bg-corsair-red-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <QuickConsultForm
              defaultService="Church Security Assessment (Free)"
              heading="Request Your Free Assessment"
              subheading="No pressure, no obligation — just an honest evaluation of your security needs."
            />
          </div>
        </div>
      </section>

      {/* Related links */}
      <section className="bg-corsair-gray-100 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { href: '/church-safety', icon: '📋', title: 'Church Safety Planning', desc: 'Risk assessments, volunteer training, emergency protocols' },
              { href: '/security-training', icon: '🎓', title: 'Security Training Programs', desc: 'Level II–IV DPS certification, LTC, and specialized courses' },
              { href: '/courses', icon: '📚', title: 'View All Courses', desc: 'Browse 30+ certified training programs for individuals and teams' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-xl p-6 border border-corsair-gray-200 hover:shadow-md hover:border-corsair-red-300 transition-all group"
              >
                <span className="text-2xl mb-3 block">{item.icon}</span>
                <h3 className="font-bold text-corsair-blue-900 group-hover:text-corsair-red-600 transition-colors mb-2">{item.title}</h3>
                <p className="text-sm text-corsair-gray-600">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
