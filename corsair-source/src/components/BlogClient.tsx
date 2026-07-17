'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  blogArticles,
  trainingCategories,
  trainingVideos,
  trainingTips,
  scenarioDiscussions,
  downloadableResources,
  filterArticles,
  getFeaturedArticle,
  getVideosByCategory,
  type BlogArticle,
  type Category,
  type TrainingVideo,
  type ScenarioDiscussion,
} from '@/lib/blog';
import type { CmsArticle, CmsDownload } from '@/lib/cms';

/* ═══════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════ */

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  shield: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
  ),
  badge: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
  ),
  target: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  lock: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
  ),
  star: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
  ),
  crosshair: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
  ),
  heart: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
  ),
  layers: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
  ),
  church: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  ),
  alert: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
  ),
};

/* ══════════════════════════════════════════════════════════════════════════════════════ */

const CATEGORY_STYLES: Record<string, { dot: string; badge: string }> = {
  'Church Safety':      { dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Business Security':  { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Security Training':  { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  'License to Carry':   { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200' },
};

const POPULAR_TOPICS = [
  { label: 'Church Safety',     href: '/church-security' },
  { label: 'Security Training', href: '/security-training' },
  { label: 'LTC Information',   href: '/courses/texas-ltc-certification-basic-handgun' },
  { label: 'Workplace Safety',  href: '/security-services' },
];

const LEARNING_AREAS = [
  'Security Articles',
  'Training Resources',
  'Firearms Safety',
  'Security Officer Career Development',
  'Executive Protection',
  'Church Security',
  'Home Defense',
  'Industry News',
  'Videos',
  'Professional Tips',
];

/* ═══════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function MotionSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN CLIENT COMPONENT
   ═══════════════════════════════════════════════════════════════ */

interface BlogClientProps {
  cmsArticles?: CmsArticle[];
  cmsDownloads?: CmsDownload[];
}

export default function BlogClient({ cmsArticles = [], cmsDownloads = [] }: BlogClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [activeVideoCategory, setActiveVideoCategory] = useState('Firearms Safety');

  const featured = getFeaturedArticle();
  const publishedCmsArticles = cmsArticles.filter((a) => a.status === 'published');

  const filteredArticles = useMemo(
    () => filterArticles(searchQuery, activeCategory ?? undefined, activeTopic ?? undefined),
    [searchQuery, activeCategory, activeTopic]
  );

  const filteredVideos = useMemo(
    () => getVideosByCategory(activeVideoCategory),
    [activeVideoCategory]
  );

  const allTopics = useMemo(() => {
    const topics: { catId: string; topicId: string; label: string }[] = [];
    trainingCategories.forEach((c) => {
      c.topics.forEach((t) => topics.push({ catId: c.id, topicId: t.id, label: t.label }));
    });
    return topics;
  }, []);

  const handleCategoryClick = (catId: string) => {
    if (activeCategory === catId) {
      setActiveCategory(null);
      setActiveTopic(null);
    } else {
      setActiveCategory(catId);
      setActiveTopic(null);
    }
  };

  const activeCat = activeCategory ? trainingCategories.find((c) => c.id === activeCategory) : null;

  return (
    <>
      {/* ━━ HERO ━━ */}
      <section className="bg-corsair-blue-900 pt-10 sm:pt-14 pb-8 sm:pb-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-corsair-red-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-corsair-blue-400 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-6 text-sm text-corsair-gray-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span className="text-white font-medium">Training & Knowledge Center</span>
          </div>

          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-0.5 bg-corsair-red-500" />
              <span className="text-corsair-red-400 text-xs font-bold uppercase tracking-widest">Corsair Knowledge Center</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Training & Knowledge Center
            </h1>
            <p className="text-corsair-gray-300 text-lg leading-relaxed mb-6">
              Your comprehensive resource for security articles, training resources, firearms safety,
              security officer career development, executive protection, church security, home defense,
              and professional industry insights from Corsair Tactical Solutions.
            </p>

            {/* Learning areas tags */}
            <div className="flex flex-wrap gap-2">
              {LEARNING_AREAS.map((area, i) => (
                <motion.span
                  key={area}
                  custom={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 text-corsair-gray-300 border border-white/10 hover:bg-white/20 hover:text-white transition-colors cursor-default"
                >
                  {area}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━ FEATURED ARTICLE ━━ */}
      <motion.section
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
        variants={staggerContainer} className="bg-white py-10 md:py-14"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-8 h-0.5 bg-corsair-red-500" />
            <span className="text-corsair-red-500 text-xs font-bold uppercase tracking-widest">Featured Article</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-corsair-gray-50 rounded-2xl overflow-hidden border border-corsair-gray-100">
            <motion.div variants={fadeUp} custom={0} className="relative aspect-[4/3] lg:aspect-auto lg:h-full overflow-hidden">
              <Image src={featured.image} alt={featured.imageAlt} fill className="object-cover object-top" sizes="(max-width: 1024px) 100vw, 50vw" priority />
              <span className={`absolute top-4 left-4 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border backdrop-blur-sm ${CATEGORY_STYLES[featured.category]?.badge ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STYLES[featured.category]?.dot ?? 'bg-gray-400'}`} />
                {featured.category}
              </span>
            </motion.div>
            <motion.div variants={fadeUp} custom={1} className="p-6 lg:p-10">
              <div className="flex items-center gap-3 text-xs text-corsair-gray-400 mb-3">
                <time dateTime={featured.date}>{featured.date}</time>
                <span aria-hidden>·</span>
                <span>{featured.readTime}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-corsair-blue-900 mb-4 leading-snug">
                {featured.title}
              </h2>
              <p className="text-corsair-gray-600 leading-relaxed mb-6">
                {featured.description}
              </p>
              <Link
                href={`/blog/${featured.slug}`}
                className="inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm group"
              >
                Read More
                <svg className="w-4 h-4 translate-x-0 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ━━ CMS ARTICLES (primary when CMS has published content) ━━ */}
      {publishedCmsArticles.length > 0 && (
        <section className="bg-white py-10 md:py-14">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-8 h-0.5 bg-corsair-red-500" />
              <span className="text-corsair-red-500 text-xs font-bold uppercase tracking-widest">Articles</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {publishedCmsArticles
                .map((article, i) => (
                  <motion.article
                    key={article.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                    className="group bg-corsair-gray-50 rounded-2xl overflow-hidden border border-corsair-gray-100 hover:shadow-md hover:border-corsair-red-200 transition-all"
                  >
                    {article.imageUrl && (
                      <div className="relative aspect-video overflow-hidden">
                        <Image
                          src={article.imageUrl}
                          alt={article.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      {article.publishedAt && (
                        <time className="text-xs text-corsair-gray-400 mb-2 block" dateTime={article.publishedAt}>
                          {new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </time>
                      )}
                      <h3 className="text-base font-black text-corsair-blue-900 group-hover:text-corsair-red-500 transition-colors leading-snug mb-2">
                        <Link href={`/blog/${article.slug}`}>{article.title}</Link>
                      </h3>
                      {article.excerpt && (
                        <p className="text-xs text-corsair-gray-500 leading-relaxed line-clamp-3">{article.excerpt}</p>
                      )}
                      <Link
                        href={`/blog/${article.slug}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-corsair-red-500 hover:text-corsair-red-600 mt-3 transition-colors"
                      >
                        Read more
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </motion.article>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ━━ CATEGORY NAVIGATION ━━ */}
      <section className="bg-corsair-gray-50 py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <span className="w-8 h-0.5 bg-corsair-red-500" />
            <span className="text-corsair-red-500 text-xs font-bold uppercase tracking-widest">Browse by Category</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {trainingCategories.map((cat, i) => (
              <motion.button
                key={cat.id}
                custom={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                onClick={() => handleCategoryClick(cat.id)}
                className={`group flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-300 text-center
                  ${activeCategory === cat.id
                    ? 'bg-corsair-blue-900 border-corsair-blue-700 text-white shadow-lg'
                    : 'bg-white border-corsair-gray-100 text-corsair-gray-700 hover:border-corsair-red-200 hover:shadow-md'
                  }`}
              >
                <span className={`${activeCategory === cat.id ? 'text-corsair-red-400' : 'text-corsair-blue-900 group-hover:text-corsair-red-500'} transition-colors`}>
                  {CATEGORY_ICON[cat.icon]}
                </span>
                <span className="text-xs font-bold leading-snug">{cat.label}</span>
                <span className="text-[10px] text-corsair-gray-400">{cat.topics.length} topics</span>
              </motion.button>
            ))}
          </div>

          {/* Topic filter when category active */}
          <AnimatePresence>
            {activeCat && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6"
              >
                <div className="bg-white rounded-2xl border border-corsair-gray-100 p-5">
                  <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-3">
                    {activeCat.label} — Select a Topic
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeCat.topics.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTopic(activeTopic === t.id ? null : t.id)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
                          ${activeTopic === t.id
                            ? 'bg-corsair-blue-900 text-white border-corsair-blue-900'
                            : 'bg-corsair-gray-50 text-corsair-gray-600 border-corsair-gray-200 hover:border-corsair-red-200 hover:text-corsair-red-600'
                          }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ━━ SEARCH + ARTICLES GRID + SIDEBAR (static fallback — shown only when CMS has no articles) ━━ */}
      {publishedCmsArticles.length === 0 && <section className="bg-white py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search */}
          <div className="mb-8">
            <div className="relative max-w-xl">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles, topics, or keywords..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-corsair-gray-200 bg-corsair-gray-50 text-sm text-corsair-blue-900 placeholder:text-corsair-gray-400 focus:outline-none focus:ring-2 focus:ring-corsair-red-500/30 focus:border-corsair-red-400 transition-all"
              />
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-corsair-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            {(searchQuery || activeCategory || activeTopic) && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-corsair-gray-400">{filteredArticles.length} result{filteredArticles.length !== 1 ? 's' : ''}</span>
                {activeCategory && (
                  <button onClick={() => { setActiveCategory(null); setActiveTopic(null); }} className="inline-flex items-center gap-1 text-corsair-red-500 hover:text-corsair-red-600 text-xs font-semibold bg-corsair-red-50 px-2 py-1 rounded-lg">
                    Clear filters
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 lg:gap-12">
            {/* Article Grid */}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredArticles.map((article, i) => {
                  const catStyle = CATEGORY_STYLES[article.category] ?? { dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-700 border-gray-200' };
                  return (
                    <motion.article
                      key={article.slug}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.06, duration: 0.5 }}
                      className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-corsair-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col"
                    >
                      <Link href={`/blog/${article.slug}`} className="block relative aspect-[3/2] overflow-hidden bg-corsair-gray-100">
                        <Image src={article.image} alt={article.imageAlt} fill className="object-cover object-top group-hover:scale-105 transition-transform duration-700 ease-out" sizes="(max-width: 768px) 100vw, 50vw" priority={i < 2} />
                        <span className={`absolute top-4 left-4 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border backdrop-blur-sm ${catStyle.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                          {article.category}
                        </span>
                      </Link>
                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center gap-3 text-xs text-corsair-gray-400 mb-3">
                          <time dateTime={article.date}>{article.date}</time>
                          <span aria-hidden>·</span>
                          <span>{article.readTime}</span>
                        </div>
                        <Link href={`/blog/${article.slug}`}>
                          <h2 className="text-base font-black text-corsair-blue-900 mb-3 group-hover:text-corsair-red-600 transition-colors leading-snug">
                            {article.title}
                          </h2>
                        </Link>
                        <p className="text-sm text-corsair-gray-500 leading-relaxed flex-1 line-clamp-3">
                          {article.description}
                        </p>
                        <Link href={`/blog/${article.slug}`} className="mt-5 inline-flex items-center gap-1.5 text-corsair-red-500 hover:text-corsair-red-600 font-bold text-sm transition-colors group/link">
                          Read Article
                          <svg className="w-4 h-4 translate-x-0 group-hover/link:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
              {filteredArticles.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-corsair-gray-400 text-sm">No articles match your search. Try a different keyword or category.</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              {/* Popular Topics */}
              <div className="bg-corsair-gray-50 rounded-2xl border border-corsair-gray-100 p-6">
                <h3 className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-4">Popular Topics</h3>
                <nav className="space-y-1">
                  {POPULAR_TOPICS.map((topic) => (
                    <Link key={topic.href} href={topic.href} className="group flex items-center justify-between py-2.5 px-3 rounded-xl text-sm font-semibold text-corsair-gray-700 hover:bg-white hover:text-corsair-red-600 transition-colors border border-transparent hover:border-corsair-gray-100">
                      {topic.label}
                      <svg className="w-4 h-4 text-corsair-gray-300 group-hover:text-corsair-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  ))}
                </nav>
              </div>

              {/* About CTS */}
              <div className="bg-corsair-blue-900 rounded-2xl p-6 text-white">
                <div className="w-10 h-10 rounded-xl bg-corsair-red-500 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <p className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest mb-2">About CTS</p>
                <p className="text-sm text-corsair-gray-300 leading-relaxed mb-4">
                  Texas-licensed security company. Veteran-founded. DPS-certified instructors. Serving North Texas since 2010.
                </p>
                <Link href="/about" className="inline-flex items-center gap-1 text-corsair-red-400 text-xs font-bold hover:text-corsair-red-300 transition-colors">
                  Learn about our team →
                </Link>
              </div>

              {/* Contact */}
              <div className="bg-white rounded-2xl border border-corsair-gray-100 shadow-sm p-6 text-center">
                <p className="font-bold text-corsair-blue-900 text-sm mb-1">Have a Question?</p>
                <p className="text-xs text-corsair-gray-400 mb-4">Mon–Sat, 8 AM – 6 PM CT</p>
                <a href="tel:+12143356652" className="block w-full bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                  214-335-6652
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>}

      {/* ━━ FEATURED TRAINING VIDEOS ━━ */}
      <section className="bg-corsair-gray-50 py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="w-8 h-0.5 bg-corsair-red-500" />
              <span className="text-corsair-red-500 text-xs font-bold uppercase tracking-widest">Featured Training Videos</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Firearms Safety', 'Security Officer Training', 'Defensive Shooting', 'Church Security', 'Executive Protection'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveVideoCategory(cat)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
                    ${activeVideoCategory === cat
                      ? 'bg-corsair-blue-900 text-white border-corsair-blue-900'
                      : 'bg-white text-corsair-gray-600 border-corsair-gray-200 hover:border-corsair-red-200 hover:text-corsair-red-600'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((video, i) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="group bg-white rounded-2xl overflow-hidden border border-corsair-gray-100 hover:shadow-lg transition-all duration-300"
              >
                <div className="relative aspect-video bg-corsair-gray-100 flex items-center justify-center group-hover:brightness-95 transition-all">
                  <div className="w-14 h-14 rounded-full bg-corsair-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                  <span className="absolute bottom-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded bg-black/60 text-white">{video.duration}</span>
                </div>
                <div className="p-5">
                  <span className="text-[10px] font-bold text-corsair-red-500 uppercase tracking-wider">{video.category}</span>
                  <h3 className="text-sm font-black text-corsair-blue-900 mt-1 mb-2 leading-snug">{video.title}</h3>
                  <p className="text-xs text-corsair-gray-500 leading-relaxed">{video.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ TRAINING TIPS (ROTATING) ━━ */}
      <section className="bg-corsair-blue-900 py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <span className="w-8 h-0.5 bg-corsair-red-500" />
            <span className="text-corsair-red-400 text-xs font-bold uppercase tracking-widest">Training Tips</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {trainingTips.map((tip, i) => (
              <motion.div
                key={tip.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="bg-corsair-blue-800/50 border border-corsair-blue-700/50 rounded-2xl p-5 hover:bg-corsair-blue-800 transition-colors"
              >
                <span className="text-[10px] font-bold text-corsair-red-400 uppercase tracking-wider">{tip.type}</span>
                <h3 className="text-sm font-black text-white mt-2 mb-2 leading-snug">{tip.title}</h3>
                <p className="text-xs text-corsair-gray-300 leading-relaxed">{tip.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ REAL-WORLD SCENARIO DISCUSSIONS ━━ */}
      <section className="bg-white py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <span className="w-8 h-0.5 bg-corsair-red-500" />
            <span className="text-corsair-red-500 text-xs font-bold uppercase tracking-widest">Real-World Scenario Discussions</span>
          </div>
          <p className="text-sm text-corsair-gray-500 mb-8 max-w-2xl">
            Instructor-led analysis of real security and defensive situations. Each scenario breaks down threat assessment, recommended response, and lessons learned.
          </p>

          <div className="space-y-4">
            {scenarioDiscussions.map((sc, i) => (
              <motion.div
                key={sc.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="border border-corsair-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setExpandedScenario(expandedScenario === sc.id ? null : sc.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-corsair-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-corsair-red-500 uppercase tracking-wider shrink-0">{sc.category}</span>
                    <h3 className="text-sm font-black text-corsair-blue-900">{sc.title}</h3>
                  </div>
                  <svg className={`w-5 h-5 text-corsair-gray-400 transition-transform ${expandedScenario === sc.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                <AnimatePresence>
                  {expandedScenario === sc.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-corsair-gray-100"
                    >
                      <div className="p-5 space-y-6">
                        <div>
                          <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-2">Situation</p>
                          <p className="text-sm text-corsair-gray-600 leading-relaxed">{sc.situation}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-2">Threat Assessment</p>
                            <p className="text-sm text-corsair-gray-600 leading-relaxed">{sc.threatAssessment}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-2">Instructor Analysis</p>
                            <p className="text-sm text-corsair-gray-600 leading-relaxed">{sc.instructorAnalysis}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-2">Recommended Response</p>
                          <p className="text-sm text-corsair-gray-600 leading-relaxed">{sc.recommendedResponse}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-3">Lessons Learned</p>
                            <ul className="space-y-2">
                              {sc.lessonsLearned.map((l, j) => (
                                <li key={j} className="flex items-start gap-2 text-sm text-corsair-gray-600">
                                  <span className="w-1.5 h-1.5 rounded-full bg-corsair-red-500 mt-1.5 shrink-0" />
                                  {l}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-3">Safety Takeaways</p>
                            <ul className="space-y-2">
                              {sc.safetyTakeaways.map((s, j) => (
                                <li key={j} className="flex items-start gap-2 text-sm text-corsair-gray-600">
                                  <span className="w-1.5 h-1.5 rounded-full bg-corsair-blue-500 mt-1.5 shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="bg-corsair-gray-50 rounded-xl p-4">
                          <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-3">Discussion Questions</p>
                          <ul className="space-y-2">
                            {sc.discussionQuestions.map((q, j) => (
                              <li key={j} className="text-sm text-corsair-gray-700 flex items-start gap-2">
                                <span className="font-bold text-corsair-red-500">{j + 1}.</span>
                                {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ DOWNLOADABLE RESOURCES ━━ */}
      <section className="bg-corsair-gray-50 py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <span className="w-8 h-0.5 bg-corsair-red-500" />
            <span className="text-corsair-red-500 text-xs font-bold uppercase tracking-widest">Professional Resources</span>
          </div>
          <p className="text-sm text-corsair-gray-500 mb-8">
            Downloadable guides, checklists, and planning tools for security professionals, church safety teams, and responsible firearm owners.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(cmsDownloads.length > 0
              ? cmsDownloads
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((r) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description ?? '',
                    href: r.fileUrl,
                    format: r.fileFormat ?? 'PDF',
                    size: r.fileSize,
                  }))
              : downloadableResources
            ).map((res, i) => (
              <motion.a
                key={res.id}
                href={res.href}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="group flex items-start gap-4 bg-white rounded-2xl border border-corsair-gray-100 p-5 hover:shadow-md hover:border-corsair-red-200 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-corsair-blue-900 flex items-center justify-center text-white shrink-0 group-hover:bg-corsair-red-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-corsair-blue-900 group-hover:text-corsair-red-500 transition-colors">{res.title}</h3>
                  <p className="text-xs text-corsair-gray-500 mt-1 leading-relaxed">{res.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-corsair-gray-100 text-corsair-gray-500">{res.format}</span>
                    {res.size && <span className="text-[10px] text-corsair-gray-400">{res.size}</span>}
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ CTA FOOTER ━━ */}
      <section className="bg-corsair-blue-900 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-4">Ready to Train with the Best?</h2>
          <p className="text-corsair-gray-300 mb-8 max-w-xl mx-auto">
            Explore our DPS-certified training programs, professional security services, and experienced instructor team.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/security-training" className="inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold px-8 py-3.5 rounded-xl transition-colors">
              Explore Training Programs
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-2 border border-white/20 text-white hover:bg-white/10 font-bold px-8 py-3.5 rounded-xl transition-colors">
              Contact Our Team
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
