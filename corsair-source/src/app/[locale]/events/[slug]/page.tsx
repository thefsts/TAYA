import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getEventBySlug } from '@/data/events';
import EventBookingForm from '@/components/EventBookingForm';
import { buildPageMetadata } from '@/lib/seo';
import EventCountdown from '@/components/EventCountdown';
import SeatCounter from '@/components/SeatCounter';

/** Server-side trusted event price registry. */
const EVENT_PRICES: Record<string, number> = {
  'texas-ltc-certification-class-jun2026': 10000,
  'texas-ltc-certification-class-jul2026': 10000,
  'level-iii-iv-security-training-jul2026': 40000,
};

/** Optional add-ons available at registration (per event). */
interface AddOnOption {
  id: string;
  label: string;
  priceCents: number;
}
const EVENT_ADDON_OPTIONS: Record<string, AddOnOption[]> = {
  'texas-ltc-certification-class-jul2026': [
    { id: 'ammo50',         label: '50 Rounds of Handgun Ammunition', priceCents: 3000 },
    { id: 'handgun-rental', label: 'Handgun Rental',                   priceCents: 2000 },
  ],
};

/** Slugs that display the full LTC content blocks (Class Includes, What to Bring, Locations). */
const LTC_EVENT_SLUGS = new Set([
  'texas-ltc-certification-class-jun2026',
  'texas-ltc-certification-class-jul2026',
]);

/** Slugs that display security training content blocks. */
const SECURITY_EVENT_SLUGS = new Set([
  'level-iii-iv-security-training-jul2026',
]);

/** Per-event Eagle Gun Range address (classroom address is the same for all LTC events). */
const LTC_RANGE_LOCATION: Record<string, { address: string[]; mapsUrl: string }> = {
  'texas-ltc-certification-class-jun2026': {
    address: ['14400 Midway Rd', 'Farmers Branch, TX 75244'],
    mapsUrl: 'https://maps.google.com/?q=14400+Midway+Rd+Farmers+Branch+TX+75244',
  },
  'texas-ltc-certification-class-jul2026': {
    address: ['13301 Midway Rd', 'Farmers Branch, TX 75244'],
    mapsUrl: 'https://maps.google.com/?q=13301+Midway+Rd+Farmers+Branch+TX+75244',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const event = getEventBySlug(slug);
  if (!event) {
    return buildPageMetadata({
      path: `/events/${slug}`,
      title: 'Event Not Found',
      description: '',
      locale,
      noIndex: true,
    });
  }
  return buildPageMetadata({
    path: `/events/${slug}`,
    title: event.title,
    description: event.shortDescription,
    locale,
    image: event.flyerImage ?? event.heroImage,
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event || event.isPast) notFound();

  const tn          = await getTranslations('nav');
  const priceCents  = EVENT_PRICES[slug] ?? null;
  const addOns      = EVENT_ADDON_OPTIONS[slug] ?? undefined;
  const isLtcEvent      = LTC_EVENT_SLUGS.has(slug);
  const isSecurityEvent = SECURITY_EVENT_SLUGS.has(slug);
  const rangeLocale = LTC_RANGE_LOCATION[slug];

  const eventJsonLd = priceCents
    ? {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.title,
        description: event.description,
        startDate: event.date,
        endDate: isSecurityEvent ? '2026-07-10' : event.date,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: 'Hilton Garden Inn Dallas / Addison',
          address: {
            '@type': 'PostalAddress',
            streetAddress: '4090 Belt Line Road',
            addressLocality: 'Addison',
            addressRegion: 'TX',
            postalCode: '75001',
            addressCountry: 'US',
          },
        },
        organizer: {
          '@type': 'Organization',
          name: 'Corsair Tactical Solutions',
          url: 'https://corsairtacticalsolutions.com',
        },
        offers: {
          '@type': 'Offer',
          price: (priceCents / 100).toFixed(2),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: `https://corsairtacticalsolutions.com/events/${slug}`,
        },
        image: event.flyerImage ?? event.heroImage,
      }
    : null;

  return (
    <>
      {eventJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
        />
      )}
      {/* Breadcrumb */}
      <nav className="bg-corsair-gray-50 border-b border-corsair-gray-200 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ol className="flex items-center gap-2 text-xs text-corsair-gray-500 flex-wrap">
            <li><Link href="/" className="hover:text-corsair-blue-900 transition-colors">{tn('home')}</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/events" className="hover:text-corsair-blue-900 transition-colors">Events</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-corsair-blue-900 font-semibold truncate max-w-[200px]">{event.title}</li>
          </ol>
        </div>
      </nav>

      {/* Flyer image */}
      {event.flyerImage && (
        <section className="bg-corsair-blue-900 py-8">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl mx-auto">
              <Image
                src={event.flyerImage}
                alt={`${event.title} — event flyer`}
                width={1024}
                height={1536}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>
        </section>
      )}

      {/* Main + sidebar */}
      <section className="py-14 bg-corsair-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* Left: content */}
            <div className="lg:col-span-2 space-y-7">

              {/* Event header */}
              <div className="bg-white border border-corsair-gray-200 rounded-2xl p-6 shadow-sm">
                <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{event.category}</span>
                <h1 className="text-3xl font-black text-corsair-blue-900 mt-2 mb-5 leading-tight">{event.title}</h1>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-corsair-gray-50 rounded-xl p-4">
                    <svg className="w-5 h-5 text-corsair-red-500 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-[10px] text-corsair-gray-500 mb-0.5 uppercase tracking-wider font-bold">Date</p>
                    <p className="text-sm font-black text-corsair-blue-900 leading-tight">{event.dateDisplay}</p>
                  </div>
                  <div className="text-center bg-corsair-gray-50 rounded-xl p-4">
                    <svg className="w-5 h-5 text-corsair-red-500 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[10px] text-corsair-gray-500 mb-0.5 uppercase tracking-wider font-bold">Time</p>
                    <p className="text-sm font-black text-corsair-blue-900 leading-tight">{event.time}</p>
                  </div>
                  <div className="text-center bg-corsair-gray-50 rounded-xl p-4">
                    <svg className="w-5 h-5 text-corsair-red-500 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[10px] text-corsair-gray-500 mb-0.5 uppercase tracking-wider font-bold">Cost</p>
                    <p className="text-sm font-black text-corsair-blue-900 leading-tight">
                      {priceCents ? `$${Math.round(priceCents / 100)}` : 'Contact'}
                      {isLtcEvent ? <span className="block text-[10px] text-corsair-gray-400 font-normal">+ add-ons available</span> : null}
                    </p>
                  </div>
                </div>
              </div>

              {/* Class includes, What to Bring, Locations — LTC events */}
              {isLtcEvent && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="bg-white border border-corsair-gray-200 rounded-2xl p-6 shadow-sm">
                      <h2 className="text-base font-black text-corsair-blue-900 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-corsair-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        Class Includes
                      </h2>
                      <ul className="space-y-2.5">
                        {[
                          'Texas LTC Classroom Instruction',
                          'Handgun Safety & Handling',
                          'Texas Laws & Use of Force',
                          'Live Fire Qualification',
                          'Application Guidance',
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2.5 text-sm text-corsair-gray-700">
                            <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white border border-corsair-gray-200 rounded-2xl p-6 shadow-sm">
                      <h2 className="text-base font-black text-corsair-blue-900 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-corsair-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </span>
                        What to Bring
                      </h2>
                      <ul className="space-y-2.5">
                        {[
                          'Valid Government Photo ID',
                          'Handgun (if not renting)',
                          'Eye and Ear Protection',
                          'Comfortable Clothing',
                          'Pen & Notebook',
                          '50 Rounds of Ammo (if not purchasing)',
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2.5 text-sm text-corsair-gray-700">
                            <span className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-corsair-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-corsair-blue-900 mb-4">Class Locations</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="bg-corsair-blue-900 text-white rounded-2xl p-6 shadow-sm">
                        <p className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest mb-3">Classroom Instruction</p>
                        <p className="text-lg font-black mb-1">Hilton Garden Inn Dallas / Addison</p>
                        <p className="text-sm text-corsair-gray-300">4090 Belt Line Road</p>
                        <p className="text-sm text-corsair-gray-300">Addison, TX 75001</p>
                        <a
                          href="https://maps.google.com/?q=4090+Belt+Line+Rd+Addison+TX+75001"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-3 text-corsair-red-400 hover:text-corsair-red-300 text-xs font-bold transition-colors"
                        >
                          Get Directions ↗
                        </a>
                      </div>
                      <div className="bg-white border border-corsair-gray-200 rounded-2xl p-6 shadow-sm">
                        <p className="text-[10px] font-bold text-corsair-red-500 uppercase tracking-widest mb-3">Shooting Qualification</p>
                        <p className="text-lg font-black text-corsair-blue-900 mb-1">Eagle Gun Range</p>
                        {rangeLocale ? (
                          <>
                            {rangeLocale.address.map((line) => (
                              <p key={line} className="text-sm text-corsair-gray-600">{line}</p>
                            ))}
                            <a
                              href={rangeLocale.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-3 text-corsair-red-500 hover:text-corsair-red-600 text-xs font-bold transition-colors"
                            >
                              Get Directions ↗
                            </a>
                          </>
                        ) : (
                          <p className="text-sm text-corsair-gray-600">Farmers Branch, TX</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-corsair-gray-500 bg-corsair-gray-50 border border-corsair-gray-200 rounded-lg px-4 py-3">
                    ⓘ You must successfully complete both the classroom portion and the shooting proficiency to be eligible for LTC certification.
                  </p>

                </>
              )}

              {/* Security Training content blocks */}
              {isSecurityEvent && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="bg-white border border-corsair-gray-200 rounded-2xl p-6 shadow-sm">
                      <h2 className="text-base font-black text-corsair-blue-900 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-corsair-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        Training Includes
                      </h2>
                      <ul className="space-y-2.5">
                        {[
                          'Level III Security Officer Certification',
                          'Level IV Personal Protection Officer (PPO)',
                          'Firearms Qualification',
                          'Executive Protection Fundamentals',
                          'Risk Assessment',
                          'Leadership Development',
                          'Scenario-Based Training',
                          'Certification Upon Completion',
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2.5 text-sm text-corsair-gray-700">
                            <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white border border-corsair-gray-200 rounded-2xl p-6 shadow-sm">
                      <h2 className="text-base font-black text-corsair-blue-900 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-corsair-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </span>
                        What to Bring
                      </h2>
                      <ul className="space-y-2.5">
                        {[
                          'Valid Government Photo ID',
                          'Duty Handgun, Belt, and Holster',
                          '250 Rounds of Ammunition',
                          'Eye and Ear Protection',
                          'Note-taking Materials',
                          'MMPI Documentation (if required)',
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2.5 text-sm text-corsair-gray-700">
                            <span className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-corsair-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-corsair-blue-900 mb-4">Class Locations</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="bg-corsair-blue-900 text-white rounded-2xl p-6 shadow-sm">
                        <p className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-widest mb-3">Classroom Instruction</p>
                        <p className="text-lg font-black mb-1">Hilton Garden Inn Dallas / Addison</p>
                        <p className="text-sm text-corsair-gray-300">4090 Belt Line Road</p>
                        <p className="text-sm text-corsair-gray-300">Addison, TX 75001</p>
                        <a
                          href="https://maps.google.com/?q=4090+Belt+Line+Rd+Addison+TX+75001"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-3 text-corsair-red-400 hover:text-corsair-red-300 text-xs font-bold transition-colors"
                        >
                          Get Directions ↗
                        </a>
                      </div>
                      <div className="bg-white border border-corsair-gray-200 rounded-2xl p-6 shadow-sm">
                        <p className="text-[10px] font-bold text-corsair-red-500 uppercase tracking-widest mb-3">Shooting Qualification</p>
                        <p className="text-lg font-black text-corsair-blue-900 mb-1">Eagle Gun Range</p>
                        <p className="text-sm text-corsair-gray-600">13301 Midway Rd</p>
                        <p className="text-sm text-corsair-gray-600">Farmers Branch, TX 75244</p>
                        <a
                          href="https://maps.google.com/?q=13301+Midway+Rd+Farmers+Branch+TX+75244"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-3 text-corsair-red-500 hover:text-corsair-red-600 text-xs font-bold transition-colors"
                        >
                          Get Directions ↗
                        </a>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Cancellation Policy — all paid events */}
              {priceCents !== null && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
                  <p className="text-xs font-bold text-amber-800 mb-1">Cancellation Policy</p>
                  <p className="text-xs text-amber-700 leading-relaxed">Course registrations are non-refundable. If unable to attend, you will be automatically enrolled in the next available class at no additional charge.</p>
                </div>
              )}
            </div>

            {/* Right: sticky sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-4">
                <EventCountdown targetDate={event.date} />

                {priceCents !== null ? (
                  <EventBookingForm
                    eventSlug={slug}
                    eventTitle={event.title}
                    eventDate={event.dateDisplay}
                    eventTime={event.time}
                    priceCents={priceCents}
                    addOns={addOns}
                  />
                ) : (
                  <div className="bg-white border border-corsair-gray-200 rounded-2xl p-6 shadow-sm text-center">
                    <p className="text-sm text-corsair-gray-600 mb-4">Contact us to register for this event.</p>
                    <Link
                      href="/contact"
                      className="block w-full bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold py-3 rounded-xl text-sm transition-colors text-center"
                    >
                      Contact to Register →
                    </Link>
                  </div>
                )}

                <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl px-5 py-4 text-center">
                  <p className="text-xs text-corsair-gray-500 mb-1">Questions? Call or text us.</p>
                  <a
                    href="tel:+12143356652"
                    className="text-corsair-blue-900 font-black text-xl hover:text-corsair-red-500 transition-colors block"
                  >
                    214-335-6652
                  </a>
                </div>

                <Link
                  href="/events"
                  className="flex items-center justify-center gap-2 text-corsair-gray-500 hover:text-corsair-blue-900 text-xs font-bold transition-colors"
                >
                  ← View All Events
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
