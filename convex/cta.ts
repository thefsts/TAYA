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
      .query("siteCtaConfig")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    return doc ? { ...doc, id: doc._id } : null;
  },
});

export const upsert = mutation({
  args: {
    siteId: v.id("sites"),
    primaryLabel: v.string(),
    primaryUrl: v.string(),
    secondaryLabel: v.optional(v.string()),
    secondaryUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db
      .query("siteCtaConfig")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "CTA config", page: "CTA Manager" });
      return existing._id;
    } else {
      const id = await ctx.db.insert("siteCtaConfig", { siteId, ...fields });
      await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "CTA config", page: "CTA Manager" });
      return id;
    }
  },
});
