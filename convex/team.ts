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
      .query("teamMembers")
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
    bio: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    credentials: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, isActive, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const count = (await ctx.db.query("teamMembers").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("teamMembers", {
      siteId,
      isActive: isActive ?? true,
      order: count,
      ...fields,
    });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "team member", page: "Team Manager", details: fields.name });
    const doc = (await ctx.db.get(id))!;
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    memberId: v.id("teamMembers"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    bio: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    credentials: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, memberId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(memberId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.patch(memberId, fields);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "team member", page: "Team Manager", details: existing.name });
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), memberId: v.id("teamMembers") },
  handler: async (ctx, { siteId, memberId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(memberId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.delete(memberId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "team member", page: "Team Manager", details: existing.name });
  },
});

export const reorder = mutation({
  args: {
    siteId: v.id("sites"),
    orderedIds: v.array(v.id("teamMembers")),
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
