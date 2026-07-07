import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString(), updatedAt: new Date(doc._creationTime).toISOString(), publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return (await ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const get = query({
  args: { siteId: v.id("sites"), articleId: v.id("articles") },
  handler: async (ctx, { siteId, articleId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
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
  },
  handler: async (ctx, { siteId, publishedAt, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const id = await ctx.db.insert("articles", { siteId, status: "draft", publishedAt: publishedAt ? new Date(publishedAt).getTime() : undefined, ...fields });
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
  },
  handler: async (ctx, { siteId, articleId, publishedAt, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(articleId);
    if (!existing || existing.siteId !== siteId) throw new Error("Article not found");
    const patch: Record<string, unknown> = { ...fields };
    if (publishedAt !== undefined) patch.publishedAt = publishedAt ? new Date(publishedAt).getTime() : undefined;
    await ctx.db.patch(articleId, patch as any);
    const doc = (await ctx.db.get(articleId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "article", entityId: articleId, page: "Articles", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "article", entityId: articleId, snapshot: doc });
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), articleId: v.id("articles") },
  handler: async (ctx, { siteId, articleId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(articleId);
    if (!existing || existing.siteId !== siteId) throw new Error("Article not found");
    await ctx.db.delete(articleId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "article", entityId: articleId, page: "Articles", previousValue: existing });
    return { success: true };
  },
});
