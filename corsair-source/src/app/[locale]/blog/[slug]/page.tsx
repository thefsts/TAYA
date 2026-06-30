import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';
import {
  getBlogArticle,
  getAllBlogSlugs,
  blogArticles,
  trainingVideos,
  getRelatedArticles,
  getRelatedVideosForArticle,
  getRelatedCoursesForArticle,
  getRelatedServicesForArticle,
} from '@/lib/blog';
import ScrollReveal from '@/components/ScrollReveal';
import ArticleClient from '@/components/ArticleClient';
import ReadingProgress from '@/components/ReadingProgress';

export async function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const article = getBlogArticle(slug);
  if (!article) {
    return buildPageMetadata({ path: `/blog/${slug}`, title: 'Article Not Found', description: '', locale, noIndex: true });
  }
  return buildPageMetadata({
    path:        `/blog/${slug}`,
    title:       `${article.title} | Corsair Training & Knowledge Center`,
    description: article.description,
    locale,
    image:       article.image,
    keywords:    [article.category, article.topic, 'Texas security', 'Corsair Tactical Solutions', 'security training', 'firearms safety'],
  });
}

const CATEGORY_STYLES: Record<string, { badge: string; dot: string }> = {
  'Church Safety':      { badge: 'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-blue-500' },
  'Business Security':  { badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  'Security Training':  { badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  'License to Carry':   { badge: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
};

const POPULAR_TOPICS = [
  { label: 'Church Safety',     href: '/church-security' },
  { label: 'Security Training', href: '/security-training' },
  { label: 'LTC Information',   href: '/courses/texas-ltc-certification-basic-handgun' },
  { label: 'Workplace Safety',  href: '/security-services' },
];

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const article = getBlogArticle(slug);
  if (!article) notFound();

  const tn = await getTranslations('nav');
  const catStyle = CATEGORY_STYLES[article.category] ?? { badge: 'bg-gray-50 text-gray-700 border-gray-200', dot: 'bg-gray-400' };

  // Related content
  const relatedArticles = getRelatedArticles(slug, 3);
  const relatedVideos   = getRelatedVideosForArticle(slug, 2);
  const relatedCourses  = getRelatedCoursesForArticle(slug);
  const relatedServices = getRelatedServicesForArticle(slug);

  return (
    <>
      {/* Breadcrumbs JSON-LD schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.corsairtacticalsolutions.com/' },
              { '@type': 'ListItem', position: 2, name: 'Training & Knowledge Center', item: 'https://www.corsairtacticalsolutions.com/blog' },
              { '@type': 'ListItem', position: 3, name: article.title, item: `https://www.corsairtacticalsolutions.com/blog/${slug}` },
            ],
          }),
        }}
      />

      {/* Article JSON-LD schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: article.title,
            description: article.description,
            image: article.image,
            author: {
              '@type': 'Organization',
              name: 'Corsair Tactical Solutions',
              url: 'https://www.corsairtacticalsolutions.com/about',
            },
            publisher: {
              '@type': 'Organization',
              name: 'Corsair Tactical Solutions',
              logo: { '@type': 'ImageObject', url: 'https://www.corsairtacticalsolutions.com/images/corsair-logo.png' },
            },
            datePublished: article.date,
            mainEntityOfPage: { '@type': 'WebPage', '@id': `https://www.corsairtacticalsolutions.com/blog/${slug}` },
          }),
        }}
      />

      <ReadingProgress />

      <ArticleClient>
        {/* Hero */}
        <section className="bg-corsair-blue-950">
          <div className="relative h-[220px] sm:h-[300px] md:h-[480px] overflow-hidden">
            <Image
              src={article.image}
              alt={article.imageAlt}
              fill
              className="object-cover object-center"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-corsair-blue-950 via-corsair-blue-950/60 to-transparent hidden md:block" />
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-corsair-blue-950 to-transparent md:hidden" />

            {/* Desktop overlay */}
            <div className="absolute inset-x-0 bottom-0 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 hidden md:block">
              <div className="flex items-center gap-2 mb-4 text-xs text-white/60">
                <Link href="/" className="hover:text-white transition-colors">{tn('home')}</Link>
                <span>/</span>
                <Link href="/blog" className="hover:text-white transition-colors">Training & Knowledge Center</Link>
                <span>/</span>
                <span className="text-white/80">{article.category}</span>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border mb-4 ${catStyle.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                {article.category}
              </span>
              <h1 className="text-2xl md:text-4xl font-black text-white leading-tight max-w-3xl">
                {article.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-sm text-white/60">
                <span className="font-semibold text-white/80">Corsair Tactical Solutions</span>
                <span aria-hidden>·</span>
                <time dateTime={article.date}>{article.date}</time>
                <span aria-hidden>·</span>
                <span>{article.readTime}</span>
              </div>
            </div>
          </div>

          {/* Mobile content */}
          <div className="bg-corsair-blue-900 px-4 py-5 sm:px-6 md:hidden">
            <Link href="/blog" className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors mb-4">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              All Articles
            </Link>
            <div className="mb-3">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${catStyle.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                {article.category}
              </span>
            </div>
            <h1 className="text-xl font-black text-white leading-tight mb-3">{article.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
              <span className="font-semibold text-white/70">Corsair Tactical Solutions</span>
              <span aria-hidden>·</span>
              <time dateTime={article.date}>{article.date}</time>
              <span aria-hidden>·</span>
              <span>{article.readTime}</span>
            </div>
          </div>
        </section>

        {/* Body + Sidebar */}
        <ScrollReveal direction="none">
          <section className="bg-white py-14">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-14">
                <article>
                  {/* Lead */}
                  <p className="text-lg text-corsair-gray-600 leading-relaxed mb-8 pb-8 border-b border-corsair-gray-100 font-medium">
                    {article.description}
                  </p>

                  {/* Sections */}
                  <div className="space-y-1">
                    {article.body.map((section, i) => {
                      if (section.type === 'heading') {
                        return <h2 key={i} className="text-xl md:text-2xl font-black text-corsair-blue-900 pt-8 pb-3 first:pt-0">{section.heading}</h2>;
                      }
                      if (section.type === 'paragraph') {
                        return <p key={i} className="text-corsair-gray-600 leading-[1.85] mb-5 text-[1.0125rem]">{section.text}</p>;
                      }
                      if (section.type === 'bullets') {
                        return (
                          <div key={i} className="my-6 bg-corsair-gray-50 rounded-2xl p-6 border border-corsair-gray-100">
                            {section.heading && <p className="font-black text-corsair-blue-900 mb-4 text-sm uppercase tracking-wide">{section.heading}</p>}
                            <ul className="space-y-3">
                              {(section.items ?? []).map((item, j) => (
                                <li key={j} className="flex items-start gap-3 text-corsair-gray-700 text-sm leading-relaxed">
                                  <span className="w-5 h-5 rounded-full bg-corsair-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  </span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      }
                      if (section.type === 'callout') {
                        return (
                          <div key={i} className="my-8 border-l-4 border-corsair-red-500 bg-corsair-blue-900 rounded-r-2xl pl-6 pr-6 py-5">
                            <svg className="w-6 h-6 text-corsair-red-400 mb-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                            </svg>
                            <p className="text-corsair-gray-200 leading-relaxed text-[1.0125rem] italic">{section.text}</p>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* Article CTA */}
                  <div className="mt-12 p-7 bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-black text-corsair-blue-900 mb-1">Ready to Take the Next Step?</h3>
                        <p className="text-corsair-gray-500 text-sm">No pressure. Our team responds within one business day.</p>
                      </div>
                      <Link href={article.cta.href} className="shrink-0 inline-flex items-center gap-2 bg-corsair-red-500 hover:bg-corsair-red-600 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm whitespace-nowrap">
                        {article.cta.label} →
                      </Link>
                    </div>
                  </div>

                  {/* Related Services */}
                  {relatedServices.length > 0 && (
                    <div className="mt-8 p-6 bg-white border border-corsair-gray-100 rounded-2xl">
                      <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-4">Related Services & Resources</p>
                      <div className="flex flex-wrap gap-3">
                        {relatedServices.map((svc) => (
                          <Link key={svc.href} href={svc.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-corsair-blue-900 hover:text-corsair-red-500 bg-corsair-gray-50 hover:bg-corsair-red-50 border border-corsair-gray-200 hover:border-corsair-red-200 px-4 py-2 rounded-xl transition-all">
                            {svc.label}
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Courses */}
                  {relatedCourses.length > 0 && (
                    <div className="mt-8 p-6 bg-corsair-blue-900 rounded-2xl text-white">
                      <p className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest mb-4">Related Training Courses</p>
                      <div className="space-y-3">
                        {relatedCourses.map((c) => (
                          <Link key={c.href} href={c.href} className="flex items-center justify-between group">
                            <span className="text-sm font-semibold group-hover:text-corsair-red-400 transition-colors">{c.label}</span>
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-corsair-red-400 group-hover:text-white transition-colors">
                              {c.cta}
                              <svg className="w-3.5 h-3.5 translate-x-0 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Videos */}
                  {relatedVideos.length > 0 && (
                    <div className="mt-8">
                      <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-4">Related Videos</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {relatedVideos.map((v) => (
                          <div key={v.id} className="bg-corsair-gray-50 rounded-xl border border-corsair-gray-100 overflow-hidden">
                            <div className="relative aspect-video bg-corsair-gray-200 flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-corsair-red-500 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                              </div>
                              <span className="absolute bottom-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/50 text-white">{v.duration}</span>
                            </div>
                            <div className="p-3">
                              <p className="text-xs font-black text-corsair-blue-900 leading-snug">{v.title}</p>
                              <p className="text-[10px] text-corsair-gray-400 mt-0.5">{v.category}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Articles */}
                  {relatedArticles.length > 0 && (
                    <div className="mt-10 pt-8 border-t border-corsair-gray-100">
                      <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-4">Related Articles</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {relatedArticles.map((ra) => {
                          const rs = CATEGORY_STYLES[ra.category] ?? { badge: 'bg-gray-50 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
                          return (
                            <Link key={ra.slug} href={`/blog/${ra.slug}`} className="group block bg-corsair-gray-50 rounded-xl border border-corsair-gray-100 overflow-hidden hover:border-corsair-red-200 transition-all">
                              <div className="relative aspect-[3/2] overflow-hidden">
                                <Image src={ra.image} alt={ra.imageAlt} fill className="object-cover object-top group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" />
                              </div>
                              <div className="p-3">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${rs.badge}`}>
                                  <span className={`w-1 h-1 rounded-full ${rs.dot}`} />
                                  {ra.category}
                                </span>
                                <p className="text-xs font-black text-corsair-blue-900 group-hover:text-corsair-red-500 transition-colors mt-1 leading-snug line-clamp-2">{ra.title}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Back to blog */}
                  <div className="mt-8 pt-8 border-t border-corsair-gray-100">
                    <Link href="/blog" className="inline-flex items-center gap-2 text-corsair-gray-500 hover:text-corsair-blue-900 font-semibold text-sm transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      Back to All Articles
                    </Link>
                  </div>
                </article>

                {/* Sidebar */}
                <aside className="space-y-6 lg:sticky lg:top-28 lg:h-fit">
                  {/* Author */}
                  <div className="bg-corsair-blue-900 rounded-2xl p-5 text-white">
                    <p className="text-xs font-bold text-corsair-red-400 uppercase tracking-widest mb-3">Written By</p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-corsair-red-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">CTS</div>
                      <div>
                        <p className="font-black text-sm">Corsair Tactical Solutions</p>
                        <p className="text-xs text-corsair-gray-400">Security Professionals</p>
                      </div>
                    </div>
                    <p className="text-xs text-corsair-gray-300 leading-relaxed">DPS-licensed, veteran-founded security company serving North Texas since 2010.</p>
                  </div>

                  {/* Popular Topics */}
                  <div className="bg-white rounded-2xl border border-corsair-gray-100 shadow-sm p-5">
                    <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-4">Popular Topics</p>
                    <nav className="space-y-1">
                      {POPULAR_TOPICS.map((topic) => (
                        <Link key={topic.href} href={topic.href} className="group flex items-center justify-between py-2 px-3 rounded-xl text-sm font-semibold text-corsair-gray-700 hover:bg-corsair-red-50 hover:text-corsair-red-600 transition-colors">
                          {topic.label}
                          <svg className="w-3.5 h-3.5 text-corsair-gray-300 group-hover:text-corsair-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      ))}
                    </nav>
                  </div>

                  {/* Recent Articles */}
                  {relatedArticles.length > 0 && (
                    <div className="bg-white rounded-2xl border border-corsair-gray-100 shadow-sm p-5">
                      <p className="text-xs font-bold text-corsair-gray-400 uppercase tracking-widest mb-4">More Articles</p>
                      <div className="space-y-4">
                        {relatedArticles.map((r) => (
                          <Link key={r.slug} href={`/blog/${r.slug}`} className="group flex gap-3 items-start">
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-corsair-gray-100">
                              <Image src={r.image} alt={r.imageAlt} fill className="object-cover object-top group-hover:scale-110 transition-transform duration-300" sizes="56px" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-corsair-blue-900 group-hover:text-corsair-red-500 transition-colors leading-snug line-clamp-2">{r.title}</p>
                              <p className="text-xs text-corsair-gray-400 mt-1">{r.readTime}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  <div className="bg-corsair-gray-50 border border-corsair-gray-200 rounded-2xl p-5 text-center">
                    <p className="font-bold text-corsair-blue-900 text-sm mb-1">Questions?</p>
                    <a href="tel:+12143356652" className="block text-corsair-red-500 font-black text-xl hover:text-corsair-red-600 transition-colors">214-335-6652</a>
                    <p className="text-xs text-corsair-gray-400 mt-1">Mon – Sat, 8 AM – 6 PM CT</p>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </ArticleClient>
    </>
  );
}
