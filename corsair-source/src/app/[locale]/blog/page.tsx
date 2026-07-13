import { buildPageMetadata } from '@/lib/seo';
import { getCmsArticles, getCmsDownloads } from '@/lib/cms';
import BlogClient from '@/components/BlogClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return buildPageMetadata({
    path:        '/blog',
    title:       'Corsair Training & Knowledge Center | Security & Firearms Articles',
    description: 'Professional security articles, firearms safety guides, training resources, scenario discussions, and downloadable resources from Corsair Tactical Solutions — Texas DPS-certified instructors since 2010.',
    locale,
    keywords:    ['security training', 'firearms safety', 'church security', 'Texas security', 'defensive shooting', 'security officer training', 'LTC', 'executive protection'],
    image:       '/images/corsair-real/church-safety-specialty-01.png',
  });
}

export default async function BlogIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const [cmsArticles, cmsDownloads] = await Promise.all([
    getCmsArticles(),
    getCmsDownloads(),
  ]);

  return <BlogClient cmsArticles={cmsArticles} cmsDownloads={cmsDownloads} />;
}
