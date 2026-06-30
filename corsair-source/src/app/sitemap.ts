import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { SITE_URL } from '@/lib/seo';
import { getAllCourses } from '@/lib/courses';

/**
 * Generate a sitemap covering every public page × every locale, plus every
 * course detail page. next-intl middleware handles the locale prefix, so we
 * emit one entry per `/{locale}/{path}`.
 *
 * Each entry also includes hreflang alternates so Google knows this is the
 * same logical page in different languages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Public, indexable paths — excludes confirmation, training-waiver (form page).
  const staticPaths: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '',                              priority: 1.0, changeFrequency: 'weekly' },
    { path: '/about',                        priority: 0.8, changeFrequency: 'monthly' },
    { path: '/careers',                      priority: 0.8, changeFrequency: 'monthly' },
    { path: '/instructors',                  priority: 0.8, changeFrequency: 'monthly' },
    { path: '/courses',                      priority: 0.9, changeFrequency: 'weekly' },
    { path: '/events',                       priority: 0.8, changeFrequency: 'weekly' },
    { path: '/security-services',            priority: 0.8, changeFrequency: 'monthly' },
    { path: '/property-manager-services',    priority: 0.8, changeFrequency: 'monthly' },
    { path: '/church-safety',                priority: 0.8, changeFrequency: 'monthly' },
    { path: '/private-investigations',       priority: 0.8, changeFrequency: 'monthly' },
    { path: '/security-training',            priority: 0.8, changeFrequency: 'monthly' },
    { path: '/faq',                          priority: 0.6, changeFrequency: 'monthly' },
    { path: '/contact',                      priority: 0.8, changeFrequency: 'monthly' },
    { path: '/training-waiver',              priority: 0.4, changeFrequency: 'yearly' },
    // Policy / legal pages — indexable but low priority.
    { path: '/policies',                     priority: 0.3, changeFrequency: 'yearly' },
    { path: '/privacy-policy',               priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms-and-conditions',         priority: 0.3, changeFrequency: 'yearly' },
    { path: '/cookie-policy',                priority: 0.3, changeFrequency: 'yearly' },
    { path: '/refund-cancellation-policy',   priority: 0.3, changeFrequency: 'yearly' },
    { path: '/sms-email-consent-policy',     priority: 0.3, changeFrequency: 'yearly' },
    { path: '/media-release-policy',         priority: 0.3, changeFrequency: 'yearly' },
    { path: '/safety-disclaimer',            priority: 0.3, changeFrequency: 'yearly' },
    { path: '/accessibility-statement',      priority: 0.3, changeFrequency: 'yearly' },
  ];

  // Course detail pages — one per slug, per locale.
  const courseSlugs = getAllCourses().map((c) => c.slug);
  const coursePaths = courseSlugs.map((slug) => ({
    path: `/courses/${slug}`,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
  }));

  const allPaths = [...staticPaths, ...coursePaths];
  const entries: MetadataRoute.Sitemap = [];

  for (const { path, priority, changeFrequency } of allPaths) {
    for (const locale of locales) {
      const url = `${SITE_URL}/${locale}${path}`;
      // hreflang alternates
      const languages: Record<string, string> = {};
      for (const l of locales) {
        languages[l] = `${SITE_URL}/${l}${path}`;
      }
      languages['x-default'] = `${SITE_URL}/en${path}`;

      entries.push({
        url,
        lastModified: now,
        changeFrequency,
        priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
