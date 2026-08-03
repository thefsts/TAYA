import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, checkModuleEnabled, requireModuleEnabled } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString(), updatedAt: new Date(doc._creationTime).toISOString() };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "courses")) return [];
    return (await ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const get = query({
  args: { siteId: v.id("sites"), courseId: v.id("courses") },
  handler: async (ctx, { siteId, courseId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "courses")) return null;
    const doc = await ctx.db.get(courseId);
    if (!doc || doc.siteId !== siteId) return null;
    return toResponse(doc);
  },
});

async function syncCourseMapping(ctx: any, siteId: any, entityId: string, squareItemId: string | undefined) {
  if (!squareItemId) return;
  const catalogItem = await ctx.db.query("squareCatalogItems")
    .withIndex("by_site_squareItemId", (q: any) => q.eq("siteId", siteId).eq("squareItemId", squareItemId))
    .first();
  const existing = await ctx.db.query("squareCatalogMappings")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .filter((q: any) => q.and(q.eq(q.field("entityType"), "course"), q.eq(q.field("entityId"), entityId)))
    .first();
  const patch = { squareItemId, squareVariationId: catalogItem?.squareVariationId };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("squareCatalogMappings", { siteId, entityType: "course", entityId, ...patch });
  }
}

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    description: v.string(),
    durationLabel: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    squareItemId: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CLASSES_MANAGE);
    await requireModuleEnabled(ctx, siteId, "courses");
    const id = await ctx.db.insert("courses", { siteId, status: "draft", ...fields });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "course", entityId: id, page: "Courses", newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "course", entityId: id, snapshot: doc });
    if (fields.squareItemId) await syncCourseMapping(ctx, siteId, id, fields.squareItemId);
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    courseId: v.id("courses"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    status: v.optional(v.string()),
    description: v.optional(v.string()),
    durationLabel: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    squareItemId: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, courseId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CLASSES_MANAGE);
    await requireModuleEnabled(ctx, siteId, "courses");
    const existing = await ctx.db.get(courseId);
    if (!existing || existing.siteId !== siteId) throw new Error("Course not found");
    await ctx.db.patch(courseId, fields as any);
    const doc = (await ctx.db.get(courseId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "course", entityId: courseId, page: "Courses", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "course", entityId: courseId, snapshot: doc });
    if ("squareItemId" in fields) await syncCourseMapping(ctx, siteId, courseId, fields.squareItemId);
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), courseId: v.id("courses") },
  handler: async (ctx, { siteId, courseId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CLASSES_MANAGE);
    await requireModuleEnabled(ctx, siteId, "courses");
    const existing = await ctx.db.get(courseId);
    if (!existing || existing.siteId !== siteId) throw new Error("Course not found");
    await ctx.db.delete(courseId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "course", entityId: courseId, page: "Courses", previousValue: existing });
    return { success: true };
  },
});
