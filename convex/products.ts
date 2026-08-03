import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    return ctx.db
      .query("siteProducts")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
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
    priceCents: v.optional(v.number()),
    priceLabel: v.optional(v.string()),
    category: v.optional(v.string()),
    isVisible: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    // Determine next order value
    const existing = await ctx.db
      .query("siteProducts")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    const order = existing.length;
    const id = await ctx.db.insert("siteProducts", {
      siteId,
      order,
      isVisible: fields.isVisible ?? true,
      ...fields,
    });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "product",
      entityId: id,
      page: "Products",
      newValue: doc,
    });
    await recordVersion(ctx, {
      siteId,
      actorName: user.name,
      entityType: "product",
      entityId: id,
      snapshot: doc,
    });
    return doc;
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    productId: v.id("siteProducts"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    priceLabel: v.optional(v.string()),
    category: v.optional(v.string()),
    isVisible: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, productId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(productId);
    if (!existing || existing.siteId !== siteId) throw new Error("Product not found");
    await ctx.db.patch(productId, fields as any);
    const doc = (await ctx.db.get(productId))!;
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "updated",
      entityType: "product",
      entityId: productId,
      page: "Products",
      previousValue: existing,
      newValue: doc,
    });
    await recordVersion(ctx, {
      siteId,
      actorName: user.name,
      entityType: "product",
      entityId: productId,
      snapshot: doc,
    });
    return doc;
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), productId: v.id("siteProducts") },
  handler: async (ctx, { siteId, productId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(productId);
    if (!existing || existing.siteId !== siteId) throw new Error("Product not found");
    await ctx.db.delete(productId);
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "deleted",
      entityType: "product",
      entityId: productId,
      page: "Products",
      previousValue: existing,
    });
    return { success: true };
  },
});

export const reorder = mutation({
  args: {
    siteId: v.id("sites"),
    orderedIds: v.array(v.id("siteProducts")),
  },
  handler: async (ctx, { siteId, orderedIds }) => {
    await requireSiteAccessMutation(ctx, siteId);
    // Fetch and validate every product belongs to this site before patching
    const docs = await Promise.all(orderedIds.map((id) => ctx.db.get(id)));
    for (const doc of docs) {
      if (!doc || doc.siteId !== siteId) {
        throw new Error("One or more products do not belong to this site");
      }
    }
    await Promise.all(
      orderedIds.map((id, idx) => ctx.db.patch(id, { order: idx }))
    );
    return { success: true };
  },
});
