import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, checkModuleEnabled, requireSiteAccessMutation, requireModuleEnabled } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

async function resolveUrl(ctx: any, doc: any): Promise<string | null> {
  if (doc.storageId) {
    return await ctx.storage.getUrl(doc.storageId);
  }
  return doc.url ?? null;
}

function toResponse(doc: any, resolvedUrl: string | null) {
  return {
    ...doc,
    id: doc._id,
    siteId: doc.siteId,
    url: resolvedUrl,
    createdAt: new Date(doc._creationTime).toISOString(),
  };
}

export const generateUploadUrl = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "media");
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "media")) return [];
    const docs = await ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return await Promise.all(
      docs.map(async (doc) => toResponse(doc, await resolveUrl(ctx, doc)))
    );
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    // New path: Convex File Storage
    storageId: v.optional(v.id("_storage")),
    // Legacy / URL tab path
    url: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    optimizedSizeBytes: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    altText: v.optional(v.string()),
    /** Normalized focal point X (0–1). Stored for CSS object-position. */
    focalX: v.optional(v.number()),
    /** Normalized focal point Y (0–1). Stored for CSS object-position. */
    focalY: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, storageId, url, ...fields }) => {
    if (!storageId && !url) throw new Error("Either storageId or url is required");
    const user = await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "media");
    const id = await ctx.db.insert("mediaAssets", {
      siteId,
      ...(storageId ? { storageId } : {}),
      ...(url ? { url } : {}),
      ...fields,
    });
    const doc = (await ctx.db.get(id))!;
    const resolvedUrl = await resolveUrl(ctx, doc);
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "media_asset",
      entityId: id,
      page: "Media Library",
      newValue: { fileName: doc.fileName, mimeType: doc.mimeType },
    });
    return toResponse(doc, resolvedUrl);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), mediaAssetId: v.id("mediaAssets") },
  handler: async (ctx, { siteId, mediaAssetId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "media");
    const existing = await ctx.db.get(mediaAssetId);
    if (!existing || existing.siteId !== siteId) throw new Error("Asset not found");
    // Delete from Convex File Storage if applicable
    if (existing.storageId) {
      await ctx.storage.delete(existing.storageId);
    }
    await ctx.db.delete(mediaAssetId);
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "deleted",
      entityType: "media_asset",
      entityId: mediaAssetId,
      page: "Media Library",
      previousValue: { fileName: existing.fileName },
    });
    return { success: true };
  },
});

/**
 * Returns a quick health summary for the media library without loading full
 * asset data or base64 payloads. Used by the UI health indicator.
 */
export const healthStats = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return { total: 0, healthy: 0, broken: 0 };
    if (!await checkModuleEnabled(ctx, siteId, "media")) return { total: 0, healthy: 0, broken: 0 };
    const docs = await ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    let broken = 0;
    for (const doc of docs) {
      if (!doc.storageId && doc.url?.startsWith("data:")) broken++;
    }
    return { total: docs.length, healthy: docs.length - broken, broken };
  },
});

/**
 * One-time migration: removes legacy records that stored raw base64 data: URLs
 * (those were never serveable as real CDN links). Safe to call multiple times.
 */
export const migrateDeleteDataUrls = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const docs = await ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    let deleted = 0;
    for (const doc of docs) {
      if (doc.url?.startsWith("data:")) {
        await ctx.db.delete(doc._id);
        deleted++;
      }
    }
    if (deleted > 0) {
      await logActivity(ctx, {
        siteId,
        actorName: user.name,
        action: "migrated",
        entityType: "media_asset",
        entityId: siteId,
        page: "Media Library",
        details: `Removed ${deleted} legacy base64 data-URL records that could not be served`,
      });
    }
    return { deleted };
  },
});
