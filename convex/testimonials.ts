import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";
import { recordVersion } from "./lib/recordVersion";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db
      .query("testimonials")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return docs.sort((a, b) => a.order - b.order).map(toResponse);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    name: v.string(),
    role: v.optional(v.string()),
    company: v.optional(v.string()),
    rating: v.optional(v.number()),
    text: v.string(),
    avatarUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, order, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    const count = (await ctx.db.query("testimonials").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("testimonials", {
      siteId,
      order: order ?? count,
      isActive: fields.isActive ?? true,
      ...fields,
    });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "testimonial", page: "Testimonials Manager", newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "testimonial", entityId: id, snapshot: doc });
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    testimonialId: v.id("testimonials"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    company: v.optional(v.string()),
    rating: v.optional(v.number()),
    text: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, testimonialId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.get(testimonialId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.patch(testimonialId, fields);
    const doc = (await ctx.db.get(testimonialId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "testimonial", page: "Testimonials Manager", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "testimonial", entityId: testimonialId, snapshot: doc });
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), testimonialId: v.id("testimonials") },
  handler: async (ctx, { siteId, testimonialId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    const existing = await ctx.db.get(testimonialId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.delete(testimonialId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "testimonial", page: "Testimonials Manager", previousValue: existing });
  },
});
