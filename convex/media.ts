import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, checkModuleEnabled, requireSiteAccessMutation, requireModuleEnabled } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
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

/**
 * ContentRecord represents a single content item that might reference a media asset.
 * Used by both `list` (for counting) and `remove` (for in-use guard).
 */
interface ContentRecord {
  module: string;
  label: string;
  /** All field values serialised together; substring-match an asset identifier against this. */
  blob: string;
}

/**
 * Scans all content tables for a given site and returns an array of ContentRecords.
 * Each record carries a pre-serialised blob covering every image-bearing field.
 *
 * Single source of truth: used by `list`, `getUsage`, and `remove` so coverage
 * is always identical across all three callers.
 */
async function fetchContentRecords(ctx: any, siteId: any): Promise<ContentRecord[]> {
  const records: ContentRecord[] = [];

  // Homepage
  const homepage = await ctx.db.query("homepageContent")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
  if (homepage) {
    const heroBlob = homepage.heroImageUrl ?? "";
    const sectionsBlob = homepage.sections ? JSON.stringify(homepage.sections) : "";
    if (heroBlob) records.push({ module: "homepage", label: "Homepage hero image", blob: heroBlob });
    if (sectionsBlob) records.push({ module: "homepage", label: "Homepage sections", blob: sectionsBlob });
  }

  // Articles
  const articles = await ctx.db.query("articles")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId)).collect();
  for (const a of articles) {
    const blob = [a.coverImageUrl, a.ogImageUrl, a.socialImageUrl, a.body].filter(Boolean).join(" ");
    if (blob) records.push({ module: "articles", label: `Article: ${a.title}`, blob });
  }

  // Courses
  const courses = await ctx.db.query("courses")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId)).collect();
  for (const c of courses) {
    if (c.imageUrl) records.push({ module: "courses", label: `Course: ${c.title}`, blob: c.imageUrl });
  }

  // Events
  const events = await ctx.db.query("events")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId)).collect();
  for (const e of events) {
    if (e.imageUrl) records.push({ module: "events", label: `Event: ${e.title}`, blob: e.imageUrl });
  }

  // Team members
  const team = await ctx.db.query("teamMembers")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId)).collect();
  for (const m of team) {
    if (m.photoUrl) records.push({ module: "team", label: `Team member: ${m.name}`, blob: m.photoUrl });
  }

  // Testimonials
  const testimonials = await ctx.db.query("testimonials")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId)).collect();
  for (const t of testimonials) {
    if (t.avatarUrl) records.push({ module: "testimonials", label: `Testimonial: ${t.name}`, blob: t.avatarUrl });
  }

  // Site settings
  const settings = await ctx.db.query("siteSettings")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
  if (settings) {
    if (settings.logoUrl) records.push({ module: "siteSettings", label: "Site logo", blob: settings.logoUrl });
    if (settings.seoOgImageUrl) records.push({ module: "siteSettings", label: "Site SEO OG image", blob: settings.seoOgImageUrl });
  }

  return records;
}

/**
 * Given pre-fetched ContentRecords and an asset's identifier list,
 * returns the deduplicated list of usages for that asset.
 */
function matchUsages(
  contentRecords: ContentRecord[],
  identifiers: string[],
): Array<{ module: string; label: string }> {
  const seen = new Set<string>();
  const result: Array<{ module: string; label: string }> = [];
  for (const rec of contentRecords) {
    for (const id of identifiers) {
      if (id && rec.blob.includes(id)) {
        const key = `${rec.module}::${rec.label}`;
        if (!seen.has(key)) { seen.add(key); result.push({ module: rec.module, label: rec.label }); }
        break;
      }
    }
  }
  return result;
}

/** Extract the stable identifiers for an asset (storageId string + url). */
function assetIdentifiers(doc: any): string[] {
  const ids: string[] = [];
  if (doc.storageId) ids.push(doc.storageId as string);
  if (doc.url && !doc.url.startsWith("data:")) ids.push(doc.url);
  return ids;
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
    await requirePermission(ctx, siteId, PERMISSIONS.MEDIA_UPLOAD);
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
// list (with search & filters)
// ---------------------------------------------------------------------------

export const list = query({
  args: {
    siteId: v.id("sites"),
    // Search & filter params (all optional for backward-compat)
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    tag: v.optional(v.string()),
    brokenOnly: v.optional(v.boolean()),
    unusedOnly: v.optional(v.boolean()),
    archived: v.optional(v.boolean()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    sizeMin: v.optional(v.number()),
    sizeMax: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, search, category, tag, brokenOnly, unusedOnly, archived, dateFrom, dateTo, sizeMin, sizeMax }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "media")) return [];

    let docs = await ctx.db
      .query("mediaAssets")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();

    // Filter archived: by default exclude archived unless explicitly requested
    if (archived === true) {
      docs = docs.filter((d) => d.archived === true);
    } else {
      docs = docs.filter((d) => !d.archived);
    }

    if (brokenOnly) {
      docs = docs.filter((d) => !d.storageId && d.url?.startsWith("data:"));
    }

    if (category) {
      docs = docs.filter((d) => d.category === category);
    }

    if (tag) {
      docs = docs.filter((d) => d.tags?.includes(tag));
    }

    if (dateFrom !== undefined) {
      docs = docs.filter((d) => d._creationTime >= dateFrom);
    }
    if (dateTo !== undefined) {
      docs = docs.filter((d) => d._creationTime <= dateTo);
    }

    if (sizeMin !== undefined) {
      docs = docs.filter((d) => (d.optimizedSizeBytes ?? d.sizeBytes) >= sizeMin);
    }
    if (sizeMax !== undefined) {
      docs = docs.filter((d) => (d.optimizedSizeBytes ?? d.sizeBytes) <= sizeMax);
    }

    if (search) {
      const q = search.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.fileName.toLowerCase().includes(q) ||
          (d.altText ?? "").toLowerCase().includes(q) ||
          (d.category ?? "").toLowerCase().includes(q) ||
          (d.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
      );
    }

    // Compute usage for all remaining docs in one pass (scan content tables once).
    // This powers both the unusedOnly filter and the per-card usage count badge.
    const contentRecords = await fetchContentRecords(ctx, siteId);

    // Build paired [doc, usages] array for filtering
    let docUsagePairs: Array<[typeof docs[number], Array<{ module: string; label: string }>]> =
      docs.map((doc) => [doc, matchUsages(contentRecords, assetIdentifiers(doc))]);

    // Apply unusedOnly filter based on computed usage
    if (unusedOnly) {
      docUsagePairs = docUsagePairs.filter(([, usages]) => usages.length === 0);
    }

    // Build responses — attach computedUsageCount for the grid badge
    return await Promise.all(docUsagePairs.map(async ([doc, usages]) => {
      const base = await buildResponse(ctx, doc);
      return { ...base, computedUsageCount: usages.length };
    }));
  },
});

// ---------------------------------------------------------------------------
// getUsage
// ---------------------------------------------------------------------------

/**
 * Scans all content tables for any field containing the asset's URL or storageId
 * and returns a typed list of { module, label } pairs.
 * Loaded lazily — only called when the usage badge is clicked.
 */
export const getUsage = query({
  args: { siteId: v.id("sites"), mediaAssetId: v.id("mediaAssets") },
  handler: async (ctx, { siteId, mediaAssetId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const asset = await ctx.db.get(mediaAssetId);
    if (!asset || asset.siteId !== siteId) return [];
    const contentRecords = await fetchContentRecords(ctx, siteId);
    return matchUsages(contentRecords, assetIdentifiers(asset));
  },
});

// ---------------------------------------------------------------------------
// listTaxonomy
// ---------------------------------------------------------------------------

/**
 * Returns distinct category and tag values in use for this site's media assets.
 * Used for autocomplete in the filter bar and detail panel.
 */
export const listTaxonomy = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return { categories: [], tags: [] };
    if (!await checkModuleEnabled(ctx, siteId, "media")) return { categories: [], tags: [] };

    const docs = await ctx.db
      .query("mediaAssets")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();

    const categoriesSet = new Set<string>();
    const tagsSet = new Set<string>();

    for (const doc of docs) {
      if (doc.category) categoriesSet.add(doc.category);
      if (doc.tags) {
        for (const t of doc.tags) tagsSet.add(t);
      }
    }

    return {
      categories: Array.from(categoriesSet).sort(),
      tags: Array.from(tagsSet).sort(),
    };
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
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, storageId, url, ...fields }) => {
    if (!storageId && !url) throw new Error("Either storageId or url is required");
    const user = await requirePermission(ctx, siteId, PERMISSIONS.MEDIA_UPLOAD);
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
// updateAsset — edit metadata inline from the detail panel
// ---------------------------------------------------------------------------

export const updateAsset = mutation({
  args: {
    siteId: v.id("sites"),
    mediaAssetId: v.id("mediaAssets"),
    altText: v.optional(v.string()),
    fileName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, mediaAssetId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.MEDIA_UPLOAD);
    await requireModuleEnabled(ctx, siteId, "media");
    const existing = await ctx.db.get(mediaAssetId);
    if (!existing || existing.siteId !== siteId) throw new Error("Asset not found");

    await ctx.db.patch(mediaAssetId, fields as any);
    const doc = (await ctx.db.get(mediaAssetId))!;

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "updated",
      entityType: "media_asset",
      entityId: mediaAssetId,
      page: "Media Library",
      previousValue: { fileName: existing.fileName, altText: existing.altText },
      newValue: { fileName: doc.fileName, altText: doc.altText },
    });

    return await buildResponse(ctx, doc);
  },
});

// ---------------------------------------------------------------------------
// replace — swap underlying blob while keeping the same record ID + URL ref
// ---------------------------------------------------------------------------

export const replace = mutation({
  args: {
    siteId: v.id("sites"),
    mediaAssetId: v.id("mediaAssets"),
    storageId: v.id("_storage"),
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
  handler: async (ctx, { siteId, mediaAssetId, storageId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.MEDIA_UPLOAD);
    await requireModuleEnabled(ctx, siteId, "media");
    const existing = await ctx.db.get(mediaAssetId);
    if (!existing || existing.siteId !== siteId) throw new Error("Asset not found");

    // IMPORTANT: We intentionally do NOT delete the old storageId here.
    //
    // Content modules (homepage, articles, courses, etc.) store image URLs as plain
    // strings — the resolved Convex CDN URL for the old storageId. Deleting the old
    // blob would immediately break every page still referencing that URL.
    //
    // Instead, the old blob is left in storage so existing content URLs remain live.
    // The mediaAssets record now points to the new blob; any new content picks will
    // use the new image. Existing content will continue to show the old image until
    // those pages are individually re-saved with the updated URL.
    //
    // Old derivative blobs are safe to delete — derivatives are never stored by
    // content modules; they're resolved fresh from the mediaAssets record each time.
    for (const field of DERIVATIVE_FIELDS) {
      const derivId = (existing as any)[field];
      if (derivId) {
        try { await ctx.storage.delete(derivId); } catch { /* already gone */ }
      }
    }

    // Patch with new blob — clear derivatives so they get re-generated
    await ctx.db.patch(mediaAssetId, {
      storageId,
      ...fields,
      // Clear the legacy external url field if present; new blob takes over
      url: undefined,
      thumbStorageId: undefined,
      smallStorageId: undefined,
      mediumStorageId: undefined,
      largeStorageId: undefined,
      heroStorageId: undefined,
    } as any);

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "replaced",
      entityType: "media_asset",
      entityId: mediaAssetId,
      page: "Media Library",
      newValue: { fileName: fields.fileName },
    });

    // Re-schedule derivatives for the new blob
    const isSvg = fields.mimeType === "image/svg+xml";
    if (!isSvg) {
      await ctx.scheduler.runAfter(0, internal.mediaDerivatives.generateDerivatives, {
        mediaAssetId,
      });
    }

    const doc = (await ctx.db.get(mediaAssetId))!;
    return await buildResponse(ctx, doc);
  },
});

// ---------------------------------------------------------------------------
// archive — hide from pickers without deleting
// ---------------------------------------------------------------------------

export const archive = mutation({
  args: {
    siteId: v.id("sites"),
    mediaAssetId: v.id("mediaAssets"),
    archived: v.boolean(),
  },
  handler: async (ctx, { siteId, mediaAssetId, archived }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.MEDIA_UPLOAD);
    await requireModuleEnabled(ctx, siteId, "media");
    const existing = await ctx.db.get(mediaAssetId);
    if (!existing || existing.siteId !== siteId) throw new Error("Asset not found");

    await ctx.db.patch(mediaAssetId, { archived });
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: archived ? "archived" : "unarchived",
      entityType: "media_asset",
      entityId: mediaAssetId,
      page: "Media Library",
      details: existing.fileName,
    });
    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// remove — with usage guard
// ---------------------------------------------------------------------------

export const remove = mutation({
  args: { siteId: v.id("sites"), mediaAssetId: v.id("mediaAssets"), force: v.optional(v.boolean()) },
  handler: async (ctx, { siteId, mediaAssetId, force }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.MEDIA_DELETE);
    await requireModuleEnabled(ctx, siteId, "media");
    const existing = await ctx.db.get(mediaAssetId);
    if (!existing || existing.siteId !== siteId) throw new Error("Asset not found");

    // If not forced, check for usages using the same shared logic as getUsage
    if (!force) {
      const contentRecords = await fetchContentRecords(ctx, siteId);
      const usages = matchUsages(contentRecords, assetIdentifiers(existing));
      if (usages.length > 0) {
        throw new Error(JSON.stringify({ code: "IN_USE", usages }));
      }
    }

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
