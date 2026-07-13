import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, checkModuleEnabled, requireSiteAccessMutation, requireModuleEnabled } from "./lib/requireSiteAccess";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString(), updatedAt: new Date(doc._creationTime).toISOString(), startAt: new Date(doc.startAt).toISOString(), endAt: doc.endAt ? new Date(doc.endAt).toISOString() : null };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "events")) return [];
    return (await ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const get = query({
  args: { siteId: v.id("sites"), eventId: v.id("events") },
  handler: async (ctx, { siteId, eventId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "events")) return null;
    const doc = await ctx.db.get(eventId);
    if (!doc || doc.siteId !== siteId) return null;
    return toResponse(doc);
  },
});

async function syncEventMapping(ctx: any, siteId: any, entityId: string, squareItemId: string | undefined) {
  if (!squareItemId) return;
  const catalogItem = await ctx.db.query("squareCatalogItems")
    .withIndex("by_site_squareItemId", (q: any) => q.eq("siteId", siteId).eq("squareItemId", squareItemId))
    .first();
  const existing = await ctx.db.query("squareCatalogMappings")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .filter((q: any) => q.and(q.eq(q.field("entityType"), "event"), q.eq(q.field("entityId"), entityId)))
    .first();
  const patch = { squareItemId, squareVariationId: catalogItem?.squareVariationId };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("squareCatalogMappings", { siteId, entityType: "event", entityId, ...patch });
  }
}

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
    squareItemId: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, startAt, endAt, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "events");
    const id = await ctx.db.insert("events", { siteId, status: "draft", startAt: new Date(startAt).getTime(), endAt: endAt ? new Date(endAt).getTime() : undefined, ...fields });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "event", entityId: id, page: "Events", newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "event", entityId: id, snapshot: doc });
    if (fields.squareItemId) await syncEventMapping(ctx, siteId, id, fields.squareItemId);
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
    squareItemId: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, eventId, startAt, endAt, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "events");
    const existing = await ctx.db.get(eventId);
    if (!existing || existing.siteId !== siteId) throw new Error("Event not found");
    const patch: Record<string, unknown> = { ...fields };
    if (startAt) patch.startAt = new Date(startAt).getTime();
    if (endAt !== undefined) patch.endAt = endAt ? new Date(endAt).getTime() : undefined;
    await ctx.db.patch(eventId, patch as any);
    const doc = (await ctx.db.get(eventId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "event", entityId: eventId, page: "Events", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "event", entityId: eventId, snapshot: doc });
    if ("squareItemId" in fields) await syncEventMapping(ctx, siteId, eventId, fields.squareItemId);
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), eventId: v.id("events") },
  handler: async (ctx, { siteId, eventId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "events");
    const existing = await ctx.db.get(eventId);
    if (!existing || existing.siteId !== siteId) throw new Error("Event not found");
    await ctx.db.delete(eventId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "event", entityId: eventId, page: "Events", previousValue: existing });
    return { success: true };
  },
});
