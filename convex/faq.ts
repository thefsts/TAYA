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
      .query("faqs")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return docs.sort((a, b) => a.order - b.order).map(toResponse);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    question: v.string(),
    answer: v.string(),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, order, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    const count = (await ctx.db.query("faqs").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("faqs", {
      siteId,
      order: order ?? count,
      isActive: fields.isActive ?? true,
      ...fields,
    });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "faq", page: "FAQ Manager", newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "faq", entityId: id, snapshot: doc });
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    faqId: v.id("faqs"),
    question: v.optional(v.string()),
    answer: v.optional(v.string()),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, faqId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.get(faqId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.patch(faqId, fields);
    const doc = (await ctx.db.get(faqId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "faq", page: "FAQ Manager", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "faq", entityId: faqId, snapshot: doc });
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), faqId: v.id("faqs") },
  handler: async (ctx, { siteId, faqId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    const existing = await ctx.db.get(faqId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.delete(faqId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "faq", page: "FAQ Manager", previousValue: existing });
  },
});

export const reorder = mutation({
  args: {
    siteId: v.id("sites"),
    orderedIds: v.array(v.id("faqs")),
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
