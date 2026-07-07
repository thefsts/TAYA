import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString() };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db.query("contentVersions").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").collect();
    return docs.map(toResponse);
  },
});

export const restore = mutation({
  args: { siteId: v.id("sites"), versionId: v.id("contentVersions") },
  handler: async (ctx, { siteId, versionId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const version = await ctx.db.get(versionId);
    if (!version) throw new Error("Version not found");
    if (version.siteId !== siteId) throw new Error("Forbidden");

    const snap = version.snapshot as any;
    const { _id: _snapId, _creationTime: _snapTime, ...fields } = snap;

    if (version.entityType === "homepage") {
      const ex = await ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
      if (ex) await ctx.db.patch(ex._id, fields);
      else await ctx.db.insert("homepageContent", { siteId, ...fields });
    } else if (version.entityType === "footer") {
      const ex = await ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
      if (ex) await ctx.db.patch(ex._id, fields);
      else await ctx.db.insert("footerContent", { siteId, ...fields });
    } else if (version.entityType === "contact_info") {
      const ex = await ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
      if (ex) await ctx.db.patch(ex._id, fields);
      else await ctx.db.insert("contactInfo", { siteId, ...fields });
    } else {
      const existing = _snapId ? await ctx.db.get(_snapId) : null;
      if (existing && (existing as any).siteId === siteId) {
        await ctx.db.patch(_snapId, fields);
      }
    }

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "restored",
      entityType: version.entityType,
      entityId: version.entityId,
      page: "Version History",
    });

    return { success: true, restoredAt: new Date().toISOString(), entityType: version.entityType };
  },
});
