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
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return null;
    const doc = await ctx.db
      .query("homepageContent")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .first();
    if (!doc) return null;
    return { ...doc, id: doc._id, siteId: doc.siteId };
  },
});

export const getFooterBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return null;
    const doc = await ctx.db
      .query("footerContent")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .first();
    if (!doc) return null;
    return { ...doc, id: doc._id, siteId: doc.siteId };
  },
});

export const getContactBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return null;
    const doc = await ctx.db
      .query("contactInfo")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .first();
    if (!doc) return null;
    return { ...doc, id: doc._id, siteId: doc.siteId };
  },
});

export const getEventsBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("events")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
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
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("courses")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
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
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("articles")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter((d) => d.status === "published")
      .sort((a, b) => (b.publishedAt ?? b._creationTime) - (a.publishedAt ?? a._creationTime))
      .map(articleToPublic);
  },
});

export const getArticleByArticleSlug = internalQuery({
  args: { siteSlug: v.string(), articleSlug: v.string() },
  handler: async (ctx, { siteSlug, articleSlug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", siteSlug))
      .first();
    if (!site) return null;
    const docs = await ctx.db
      .query("articles")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    const doc = docs.find((d) => d.slug === articleSlug && d.status === "published");
    if (!doc) return null;
    return articleToPublic(doc);
  },
});

export const getArticlesForOperon = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("articles")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter((d) => d.status === "published")
      .sort((a, b) => (b.publishedAt ?? b._creationTime) - (a.publishedAt ?? a._creationTime))
      .map((d) => ({
        id: d._id,
        title: d.title,
        slug: d.slug,
        url: `https://www.corsairtacticalsolutions.com/blog/${d.slug}`,
        category: d.category ?? null,
        excerpt: d.excerpt ?? null,
        body: d.body,
        featuredImage: d.coverImageUrl ?? null,
        publishedAt: d.publishedAt ? new Date(d.publishedAt).toISOString() : null,
        author: d.author ?? "Corsair Tactical Solutions",
        readingTime: d.readingTime ?? null,
        tags: d.tags ?? [],
        featured: d.featured ?? false,
        seo: {
          title: d.seoTitle ?? d.title,
          description: d.metaDescription ?? d.excerpt ?? null,
          ogImage: d.ogImageUrl ?? d.coverImageUrl ?? null,
          canonicalUrl: d.canonicalUrl ?? `https://www.corsairtacticalsolutions.com/blog/${d.slug}`,
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
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("seoSettings")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs.map((d) => ({ ...d, id: d._id, siteId: d.siteId }));
  },
});

export const getMediaBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("mediaAssets")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs.map((d) => ({
      id: d._id,
      siteId: d.siteId,
      url: d.url,
      thumbnailUrl: d.thumbnailUrl,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      altText: d.altText,
      width: d.width,
      height: d.height,
    }));
  },
});

export const getFaqsBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("faqs")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter((d) => d.isActive)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, id: d._id, siteId: d.siteId }));
  },
});

export const getTestimonialsBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("testimonials")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter((d) => d.isActive)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, id: d._id, siteId: d.siteId }));
  },
});

export const getPricingBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return [];
    const docs = await ctx.db
      .query("pricingTiers")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter((d) => d.isActive)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ ...d, id: d._id, siteId: d.siteId }));
  },
});
