import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db
      .query("popupConfig")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    return doc ? { ...doc, id: doc._id } : null;
  },
});

export const upsert = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    body: v.string(),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
    triggerType: v.string(),
    delaySecs: v.optional(v.number()),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db
      .query("popupConfig")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "popup config", page: "Popup Manager" });
      return existing._id;
    } else {
      const id = await ctx.db.insert("popupConfig", { siteId, ...fields });
      await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "popup config", page: "Popup Manager" });
      return id;
    }
  },
});
