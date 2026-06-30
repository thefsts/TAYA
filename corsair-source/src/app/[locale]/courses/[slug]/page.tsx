import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCourseBySlug, getAllCourses } from '@/lib/courses';
import { getCatalogItemBySlug } from '@/lib/pricing';
import { getLocalizedCourse } from '@/lib/courseTranslations';
import BookingForm from '@/components/BookingForm';
import DiscountsBanner from '@/components/DiscountsBanner';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';
import { courseSchema, breadcrumbSchema } from '@/lib/schema';

const CROSS_SELL_MAP: Record<string, string[]> = {
  'texas-ltc-certification-basic-handgun': ['defensive-shooting-skills', 'texas-ltc-shooting-proficiency'],
  'basic-handgun-skills-training':         ['defensive-shooting-skills', 'concealed-carry-home-defense'],
  'introduction-to-firearms':              ['basic-handgun-skills-training', 'defensive-shooting-skills'],
  'concealed-carry-home-defense':          ['defensive-shooting-skills'],
  'level-2-security-officer':              ['level-3-armed-security-officer'],
  'level-3-armed-security-officer':        ['level-4-bodyguard', 'level-3-4-complete-package'],
  'level-4-bodyguard':                     ['level-3-4-complete-package'],
  'ar-15-rifle-course':                    ['shotgun-course'],
  'shotgun-course':                        ['ar-15-rifle-course'],
  'firearm-proficiency-requalification':   ['armed-first-responder'],
  'armed-first-responder':                 ['firearm-proficiency-requalification'],
  'defensive-shooting-skills':             ['concealed-carry-home-defense', 'armed-first-responder'],
};

export async function generateStaticParams() {
  const courses = getAllCourses();
  return courses.map((course) => ({ slug: course.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const baseCourse = getCourseBySlug(slug);
  const t = await getTranslations({ locale, namespace: 'courseDetail' });
  if (!baseCourse) {
    return buildPageMetadata({
      path: `/courses/${slug}`,
      title: t('notFoundTitle'),
      description: t('notFoundTitle'),
      locale,
      noIndex: true,
    });
  }
  const course = getLocalizedCourse(baseCourse, locale);
  return buildPageMetadata({
    path: `/courses/${slug}`,
    title: course.title,
    description: course.description,
    locale,
    image: course.image,
    keywords: course.categoryTags ?? [],
  });
}

const levelColors: Record<string, string> = {
  Beginner: 'bg-green-100 text-green-700 border-green-200',
  Intermediate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Advanced: 'bg-orange-100 text-orange-700 border-orange-200',
  Professional: 'bg-purple-100 text-purple-700 border-purple-200',
  'All Levels': 'bg-blue-100 text-blue-700 border-blue-200',
};

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const baseCourse = getCourseBySlug(slug);
  if (!baseCourse) notFound();
  const course = getLocalizedCourse(baseCourse, locale);

  const t = await getTranslations('courseDetail');
  const tc = await getTranslations('common');

  // Cross-sell: look up related course objects
  const relatedSlugs = CROSS_SELL_MAP[slug] ?? [];
  const relatedCourses = relatedSlugs
    .map((s) => getCourseBySlug(s))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => getLocalizedCourse(c, locale));
  const tn = await getTranslations('nav');

  // Extract numeric price for schema (first pricing option, if numeric)
  const catalogItem = getCatalogItemBySlug(course.slug);
  const numericPrice =
    catalogItem?.basePriceCents != null ? catalogItem.basePriceCents / 100 : undefined;

  const courseUrl = `/${locale}/courses/${course.slug}`;
  const schemas = [
    courseSchema({
      name: course.title,
      description: course.description,
      url: courseUrl,
      image: course.image,
      price: numericPrice,
      category: course.category,
    }),
    breadcrumbSchema([
      { name: tn('home'), url: `/${locale}` },
      { name: tn('courses'), url: `/${locale}/courses` },
      { name: course.title, url: courseUrl },
    ]),
  ];

  const trustItems = [
    { icon: '🏅', label: t('trust.nraCertified'), sub: t('trust.instructor') },
    { icon: '🪪', label: t('trust.stateApproved'), sub: t('trust.ltcCertification') },
    { icon: '⭐', label: t('trust.rating'), sub: t('trust.allReviews') },
    { icon: '🔒', label: t('trust.safetyFirst'), sub: t('trust.everySession') },
  ];

  const whyBookItems = [
    t('whyBook.freeCancellation'),
    t('whyBook.noPaymentRequired'),
    t('whyBook.firearmsRental'),
    t('whyBook.smallClasses'),
    t('whyBook.veteranOwned'),
    t('whyBook.fiveStarReviewed'),
  ];

  return (
    <>
      <JsonLd data={schemas} />
      {/* ── Hero ── */}
      <section className="relative bg-corsair-blue-900 py-16 md:py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-25">
          <Image
            src={course.image}
            alt={course.title}
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-corsair-blue-900/75" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5 text-sm">
            <Link href="/" className="text-corsair-gray-400 hover:text-white transition-colors">{tc('home')}</Link>
            <span className="text-corsair-gray-600">/</span>
            <Link href="/courses" className="text-corsair-gray-400 hover:text-white transition-colors">{tc('courses')}</Link>
            <span className="text-corsair-gray-600">/</span>
            <span className="text-corsair-red-400 font-medium truncate max-w-[200px]">{course.title}</span>
          </div>

          <div className="max-w-3xl">
            <span className="inline-block bg-corsair-red-500/20 text-corsair-red-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded mb-3">
              {course.category}
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
              {course.title}
            </h1>
            <p className="text-corsair-gray-200 text-lg leading-relaxed mb-6 max-w-2xl">
              {course.tagline}
            </p>

            {/* Quick highlights */}
            <div className="flex flex-wrap gap-3">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${levelColors[course.level] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                🎯 {course.level}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {course.duration}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-corsair-red-500/20 text-corsair-red-300 text-xs font-bold px-3 py-1.5 rounded-full border border-corsair-red-500/30">
                💰 {numericPrice != null ? `$${numericPrice % 1 === 0 ? numericPrice : numericPrice.toFixed(2)}` : course.price}
              </span>
              {course.urgencyMessage && (
                <span className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-300 text-xs font-bold px-3 py-1.5 rounded-full border border-yellow-500/30 animate-pulse">
                  🔥 {course.urgencyMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Content + Sidebar ── */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* ── Main Content ── */}
            <div className="lg:col-span-2 space-y-10">

              {/* About this course */}
              <div>
                <h2 className="text-2xl font-black text-corsair-blue-900 mb-3">{t('aboutCourse')}</h2>
                <div className="w-12 h-1 bg-corsair-red-500 rounded mb-4" />
                <p className="text-corsair-gray-600 leading-relaxed">{course.longDescription}</p>
              </div>

              {/* What You'll Learn */}
              <div>
                <h2 className="text-2xl font-black text-corsair-blue-900 mb-3">{t('whatYouLearn')}</h2>
                <div className="w-12 h-1 bg-corsair-red-500 rounded mb-5" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {course.whatYouLearn.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 bg-corsair-gray-50 border border-corsair-gray-200 rounded-xl p-4">
                      <div className="w-5 h-5 rounded-full bg-corsair-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm text-corsair-gray-700 leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Who It's For */}
              {course.whoIsItFor && course.whoIsItFor.length > 0 && (
                <div>
                  <h2 className="text-2xl font-black text-corsair-blue-900 mb-3">{t('whoIsItFor')}</h2>
                  <div className="w-12 h-1 bg-corsair-red-500 rounded mb-5" />
                  <div className="space-y-2.5">
                    {course.whoIsItFor.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-corsair-red-500">→</span>
                        <p className="text-corsair-gray-600 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisites + What to Bring */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-corsair-blue-900/5 border border-corsair-blue-900/10 rounded-2xl p-5">
                  <h3 className="font-black text-corsair-blue-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-corsair-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {t('requirements')}
                  </h3>
                  <ul className="space-y-2">
                    {course.prerequisites.map((item, i) => (
                      <li key={i} className="text-sm text-corsair-gray-600 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-500 flex-shrink-0 mt-1.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-5">
                  <h3 className="font-black text-corsair-blue-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-corsair-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    {t('whatToBring')}
                  </h3>
                  <ul className="space-y-2">
                    {course.whatToBring.map((item, i) => (
                      <li key={i} className="text-sm text-corsair-gray-600 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Related old-site classes */}
              {course.relatedOldSiteClasses && course.relatedOldSiteClasses.length > 0 && (
                <div>
                  <h2 className="text-2xl font-black text-corsair-blue-900 mb-3">{t('relatedClasses')}</h2>
                  <div className="w-12 h-1 bg-corsair-red-500 rounded mb-5" />
                  <div className="flex flex-wrap gap-2">
                    {course.relatedOldSiteClasses.map((name, i) => (
                      <span key={i} className="bg-corsair-gray-50 border border-corsair-gray-200 text-corsair-gray-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        {name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-corsair-gray-400 mt-3 italic">
                    {t('relatedClassesNote')}
                  </p>
                </div>
              )}

              {/* Trust strip */}
              <div className="bg-corsair-blue-900 rounded-2xl p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-white">
                  {trustItems.map((item, i) => (
                    <div key={i}>
                      <div className="text-xl mb-1">{item.icon}</div>
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-xs text-corsair-gray-400">{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Sticky Sidebar ── */}
            <div className="lg:sticky lg:top-28 h-fit space-y-5">
              {/* Booking Form */}
              <BookingForm course={course} />

              {/* Reassurance */}
              <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-5">
                <h4 className="font-bold text-corsair-blue-900 text-sm mb-3">{t('whyBookTitle')}</h4>
                <ul className="space-y-2.5">
                  {whyBookItems.map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-xs text-corsair-gray-600">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Discounts */}
              <DiscountsBanner variant="sidebar" />

              {/* Contact fallback */}
              <div className="bg-white border border-corsair-gray-200 rounded-2xl p-5 text-center">
                <p className="text-sm font-bold text-corsair-blue-900 mb-1">{t('preferToCall')}</p>
                <p className="text-xs text-corsair-gray-500 mb-3">{t('steveAnswersDirectly')}</p>
                <a
                  href="tel:+12143356652"
                  className="block w-full border-2 border-corsair-blue-900 text-corsair-blue-900 hover:bg-corsair-blue-900 hover:text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                >
                  📞 214-335-6652
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ── Related Courses ── */}
      {relatedCourses.length > 0 && (
        <section className="py-12 bg-white border-t border-corsair-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <span className="text-xs font-bold text-corsair-red-500 uppercase tracking-widest">Continue Your Training</span>
              <h2 className="text-2xl font-black text-corsair-blue-900 mt-1">Students Also Take</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedCourses.map((rc) => (
                <Link
                  key={rc.slug}
                  href={`/courses/${rc.slug}`}
                  className="group bg-corsair-gray-50 border border-corsair-gray-200 hover:border-corsair-red-300 hover:bg-corsair-red-50/30 rounded-2xl p-5 transition-all duration-200 flex flex-col"
                >
                  <div className="relative h-36 rounded-xl overflow-hidden mb-4">
                    <Image
                      src={rc.image}
                      alt={rc.title}
                      fill
                      className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-corsair-red-500 uppercase tracking-widest mb-1">{rc.category}</span>
                  <h3 className="font-black text-corsair-blue-900 text-sm leading-snug group-hover:text-corsair-red-600 transition-colors mb-2">
                    {rc.title}
                  </h3>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-corsair-gray-200">
                    <span className="text-corsair-gray-500 text-xs">{rc.duration}</span>
                    <span className="text-corsair-red-500 font-bold text-xs">{rc.price}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom CTA ── */}
      <section className="py-12 bg-corsair-gray-50 border-t border-corsair-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-corsair-blue-900 mb-3">{t('ctaTitle')}</h2>
          <p className="text-corsair-gray-500 text-sm mb-6">{t('ctaDescription')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/courses" className="border-2 border-corsair-gray-300 text-corsair-gray-600 hover:border-corsair-blue-900 hover:text-corsair-blue-900 px-6 py-3 rounded-xl text-sm font-bold transition-colors">
              ← {t('backToCourses')}
            </Link>
            <Link href="/contact" className="btn-red-glow bg-corsair-red-500 hover:bg-corsair-red-600 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300">
              {t('contactUs')} →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
