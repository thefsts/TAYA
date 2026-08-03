import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db
      .query("siteServices")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return docs.sort((a, b) => a.order - b.order).map(toResponse);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    shortDescription: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    price: v.optional(v.string()),
    duration: v.optional(v.string()),
    category: v.optional(v.string()),
    isVisible: v.optional(v.boolean()),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, isVisible, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const count = (await ctx.db.query("siteServices").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("siteServices", {
      siteId,
      isVisible: isVisible ?? true,
      order: count,
      ...fields,
    });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "service", page: "Services Manager", details: fields.title });
    const doc = (await ctx.db.get(id))!;
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    serviceId: v.id("siteServices"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    price: v.optional(v.string()),
    duration: v.optional(v.string()),
    category: v.optional(v.string()),
    isVisible: v.optional(v.boolean()),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, serviceId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(serviceId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.patch(serviceId, fields);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "service", page: "Services Manager", details: existing.title });
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), serviceId: v.id("siteServices") },
  handler: async (ctx, { siteId, serviceId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(serviceId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.delete(serviceId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "service", page: "Services Manager", details: existing.title });
  },
});

export const reorder = mutation({
  args: {
    siteId: v.id("sites"),
    orderedIds: v.array(v.id("siteServices")),
  },
  handler: async (ctx, { siteId, orderedIds }) => {
    await requireSiteAccessMutation(ctx, siteId);
    for (let i = 0; i < orderedIds.length; i++) {
      const doc = await ctx.db.get(orderedIds[i]);
      if (doc && doc.siteId === siteId) {
        await ctx.db.patch(orderedIds[i], { order: i });
      }
    }
  },
});
