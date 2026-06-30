'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import PageHero from '@/components/PageHero';
import FloatingElements from '@/components/FloatingElements';
import Lightbox from '@/components/Lightbox';
import {
  getUpcomingEvents,
  getPastEvents,
  getUpcomingEventFlyers,
  eventPhotos,
  eventCategories,
  type EventCategory,
  type CorsairEvent,
} from '@/data/events';

/* ────────────────────────────────────────────────────────────
   Category badge styles (navy, red, subtle)
   ──────────────────────────────────────────────────────────── */
const categoryStyles: Record<EventCategory, string> = {
  'Firearms Training': 'bg-corsair-red-50 text-corsair-red-600 border-corsair-red-200',
  'LTC Certification': 'bg-corsair-blue-50 text-corsair-blue-900 border-corsair-blue-200',
  "Women's Training": 'bg-pink-50 text-pink-700 border-pink-200',
  'Church Safety': 'bg-amber-50 text-amber-800 border-amber-200',
  'Security Training': 'bg-slate-100 text-slate-800 border-slate-300',
  'Community Safety': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Private Event': 'bg-purple-50 text-purple-700 border-purple-200',
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

/* ────────────────────────────────────────────────────────────
   Event Card
   ──────────────────────────────────────────────────────────── */
function EventCard({
  event,
  index,
  t,
}: {
  event: CorsairEvent;
  index: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <motion.article
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      custom={index}
      variants={cardVariants}
      className="group bg-white rounded-2xl overflow-hidden border border-corsair-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* Image */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-corsair-blue-900">
        <Image
          src={event.heroImage}
          alt={event.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <span
          className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${categoryStyles[event.category]}`}
        >
          {event.category}
        </span>
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-1 bg-black/55 backdrop-blur rounded-full px-2.5 py-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {event.dateDisplay}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        <h3 className="text-lg font-black text-corsair-blue-900 leading-tight mb-2 group-hover:text-corsair-red-500 transition-colors">
          {event.title}
        </h3>
        <p className="text-sm text-corsair-gray-600 leading-relaxed mb-4 flex-1">
          {event.shortDescription}
        </p>

        {/* Meta */}
        <ul className="text-xs text-corsair-gray-600 space-y-1.5 mb-5">
          <li className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-corsair-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {event.time}
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-corsair-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {event.location}
          </li>
        </ul>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          {event.registrationUrl ? (
            <Link
              href={event.registrationUrl}
              className="inline-flex items-center gap-1.5 bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg transition-colors"
            >
              {event.contactCta || t('cta.register')}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg transition-colors"
            >
              {event.contactCta || t('cta.contactToRsvp')}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ────────────────────────────────────────────────────────────
   Events Page
   ──────────────────────────────────────────────────────────── */
export default function EventsPage() {
  const t = useTranslations('events');
  const tn = useTranslations('nav');

  const [mode, setMode] = useState<'upcoming' | 'past'>('upcoming');
  const [activeCategory, setActiveCategory] = useState<'All' | EventCategory>('All');

  // Date-aware partition — events auto-move to past once their date passes
  const upcomingEvents = getUpcomingEvents();
  const pastEvents = getPastEvents();
  const upcomingFlyers = getUpcomingEventFlyers();

  // Flyer lightbox
  const [flyerIndex, setFlyerIndex] = useState<number | null>(null);
  // Photo lightbox
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [pastFlyerIndex, setPastFlyerIndex] = useState<number | null>(null);

  const events = mode === 'upcoming' ? upcomingEvents : pastEvents;

  const filteredEvents = useMemo(() => {
    if (activeCategory === 'All') return events;
    return events.filter((e) => e.category === activeCategory);
  }, [events, activeCategory]);

  return (
    <>
      {/* ── Hero ── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title1')}
        title2={t('hero.title2')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/group-range-training-01.jpg"
        imageAlt={t('hero.imageAlt')}
        breadcrumbs={[
          { label: tn('home'), href: '/' },
          { label: t('hero.breadcrumb') },
        ]}
        ctas={[
          { label: t('hero.cta1'), href: '#upcoming', variant: 'primary' },
          { label: t('hero.cta2'), href: '/contact', variant: 'secondary' },
        ]}
      />

      {/* ── Upcoming Events ── */}
      <section id="upcoming" className="bg-corsair-gray-100 py-20 relative overflow-hidden">
        <FloatingElements variant="minimal" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Heading */}
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">
              {t('upcoming.label')}
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
              {mode === 'upcoming' ? t('upcoming.title') : t('past.title')}
            </h2>
            <p className="text-corsair-gray-600 mt-3 max-w-2xl mx-auto text-sm md:text-base">
              {mode === 'upcoming' ? t('upcoming.description') : t('past.description')}
            </p>
          </div>

          {/* Upcoming / Past toggle */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-white border border-corsair-gray-200 rounded-full p-1 shadow-sm">
              <button
                onClick={() => {
                  setMode('upcoming');
                  setActiveCategory('All');
                }}
                className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${
                  mode === 'upcoming'
                    ? 'bg-corsair-red-500 text-white'
                    : 'text-corsair-gray-700 hover:text-corsair-blue-900'
                }`}
                aria-pressed={mode === 'upcoming'}
              >
                {t('toggle.upcoming')}
              </button>
              <button
                onClick={() => {
                  setMode('past');
                  setActiveCategory('All');
                }}
                className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${
                  mode === 'past'
                    ? 'bg-corsair-red-500 text-white'
                    : 'text-corsair-gray-700 hover:text-corsair-blue-900'
                }`}
                aria-pressed={mode === 'past'}
              >
                {t('toggle.past')}
              </button>
            </div>
          </div>

          {/* Category filter — upcoming only */}
          {mode === 'upcoming' && <div className="flex flex-wrap justify-center gap-2 mb-10">
            <button
              onClick={() => setActiveCategory('All')}
              className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-full border transition-colors ${
                activeCategory === 'All'
                  ? 'bg-corsair-blue-900 text-white border-corsair-blue-900'
                  : 'bg-white text-corsair-gray-700 border-corsair-gray-200 hover:border-corsair-blue-900 hover:text-corsair-blue-900'
              }`}
            >
              {t('filters.all')}
            </button>
            {eventCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-full border transition-colors ${
                  activeCategory === cat
                    ? 'bg-corsair-blue-900 text-white border-corsair-blue-900'
                    : 'bg-white text-corsair-gray-700 border-corsair-gray-200 hover:border-corsair-blue-900 hover:text-corsair-blue-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>}

          {/* Upcoming: event cards — Past: full flyer grid */}
          {mode === 'upcoming' ? (
            filteredEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} t={t} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-corsair-gray-300">
                <p className="text-corsair-gray-500">{t('emptyState')}</p>
              </div>
            )
          ) : (
            /* Past events — full flyer grid */
            pastEvents.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {pastEvents.map((event, i) => (
                  <button
                    key={event.id}
                    onClick={() => setPastFlyerIndex(i)}
                    className="group relative flex flex-col bg-white border border-corsair-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:border-corsair-red-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-corsair-red-400 focus:ring-offset-2 text-left"
                    aria-label={`View flyer: ${event.title}`}
                  >
                    <div className="relative w-full aspect-[3/4] bg-white">
                      <Image
                        src={event.flyerImage ?? event.heroImage}
                        alt={event.title}
                        fill
                        className="object-contain group-hover:scale-[1.02] transition-transform duration-500"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    </div>
                    <div className="px-3 py-2.5 border-t border-corsair-gray-100 bg-corsair-gray-50">
                      <p className="text-[11px] font-black text-corsair-blue-900 uppercase tracking-wide">{event.dateDisplay}</p>
                      <p className="text-[10px] text-corsair-red-500 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                        View Flyer
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-corsair-gray-300">
                <p className="text-corsair-gray-500">No past events yet.</p>
              </div>
            )
          )}
        </div>
      </section>

      {/* ── Flyer Gallery — only rendered when upcoming flyers exist ── */}
      {upcomingFlyers.length > 0 && (
        <section className="py-20 bg-white border-t border-corsair-gray-200 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">
                {t('flyers.label')}
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
                {t('flyers.title')}
              </h2>
              <p className="text-corsair-gray-600 mt-3 max-w-2xl mx-auto text-sm md:text-base">
                {t('flyers.description')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {upcomingFlyers.map((flyer, i) => (
                <button
                  key={flyer.id}
                  onClick={() => setFlyerIndex(i)}
                  className="group relative block bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:border-corsair-red-300 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-corsair-red-400 focus:ring-offset-2"
                  aria-label={`View flyer: ${flyer.title}`}
                >
                  {/* Flyer uses contain to preserve full layout */}
                  <div className="relative w-full aspect-[3/4] bg-white p-3">
                    <Image
                      src={flyer.image}
                      alt={flyer.title}
                      fill
                      className="object-contain group-hover:scale-[1.02] transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-3 border-t border-corsair-gray-200">
                    <p className="text-xs font-bold text-corsair-blue-900 leading-tight line-clamp-2">
                      {flyer.title}
                    </p>
                    <p className="text-[10px] text-corsair-red-500 font-bold uppercase tracking-wider mt-1 inline-flex items-center gap-1">
                      {t('flyers.viewCta')}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Past Event Photos ── */}
      <section className="py-20 bg-corsair-gray-100 border-t border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">
              {t('photos.label')}
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
              {t('photos.title')}
            </h2>
            <p className="text-corsair-gray-600 mt-3 max-w-2xl mx-auto text-sm md:text-base">
              {t('photos.description')}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {eventPhotos.map((photo, i) => (
              <button
                key={photo.src + i}
                onClick={() => setPhotoIndex(i)}
                className="group relative block bg-corsair-blue-900 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-corsair-red-400 focus:ring-offset-2"
                aria-label={photo.alt}
              >
                <div className="relative w-full aspect-[4/3]">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.caption}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 bg-corsair-blue-900 text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">{t('cta.title')}</h2>
          <p className="text-corsair-gray-300 max-w-2xl mx-auto mb-8">{t('cta.description')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold px-6 py-3 rounded-lg transition-colors"
            >
              {t('cta.contact')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-lg border border-white/20 transition-colors"
            >
              {t('cta.courses')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Lightboxes ── */}
      {/* Past flyer lightbox */}
      {pastFlyerIndex !== null && (
        <Lightbox
          open={pastFlyerIndex !== null}
          onClose={() => setPastFlyerIndex(null)}
          src={pastEvents[pastFlyerIndex].flyerImage ?? pastEvents[pastFlyerIndex].heroImage}
          alt={pastEvents[pastFlyerIndex].title}
          caption={`${pastEvents[pastFlyerIndex].dateDisplay} — ${pastEvents[pastFlyerIndex].title}`}
          fit="contain"
          downloadUrl={pastEvents[pastFlyerIndex].flyerImage}
          onPrev={pastFlyerIndex > 0 ? () => setPastFlyerIndex(pastFlyerIndex - 1) : undefined}
          onNext={pastFlyerIndex < pastEvents.length - 1 ? () => setPastFlyerIndex(pastFlyerIndex + 1) : undefined}
        />
      )}

      {flyerIndex !== null && (
        <Lightbox
          open={flyerIndex !== null}
          onClose={() => setFlyerIndex(null)}
          src={upcomingFlyers[flyerIndex].image}
          alt={upcomingFlyers[flyerIndex].title}
          caption={upcomingFlyers[flyerIndex].title}
          fit="contain"
          downloadUrl={upcomingFlyers[flyerIndex].downloadUrl}
          onPrev={
            flyerIndex > 0
              ? () => setFlyerIndex(flyerIndex - 1)
              : undefined
          }
          onNext={
            flyerIndex < upcomingFlyers.length - 1
              ? () => setFlyerIndex(flyerIndex + 1)
              : undefined
          }
        />
      )}
      {photoIndex !== null && (
        <Lightbox
          open={photoIndex !== null}
          onClose={() => setPhotoIndex(null)}
          src={eventPhotos[photoIndex].src}
          alt={eventPhotos[photoIndex].alt}
          caption={eventPhotos[photoIndex].caption}
          fit="contain"
          onPrev={
            photoIndex > 0
              ? () => setPhotoIndex(photoIndex - 1)
              : undefined
          }
          onNext={
            photoIndex < eventPhotos.length - 1
              ? () => setPhotoIndex(photoIndex + 1)
              : undefined
          }
        />
      )}
    </>
  );
}
