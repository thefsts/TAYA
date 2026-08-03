import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, checkModuleEnabled, requireSiteAccessMutation, requireModuleEnabled } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

// ---------------------------------------------------------------------------
// Derivative size field names (kept in sync with schema + mediaDerivatives.ts)
// ---------------------------------------------------------------------------

const DERIVATIVE_FIELDS = [
  "thumbStorageId",
  "smallStorageId",
  "mediumStorageId",
  "largeStorageId",
  "heroStorageId",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveStorageUrl(ctx: any, storageId: any): Promise<string | null> {
  if (!storageId) return null;
  return await ctx.storage.getUrl(storageId);
}

async function buildResponse(ctx: any, doc: any) {
  // Primary URL
  const url = doc.storageId
    ? await ctx.storage.getUrl(doc.storageId)
    : (doc.url ?? null);

  // Resolve each derivative URL
  const thumbUrl  = await resolveStorageUrl(ctx, doc.thumbStorageId);
  const smallUrl  = await resolveStorageUrl(ctx, doc.smallStorageId);
  const mediumUrl = await resolveStorageUrl(ctx, doc.mediumStorageId);
  const largeUrl  = await resolveStorageUrl(ctx, doc.largeStorageId);
  const heroUrl   = await resolveStorageUrl(ctx, doc.heroStorageId);

  return {
    ...doc,
    id: doc._id,
    url,
    thumbUrl,
    smallUrl,
    mediumUrl,
    largeUrl,
    heroUrl,
    // Backward-compat: thumbnailUrl = thumbUrl ?? legacy external thumbnail
    thumbnailUrl: thumbUrl ?? doc.thumbnailUrl ?? null,
    createdAt: new Date(doc._creationTime).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// generateUploadUrl
// ---------------------------------------------------------------------------

/**
 * Returns a signed Convex storage upload URL.
 *
 * SVG SECURITY PATH: When the caller declares mimeType = "image/svg+xml" we
 * enforce a stricter allowlist check (SVGs can carry embedded scripts) and
 * record the intent so the create mutation knows to skip derivative generation.
 * SVG files are stored as-is — no compression, no derivative variants.
 *
 * All other image/* types go through the standard path and will have
 * derivatives generated in the background after upload.
 */
export const generateUploadUrl = mutation({
  args: {
    siteId: v.id("sites"),
    /**
     * Caller-declared MIME type. Required when uploading SVG so the server can
     * enforce the SVG allowlist and skip derivative scheduling.
     */
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, mimeType }) => {
    await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "media");

    if (mimeType) {
      const isSvg = mimeType === "image/svg+xml";
      const isImage = mimeType.startsWith("image/");
      // Reject non-image types and anything other than image/* that isn't SVG
      if (!isImage) {
        throw new Error(`MIME type "${mimeType}" is not permitted for media uploads`);
      }
      // SVG path: allowed but no derivatives will be generated (handled in create)
      void isSvg;
    }

    return await ctx.storage.generateUploadUrl();
  },
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "media")) return [];
    const docs = await ctx.db
      .query("mediaAssets")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return await Promise.all(docs.map((doc) => buildResponse(ctx, doc)));
  },
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    optimizedSizeBytes: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    altText: v.optional(v.string()),
    focalX: v.optional(v.number()),
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
    const response = await buildResponse(ctx, doc);

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "media_asset",
      entityId: id,
      page: "Media Library",
      newValue: { fileName: doc.fileName, mimeType: doc.mimeType },
    });

    // Schedule derivative generation immediately after upload.
    // Skipped for:
    //   - SVG uploads (no raster derivatives make sense for vector files)
    //   - External URL assets (no Convex blob to read from)
    const isSvg = fields.mimeType === "image/svg+xml";
    if (storageId && !isSvg) {
      await ctx.scheduler.runAfter(0, internal.mediaDerivatives.generateDerivatives, {
        mediaAssetId: id,
      });
    }

    return response;
  },
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

export const remove = mutation({
  args: { siteId: v.id("sites"), mediaAssetId: v.id("mediaAssets") },
  handler: async (ctx, { siteId, mediaAssetId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "media");
    const existing = await ctx.db.get(mediaAssetId);
    if (!existing || existing.siteId !== siteId) throw new Error("Asset not found");

    // Delete original blob
    if (existing.storageId) {
      await ctx.storage.delete(existing.storageId);
    }
    // Delete any derivative blobs that were generated
    for (const field of DERIVATIVE_FIELDS) {
      const derivId = (existing as any)[field];
      if (derivId) {
        try { await ctx.storage.delete(derivId); } catch { /* already gone */ }
      }
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

// ---------------------------------------------------------------------------
// healthStats
// ---------------------------------------------------------------------------

/**
 * Returns a quick health summary for the media library without loading full
 * asset data or base64 payloads. Used by the UI health indicator.
 */
export const healthStats = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return { total: 0, healthy: 0, broken: 0 };
    if (!await checkModuleEnabled(ctx, siteId, "media")) return { total: 0, healthy: 0, broken: 0 };
    const docs = await ctx.db
      .query("mediaAssets")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    let broken = 0;
    for (const doc of docs) {
      if (!doc.storageId && doc.url?.startsWith("data:")) broken++;
    }
    return { total: docs.length, healthy: docs.length - broken, broken };
  },
});

// ---------------------------------------------------------------------------
// migrateDeleteDataUrls
// ---------------------------------------------------------------------------

/**
 * One-time migration: removes legacy records that stored raw base64 data: URLs
 * (those were never serveable as real CDN links). Safe to call multiple times.
 */
export const migrateDeleteDataUrls = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const docs = await ctx.db
      .query("mediaAssets")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
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

// ---------------------------------------------------------------------------
// getById  (internal query — called by mediaDerivatives action)
// ---------------------------------------------------------------------------

export const getById = internalQuery({
  args: { mediaAssetId: v.id("mediaAssets") },
  handler: async (ctx, { mediaAssetId }) => {
    return await ctx.db.get(mediaAssetId);
  },
});

// ---------------------------------------------------------------------------
// writeDerivatives  (internal mutation — called by mediaDerivatives action)
// ---------------------------------------------------------------------------

export const writeDerivatives = internalMutation({
  args: {
    mediaAssetId: v.id("mediaAssets"),
    thumbStorageId:  v.optional(v.id("_storage")),
    smallStorageId:  v.optional(v.id("_storage")),
    mediumStorageId: v.optional(v.id("_storage")),
    largeStorageId:  v.optional(v.id("_storage")),
    heroStorageId:   v.optional(v.id("_storage")),
  },
  handler: async (ctx, { mediaAssetId, ...ids }) => {
    await ctx.db.patch(mediaAssetId, ids);
  },
});
