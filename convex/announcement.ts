import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db
      .query("announcementBanner")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    return doc ? { ...doc, id: doc._id } : null;
  },
});

export const upsert = mutation({
  args: {
    siteId: v.id("sites"),
    text: v.string(),
    bgColor: v.string(),
    link: v.optional(v.string()),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db
      .query("announcementBanner")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "announcement banner", page: "Announcement Banner" });
      return existing._id;
    } else {
      const id = await ctx.db.insert("announcementBanner", { siteId, ...fields });
      await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "announcement banner", page: "Announcement Banner" });
      return id;
    }
  },
});
