import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, checkModuleEnabled, requireDesignCapability, requireModuleEnabled } from "./lib/requireSiteAccess";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, updatedAt: new Date(doc._creationTime).toISOString() };
}

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "footer")) return null;
    const doc = await ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (!doc) return { siteId, columns: [], socialLinks: [], copyrightText: "", updatedAt: new Date().toISOString() };
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    columns: v.optional(v.any()),
    socialLinks: v.optional(v.any()),
    copyrightText: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireDesignCapability(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "footer");
    const existing = await ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, fields as any);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("footerContent", { siteId, columns: [], socialLinks: [], copyrightText: "", ...fields });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "footer", page: "Footer", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "footer", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});
