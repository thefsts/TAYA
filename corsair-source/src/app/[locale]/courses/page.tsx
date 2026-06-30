'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import { courseCategories, getAllCourses, filterCategories, type FilterCategory, type Course } from '@/lib/courses';
import { localizeAllCourses } from '@/lib/courseTranslations';
import FloatingElements from '@/components/FloatingElements';
import PageHero from '@/components/PageHero';

const levelColors: Record<string, string> = {
  Beginner: 'bg-green-100 text-green-700',
  Intermediate: 'bg-yellow-100 text-yellow-700',
  Advanced: 'bg-orange-100 text-orange-700',
  Professional: 'bg-purple-100 text-purple-700',
  'All Levels': 'bg-blue-100 text-blue-700',
};

/* ──── Quick-View accordion content per course ──── */
function QuickView({ course }: { course: Course }) {
  const t = useTranslations('courses');
  return (
    <div className="px-5 pb-5 space-y-4">
      {/* What You Learn */}
      <div>
        <h4 className="text-xs font-bold text-corsair-blue-900 uppercase tracking-wider mb-2">{t('quickView.whatYouLearn')}</h4>
        <ul className="space-y-1">
          {course.whatYouLearn.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-corsair-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-500 flex-shrink-0 mt-1" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      {/* Prerequisites */}
      <div>
        <h4 className="text-xs font-bold text-corsair-blue-900 uppercase tracking-wider mb-2">{t('quickView.prerequisites')}</h4>
        <ul className="space-y-1">
          {course.prerequisites.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-corsair-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-corsair-gray-300 flex-shrink-0 mt-1" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      {/* What to Bring */}
      <div>
        <h4 className="text-xs font-bold text-corsair-blue-900 uppercase tracking-wider mb-2">{t('quickView.whatToBring')}</h4>
        <ul className="space-y-1">
          {course.whatToBring.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-corsair-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-corsair-blue-400 flex-shrink-0 mt-1" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      {/* CTA */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-corsair-gray-100">
        <Link
          href={`/courses/${course.slug}`}
          className="bg-corsair-red-500 hover:bg-corsair-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
        >
          {course.cta}
        </Link>
        <Link
          href={`/contact?course=${encodeURIComponent(course.title)}`}
          className="border border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
        >
          {t('quickView.contactInstructor')}
        </Link>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const t = useTranslations('courses');
  const tn = useTranslations('nav');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All');
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const allCourses = useMemo(() => localizeAllCourses(getAllCourses(), locale), [locale]);

  const filteredCourses = useMemo(() => {
    let result = allCourses;

    // Category filter
    if (activeFilter !== 'All') {
      result = result.filter((c) => c.categoryTags.includes(activeFilter));
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.categoryTags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allCourses, search, activeFilter]);

  const courseCount = filteredCourses.length;

  return (
    <>
      {/* ──────── Hero ──────── */}
      <PageHero
        badge={t('hero.badge')}
        title1={t('hero.title')}
        subtitle={t('hero.subtitle')}
        imageSrc="/images/corsair-real/group-range-training-01.jpg"
        imageAlt={t('hero.imageAlt')}
        breadcrumbs={[
          { label: tn('corsair'), href: '/' },
          { label: tn('courses') },
        ]}
      >
        {/* Urgency bar */}
        <div className="inline-flex items-center gap-2.5 rounded-xl px-5 py-3" style={{ backgroundColor: '#ac283e' }}>
          <span className="text-base animate-pulse">🔥</span>
          <p className="text-white text-sm font-bold">{t('hero.urgency')}</p>
        </div>
      </PageHero>

      {/* ──────── Search + Filter Bar ──────── */}
      <section className="bg-white border-b border-corsair-gray-200 sticky top-20 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Search input */}
          <div className="relative mb-3">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-corsair-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t('search.placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-corsair-gray-200 rounded-xl text-sm text-corsair-gray-700 placeholder:text-corsair-gray-400 focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-corsair-gray-400 hover:text-corsair-gray-600"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filterCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`flex-shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all duration-200 ${
                  activeFilter === cat
                    ? 'bg-corsair-blue-900 text-white border-corsair-blue-900'
                    : 'bg-white text-corsair-gray-600 border-corsair-gray-200 hover:border-corsair-blue-900 hover:text-corsair-blue-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Course count + reset */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-corsair-gray-500">
              {t('search.showing')} <span className="font-bold text-corsair-blue-900">{courseCount}</span> {courseCount === 1 ? t('search.courseSingular') : t('search.coursePlural')}
              {activeFilter !== 'All' && <span> {t('search.in')} <span className="font-semibold">{activeFilter}</span></span>}
              {search && <span> {t('search.matching')} &ldquo;{search}&rdquo;</span>}
            </p>
            {(activeFilter !== 'All' || search) && (
              <button
                onClick={() => { setActiveFilter('All'); setSearch(''); }}
                className="text-xs font-semibold text-corsair-red-500 hover:text-corsair-red-600 transition-colors"
              >
                {t('search.resetFilters')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ──────── Course Cards Grid ──────── */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="popLayout">
            {filteredCourses.length > 0 ? (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                layout
              >
                {filteredCourses.map((course) => {
                  const isExpanded = expandedCourse === course.slug;
                  return (
                    <motion.div
                      key={course.slug}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 card-glow glow-border ${
                        isExpanded ? 'border-corsair-red-300 ring-1 ring-corsair-red-200 sm:col-span-2 lg:col-span-1' : 'border-corsair-gray-200'
                      }`}
                    >
                      {/* Image */}
                      <div className="relative w-full aspect-[4/3] overflow-hidden">
                        <Image
                          src={course.image}
                          alt={course.imageAlt}
                          fill
                          className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        {/* Level badge */}
                        <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full ${levelColors[course.level] || 'bg-gray-100 text-gray-700'}`}>
                          {course.level}
                        </span>
                        {/* Duration */}
                        <span className="absolute bottom-3 left-3 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {course.duration}
                        </span>
                        {/* Category tags */}
                        <div className="absolute bottom-3 right-3 flex gap-1">
                          {course.categoryTags.slice(0, 2).map((tag) => (
                            <span key={tag} className="bg-corsair-blue-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <div className="text-xs text-corsair-red-500 font-bold uppercase tracking-wider mb-1">{course.category}</div>
                        <h3 className="text-base font-black text-corsair-blue-900 mb-2 leading-snug">
                          {course.title}
                        </h3>
                        <p className="text-corsair-gray-500 text-sm mb-4 line-clamp-2">{course.description}</p>

                        {/* Key points */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {course.keyPoints.slice(0, 3).map((point, i) => (
                            <span key={i} className="bg-corsair-gray-50 border border-corsair-gray-200 text-[10px] font-medium text-corsair-gray-600 px-2 py-0.5 rounded-full">
                              {point}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-corsair-gray-100">
                          <span className="text-xl font-black text-corsair-red-500">{course.price}</span>
                          <button
                            onClick={() => setExpandedCourse(isExpanded ? null : course.slug)}
                            className="text-xs font-bold text-corsair-blue-900 hover:text-corsair-red-500 transition-colors flex items-center gap-1"
                          >
                            {isExpanded ? t('card.close') : t('card.quickView')}
                            <svg
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expandable Quick View */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <QuickView course={course} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <div className="w-16 h-16 bg-corsair-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-corsair-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-corsair-gray-700 mb-1">{t('empty.title')}</h3>
                <p className="text-sm text-corsair-gray-500 mb-4">{t('empty.description')}</p>
                <button
                  onClick={() => { setActiveFilter('All'); setSearch(''); }}
                  className="bg-corsair-red-500 hover:bg-corsair-red-600 text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-colors"
                >
                  {t('search.resetFilters')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ──────── Category Sections ──────── */}
      <section className="py-16 bg-corsair-gray-50 border-t border-corsair-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">{t('catalog.label')}</span>
            <h2 className="text-3xl md:text-4xl font-black text-corsair-blue-900 mt-2">
              {t('catalog.title')}
            </h2>
            <p className="text-corsair-gray-500 mt-3 text-sm max-w-xl mx-auto">
              {t('catalog.description')}
            </p>
          </div>

          <div className="space-y-8">
            {courseCategories.map((cat) => (
              <div key={cat.id} id={cat.id} className="scroll-mt-32 bg-white rounded-2xl border border-corsair-gray-200 overflow-hidden shadow-sm">
                {/* Category header */}
                <div className="bg-corsair-blue-900 px-6 py-5 flex items-start gap-4">
                  <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-white">{cat.title}</h3>
                    <p className="text-corsair-gray-300 text-sm mt-1 leading-relaxed">{cat.description}</p>
                  </div>
                  <span className="flex-shrink-0 bg-corsair-red-500/20 text-corsair-red-300 text-xs font-bold px-3 py-1.5 rounded-lg">
                    {cat.courses.length} {cat.courses.length === 1 ? t('search.courseSingular') : t('search.coursePlural')}
                  </span>
                </div>

                {/* Course list within category */}
                <div className="px-6 py-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cat.courses.map((slug) => {
                      const course = allCourses.find((c) => c.slug === slug);
                      if (!course) return null;
                      return (
                        <button
                          key={slug}
                          onClick={() => {
                            setActiveFilter('All');
                            setSearch('');
                            setExpandedCourse(slug);
                            // Scroll to expanded card
                            setTimeout(() => {
                              const el = document.querySelector(`[data-course-slug="${slug}"]`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                          }}
                          className="flex items-start gap-3 bg-corsair-gray-50 border border-corsair-gray-200 hover:border-corsair-red-300 hover:bg-corsair-red-50/30 rounded-lg px-4 py-3 text-left transition-all duration-200 group"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                            <Image
                              src={course.image}
                              alt={course.title}
                              width={48}
                              height={48}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-corsair-blue-900 group-hover:text-corsair-red-500 transition-colors leading-snug line-clamp-2">
                              {course.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${levelColors[course.level] || 'bg-gray-100 text-gray-700'}`}>
                                {course.level}
                              </span>
                              <span className="text-[10px] text-corsair-gray-400">{course.duration}</span>
                            </div>
                            <span className="text-xs font-black text-corsair-red-500 mt-0.5">{course.price}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────── Waiver Section ──────── */}
      <section className="py-14 bg-white border-t border-corsair-gray-200" id="waiver">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-corsair-blue-900 px-6 py-5 flex items-center gap-3">
              <svg className="w-6 h-6 text-corsair-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-lg font-black text-white">{t('waiver.title')}</h2>
            </div>
            <div className="px-6 py-6">
              <p className="text-corsair-gray-500 text-xs mb-4 italic">
                {t('waiver.required')}
              </p>
              <p className="text-sm text-corsair-gray-600 mb-4 leading-relaxed">
                {t('waiver.description')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/training-waiver"
                  className="inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {t('waiver.signButton')}
                </Link>
                <Link
                  href="/safety-disclaimer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-corsair-gray-500 hover:text-corsair-blue-900 border border-corsair-gray-200 hover:border-corsair-gray-400 px-4 py-2 rounded-lg transition-colors"
                >
                  {t('waiver.safetyDisclaimer')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────── CTA ──────── */}
      <section className="py-14 bg-corsair-blue-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{t('cta.title')}</h2>
          <p className="text-corsair-gray-300 mb-8 text-sm">
            {t('cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-8 py-4 rounded-xl text-sm font-bold transition-all duration-300"
            >
              {t('cta.button')}
            </Link>
            <a
              href="tel:+12143356652"
              className="border-2 border-white/50 hover:border-white text-white px-8 py-4 rounded-xl text-sm font-bold transition-all duration-300"
            >
              📞 {t('cta.call')} {tc('phone')}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
