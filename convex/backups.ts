import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString() };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db.query("backups").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").collect();
    return docs.map(toResponse);
  },
});

export const create = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);

    const [homepage, footer, contact, courses, events, articles, seo, media, square, email, crm] = await Promise.all([
      ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("crmConnections").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
    ]);

    const snapshot = { homepage, footer, contact, courses, events, articles, seo, media, square, email, crm };
    const snapshotStr = JSON.stringify(snapshot);
    const sizeBytes = new TextEncoder().encode(snapshotStr).length;
    const label = `Backup ${new Date().toLocaleString("en-US")}`;

    const id = await ctx.db.insert("backups", { siteId, label, sizeBytes, snapshot });
    return toResponse((await ctx.db.get(id))!);
  },
});

export const restore = mutation({
  args: { siteId: v.id("sites"), backupId: v.id("backups") },
  handler: async (ctx, { siteId, backupId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const backup = await ctx.db.get(backupId);
    if (!backup) throw new Error("Backup not found");
    if (backup.siteId !== siteId) throw new Error("Forbidden");

    const snap = backup.snapshot as any;

    if (snap.homepage) {
      const ex = await ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
      const { _id, _creationTime, ...fields } = snap.homepage;
      if (ex) await ctx.db.patch(ex._id, fields);
      else await ctx.db.insert("homepageContent", { siteId, ...fields });
    }
    if (snap.footer) {
      const ex = await ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
      const { _id, _creationTime, ...fields } = snap.footer;
      if (ex) await ctx.db.patch(ex._id, fields);
      else await ctx.db.insert("footerContent", { siteId, ...fields });
    }
    if (snap.contact) {
      const ex = await ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
      const { _id, _creationTime, ...fields } = snap.contact;
      if (ex) await ctx.db.patch(ex._id, fields);
      else await ctx.db.insert("contactInfo", { siteId, ...fields });
    }

    return { success: true, restoredAt: new Date().toISOString() };
  },
});

export const getAllSiteIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").collect();
    return sites.map((s) => s._id);
  },
});

export const createForSite = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const [homepage, footer, contact, courses, events, articles, seo, media, square, email, crm] = await Promise.all([
      ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("crmConnections").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
    ]);
    const snapshot = { homepage, footer, contact, courses, events, articles, seo, media, square, email, crm };
    const sizeBytes = new TextEncoder().encode(JSON.stringify(snapshot)).length;
    const label = `Auto-backup ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`;
    await ctx.db.insert("backups", { siteId, label, sizeBytes, snapshot });
  },
});

export const autoBackupAllSites = internalMutation({
  args: {},
  handler: async (ctx) => {
    const siteIds = await ctx.db.query("sites").collect().then((s) => s.map((x) => x._id));
    for (const siteId of siteIds) {
      const [homepage, footer, contact, courses, events, articles, seo, media, square, email, crm] = await Promise.all([
        ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("crmConnections").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ]);
      const snapshot = { homepage, footer, contact, courses, events, articles, seo, media, square, email, crm };
      const sizeBytes = new TextEncoder().encode(JSON.stringify(snapshot)).length;
      const label = `Auto-backup ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`;
      await ctx.db.insert("backups", { siteId, label, sizeBytes, snapshot });
    }
  },
});
