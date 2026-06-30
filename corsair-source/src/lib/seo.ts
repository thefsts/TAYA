import type { Metadata } from 'next';
import { locales, type Locale } from '@/i18n/config';

/**
 * Site-wide SEO configuration.
 * Override SITE_URL at deploy time via NEXT_PUBLIC_SITE_URL
 * (e.g. https://corsairtacticalsolutions.com).
 *
 * The default is the final production domain so canonical/OG/sitemap
 * URLs remain correct even if the env var is not set. To preview the
 * Vercel deployment with its own canonical URLs, set
 * NEXT_PUBLIC_SITE_URL=https://corsair-tactical-solutions.vercel.app in
 * the Vercel preview environment.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://corsairtacticalsolutions.com';

export const SITE_NAME = 'Corsair Tactical Solutions';
export const SITE_TAGLINE =
  'Professional Security Services & Security Training in Texas';
export const DEFAULT_OG_IMAGE = '/og-default.jpg';
export const TWITTER_HANDLE = '@corsairtactical';

/**
 * Base keywords — kept concise. Individual pages add their own.
 */
export const BASE_KEYWORDS = [
  'Corsair Tactical Solutions',
  'security services Texas',
  'armed security officer Texas',
  'security guard services Dallas',
  'professional security services Texas',
  'Texas firearms training',
  'Texas License to Carry Certification',
  'LTC training Texas',
  'handgun training Texas',
  'defensive handgun training',
  'firearm safety training',
  'private firearms training',
  'security guard training Texas',
  'Level II security training Texas',
  'Level III armed security officer training',
  'Level IV personal protection officer training',
  'private investigations Texas',
  'security services Texas',
  'church safety training',
  'property manager security services',
];

export interface PageSeoInput {
  /** Path of the page *without* locale prefix. e.g. '/about', '/' */
  path: string;
  title: string;
  description: string;
  locale: string;
  keywords?: string[];
  /** OG image path (relative or absolute). Defaults to site logo. */
  image?: string;
  /** If true, appends " | Corsair Tactical Solutions" unless already present */
  appendSiteName?: boolean;
  /** If true, prevents indexing (legal-only pages, etc.) */
  noIndex?: boolean;
  type?: 'website' | 'article';
}

function buildLocalizedPath(locale: string, path: string): string {
  const clean = path === '/' ? '' : path.replace(/^\/+|\/+$/g, '');
  return `/${locale}${clean ? `/${clean}` : ''}`;
}

/**
 * Build a complete Metadata object for a page including canonical,
 * hreflang alternates, OG and Twitter cards.
 */
export function buildPageMetadata(input: PageSeoInput): Metadata {
  const {
    path,
    title,
    description,
    locale,
    keywords = [],
    image = DEFAULT_OG_IMAGE,
    appendSiteName = true,
    noIndex = false,
    type = 'website',
  } = input;

  const fullTitle =
    appendSiteName && !title.includes(SITE_NAME)
      ? `${title} | ${SITE_NAME}`
      : title;

  const canonicalPath = buildLocalizedPath(locale, path);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  // Build hreflang alternates for every locale on the same page.
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${SITE_URL}${buildLocalizedPath(l, path)}`;
  }
  // x-default points to English version for search engines.
  languages['x-default'] = `${SITE_URL}${buildLocalizedPath('en', path)}`;

  const ogImage = image.startsWith('http') ? image : `${SITE_URL}${image}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: fullTitle,
    description,
    keywords: [...BASE_KEYWORDS, ...keywords].slice(0, 25),
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: canonicalUrl,
      locale,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
  };
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function localeUrl(locale: string, path: string): string {
  return `${SITE_URL}${buildLocalizedPath(locale, path)}`;
}

export const ALL_LOCALES: readonly Locale[] = locales;
