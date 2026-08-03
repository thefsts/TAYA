/**
 * FSTS-WOS™ — Parameterized Client Site Seeder
 *
 * Replaces the need to write a bespoke seeder for every new client.
 * Supply a `ClientSeedConfig` JSON object and a `siteId`, and this
 * seeder will populate all 13 content tables in the correct order.
 *
 * Usage (from your workspace):
 *
 *   npx convex run seedClient:seedClientSite '{
 *     "siteId": "<convex-site-id>",
 *     "config": { ... }   ← paste your ClientSeedConfig JSON here
 *   }'
 *
 * For a complete config template, see:
 *   docs/CLIENT_SEED_CONFIG_TEMPLATE.json
 *
 * For the original Corsair-specific implementation that inspired this
 * template, see:
 *   convex/seedCorsair.ts  ← reference example, do not modify
 *
 * IMPORTANT: These are `internalMutation` / `internalAction` — they can
 * NEVER be called from the browser client. They do not weaken the security
 * model of the dashboard.
 */

import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// TypeScript type for the config object (for authoring new configs)
// ---------------------------------------------------------------------------

export interface ClientSeedConfig {
  /** Step 1 — Branding & site identity */
  branding: {
    businessName: string;
    tagline: string;
    logoUrl: string;
    faviconUrl: string;
    /**
     * Convex `websiteType` enum value, e.g. "training_academy", "gym",
     * "salon", "consulting", "restaurant". Use "general" when unsure.
     */
    websiteType: string;
    /** IANA timezone string, e.g. "America/New_York" */
    timezone: string;
    /** Hex color, e.g. "#1A3A52" */
    brandColorPrimary: string;
    /** Hex color for secondary surfaces */
    brandColorSecondary: string;
    /** Hex accent / call-to-action color */
    brandColorAccent: string;
    fontHeading: string;
    fontBody: string;
    phone: string;
    email: string;
    address: string;
  };

  /** Step 2 — Homepage hero + feature sections */
  homepage: {
    heroHeadline: string;
    heroSubheadline: string;
    heroImageUrl: string;
    /** Array of page sections. Each section must have a `type` field.
     *  The "features" section type is the most common; it renders a grid
     *  of icon + title + body cards. */
    sections: Array<{
      type: string;
      headline?: string;
      items?: Array<{
        icon?: string;
        title: string;
        body: string;
      }>;
      [key: string]: unknown;
    }>;
  };

  /** Step 3 — Navigation menu items, in display order */
  navigation: Array<{
    label: string;
    /** Relative path, e.g. "/" or "/courses" */
    href: string;
    /** Display order (0-based integer) */
    order: number;
    isVisible?: boolean;
    openInNewTab?: boolean;
  }>;

  /** Step 4 — Footer columns + social links */
  footer: {
    columns: Array<{
      heading: string;
      links: Array<{ label: string; href: string }>;
    }>;
    socialLinks: Array<{
      /** "facebook" | "instagram" | "youtube" | "twitter" | "linkedin" | "tiktok" */
      platform: string;
      url: string;
    }>;
    copyrightText: string;
  };

  /** Step 5 — Contact information */
  contact: {
    email: string;
    phone: string;
    address: string;
    mapEmbedUrl?: string;
    hours: Array<{
      day: string;
      /** "HH:MM" 24-hour string, or null if closed */
      open: string | null;
      close: string | null;
    }>;
  };

  /** Step 6 — SEO metadata for key pages (≥3 records recommended) */
  seo: Array<{
    /** Relative path, e.g. "/" or "/courses" */
    pagePath: string;
    /** Page <title> — keep under 60 characters */
    title: string;
    /** Meta description — 120–160 characters */
    description: string;
    /** OG image URL (1200×630px recommended) */
    ogImageUrl?: string;
    /** Full canonical URL, e.g. "https://example.com/courses" */
    canonicalUrl: string;
  }>;

  /** Step 7 — Blog / article content (≥1 published article required) */
  articles: Array<{
    title: string;
    /** URL-safe slug, e.g. "getting-started-guide" */
    slug: string;
    /** "published" | "draft" */
    status: "published" | "draft";
    excerpt: string;
    /** Markdown body */
    body: string;
    coverImageUrl?: string;
    /**
     * Milliseconds offset from now. Use negative values for past dates.
     * e.g. -7 * 24 * 60 * 60 * 1000 for "1 week ago"
     */
    publishedAtOffsetMs?: number;
    category?: string;
    author?: string;
    readingTime?: string;
    tags?: string[];
    featured?: boolean;
    seoTitle?: string;
    metaDescription?: string;
  }>;

  /** Step 8 — Course catalog (≥1 published course with priceCents required) */
  courses: Array<{
    title: string;
    slug: string;
    status: "published" | "draft";
    description: string;
    durationLabel?: string;
    /** Price in cents, e.g. 24900 for $249.00 */
    priceCents?: number;
    imageUrl?: string;
  }>;

  /** Step 9 — Upcoming events (≥1 with a future date required) */
  events: Array<{
    title: string;
    slug: string;
    status: "published" | "draft";
    description: string;
    /**
     * Days from now for the event start.
     * e.g. 14 = "two weeks from today"
     */
    startAtDaysFromNow: number;
    /** Duration of the event in hours */
    durationHours: number;
    location?: string;
    imageUrl?: string;
  }>;

  /** Step 10 — Client testimonials (≥3 required for launch) */
  testimonials: Array<{
    name: string;
    role?: string;
    company?: string;
    /** 1–5 */
    rating: number;
    text: string;
    isActive?: boolean;
    order?: number;
  }>;

  /** Step 11 — Email sender identity (Resend API key is NOT stored here) */
  emailConfig: {
    fromName: string;
    /** Must match the client's verified domain, e.g. "noreply@example.com" */
    fromEmail: string;
    replyToEmail: string;
    notificationEmail: string;
    notifyOnNewLead?: boolean;
    notifyOnBooking?: boolean;
  };

  /** Step 12 — Client portal configuration */
  portalConfig: {
    enabled: boolean;
    registrationOpen: boolean;
    requireApproval: boolean;
    logoUrl?: string;
    primaryColor: string;
    welcomeMessage: string;
    enabledFeatures?: {
      courseMaterials?: boolean;
      certificates?: boolean;
      bookingHistory?: boolean;
      messaging?: boolean;
    };
  };

  /**
   * Step 13 — Google review source + seed reviews.
   * Set placeId to "PENDING_<slug>" if the real Place ID isn't available yet.
   */
  reviews: {
    provider: "google" | "yelp";
    placeId: string;
    businessName: string;
    sampleReviews: Array<{
      reviewerName: string;
      /** 1–5 */
      rating: number;
      text: string;
      /** How many days ago the review was posted */
      daysAgo: number;
      pinned?: boolean;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Step mutations — one per content table
// ---------------------------------------------------------------------------

export const seedBranding = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const b = config as ClientSeedConfig["branding"];

    await ctx.db.patch(siteId, {
      logoUrl: b.logoUrl,
      faviconUrl: b.faviconUrl,
      brandColorPrimary: b.brandColorPrimary,
      brandColorSecondary: b.brandColorSecondary,
    });

    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const identityData = {
      siteId,
      businessName: b.businessName,
      tagline: b.tagline,
      logoUrl: b.logoUrl,
      faviconUrl: b.faviconUrl,
      websiteType: b.websiteType,
      timezone: b.timezone,
      brandColorPrimary: b.brandColorPrimary,
      brandColorSecondary: b.brandColorSecondary,
      brandColorAccent: b.brandColorAccent,
      fontHeading: b.fontHeading,
      fontBody: b.fontBody,
      phone: b.phone,
      email: b.email,
      address: b.address,
      identityUpdatedAt: Date.now(),
      brandingUpdatedAt: Date.now(),
      contactUpdatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, identityData);
    } else {
      await ctx.db.insert("siteSettings", identityData);
    }

    return { ok: true, step: "branding" };
  },
});

export const seedHomepage = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const h = config as ClientSeedConfig["homepage"];

    const existing = await ctx.db
      .query("homepageContent")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const heroData = {
      heroHeadline: h.heroHeadline,
      heroSubheadline: h.heroSubheadline,
      heroImageUrl: h.heroImageUrl,
      sections: h.sections,
    };

    if (existing) {
      await ctx.db.patch(existing._id, heroData);
    } else {
      await ctx.db.insert("homepageContent", { siteId, ...heroData });
    }

    return { ok: true, step: "homepage" };
  },
});

export const seedNavigation = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const navItems = config as ClientSeedConfig["navigation"];

    // Remove any existing nav items (idempotent)
    const existing = await ctx.db
      .query("navigationItems")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const item of existing) await ctx.db.delete(item._id);

    for (const item of navItems) {
      await ctx.db.insert("navigationItems", {
        siteId,
        label: item.label,
        href: item.href,
        order: item.order,
        isVisible: item.isVisible ?? true,
        openInNewTab: item.openInNewTab ?? false,
      });
    }

    return { ok: true, step: "navigation", count: navItems.length };
  },
});

export const seedFooter = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const f = config as ClientSeedConfig["footer"];

    const existing = await ctx.db
      .query("footerContent")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const footerData = {
      columns: f.columns,
      socialLinks: f.socialLinks,
      copyrightText: f.copyrightText,
    };

    if (existing) {
      await ctx.db.patch(existing._id, footerData);
    } else {
      await ctx.db.insert("footerContent", { siteId, ...footerData });
    }

    return { ok: true, step: "footer" };
  },
});

export const seedContactInfo = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const c = config as ClientSeedConfig["contact"];

    const existing = await ctx.db
      .query("contactInfo")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const contactData = {
      email: c.email,
      phone: c.phone,
      address: c.address,
      ...(c.mapEmbedUrl ? { mapEmbedUrl: c.mapEmbedUrl } : {}),
      hours: c.hours,
    };

    if (existing) {
      await ctx.db.patch(existing._id, contactData);
    } else {
      await ctx.db.insert("contactInfo", { siteId, ...contactData });
    }

    return { ok: true, step: "contact" };
  },
});

export const seedSeo = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const seoPages = config as ClientSeedConfig["seo"];

    // Remove old SEO records (idempotent)
    const existing = await ctx.db
      .query("seoSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const r of existing) await ctx.db.delete(r._id);

    for (const seo of seoPages) {
      await ctx.db.insert("seoSettings", { siteId, ...seo });
    }

    return { ok: true, step: "seo", count: seoPages.length };
  },
});

export const seedArticles = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const articles = config as ClientSeedConfig["articles"];

    const existing = await ctx.db
      .query("articles")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const a of existing) await ctx.db.delete(a._id);

    const now = Date.now();
    for (const article of articles) {
      const { publishedAtOffsetMs, ...rest } = article;
      await ctx.db.insert("articles", {
        siteId,
        ...rest,
        publishedAt: now + (publishedAtOffsetMs ?? 0),
      });
    }

    return { ok: true, step: "articles", count: articles.length };
  },
});

export const seedCourses = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const courses = config as ClientSeedConfig["courses"];

    const existing = await ctx.db
      .query("courses")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const c of existing) await ctx.db.delete(c._id);

    for (const course of courses) {
      await ctx.db.insert("courses", { siteId, ...course });
    }

    return { ok: true, step: "courses", count: courses.length };
  },
});

export const seedEvents = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const events = config as ClientSeedConfig["events"];

    const existing = await ctx.db
      .query("events")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    for (const event of events) {
      const { startAtDaysFromNow, durationHours, ...rest } = event;
      const startAt = now + startAtDaysFromNow * DAY;
      const endAt = startAt + durationHours * 60 * 60 * 1000;
      await ctx.db.insert("events", { siteId, startAt, endAt, ...rest });
    }

    return { ok: true, step: "events", count: events.length };
  },
});

export const seedTestimonials = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const testimonials = config as ClientSeedConfig["testimonials"];

    const existing = await ctx.db
      .query("testimonials")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const t of existing) await ctx.db.delete(t._id);

    for (let i = 0; i < testimonials.length; i++) {
      const t = testimonials[i];
      await ctx.db.insert("testimonials", {
        siteId,
        name: t.name,
        role: t.role ?? "",
        company: t.company ?? "",
        rating: t.rating,
        text: t.text,
        isActive: t.isActive ?? true,
        order: t.order ?? i,
      });
    }

    return { ok: true, step: "testimonials", count: testimonials.length };
  },
});

export const seedEmailConfig = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const e = config as ClientSeedConfig["emailConfig"];

    const existing = await ctx.db
      .query("emailSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const emailData = {
      fromName: e.fromName,
      fromEmail: e.fromEmail,
      replyToEmail: e.replyToEmail,
      notificationEmail: e.notificationEmail,
      notifyOnNewLead: e.notifyOnNewLead ?? true,
      notifyOnBooking: e.notifyOnBooking ?? true,
      // resendApiKey intentionally omitted — client must supply their own
      // Resend API key via Dashboard → Email Config (Section 14b of the
      // WEBSITE_ONBOARDING_CHECKLIST.md)
    };

    if (existing) {
      await ctx.db.patch(existing._id, emailData);
    } else {
      await ctx.db.insert("emailSettings", { siteId, ...emailData });
    }

    return {
      ok: true,
      step: "email",
      warning:
        "resendApiKey NOT set — client must configure via dashboard before live email delivery works",
    };
  },
});

export const seedPortalConfig = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const p = config as ClientSeedConfig["portalConfig"];

    const existing = await ctx.db
      .query("portalConfigs")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const portalData = {
      siteId,
      enabled: p.enabled,
      registrationOpen: p.registrationOpen,
      requireApproval: p.requireApproval,
      ...(p.logoUrl ? { logoUrl: p.logoUrl } : {}),
      primaryColor: p.primaryColor,
      welcomeMessage: p.welcomeMessage,
      enabledFeatures: {
        courseMaterials: p.enabledFeatures?.courseMaterials ?? true,
        certificates: p.enabledFeatures?.certificates ?? true,
        bookingHistory: p.enabledFeatures?.bookingHistory ?? true,
        messaging: p.enabledFeatures?.messaging ?? false,
      },
    };

    if (existing) {
      await ctx.db.patch(existing._id, portalData);
    } else {
      await ctx.db.insert("portalConfigs", portalData);
    }

    return { ok: true, step: "portalConfig" };
  },
});

export const seedReviews = internalMutation({
  args: { siteId: v.id("sites"), config: v.any() },
  handler: async (ctx, { siteId, config }) => {
    const r = config as ClientSeedConfig["reviews"];

    const existingSource = await ctx.db
      .query("reviewSources")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const sourceData = {
      siteId,
      provider: r.provider,
      config: {
        placeId: r.placeId,
        businessName: r.businessName,
      },
      autoRefresh: false,
      refreshIntervalHours: 24,
      status: "active" as const,
    };

    let sourceId: Id<"reviewSources">;

    if (existingSource) {
      // Upsert: always apply latest config so a pending placeId can be
      // updated to the real one on re-run (and a provider change is
      // reflected immediately).
      await ctx.db.patch(existingSource._id, sourceData);
      sourceId = existingSource._id;
    } else {
      sourceId = await ctx.db.insert("reviewSources", sourceData);
    }

    // Replace existing sample reviews (idempotent)
    const existingReviews = await ctx.db
      .query("importedReviews")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const rev of existingReviews) await ctx.db.delete(rev._id);

    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (let i = 0; i < r.sampleReviews.length; i++) {
      const rev = r.sampleReviews[i];
      await ctx.db.insert("importedReviews", {
        siteId,
        sourceId: sourceId!,
        provider: r.provider,
        externalId: `${r.provider}-review-seed-${String(i + 1).padStart(3, "0")}`,
        reviewerName: rev.reviewerName,
        rating: rev.rating,
        text: rev.text,
        reviewDate: now - rev.daysAgo * DAY,
        status: "approved",
        pinned: rev.pinned ?? i === 0,
        cachedAt: now,
      });
    }

    return { ok: true, step: "reviews", count: r.sampleReviews.length };
  },
});

// ---------------------------------------------------------------------------
// Master seeder — accepts a full ClientSeedConfig and runs all 13 steps
// ---------------------------------------------------------------------------

export const seedClientSite = internalAction({
  args: {
    siteId: v.id("sites"),
    /**
     * Full ClientSeedConfig JSON object.
     * See docs/CLIENT_SEED_CONFIG_TEMPLATE.json for a complete example.
     */
    config: v.any(),
  },
  handler: async (ctx, { siteId, config }) => {
    const c = config as ClientSeedConfig;
    const results: Record<string, unknown> = {};

    async function run(name: string, fn: () => Promise<unknown>) {
      try {
        results[name] = await fn();
        console.log(`✅ ${name}:`, JSON.stringify(results[name]));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results[name] = { error: message };
        console.error(`❌ ${name}:`, message);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = (internal as any).seedClient;

    await run("branding", () =>
      ctx.runMutation(sc.seedBranding, { siteId, config: c.branding })
    );
    await run("homepage", () =>
      ctx.runMutation(sc.seedHomepage, { siteId, config: c.homepage })
    );
    await run("navigation", () =>
      ctx.runMutation(sc.seedNavigation, { siteId, config: c.navigation })
    );
    await run("footer", () =>
      ctx.runMutation(sc.seedFooter, { siteId, config: c.footer })
    );
    await run("contact", () =>
      ctx.runMutation(sc.seedContactInfo, { siteId, config: c.contact })
    );
    await run("seo", () =>
      ctx.runMutation(sc.seedSeo, { siteId, config: c.seo })
    );
    await run("articles", () =>
      ctx.runMutation(sc.seedArticles, { siteId, config: c.articles })
    );
    await run("courses", () =>
      ctx.runMutation(sc.seedCourses, { siteId, config: c.courses })
    );
    await run("events", () =>
      ctx.runMutation(sc.seedEvents, { siteId, config: c.events })
    );
    await run("testimonials", () =>
      ctx.runMutation(sc.seedTestimonials, { siteId, config: c.testimonials })
    );
    await run("email", () =>
      ctx.runMutation(sc.seedEmailConfig, { siteId, config: c.emailConfig })
    );
    await run("portal", () =>
      ctx.runMutation(sc.seedPortalConfig, { siteId, config: c.portalConfig })
    );
    await run("reviews", () =>
      ctx.runMutation(sc.seedReviews, { siteId, config: c.reviews })
    );

    const failed = Object.entries(results).filter(
      ([, v]: [string, unknown]) => (v as { error?: string })?.error
    );

    return {
      success: failed.length === 0,
      failed: failed.length,
      results,
    };
  },
});
