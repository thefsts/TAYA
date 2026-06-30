import Link from 'next/link';
import Image from 'next/image';
import QuickConsultForm from '@/components/QuickConsultForm';
import { getTranslations } from 'next-intl/server';
import { type Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import ScrollReveal, { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import FourDClient from '@/components/FourDClient';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/4d-protection-model',
    title: 'The 4D Protection Model\u2122 | Corsair Tactical Solutions | Deter \u00b7 Detect \u00b7 Deflect \u00b7 Defend',
    description:
      "Corsair Tactical Solutions' proprietary 4D Protection Model\u2122 \u2014 a progressive security framework built on Deter, Detect, Deflect, and Defend. Our approach emphasizes prevention and communication before physical intervention.",
    locale,
  });
}

const APPLICATIONS = [
  { icon: '\u271d\ufe0f', title: 'Houses of Worship',       desc: 'The 4D model is the backbone of every church security program we design.' },
  { icon: '\ud83c\udfe2', title: 'Corporate Facilities',     desc: 'From office parks to industrial sites, 4D scales to any environment.' },
  { icon: '\ud83c\udf89', title: 'Special Events',            desc: 'Dynamic threat environments require adaptive 4D application.' },
  { icon: '\ud83c\udfd8\ufe0f', title: 'Residential Communities', desc: 'HOA and multi-family communities benefit from layered 4D protection.' },
  { icon: '\ud83c\udf93', title: 'Educational Institutions', desc: 'School safety teams trained on the 4D framework for all threat scenarios.' },
  { icon: '\ud83c\udfe5', title: 'Healthcare Facilities',    desc: 'Patient and staff protection through comprehensive 4D implementation.' },
];

export default async function FourDModelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tn = await getTranslations('nav');

  return (
    <>
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: tn('home'), path: '/' },
          { name: 'The 4D Protection Model\u2122', path: '/4d-protection-model' },
        ]}
      />

      <PageHero
        badge="Proprietary Security Framework"
        title1="The 4D Protection"
        title2="Model\u2122"
        subtitle="CTS's proprietary security framework \u2014 developed over 14 years of armed security, law enforcement training, and real-world incident response. Four dimensions. One integrated system."
        imageSrc="/images/corsair-real/steve-security-uniform-01.jpg"
        imageAlt="Steve Hopwood \u2014 creator of the 4D Protection Model"
        splitLayout={true}
        floatingCard={{
          imageSrc: '/images/corsair-real/steve-hopwood-bio-01.png',
          imageAlt: 'Steve Hopwood, Founder of Corsair Tactical Solutions',
          label: '4D Model Creator',
          sublabel: 'Steve Hopwood \u00b7 14 Yrs Experience',
        }}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: 'The 4D Protection Model\u2122' },
        ]}
        ctas={[
          { label: 'Apply the 4D Model', href: '/contact', variant: 'primary' },
          { label: 'View Training Courses', href: '/courses', variant: 'secondary' },
        ]}
      />

      {/* Intro */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">The Framework</span>
          <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-6">
            A System Built on 14 Years of Field Experience
          </h2>
          <p className="text-lg text-corsair-gray-700 leading-relaxed mb-6">
            The <strong>4D Protection Model&#x2122;</strong> is Corsair Tactical Solutions' proprietary security framework designed to proactively reduce risk through progressive response strategies rather than reactive force.
          </p>
          <p className="text-lg text-corsair-gray-700 leading-relaxed mb-6">
            Unlike traditional security models that focus primarily on physical intervention, the 4D Protection Model&#x2122; emphasizes prevention, awareness, communication, and professional decision-making before force is ever considered.
          </p>
          <p className="text-lg text-corsair-gray-700 leading-relaxed">
            Every Corsair Tactical Solutions officer is trained to move through four sequential phases of protection, ensuring each situation is addressed at the lowest appropriate level of response.
          </p>
        </div>
      </section>

      {/* Animated 4D Dimensions + Applications */}
      <FourDClient />

      {/* Progressive Escalation */}
      <section className="bg-corsair-blue-950 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-6">
            Progressive Escalation
          </h2>
          <p className="text-lg text-white/70 leading-relaxed mb-6">
            The <strong className="text-white">4D Protection Model&#x2122;</strong> follows a structured escalation process. Each phase activates only when the previous layer is insufficient to safely resolve the situation.
          </p>
          <p className="text-lg text-white/70 leading-relaxed mb-6">
            The model is intentionally designed to resolve incidents at the earliest possible stage, reducing unnecessary confrontation while improving safety for everyone involved.
          </p>
          <p className="text-lg text-white/70 leading-relaxed">
            By emphasizing prevention, awareness, communication, and only then physical response, Corsair Tactical Solutions delivers a higher standard of professional security services.
          </p>
        </div>
      </section>

      {/* Why Clients Choose */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Client Benefits</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-4">
              Why Clients Choose the 4D Protection Model&#x2122;
            </h2>
            <p className="text-lg text-corsair-gray-600 max-w-3xl mx-auto">
              Organizations choose Corsair Tactical Solutions because security is more than placing personnel on a property &mdash; it&apos;s implementing a comprehensive protection strategy.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            {[
              { title: 'Proactive Risk Reduction',    body: 'The 4D model is designed to stop incidents before they occur, not merely react to them. This proactive approach significantly reduces liability, disruption, and potential harm.' },
              { title: 'Trained, Licensed Professionals', body: 'Every officer assigned to a 4D-modeled program is DPS-licensed, background-checked, and trained specifically on the framework. Not every security company invests in this level of officer development.' },
              { title: 'Customized to Your Environment',  body: 'Churches, businesses, and residential communities face different threat profiles. The 4D model is applied with environment-specific intelligence, not a one-size-fits-all template.' },
              { title: 'Documented & Accountable',      body: 'Each phase of the 4D model includes reporting, documentation, and post-incident review. Clients receive clear visibility into what happened, when, and why.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-corsair-red-500 mt-2.5 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-corsair-blue-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-corsair-gray-600 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Applications Grid */}
      <section className="bg-corsair-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Industries</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3 mb-4">
              Where the 4D Model&#x2122; Protects
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {APPLICATIONS.map((app) => (
              <div key={app.title} className="bg-white rounded-xl p-6 border border-corsair-gray-200 text-center hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <span className="text-3xl mb-3 block">{app.icon}</span>
                <h3 className="font-bold text-corsair-blue-900 mb-2">{app.title}</h3>
                <p className="text-sm text-corsair-gray-600 leading-relaxed">{app.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-corsair-blue-900 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest">Next Step</span>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">
            Apply the 4D Protection Model&#x2122; to Your Organization
          </h2>
          <p className="text-lg text-white/70 leading-relaxed mb-8">
            Whether you are a church, a business, a residential community, or a school, the 4D Protection Model&#x2122; can be adapted to your specific threat environment and operational needs. Contact Corsair Tactical Solutions for a no-obligation security assessment.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact" className="inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold px-8 py-4 rounded-xl transition-colors text-sm">
              Request a Free Security Assessment
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
            <Link href="/security-services" className="inline-flex items-center gap-2 border border-white/20 text-white hover:bg-white/10 font-bold px-8 py-4 rounded-xl transition-colors text-sm">
              Explore Security Services
            </Link>
          </div>
        </div>
      </section>

      <QuickConsultForm />
    </>
  );
}
