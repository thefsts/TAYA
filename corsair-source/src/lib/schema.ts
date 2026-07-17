import { SITE_URL, SITE_NAME, absoluteUrl } from './seo';

const LOGO_URL = absoluteUrl('/corsair-logo.png');
const SAME_AS = [
  'https://www.instagram.com/corsairtacticalsolution?igsh=MTd1MmhkZzZtaWh2MQ==',
  'https://www.facebook.com/share/17iPFcVg7j/',
  'https://www.tiktok.com/@stevehopwood0',
  'https://youtube.com/@corsairtacticalsolutions9474?si=4ds7s4wshyFwg4fe',
];

/**
 * Organization schema — used in root/homepage.
 */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: 'Corsair Tactical',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: LOGO_URL,
      width: 512,
      height: 512,
    },
    sameAs: SAME_AS,
    description:
      'Veteran-owned Texas firearms training, License to Carry certification, security guard training, and professional security services.',
  };
}

/**
 * LocalBusiness schema — the business behind the organization.
 */
export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#localbusiness`,
    name: SITE_NAME,
    url: SITE_URL,
    image: LOGO_URL,
    logo: LOGO_URL,
    priceRange: '$$',
    areaServed: [
      { '@type': 'State', name: 'Texas' },
      { '@type': 'Country', name: 'United States' },
    ],
    address: {
      '@type': 'PostalAddress',
      addressRegion: 'TX',
      addressCountry: 'US',
    },
    sameAs: SAME_AS,
    makesOffer: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Texas License to Carry Certification',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Defensive Handgun Training',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Security Guard Training (Level II, III, IV)',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Private Investigations',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Property Manager Security Services',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Church Safety Training',
        },
      },
    ],
  };
}

/**
 * WebSite schema — enables sitelinks search box for Google.
 */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/en/courses?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : absoluteUrl(item.url),
    })),
  };
}

export interface CourseSchemaInput {
  name: string;
  description: string;
  url: string;
  image?: string;
  price?: number;
  priceCurrency?: string;
  duration?: string; // ISO 8601 e.g. "PT6H"
  category?: string;
}

export function courseSchema(input: CourseSchemaInput) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: input.name,
    description: input.description,
    url: input.url.startsWith('http') ? input.url : absoluteUrl(input.url),
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
      sameAs: SITE_URL,
    },
  };
  if (input.image) {
    base.image = input.image.startsWith('http') ? input.image : absoluteUrl(input.image);
  }
  if (input.category) base.courseCode = input.category;
  if (typeof input.price === 'number') {
    base.offers = {
      '@type': 'Offer',
      price: input.price,
      priceCurrency: input.priceCurrency ?? 'USD',
      availability: 'https://schema.org/InStock',
      url: base.url,
      category: 'Paid',
    };
  }
  if (input.duration) {
    base.timeRequired = input.duration;
  }
  // Required for Google rich results
  base.hasCourseInstance = {
    '@type': 'CourseInstance',
    courseMode: 'Blended',
    courseWorkload: input.duration ?? 'PT6H',
  };
  return base;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
}

export interface EventSchemaInput {
  name: string;
  description: string;
  startDate: string; // ISO
  endDate?: string;
  location: string;
  url: string;
  image?: string;
  isPast?: boolean;
}

export function eventSchema(input: EventSchemaInput) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    description: input.description,
    startDate: input.startDate,
    eventStatus: input.isPast
      ? 'https://schema.org/EventScheduled'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: input.location,
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'TX',
        addressCountry: 'US',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    url: input.url.startsWith('http') ? input.url : absoluteUrl(input.url),
  };
  if (input.endDate) data.endDate = input.endDate;
  if (input.image) {
    data.image = input.image.startsWith('http')
      ? input.image
      : absoluteUrl(input.image);
  }
  return data;
}
