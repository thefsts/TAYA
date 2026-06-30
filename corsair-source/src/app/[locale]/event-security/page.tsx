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
    path: '/event-security',
    title: 'Professional Event Security Services | Corsair Tactical Solutions',
    description:
      'Licensed armed and unarmed security personnel for corporate events, concerts, faith-based gatherings, VIP functions, weddings, festivals, and public appearances. Serving North Texas.',
    locale,
  });
}

const SERVICES = [
  { icon: '🛡️', title: 'Armed & Unarmed Personnel',       desc: 'DPS-licensed officers deployed in uniform or plainclothes — matched to the tone and formality of your event.' },
  { icon: '🎫', title: 'Access Control & Credentialing',   desc: 'Managed entry points, credential verification, VIP lane management, and wristband/badge enforcement.' },
  { icon: '👜', title: 'Guest Screening & Bag Inspections', desc: 'Professional screening procedures that protect attendees without disrupting the guest experience.' },
  { icon: '👥', title: 'Crowd Management',                  desc: 'Flow control, capacity monitoring, and proactive positioning to prevent dangerous crowd conditions.' },
  { icon: '🅿️', title: 'Parking & Traffic Management',     desc: 'Organized lot management, traffic flow coordination, and pedestrian safety from arrival to departure.' },
  { icon: '⭐', title: 'VIP & Executive Protection',        desc: 'Discreet close-protection for celebrities, executives, speakers, and high-profile guests.' },
  { icon: '🎭', title: 'Stage & Restricted-Area Security', desc: 'Green room access control, stage perimeter security, and talent escort services.' },
  { icon: '🚨', title: 'Emergency Response Coordination',  desc: 'Pre-event emergency planning and on-site coordination with EMS, fire, and law enforcement.' },
  { icon: '📋', title: 'Incident Documentation',           desc: 'Real-time incident logging and post-event reporting to protect your organization and satisfy insurance requirements.' },
  { icon: '🔍', title: 'Threat & Vulnerability Assessment', desc: 'Pre-event venue walkthrough to identify risks, map response routes, and brief all security personnel.' },
  { icon: '🌙', title: 'Overnight Asset Protection',       desc: 'Overnight or multi-day guard coverage for equipment, staging, merchandise, and event infrastructure.' },
  { icon: '📝', title: 'Security Planning & Briefings',    desc: 'Comprehensive security operations plans, post-order development, and full team briefings before every event.' },
];

const EVENT_TYPES = [
  { icon: '🏢', label: 'Corporate Events' },
  { icon: '🎤', label: 'Conferences & Trade Shows' },
  { icon: '✝️', label: 'Church & Faith-Based Events' },
  { icon: '💍', label: 'Weddings & Private Celebrations' },
  { icon: '🎵', label: 'Concerts & Entertainment Events' },
  { icon: '🎪', label: 'Community Festivals' },
  { icon: '🏟️', label: 'Sporting Events' },
  { icon: '🎙️', label: 'Political & Public Appearances' },
  { icon: '❤️', label: 'Fundraisers & Charity Events' },
  { icon: '⭐', label: 'Executive & VIP Functions' },
  { icon: '🎉', label: 'Grand Openings & Promotions' },
  { icon: '🎓', label: 'Graduations & Galas' },
];

const TRUST_ITEMS = [
  { stat: '500+', label: 'Events Secured' },
  { stat: '24/7', label: 'On-Call Response' },
  { stat: '4',    label: 'Texas DPS License Levels' },
  { stat: '10+',  label: 'Years in North Texas' },
];

const APPROACH_ITEMS = [
  { icon: '👁️', title: 'Visible Deterrence',       desc: 'Strategic officer placement that signals security is present — discouraging threats before they escalate.' },
  { icon: '🤝', title: 'Guest-First Professionalism', desc: 'Officers trained in customer service and conflict de-escalation so security enhances, not disrupts, the atmosphere.' },
  { icon: '📡', title: 'Situational Awareness',     desc: 'Continuous crowd monitoring and communication between officers to identify and respond to developing situations early.' },
  { icon: '⚡', title: 'Rapid Incident Response',   desc: 'Clear incident command structure and pre-briefed response plans for medical, security, and evacuation emergencies.' },
];

export default async function EventSecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tn = await getTranslations('nav');

  return (
    <>
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: tn('home'), path: '/' },
          { name: 'Services', path: '/security-services' },
          { name: 'Professional Event Security Services', path: '/event-security' },
        ]}
      />

      <PageHero
        badge="Licensed Event Security Specialists"
        title1="Professional Event"
        title2="Security Services"
        subtitle="Expert security planning and deployment for public gatherings, private functions, corporate events, VIP appearances, and everything in between — protecting people, property, and reputation."
        imageSrc="/images/corsair-real/event-venue-crowd-01.jpg"
        imageAlt="Corsair Tactical Solutions event security at a gala banquet"
        splitLayout={true}
        floatingCard={{
          imageSrc: '/images/corsair-real/event-venue-setup-01.jpg',
          imageAlt: 'Elegant event venue setup secured by Corsair Tactical Solutions',
          label: 'Event Security Experts',
          sublabel: '500+ Events Secured Across TX',
        }}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: 'Services', href: '/security-services' },
          { label: 'Event Security' },
        ]}
        ctas={[
          { label: 'Request Event Security Quote', href: '/contact', variant: 'primary' },
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
          <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Public &amp; Private Event Security</span>
          <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-6">
            Security That Protects Without Disrupting
          </h2>
          <p className="text-lg text-corsair-gray-700 leading-relaxed mb-4">
            Corsair Tactical Solutions provides professional security and event support services for public gatherings,
            private functions, corporate events, faith-based events, community festivals, VIP appearances, and special
            occasions.
          </p>
          <p className="text-corsair-gray-600 leading-relaxed">
            Our team works closely with event organizers to create a safe, welcoming, and secure environment while
            maintaining a professional and customer-focused presence.
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="bg-corsair-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Our Event Services Include</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-4">
              Complete Event Security Solutions
            </h2>
            <p className="text-corsair-gray-600 max-w-2xl mx-auto">
              From single-officer assignments to full multi-team deployments — we cover every dimension of event safety and security operations.
            </p>
          </div>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.1}>
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

      {/* Personalized Event Protection */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Tailored to Your Event</span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-6">
                Personalized Event Protection
              </h2>
              <p className="text-corsair-gray-700 leading-relaxed mb-6">
                Every event is unique. Corsair Tactical Solutions develops customized security plans based on venue layout,
                attendance levels, event type, known risks, and client objectives.
              </p>
              <p className="text-corsair-gray-600 leading-relaxed mb-8">
                Whether protecting a private family gathering, corporate function, church event, political appearance,
                celebrity guest, or large-scale public event, our team delivers tailored security solutions designed to
                protect people, property, and reputation.
              </p>
              <div className="space-y-3">
                {[
                  'Custom security operations plan for every event',
                  'Staffing levels matched to attendance and risk profile',
                  'Venue walkthrough and threat assessment included',
                  'Coordination with local law enforcement when required',
                  'Post-event incident report provided to organizer',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-corsair-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-sm text-corsair-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-xl">
              <Image
                src="/images/corsair-real/event-venue-gala-01.jpg"
                alt="Live event secured by Corsair Tactical Solutions — gala and banquet"
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Our Approach */}
      <section className="bg-corsair-blue-900 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">Our Approach</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">
              Effective Security. Seamless Experience.
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto leading-relaxed">
              We believe effective security should be visible enough to deter threats while remaining professional enough
              to preserve the guest experience. Our officers are trained in conflict resolution, de-escalation,
              situational awareness, emergency response, and customer service.
            </p>
          </div>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" staggerDelay={0.1}>
            {APPROACH_ITEMS.map((item) => (
              <StaggerItem key={item.title}>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition-colors hover-lift">
                  <span className="text-4xl mb-4 block">{item.icon}</span>
                  <h3 className="text-base font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-white/65 leading-relaxed">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Event Types */}
      <section className="bg-corsair-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Event Types We Support</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-4">
              No Event Too Small or Too Large
            </h2>
            <p className="text-corsair-gray-600 max-w-2xl mx-auto">
              From intimate private celebrations to large-scale public events — Corsair Tactical deploys the right team for every occasion.
            </p>
          </div>
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" staggerDelay={0.06}>
            {EVENT_TYPES.map((type) => (
              <StaggerItem key={type.label}>
                <div className="bg-white border border-corsair-gray-200 rounded-xl px-5 py-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-corsair-red-300 transition-all hover-lift">
                  <span className="text-2xl flex-shrink-0">{type.icon}</span>
                  <span className="text-sm font-semibold text-corsair-blue-900 leading-snug">{type.label}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Corsair Promise — dark CTA with photo */}
      <section className="bg-corsair-blue-950 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
              <Image
                src="/images/corsair-real/hilton-and-steve-01.jpg"
                alt="Corsair Tactical Solutions leadership team"
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">The Corsair Promise</span>
              <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">
                Protecting Those We Will Never Meet
              </h2>
              <p className="text-white/70 leading-relaxed mb-8">
                From intimate private gatherings to large public events, Corsair Tactical Solutions delivers professional
                security services that allow hosts, guests, and stakeholders to focus on the event while we focus on
                safety, security, and operational excellence.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Texas DPS-licensed officers on every assignment',
                  '$1M liability coverage — every event, no exceptions',
                  'Veteran-owned and operated — disciplined by service',
                  'Available 48-hour deployment for urgent requests',
                  'Transparent pricing — no hidden fees',
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
                  Request Event Security Quote
                </Link>
                <a
                  href="tel:+12143356652"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/10 px-8 py-4 rounded-xl font-bold transition-all duration-300"
                >
                  📞 214-335-6652
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Consult Form */}
      <section className="bg-corsair-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Get a Quote</span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-4">
                Tell Us About Your Event
              </h2>
              <p className="text-corsair-gray-600 leading-relaxed mb-6">
                Fill out the form and a CTS event security specialist will contact you within one business day to
                discuss your needs and provide a no-obligation quote.
              </p>
              <div className="space-y-3">
                {[
                  'Event date, venue, and estimated attendance',
                  'Customized staffing recommendation',
                  'Transparent, itemized pricing',
                  'No long-term contracts required',
                ].map((item) => (
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
              defaultService="Event Security Services"
              heading="Request an Event Security Quote"
              subheading="Tell us about your event and we&apos;ll put together a tailored security plan."
            />
          </div>
        </div>
      </section>

      {/* Related Services */}
      <section className="bg-corsair-gray-100 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { href: '/security-services',       icon: '🛡️', title: 'Security Services',         desc: 'Armed & unarmed guard services for businesses, properties, and individuals' },
              { href: '/church-security',          icon: '✝️', title: 'Church Security Division',  desc: 'Faith-sensitive security solutions for houses of worship across North Texas' },
              { href: '/security-training',        icon: '🎓', title: 'Security Officer Training', desc: 'Level II–IV DPS certification and professional security training programs' },
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
