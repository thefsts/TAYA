import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, checkModuleEnabled, requireDesignCapability, requireModuleEnabled } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";
import { recordVersion } from "./lib/recordVersion";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, updatedAt: new Date(doc._creationTime).toISOString() };
}

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "email")) return null;
    const doc = await ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (!doc) return { siteId, fromName: "", fromEmail: "", replyToEmail: "", notifyOnNewLead: true, notifyOnBooking: true, updatedAt: new Date().toISOString() };
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    fromName: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
    replyToEmail: v.optional(v.string()),
    notifyOnNewLead: v.optional(v.boolean()),
    notifyOnBooking: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireDesignCapability(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "email");
    const existing = await ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, fields as any);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("emailSettings", { siteId, fromName: "", fromEmail: "", replyToEmail: "", notifyOnNewLead: true, notifyOnBooking: true, ...fields });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "email_settings", page: "Email Config", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "email_settings", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});
