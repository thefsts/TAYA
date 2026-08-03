import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, checkModuleEnabled, requireModuleEnabled } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return {
    ...doc,
    id: doc._id,
    siteId: doc.siteId,
    createdAt: new Date(doc._creationTime).toISOString(),
    updatedAt: new Date(doc._creationTime).toISOString(),
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
    scheduledAt: doc.scheduledAt ? new Date(doc.scheduledAt).toISOString() : null,
  };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "articles")) return [];
    return (await ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const get = query({
  args: { siteId: v.id("sites"), articleId: v.id("articles") },
  handler: async (ctx, { siteId, articleId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "articles")) return null;
    const doc = await ctx.db.get(articleId);
    if (!doc || doc.siteId !== siteId) return null;
    return toResponse(doc);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    body: v.string(),
    excerpt: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    publishedAt: v.optional(v.string()),
    category: v.optional(v.string()),
    author: v.optional(v.string()),
    readingTime: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    featured: v.optional(v.boolean()),
    scheduledAt: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    socialTitle: v.optional(v.string()),
    socialDescription: v.optional(v.string()),
    socialImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, publishedAt, scheduledAt, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    await requireModuleEnabled(ctx, siteId, "articles");
    const id = await ctx.db.insert("articles", {
      siteId,
      status: "draft",
      publishedAt: publishedAt ? new Date(publishedAt).getTime() : undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : undefined,
      ...fields,
    });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "article", entityId: id, page: "Articles", newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "article", entityId: id, snapshot: doc });
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    articleId: v.id("articles"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    status: v.optional(v.string()),
    body: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    publishedAt: v.optional(v.string()),
    category: v.optional(v.string()),
    author: v.optional(v.string()),
    readingTime: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    featured: v.optional(v.boolean()),
    scheduledAt: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    socialTitle: v.optional(v.string()),
    socialDescription: v.optional(v.string()),
    socialImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, articleId, publishedAt, scheduledAt, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    await requireModuleEnabled(ctx, siteId, "articles");
    const existing = await ctx.db.get(articleId);
    if (!existing || existing.siteId !== siteId) throw new Error("Article not found");
    const patch: Record<string, unknown> = { ...fields };
    if (publishedAt !== undefined) patch.publishedAt = publishedAt ? new Date(publishedAt).getTime() : undefined;
    if (scheduledAt !== undefined) patch.scheduledAt = scheduledAt ? new Date(scheduledAt).getTime() : undefined;
    await ctx.db.patch(articleId, patch as any);
    const doc = (await ctx.db.get(articleId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "article", entityId: articleId, page: "Articles", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "article", entityId: articleId, snapshot: doc });
    if (fields.status === "published" && existing.status !== "published") {
      await ctx.scheduler.runAfter(0, internal.automation.runAutomationRules, {
        siteId,
        triggerType: "article_published",
        triggerPayload: { articleId, title: doc.title, author: doc.author, category: doc.category },
      });
    }
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), articleId: v.id("articles") },
  handler: async (ctx, { siteId, articleId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    await requireModuleEnabled(ctx, siteId, "articles");
    const existing = await ctx.db.get(articleId);
    if (!existing || existing.siteId !== siteId) throw new Error("Article not found");
    await ctx.db.delete(articleId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "article", entityId: articleId, page: "Articles", previousValue: existing });
    return { success: true };
  },
});
