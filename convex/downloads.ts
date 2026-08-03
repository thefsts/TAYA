import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id };
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
