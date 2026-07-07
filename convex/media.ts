import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString() };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return (await ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    url: v.string(),
    thumbnailUrl: v.optional(v.string()),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    optimizedSizeBytes: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    altText: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const id = await ctx.db.insert("mediaAssets", { siteId, ...fields });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "media_asset", entityId: id, page: "Media Library", newValue: { fileName: doc.fileName, mimeType: doc.mimeType } });
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), mediaAssetId: v.id("mediaAssets") },
  handler: async (ctx, { siteId, mediaAssetId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(mediaAssetId);
    if (!existing || existing.siteId !== siteId) throw new Error("Asset not found");
    await ctx.db.delete(mediaAssetId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "media_asset", entityId: mediaAssetId, page: "Media Library", previousValue: { fileName: existing.fileName } });
    return { success: true };
  },
});
