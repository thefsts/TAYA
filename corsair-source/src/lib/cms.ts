/**
 * CMS client — fetches public content from Convex for this site.
 *
 * All functions are safe to call in Next.js Server Components (async fetch).
 * Each function returns typed data or a sensible fallback on error so
 * a Convex outage never breaks the live website.
 */

const CONVEX_URL =
  process.env.CONVEX_URL ??
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  "https://clean-marlin-94.convex.cloud";

const SITE_SLUG = "corsair-tactical";

async function cmsGet<T>(resource: string): Promise<T | null> {
  try {
    const url = `${CONVEX_URL}/api/public/${resource}?slug=${SITE_SLUG}`;
    const res = await fetch(url, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: { revalidate: 60 } as any,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function cmsList<T>(resource: string): Promise<T[]> {
  const result = await cmsGet<T[]>(resource);
  return Array.isArray(result) ? result : [];
}

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface CmsHomepage {
  heroHeadline: string;
  heroSubheadline: string;
  heroImageUrl?: string;
  sections: unknown[];
}

export interface CmsFooterLink {
  label: string;
  href: string;
}

export interface CmsFooterColumn {
  heading: string;
  links: CmsFooterLink[];
}

export interface CmsFooterSocialLink {
  platform: string;
  url: string;
}

export interface CmsFooter {
  columns: CmsFooterColumn[];
  socialLinks: CmsFooterSocialLink[];
  copyrightText: string;
}

export interface CmsContact {
  email: string;
  phone: string;
  address: string;
  mapEmbedUrl?: string;
  hours: Record<string, string>;
}

export interface CmsEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  startAt: string; // ISO string
  endAt: string | null;
  location?: string;
  imageUrl?: string;
  status: string;
}

export interface CmsCourse {
  id: string;
  title: string;
  slug: string;
  description: string;
  durationLabel?: string;
  priceCents?: number;
  imageUrl?: string;
  squareItemId?: string;
  status: string;
}

export interface CmsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  publishedAt: string | null;
  status: string;
}

export interface CmsSeoSetting {
  pagePath: string;
  title: string;
  description: string;
  ogImageUrl?: string;
  canonicalUrl?: string;
}

/* ─── Fetch helpers ─────────────────────────────────────────────────────── */

export function getCmsHomepage() {
  return cmsGet<CmsHomepage>("homepage");
}

export function getCmsFooter() {
  return cmsGet<CmsFooter>("footer");
}

export function getCmsContact() {
  return cmsGet<CmsContact>("contact");
}

export function getCmsEvents() {
  return cmsList<CmsEvent>("events");
}

export function getCmsCourses() {
  return cmsList<CmsCourse>("courses");
}

export function getCmsArticles() {
  return cmsList<CmsArticle>("articles");
}

export function getCmsSeo() {
  return cmsList<CmsSeoSetting>("seo");
}

export function getCmsFaqs() {
  return cmsList<{ id: string; question: string; answer: string; order: number }>("faqs");
}

export function getCmsTestimonials() {
  return cmsList<{
    id: string;
    name: string;
    role?: string;
    company?: string;
    rating?: number;
    text: string;
    avatarUrl?: string;
  }>("testimonials");
}

export function getCmsPricing() {
  return cmsList<{
    id: string;
    planName: string;
    price?: string;
    interval?: string;
    description?: string;
    features: string[];
    isHighlighted: boolean;
    ctaLabel: string;
    ctaUrl?: string;
  }>("pricing");
}

/**
 * Submit a form entry to the dashboard inbox.
 * Safe to call from server components or API routes.
 * Never throws — returns true on success, false on failure.
 */
export async function submitFormToCms(payload: {
  formType: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const res = await fetch(`${CONVEX_URL}/api/public/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SITE_SLUG, ...payload }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ─── Group B types (need new functions) ───────────────────────────────── */

export interface CmsTeamMember {
  id: string;
  name: string;
  role?: string;
  bio?: string;
  photoUrl?: string;
  credentials?: string[];
  order?: number;
  externalUrl?: string;
}

export interface CmsDownload {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileFormat?: string;
  fileSize?: string;
  category?: string;
  order?: number;
}

export interface CmsAnnouncement {
  text: string;
  bgColor?: string;
  isEnabled: boolean;
  link?: string;
}

export interface CmsCta {
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
  headline?: string;
  subheadline?: string;
}

export interface CmsPolicy {
  type: string;
  title: string;
  content: string;
  lastUpdated?: string;
}

/* Helper that allows extra query params alongside slug */
async function cmsGetWithParams<T>(
  resource: string,
  params: Record<string, string>,
): Promise<T | null> {
  try {
    const searchParams = new URLSearchParams({ slug: SITE_SLUG, ...params });
    const url = `${CONVEX_URL}/api/public/${resource}?${searchParams.toString()}`;
    const res = await fetch(url, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: { revalidate: 60 } as any,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getCmsTeam() {
  return cmsList<CmsTeamMember>("team");
}

export function getCmsDownloads() {
  return cmsList<CmsDownload>("downloads");
}

export function getCmsAnnouncement() {
  return cmsGet<CmsAnnouncement>("announcement");
}

export function getCmsCta() {
  return cmsGet<CmsCta>("cta");
}

export async function getCmsPolicy(type: string): Promise<CmsPolicy | null> {
  const all = await cmsList<CmsPolicy & { type?: string; policyType?: string }>("policies");
  return all.find((p) => p.type === type || p.policyType === type) ?? null;
}

/* ─── Mappers: Convex → Corsair website shapes ──────────────────────────── */

/**
 * Maps a CmsEvent (from Convex) to the CorsairEvent shape expected
 * by the Corsair events page. Unknown fields get sensible defaults.
 */
export function cmsEventToCorsairEvent(e: CmsEvent) {
  const start = new Date(e.startAt);
  const isPast = start.getTime() < Date.now();

  const dateDisplay = start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const time =
    start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " CT";

  return {
    id: e.id,
    title: e.title,
    slug: e.slug,
    date: e.startAt.slice(0, 10),
    dateDisplay,
    time,
    location: e.location ?? "Texas",
    category: "Security Training" as const,
    shortDescription: e.description.slice(0, 200),
    description: e.description,
    heroImage:
      e.imageUrl ?? "/images/corsair-real/classroom-training-group-01.jpg",
    flyerImage: undefined as string | undefined,
    galleryImages: undefined as string[] | undefined,
    registrationUrl: `/events/${e.slug}`,
    contactCta: "Register Now",
    isPast,
  };
}
