import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";

export const POLICY_TYPES = ["privacy", "terms", "cookie", "accessibility"] as const;

const POLICY_LABELS: Record<string, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  cookie: "Cookie Policy",
  accessibility: "Accessibility Statement",
};

function deriveTitle(policyType: string): string {
  return POLICY_LABELS[policyType] ?? policyType;
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db
      .query("policyPages")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return docs.map((d) => ({ ...d, id: d._id, title: deriveTitle(d.policyType) }));
  },
});

export const get = query({
  args: { siteId: v.id("sites"), policyType: v.string() },
  handler: async (ctx, { siteId, policyType }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db
      .query("policyPages")
      .withIndex("by_site_type", (q) => q.eq("siteId", siteId).eq("policyType", policyType))
      .first();
    return doc ? { ...doc, id: doc._id, title: deriveTitle(doc.policyType) } : null;
  },
});

export const upsert = mutation({
  args: {
    siteId: v.id("sites"),
    policyType: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { siteId, policyType, content }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db
      .query("policyPages")
      .withIndex("by_site_type", (q) => q.eq("siteId", siteId).eq("policyType", policyType))
      .first();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { content, updatedAt });
      await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "policy", page: "Policy Editor", details: deriveTitle(policyType) });
      return existing._id;
    } else {
      const id = await ctx.db.insert("policyPages", { siteId, policyType, content, updatedAt });
      await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "policy", page: "Policy Editor", details: deriveTitle(policyType) });
      return id;
    }
  },
});
