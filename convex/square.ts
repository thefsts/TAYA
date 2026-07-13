import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

function toConfigResponse(doc: any) {
  const { accessToken: _redacted, applicationId: _appId, ...safe } = doc;
  return {
    ...safe,
    id: doc._id,
    siteId: doc.siteId,
    applicationIdLast4: doc.applicationId ? doc.applicationId.slice(-4) : null,
    hasAccessToken: Boolean(doc.accessToken),
    updatedAt: new Date(doc._creationTime).toISOString(),
  };
}

function toMappingResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString() };
}

export const getConfig = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (!doc) return { siteId, connected: false, environment: "sandbox", applicationIdLast4: null, locationId: null, checkoutEnabled: false, hasAccessToken: false, updatedAt: new Date().toISOString() };
    return toConfigResponse(doc);
  },
});

export const updateConfig = mutation({
  args: {
    siteId: v.id("sites"),
    environment: v.optional(v.string()),
    applicationId: v.optional(v.string()),
    locationId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    checkoutEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    const connected = Boolean((fields.applicationId ?? existing?.applicationId) && (fields.locationId ?? existing?.locationId) && (fields.accessToken ?? existing?.accessToken));
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, connected });
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("squareConfig", { siteId, connected, environment: "sandbox", checkoutEnabled: false, ...fields });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "square_config", page: "Payments", previousValue: existing ? toConfigResponse(existing) : undefined, newValue: toConfigResponse(doc) });
    return toConfigResponse(doc);
  },
});

export const listMappings = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return (await ctx.db.query("squareCatalogMappings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toMappingResponse);
  },
});

export const createMapping = mutation({
  args: {
    siteId: v.id("sites"),
    entityType: v.string(),
    entityId: v.string(),
    squareItemId: v.string(),
    squareVariationId: v.string(),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const id = await ctx.db.insert("squareCatalogMappings", { siteId, ...fields });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "square_mapping", entityId: id, page: "Payments", newValue: doc });
    return toMappingResponse(doc);
  },
});

export const updateMapping = mutation({
  args: {
    siteId: v.id("sites"),
    mappingId: v.id("squareCatalogMappings"),
    squareItemId: v.optional(v.string()),
    squareVariationId: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, mappingId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(mappingId);
    if (!existing || existing.siteId !== siteId) throw new Error("Mapping not found");
    await ctx.db.patch(mappingId, fields as any);
    const doc = (await ctx.db.get(mappingId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "square_mapping", entityId: mappingId, page: "Payments", previousValue: existing, newValue: doc });
    return toMappingResponse(doc);
  },
});

export const removeMapping = mutation({
  args: { siteId: v.id("sites"), mappingId: v.id("squareCatalogMappings") },
  handler: async (ctx, { siteId, mappingId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(mappingId);
    if (!existing || existing.siteId !== siteId) throw new Error("Mapping not found");
    await ctx.db.delete(mappingId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "square_mapping", entityId: mappingId, page: "Payments", previousValue: existing });
    return { success: true };
  },
});

// ── Internal helpers used by squareOrders action + webhook ───────────────────

export const getConfigInternal = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    return ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
  },
});

export const updateRefundStatus = internalMutation({
  args: { siteId: v.id("sites"), squarePaymentId: v.string(), refundStatus: v.string() },
  handler: async (ctx, { siteId, squarePaymentId, refundStatus }) => {
    const order = await ctx.db
      .query("squareOrders")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .filter((q) => q.eq(q.field("squarePaymentId"), squarePaymentId))
      .first();
    if (order) await ctx.db.patch(order._id, { refundStatus });
  },
});
