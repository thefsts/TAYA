import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { type Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import { buildPageMetadata } from '@/lib/seo';
import { TX_LOCATIONS, getLocation } from '@/lib/locations';

export async function generateStaticParams() {
  return TX_LOCATIONS.map((l) => ({ city: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; city: string }>;
}): Promise<Metadata> {
  const { locale, city: citySlug } = await params;
  const location = getLocation(citySlug);
  if (!location) return {};
  return buildPageMetadata({
    path: `/security-services/${citySlug}`,
    title: `Security Services in ${location.city}, TX | Corsair Tactical Solutions`,
    description: `Licensed armed & unarmed security services in ${location.city}, Texas. ${location.county}. Veteran-owned. Texas DPS licensed. Available 24/7 across all of North Texas. Call 214-335-6652.`,
    locale,
  });
}

const SERVICES = [
  { icon: '🛡️', title: 'Armed Security Officers',     desc: 'Texas DPS Level III & IV licensed armed officers for businesses, events, and facilities.' },
  { icon: '👮', title: 'Unarmed Security Officers',    desc: 'Uniformed presence, access control, and patrol for commercial and residential sites.' },
  { icon: '✝️', title: 'Church & Worship Security',   desc: 'Discreet, faith-sensitive security for services, events, and ongoing campus protection.' },
  { icon: '🎉', title: 'Event Security',                desc: 'Professional crowd management and security detail for corporate and public events.' },
  { icon: '🏘️', title: 'Property & HOA Security',    desc: 'Residential and commercial property patrol, access control, and tenant safety.' },
  { icon: '🚗', title: 'Executive Protection',          desc: 'Close-protection escorts, vehicle security, and advance planning for high-profile principals.' },
];

export default async function CitySecurityPage({
  params,
}: {
  params: Promise<{ locale: string; city: string }>;
}) {
  const { locale, city: citySlug } = await params;
  const location = getLocation(citySlug);
  if (!location) notFound();

  const tn = await getTranslations('nav');

  return (
    <>
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: tn('home'), path: '/' },
          { name: 'Security Services', path: '/security-services' },
          { name: `${location.city}, TX`, path: `/security-services/${citySlug}` },
        ]}
      />

      <PageHero
        badge={`Serving ${location.city}, ${location.state}`}
        title1="Security Services in"
        title2={`${location.city}, TX`}
        subtitle={`Professional armed and unarmed security for businesses, churches, events, and properties in ${location.city} and surrounding ${location.county} areas. Texas DPS licensed. Veteran-owned.`}
        imageSrc="/images/corsair-real/security-officer-hero-01.png"
        imageAlt={`Corsair Tactical Solutions security officer serving ${location.city}, TX`}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: 'Security Services', href: '/security-services' },
          { label: `${location.city}, TX` },
        ]}
        ctas={[
          { label: 'Request a Quote', href: '/contact', variant: 'primary' },
          { label: '📞 214-335-6652', href: '/contact', variant: 'phone', phone: '+12143356652' },
        ]}
      />

      {/* Location signal bar */}
      <section className="bg-corsair-blue-900 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div>
              <p className="text-white font-bold text-lg">Serving {location.city} and {location.county}</p>
              <p className="text-white/60 text-sm mt-1">Also covering: {location.nearbyAreas.join(', ')}</p>
            </div>
            <div className="flex gap-8">
              {[
                { val: '24/7', lbl: 'Availability' },
                { val: 'TX DPS', lbl: 'Licensed' },
                { val: '14+', lbl: 'Years Experience' },
              ].map((s) => (
                <div key={s.lbl} className="text-center">
                  <p className="text-corsair-red-400 font-black text-2xl">{s.val}</p>
                  <p className="text-white/60 text-xs">{s.lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Intro text */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-black text-corsair-blue-900 mb-6">
            Professional Security in {location.city}, Texas
          </h2>
          <p className="text-lg text-corsair-gray-700 leading-relaxed mb-6">
            Corsair Tactical Solutions provides licensed armed and unarmed security services throughout {location.city} and{' '}
            {location.description}. Our Texas DPS-certified security officers bring military discipline and professional
            training to every assignment — from Sunday morning church services to corporate facility protection.
          </p>
          <p className="text-lg text-corsair-gray-700 leading-relaxed">
            As a veteran-owned North Texas security company, we understand {location.county} communities. We've protected
            businesses, houses of worship, residential properties, and events across the {location.city} area for over a decade.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="bg-corsair-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">
              Services Available in {location.city}
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-3">
              Security Solutions for {location.city} Businesses &amp; Organizations
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s) => (
              <div key={s.title} className="bg-white rounded-xl p-6 border border-corsair-gray-200 shadow-sm hover:shadow-lg transition-shadow">
                <span className="text-3xl mb-4 block">{s.icon}</span>
                <h3 className="text-base font-bold text-corsair-blue-900 mb-2">{s.title}</h3>
                <p className="text-sm text-corsair-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-corsair-blue-950 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
            Get a Security Quote for {location.city}
          </h2>
          <p className="text-white/70 leading-relaxed mb-8 max-w-2xl mx-auto">
            Ready to protect your {location.city} business, church, or property? Contact us for a free consultation and
            same-week quote. No long-term contract required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-4 rounded-xl font-bold transition-all duration-300">
              Request a Free Quote
            </Link>
            <a href="tel:+12143356652" className="inline-flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/10 px-8 py-4 rounded-xl font-bold transition-all duration-300">
              📞 214-335-6652
            </a>
          </div>
          <div className="border-t border-white/10 pt-10">
            <p className="text-white/40 text-sm mb-4">Also serving these {location.county} communities:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {location.nearbyAreas.map((area) => (
                <span key={area} className="bg-white/5 border border-white/10 text-white/60 text-sm px-4 py-2 rounded-full">
                  {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Related links */}
      <section className="bg-corsair-gray-100 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { href: '/security-services', icon: '🛡️', title: 'All Security Services',    desc: 'Full list of security services and programs offered by CTS' },
              { href: '/church-security',   icon: '✝️', title: 'Church Security Division', desc: 'Specialized faith-based security for houses of worship' },
              { href: '/contact',           icon: '📋', title: 'Get a Quote',              desc: 'Request a free security assessment or service quote' },
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
