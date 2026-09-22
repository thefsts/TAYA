import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireModuleEnabled } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id };
}

/** Human-readable size label derived from upload byte count (e.g. "2.4 MB"). */
function formatSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db
      .query("downloadableResources")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return docs.sort((a, b) => a.order - b.order).map(toResponse);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    format: v.optional(v.string()),
    sizeLabel: v.optional(v.string()),
    category: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, isActive, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    const count = (await ctx.db.query("downloadableResources").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("downloadableResources", {
      siteId,
      isActive: isActive ?? true,
      order: count,
      ...fields,
    });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "download", page: "Downloads Manager", details: fields.title });
    const doc = (await ctx.db.get(id))!;
    return toResponse(doc);
  },
});

// Chat D (client website management completion) — PDF upload support.
//   generateUploadUrl: gates the upload the same way the record creation is
//     gated (CONTENT_CREATE + downloads module enabled) and only accepts
//     application/pdf. The media module's upload URL stays image-only; PDFs
//     belong to the Downloads module, next to the resource records that
//     present them.
export const generateUploadUrl = mutation({
  args: {
    siteId: v.id("sites"),
    /** Caller-declared MIME type — must be application/pdf. */
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, mimeType }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    await requireModuleEnabled(ctx, siteId, "downloads");
    if (mimeType !== undefined && mimeType !== "application/pdf") {
      throw new Error(`MIME type "${mimeType}" is not permitted for downloads uploads (PDF only)`);
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// createFromStorage: completes a PDF upload. Resolves the Convex storage URL
//   for the uploaded blob, derives format/sizeLabel server-side, and inserts
//   the downloadableResources row — CONTENT_CREATE, same tier as create().
export const createFromStorage = mutation({
  args: {
    siteId: v.id("sites"),
    storageId: v.id("_storage"),
    title: v.string(),
    description: v.optional(v.string()),
    fileName: v.string(),
    sizeBytes: v.number(),
    category: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, storageId, sizeBytes, isActive, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    await requireModuleEnabled(ctx, siteId, "downloads");
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Uploaded file could not be found — try again.");
    const count = (await ctx.db.query("downloadableResources").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("downloadableResources", {
      siteId,
      storageId,
      url,
      title: fields.title,
      description: fields.description,
      format: "PDF",
      sizeLabel: formatSizeLabel(sizeBytes) || undefined,
      category: fields.category,
      isActive: isActive ?? true,
      order: count,
    });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "download", page: "Downloads Manager", details: fields.title });
    const doc = (await ctx.db.get(id))!;
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    resourceId: v.id("downloadableResources"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    format: v.optional(v.string()),
    sizeLabel: v.optional(v.string()),
    category: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, resourceId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.get(resourceId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    // Chat D: storage-backed resources keep their uploaded file. Editing the
    // file means deleting and re-uploading the resource; a manual URL edit
    // would desync the record from its blob (and orphan storage).
    if (existing.storageId && fields.url !== undefined && fields.url !== existing.url) {
      throw new Error("This resource uses an uploaded file — delete and re-upload it to replace the file.");
    }
    await ctx.db.patch(resourceId, fields);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "download", page: "Downloads Manager", details: existing.title });
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), resourceId: v.id("downloadableResources") },
  handler: async (ctx, { siteId, resourceId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    const existing = await ctx.db.get(resourceId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    // Chat D: delete the uploaded blob too when this resource was storage-backed
    // (external-URL resources leave the external file untouched).
    if (existing.storageId) {
      try { await ctx.storage.delete(existing.storageId); } catch { /* already gone */ }
    }
    await ctx.db.delete(resourceId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "download", page: "Downloads Manager", details: existing.title });
  },
});

export const reorder = mutation({
  args: {
    siteId: v.id("sites"),
    orderedIds: v.array(v.id("downloadableResources")),
  },
  handler: async (ctx, { siteId, orderedIds }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    for (let i = 0; i < orderedIds.length; i++) {
      const doc = await ctx.db.get(orderedIds[i]);
      if (doc && doc.siteId === siteId) {
        await ctx.db.patch(orderedIds[i], { order: i });
      }
    }
  },
});
