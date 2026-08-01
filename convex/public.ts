/**
 * Internal queries used by the HTTP public API.
 * No auth required — only reads published/active data.
 */
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getSiteBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});

export const getHomepageBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return null;
    const doc = await ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", site._id)).first();
    if (!doc) return null;
    return { ...doc, id: doc._id, siteId: doc.siteId };
  },
});

export const getFooterBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return null;
    const doc = await ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", site._id)).first();
    if (!doc) return null;
    return { ...doc, id: doc._id, siteId: doc.siteId };
  },
});

export const getContactBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return null;
    const doc = await ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", site._id)).first();
    if (!doc) return null;
    return { ...doc, id: doc._id, siteId: doc.siteId };
  },
});

export const getEventsBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return [];
    const docs = await ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    return docs
      .filter((d) => d.status === "published")
      .map((d) => ({
        ...d,
        id: d._id,
        siteId: d.siteId,
        startAt: new Date(d.startAt).toISOString(),
        endAt: d.endAt ? new Date(d.endAt).toISOString() : null,
      }));
  },
});

export const getCoursesBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return [];
    const docs = await ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    return docs
      .filter((d) => d.status === "published")
      .map((d) => ({ ...d, id: d._id, siteId: d.siteId }));
  },
});

function articleToPublic(d: any) {
  return {
    ...d,
    id: d._id,
    siteId: d.siteId,
    publishedAt: d.publishedAt ? new Date(d.publishedAt).toISOString() : null,
    scheduledAt: d.scheduledAt ? new Date(d.scheduledAt).toISOString() : null,
  };
}

export const getArticlesBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return [];
    const docs = await ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    return docs
      .filter((d) => d.status === "published")
      .sort((a, b) => (b.publishedAt ?? b._creationTime) - (a.publishedAt ?? a._creationTime))
      .map(articleToPublic);
  },
});

export const getArticleByArticleSlug = internalQuery({
  args: { siteSlug: v.string(), articleSlug: v.string() },
  handler: async (ctx, { siteSlug, articleSlug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", siteSlug)).first();
    if (!site) return null;
    const docs = await ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    const doc = docs.find((d) => d.slug === articleSlug && d.status === "published");
    if (!doc) return null;
    return articleToPublic(doc);
  },
});

export const getArticlesForOperon = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return [];
    const docs = await ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    return docs
      .filter((d) => d.status === "published")
      .sort((a, b) => (b.publishedAt ?? b._creationTime) - (a.publishedAt ?? a._creationTime))
      .map((d) => ({
        id: d._id,
        title: d.title,
        slug: d.slug,
        url: site.domain
          ? `https://${site.domain}/blog/${d.slug}`
          : `/blog/${d.slug}`,
        category: d.category ?? null,
        excerpt: d.excerpt ?? null,
        body: d.body,
        featuredImage: d.coverImageUrl ?? null,
        publishedAt: d.publishedAt ? new Date(d.publishedAt).toISOString() : null,
        author: d.author ?? site.name,
        readingTime: d.readingTime ?? null,
        tags: d.tags ?? [],
        featured: d.featured ?? false,
        seo: {
          title: d.seoTitle ?? d.title,
          description: d.metaDescription ?? d.excerpt ?? null,
          ogImage: d.ogImageUrl ?? d.coverImageUrl ?? null,
          canonicalUrl: d.canonicalUrl ?? (site.domain
            ? `https://${site.domain}/blog/${d.slug}`
            : `/blog/${d.slug}`),
        },
        social: {
          title: d.socialTitle ?? d.seoTitle ?? d.title,
          description: d.socialDescription ?? d.metaDescription ?? d.excerpt ?? null,
          image: d.socialImageUrl ?? d.ogImageUrl ?? d.coverImageUrl ?? null,
        },
      }));
  },
});

export const getSeoBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return [];
    const docs = await ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    return docs.map((d) => ({ ...d, id: d._id, siteId: d.siteId }));
  },
});

export const getMediaBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return [];
    const docs = await ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    return await Promise.all(
      docs.map(async (d) => {
        // Resolve storage-backed uploads to a real CDN URL; fall back to legacy url field
        const resolvedUrl = d.storageId
          ? await ctx.storage.getUrl(d.storageId)
          : (d.url ?? null);
        return {
          id: d._id,
          siteId: d.siteId,
          url: resolvedUrl,
          thumbnailUrl: d.thumbnailUrl,
          fileName: d.fileName,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          altText: d.altText,
          width: d.width,
          height: d.height,
        };
      })
    );
  },
});

export const getFaqsBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return [];
    const docs = await ctx.db.query("faqs").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    return docs
      .filter((d) => d.isActive)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, id: d._id, siteId: d.siteId }));
  },
});

export const getTestimonialsBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return [];
    const docs = await ctx.db.query("testimonials").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    return docs
      .filter((d) => d.isActive)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, id: d._id, siteId: d.siteId }));
  },
});

export const getPricingBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!site) return [];
    const docs = await ctx.db.query("pricingTiers").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
    return docs
      .filter((d) => d.isActive)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, id: d._id, siteId: d.siteId }));
  },
});

// ── Phase 2 — New public endpoints ───────────────────────────────────────────

export const getPoliciesBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("policyPages")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs.map((d) => ({ ...d, id: d._id }));
  },
});

export const getNavigationBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("navigationItems")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter((d) => d.isVisible)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, id: d._id }));
  },
});

export const getAnnouncementBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return null;
    const doc = await ctx.db
      .query("announcementBanner")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .first();
    if (!doc || !doc.isEnabled) return null;
    return { ...doc, id: doc._id };
  },
});

export const getCtaBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return null;
    const doc = await ctx.db
      .query("siteCtaConfig")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .first();
    return doc ? { ...doc, id: doc._id } : null;
  },
});

export const getDownloadsBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("downloadableResources")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter((d) => d.isActive)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, id: d._id }));
  },
});

export const getTeamBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("teamMembers")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter((d) => d.isActive)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, id: d._id }));
  },
});

export const getCareersBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("jobPostings")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter((d) => d.isActive)
      .map((d) => ({ ...d, id: d._id }));
  },
});

export const getPopupBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return null;
    const doc = await ctx.db
      .query("popupConfig")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .first();
    if (!doc || !doc.isEnabled) return null;
    return { ...doc, id: doc._id };
  },
});
