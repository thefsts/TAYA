import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString(), updatedAt: new Date(doc._creationTime).toISOString(), startAt: new Date(doc.startAt).toISOString(), endAt: doc.endAt ? new Date(doc.endAt).toISOString() : null };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return (await ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const get = query({
  args: { siteId: v.id("sites"), eventId: v.id("events") },
  handler: async (ctx, { siteId, eventId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db.get(eventId);
    if (!doc || doc.siteId !== siteId) return null;
    return toResponse(doc);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    description: v.string(),
    startAt: v.string(),
    endAt: v.optional(v.string()),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, startAt, endAt, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const id = await ctx.db.insert("events", { siteId, status: "draft", startAt: new Date(startAt).getTime(), endAt: endAt ? new Date(endAt).getTime() : undefined, ...fields });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "event", entityId: id, page: "Events", newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "event", entityId: id, snapshot: doc });
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    eventId: v.id("events"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    status: v.optional(v.string()),
    description: v.optional(v.string()),
    startAt: v.optional(v.string()),
    endAt: v.optional(v.string()),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, eventId, startAt, endAt, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(eventId);
    if (!existing || existing.siteId !== siteId) throw new Error("Event not found");
    const patch: Record<string, unknown> = { ...fields };
    if (startAt) patch.startAt = new Date(startAt).getTime();
    if (endAt !== undefined) patch.endAt = endAt ? new Date(endAt).getTime() : undefined;
    await ctx.db.patch(eventId, patch as any);
    const doc = (await ctx.db.get(eventId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "event", entityId: eventId, page: "Events", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "event", entityId: eventId, snapshot: doc });
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), eventId: v.id("events") },
  handler: async (ctx, { siteId, eventId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(eventId);
    if (!existing || existing.siteId !== siteId) throw new Error("Event not found");
    await ctx.db.delete(eventId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "event", entityId: eventId, page: "Events", previousValue: existing });
    return { success: true };
  },
});
