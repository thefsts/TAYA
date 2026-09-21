import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, checkModuleEnabled, requireModuleEnabled } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";
import { recordVersion } from "./lib/recordVersion";

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, updatedAt: new Date(doc._creationTime).toISOString() };
}

/**
 * Chat D — canonical page-path normalization for the discovery import.
 * Ensures a discovered path ("/about/") and a hand-created row ("/about")
 * are treated as the same page so owner edits are never duplicated or
 * overwritten by an import.
 */
function normalizePagePath(path: string): string {
  const trimmed = (path ?? "").trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "seo")) return [];
    return (await ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    pagePath: v.string(),
    title: v.string(),
    description: v.string(),
    ogImageUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    noindex: v.optional(v.boolean()),
    ogTitle: v.optional(v.string()),
    ogDescription: v.optional(v.string()),
    twitterCardType: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    await requireModuleEnabled(ctx, siteId, "seo");
    const id = await ctx.db.insert("seoSettings", { siteId, ...fields });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "seo_setting", entityId: id, page: "SEO Settings", newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "seo_setting", entityId: id, snapshot: doc });
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    seoSettingId: v.id("seoSettings"),
    pagePath: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    noindex: v.optional(v.boolean()),
    ogTitle: v.optional(v.string()),
    ogDescription: v.optional(v.string()),
    twitterCardType: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, seoSettingId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    await requireModuleEnabled(ctx, siteId, "seo");
    const existing = await ctx.db.get(seoSettingId);
    if (!existing || existing.siteId !== siteId) throw new Error("SEO setting not found");
    await ctx.db.patch(seoSettingId, fields as any);
    const doc = (await ctx.db.get(seoSettingId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "seo_setting", entityId: seoSettingId, page: "SEO Settings", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "seo_setting", entityId: seoSettingId, snapshot: doc });
    return toResponse(doc);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), seoSettingId: v.id("seoSettings") },
  handler: async (ctx, { siteId, seoSettingId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    await requireModuleEnabled(ctx, siteId, "seo");
    const existing = await ctx.db.get(seoSettingId);
    if (!existing || existing.siteId !== siteId) throw new Error("SEO setting not found");
    await ctx.db.delete(seoSettingId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "seo_setting", entityId: seoSettingId, page: "SEO Settings", previousValue: existing });
    return { success: true };
  },
});

// Chat D (client website management completion) — import live-site SEO.
//   Reads the latest discovery snapshot (the client's own public site, §16
//   read-only crawl) and creates seoSettings rows for pages whose live meta
//   was extracted. NEVER OVERWRITES OWNER EDITS: a row is created only when
//   no seoSettings row already exists for that pagePath. Pages whose live
//   title AND description are both empty are skipped (no fabricated data,
//   §14). Empty live fields stay empty in the created row so the owner can
//   fill them in the editor.
export const importFromDiscovery = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    await requireModuleEnabled(ctx, siteId, "seo");

    const site = await ctx.db.get(siteId);
    if (!site) throw new Error("Site not found");
    const snapshotDoc = await ctx.db
      .query("discoverySnapshots")
      .withIndex("by_site_startedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .first();
    if (!snapshotDoc) {
      throw new Error("No discovery snapshot yet — run a site scan first (Site Discovery).");
    }
    const snapshot = snapshotDoc.snapshot as {
      pages?: Array<{
        path?: string | null;
        status?: string | null;
        model?: {
          meta?: {
            title?: string | null;
            description?: string | null;
            ogTitle?: string | null;
            ogDescription?: string | null;
            ogImage?: string | null;
            canonical?: string | null;
          } | null;
        } | null;
      }>;
    };

    const existingRows = await ctx.db
      .query("seoSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    const existingPaths = new Set(existingRows.map((row: any) => normalizePagePath(row.pagePath)));

    let createdCount = 0;
    let skippedExisting = 0;
    let skippedEmpty = 0;
    const createdPaths: string[] = [];
    const skippedExistingPaths: string[] = [];

    for (const page of snapshot.pages ?? []) {
      if (page.status !== "fetched" || !page.model) continue;
      const pagePath = normalizePagePath(page.path ?? "/");
      if (existingPaths.has(pagePath)) {
        skippedExisting += 1;
        skippedExistingPaths.push(pagePath);
        continue;
      }
      const meta = page.model.meta ?? {};
      const title = (meta.title ?? "").toString().trim();
      const description = (meta.description ?? "").toString().trim();
      // §14 — never fabricate: skip pages where the live site has no title
      // AND no description to import.
      if (!title && !description) {
        skippedEmpty += 1;
        continue;
      }
      const id = await ctx.db.insert("seoSettings", {
        siteId,
        pagePath,
        title,
        description,
        ogImageUrl: (meta.ogImage ?? "").toString().trim() || undefined,
        canonicalUrl: (meta.canonical ?? "").toString().trim() || undefined,
        ogTitle: (meta.ogTitle ?? "").toString().trim() || undefined,
        ogDescription: (meta.ogDescription ?? "").toString().trim() || undefined,
        importedFromDiscovery: true,
      });
      existingPaths.add(pagePath); // guard against duplicate paths in one snapshot
      createdCount += 1;
      createdPaths.push(pagePath);
      const doc = (await ctx.db.get(id))!;
      await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "seo_setting", entityId: id, page: "SEO Settings", details: `imported from live site: ${pagePath}`, newValue: doc });
    }

    return {
      created: createdCount,
      skippedExisting: skippedExisting,
      skippedEmpty: skippedEmpty,
      createdPaths,
      skippedExistingPaths,
    };
  },
});
