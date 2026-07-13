import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, checkModuleEnabled, requireSiteAccessMutation, requireModuleEnabled } from "./lib/requireSiteAccess";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, updatedAt: new Date(doc._creationTime).toISOString() };
}

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "homepage")) return null;
    const doc = await ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (!doc) return { siteId, heroHeadline: "", heroSubheadline: "", heroImageUrl: null, sections: [], updatedAt: new Date().toISOString() };
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    heroHeadline: v.optional(v.string()),
    heroSubheadline: v.optional(v.string()),
    heroImageUrl: v.optional(v.string()),
    sections: v.optional(v.any()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    await requireModuleEnabled(ctx, siteId, "homepage");
    const existing = await ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, fields as any);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("homepageContent", { siteId, heroHeadline: "", heroSubheadline: "", sections: [], ...fields });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "homepage", page: "Homepage", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "homepage", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});
