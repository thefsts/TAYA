import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";
import { recordVersion } from "./lib/recordVersion";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, updatedAt: new Date(doc._creationTime).toISOString() };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return (await ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    pagePath: v.string(),
    title: v.string(),
    description: v.string(),
    ogImageUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const id = await ctx.db.insert("seoSettings", { siteId, ...fields });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "seo_setting", entityId: id, page: "SEO Settings", newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "seo_setting", entityId: id, snapshot: doc });
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    seoSettingId: v.id("seoSettings"),
    pagePath: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, seoSettingId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(seoSettingId);
    if (!existing || existing.siteId !== siteId) throw new Error("SEO setting not found");
    await ctx.db.patch(seoSettingId, fields as any);
    const doc = (await ctx.db.get(seoSettingId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "seo_setting", entityId: seoSettingId, page: "SEO Settings", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "seo_setting", entityId: seoSettingId, snapshot: doc });
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), seoSettingId: v.id("seoSettings") },
  handler: async (ctx, { siteId, seoSettingId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(seoSettingId);
    if (!existing || existing.siteId !== siteId) throw new Error("SEO setting not found");
    await ctx.db.delete(seoSettingId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "seo_setting", entityId: seoSettingId, page: "SEO Settings", previousValue: existing });
    return { success: true };
  },
});
